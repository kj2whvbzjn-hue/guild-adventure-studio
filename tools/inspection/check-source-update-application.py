#!/usr/bin/env python3
"""Validate a SOURCE_UPDATE against the exact source baseline it will overlay.

The Studio deployer uploads only files classified as ``persistent`` from the
update ZIP. Files omitted from the ZIP remain on GitHub unless they are listed
in an approved DELETE_MANIFEST. Therefore an update package can be internally
self-consistent while still producing an invalid deployed tree.

This checker reproduces that overlay model in a temporary directory and then
runs the normal source inspection against the *applied* tree.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
from zipfile import ZipFile, ZipInfo

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from system_file_policy import classify, load_policy  # noqa: E402


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def source_tree_sha256(root: Path) -> str:
    """Stable digest of the full source tree, including managed Export data."""
    records: list[str] = []
    for path in sorted(root.rglob("*"), key=lambda p: p.relative_to(root).as_posix()):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        records.append(f"{rel}\0{path.stat().st_size}\0{sha256_file(path)}")
    return hashlib.sha256("\n".join(records).encode("utf-8")).hexdigest()


def common_top_level(file_names: list[str]) -> str | None:
    tops: list[str] = []
    for name in file_names:
        parts = PurePosixPath(name).parts
        if parts:
            tops.append(parts[0])
    return tops[0] if tops and len(set(tops)) == 1 else None


def strip_top(name: str, top: str | None) -> str:
    parts = PurePosixPath(name).parts
    if top and parts and parts[0] == top:
        parts = parts[1:]
    return PurePosixPath(*parts).as_posix() if parts else ""


def zipinfo_is_symlink(info: ZipInfo) -> bool:
    # Upper 16 bits carry the Unix mode when present.
    mode = (info.external_attr >> 16) & 0xFFFF
    return (mode & 0o170000) == 0o120000


def extract_source_zip(zip_path: Path, destination: Path) -> None:
    with ZipFile(zip_path) as zf:
        infos = [info for info in zf.infolist() if not info.is_dir()]
        names = [info.filename.replace("\\", "/") for info in infos]
        top = common_top_level(names)
        seen: set[str] = set()
        for info, raw_name in zip(infos, names):
            if zipinfo_is_symlink(info):
                raise ValueError(f"BASELINE_ZIP_SYMLINK {raw_name}")
            rel = strip_top(raw_name, top)
            if not rel:
                continue
            posix = PurePosixPath(rel)
            if posix.is_absolute() or ".." in posix.parts or "" in posix.parts:
                raise ValueError(f"BASELINE_ZIP_UNSAFE_PATH {raw_name}")
            if rel in seen:
                raise ValueError(f"BASELINE_ZIP_DUPLICATE_PATH {rel}")
            seen.add(rel)
            target = destination / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zf.read(info))


def run_checked(command: list[str], cwd: Path, timeout: int = 180) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.pop("PYTHONPYCACHEPREFIX", None)
    return subprocess.run(
        command,
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
    )




def is_inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False

def parse_delete_manifest(update_root: Path) -> list[str]:
    path = update_root / "DELETE_MANIFEST.txt"
    if not path.is_file():
        return []
    out: list[str] = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        rel = raw.strip()
        if rel and not rel.startswith("#"):
            out.append(PurePosixPath(rel).as_posix())
    return out


def parse_studio_build(value: object) -> int | None:
    match = re.fullmatch(r"GKS-B(\d+)", str(value or ""))
    return int(match.group(1)) if match else None


def expected_artifact_id(studio_build: str, source_tree_sha: str) -> str:
    return f"{studio_build}-{source_tree_sha[:12]}"


def baseline_manifest_repairable(context_output: str, manifest_output: str) -> tuple[bool, list[str]]:
    """Allow only the narrow migration case where an old manifest lists files
    that the current system-file policy now classifies as nonpersistent.

    The baseline remains cryptographically bound by studio-update.json. Any other
    baseline error still fails closed. The applied target must pass the normal
    source context and package-manifest checks later in this gate.
    """
    ctx_paths: list[str] = []
    man_paths: list[str] = []
    for raw in context_output.splitlines():
        line = raw.strip()
        if not line or line == "INSPECTION_CONTEXT_FAIL":
            continue
        prefix = "NONPERSISTENT_FILE_LISTED "
        if not line.startswith(prefix):
            return False, []
        ctx_paths.append(line[len(prefix):])
    for raw in manifest_output.splitlines():
        line = raw.strip()
        if not line or line == "PACKAGE_MANIFEST_FAIL":
            continue
        prefix = "NONPERSISTENT_LISTED "
        if not line.startswith(prefix):
            return False, []
        man_paths.append(line[len(prefix):])
    paths = sorted(set(ctx_paths))
    return bool(paths) and paths == sorted(set(man_paths)), paths


def baseline_exact_missing_restore_repairable(update_root: Path, baseline_root: Path, manifest_output: str) -> tuple[bool, list[str]]:
    """Allow repair only when the baseline manifest lists a persistent file that
    is physically missing, and the update restores the exact bytes recorded by
    that baseline manifest. No hash drift or extra baseline error is accepted.
    """
    missing: list[str] = []
    unexpected: list[str] = []
    for raw in manifest_output.splitlines():
        line = raw.strip()
        if not line or line == "PACKAGE_MANIFEST_FAIL":
            continue
        if line.startswith("MISSING "):
            missing.append(line[len("MISSING "):])
            continue
        if line.startswith("UNEXPECTED_LISTED "):
            unexpected.append(line[len("UNEXPECTED_LISTED "):])
            continue
        return False, []
    paths = sorted(set(missing))
    if not paths or paths != sorted(set(unexpected)):
        return False, []
    try:
        manifest = json.loads((baseline_root / "package_manifest.json").read_text(encoding="utf-8"))
        by_path = {str(row.get("path") or ""): row for row in manifest.get("files", [])}
        policy = load_policy(baseline_root)
    except Exception:
        return False, []
    for rel in paths:
        spec = by_path.get(rel)
        restored = update_root / rel
        if not isinstance(spec, dict) or classify(rel, policy) != "persistent" or not restored.is_file():
            return False, []
        if int(spec.get("size", -1)) != restored.stat().st_size:
            return False, []
        expected = str(spec.get("sha256") or "").lower()
        if not re.fullmatch(r"[0-9a-f]{64}", expected) or sha256_file(restored) != expected:
            return False, []
    return True, paths


def validate_baseline_binding(update_root: Path, baseline_root: Path, errors: list[str]) -> dict:
    meta_path = update_root / "studio-update.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"UPDATE_METADATA_INVALID {exc}")
        return {}
    binding = meta.get("baseline_source")
    if not isinstance(binding, dict):
        errors.append("BASELINE_BINDING_MISSING studio-update.json:baseline_source")
        return {}
    try:
        build = json.loads((baseline_root / "package-build.json").read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"BASELINE_PACKAGE_BUILD_INVALID {exc}")
        build = {}
    expected_game = binding.get("game_build")
    expected_studio = binding.get("studio_build")
    if expected_game != build.get("game_build"):
        errors.append(
            f"BASELINE_GAME_BUILD_MISMATCH expected={expected_game!r} actual={build.get('game_build')!r}"
        )
    if expected_studio != build.get("studio_build"):
        errors.append(
            f"BASELINE_STUDIO_BUILD_MISMATCH expected={expected_studio!r} actual={build.get('studio_build')!r}"
        )
    manifest_path = baseline_root / "package_manifest.json"
    actual_manifest_sha = sha256_file(manifest_path) if manifest_path.is_file() else None
    expected_manifest_sha = binding.get("package_manifest_sha256")
    if expected_manifest_sha != actual_manifest_sha:
        errors.append(
            "BASELINE_PACKAGE_MANIFEST_SHA256_MISMATCH "
            f"expected={expected_manifest_sha!r} actual={actual_manifest_sha!r}"
        )
    actual_tree_sha = source_tree_sha256(baseline_root)
    expected_tree_sha = binding.get("source_tree_sha256")
    if expected_tree_sha != actual_tree_sha:
        errors.append(
            f"BASELINE_SOURCE_TREE_SHA256_MISMATCH expected={expected_tree_sha!r} actual={actual_tree_sha!r}"
        )
    return {
        "game_build": build.get("game_build"),
        "studio_build": build.get("studio_build"),
        "package_manifest_sha256": actual_manifest_sha,
        "source_tree_sha256": actual_tree_sha,
    }


def validate_target_binding(update_root: Path, baseline_info: dict, applied_root: Path, errors: list[str]) -> dict:
    meta_path = update_root / "studio-update.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"UPDATE_METADATA_INVALID {exc}")
        return {}
    target = meta.get("target_source")
    if not isinstance(target, dict):
        errors.append("TARGET_BINDING_MISSING studio-update.json:target_source")
        return {}
    artifact_id = str(meta.get("artifact_id") or "")
    try:
        build = json.loads((applied_root / "package-build.json").read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"TARGET_PACKAGE_BUILD_INVALID {exc}")
        build = {}

    actual_game = build.get("game_build")
    actual_studio = build.get("studio_build")
    if target.get("game_build") != actual_game:
        errors.append(f"TARGET_GAME_BUILD_MISMATCH expected={target.get('game_build')!r} actual={actual_game!r}")
    if target.get("studio_build") != actual_studio:
        errors.append(f"TARGET_STUDIO_BUILD_MISMATCH expected={target.get('studio_build')!r} actual={actual_studio!r}")

    baseline_studio = baseline_info.get("studio_build")
    baseline_num = parse_studio_build(baseline_studio)
    target_num = parse_studio_build(actual_studio)
    if baseline_num is None or target_num is None:
        errors.append(f"STUDIO_BUILD_TRANSITION_INVALID baseline={baseline_studio!r} target={actual_studio!r}")
    elif target_num <= baseline_num:
        errors.append(f"STUDIO_BUILD_TRANSITION_NOT_FORWARD baseline={baseline_studio} target={actual_studio}")

    manifest_path = applied_root / "package_manifest.json"
    actual_manifest_sha = sha256_file(manifest_path) if manifest_path.is_file() else None
    expected_manifest_sha = target.get("package_manifest_sha256")
    if expected_manifest_sha != actual_manifest_sha:
        errors.append(
            "TARGET_PACKAGE_MANIFEST_SHA256_MISMATCH "
            f"expected={expected_manifest_sha!r} actual={actual_manifest_sha!r}"
        )
    actual_tree_sha = source_tree_sha256(applied_root)
    expected_tree_sha = target.get("source_tree_sha256")
    if expected_tree_sha != actual_tree_sha:
        errors.append(f"TARGET_SOURCE_TREE_SHA256_MISMATCH expected={expected_tree_sha!r} actual={actual_tree_sha!r}")

    if not re.fullmatch(r"GKS-B\d+-[0-9a-f]{12}", artifact_id):
        errors.append(f"ARTIFACT_ID_INVALID {artifact_id!r}")
    elif actual_studio and actual_tree_sha:
        expected_id = expected_artifact_id(str(actual_studio), actual_tree_sha)
        if artifact_id != expected_id:
            errors.append(f"ARTIFACT_ID_MISMATCH expected={expected_id} actual={artifact_id}")

    return {
        "game_build": actual_game,
        "studio_build": actual_studio,
        "package_manifest_sha256": actual_manifest_sha,
        "source_tree_sha256": actual_tree_sha,
        "artifact_id": artifact_id,
    }


def apply_update(update_root: Path, baseline_root: Path, applied_root: Path, errors: list[str]) -> dict:
    shutil.copytree(baseline_root, applied_root, dirs_exist_ok=True)
    policy = load_policy(update_root)
    allowed_upload = set(policy.get("rules", {}).get("studio_upload_classes", ["persistent"]))
    copied: list[str] = []
    skipped: list[str] = []
    forbidden: list[str] = []
    game_data_update_paths: list[str] = []

    for path in sorted(update_root.rglob("*"), key=lambda p: p.relative_to(update_root).as_posix()):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = path.relative_to(update_root).as_posix()
        file_class = classify(rel, policy)
        if file_class == "game_data":
            game_data_update_paths.append(rel)
        if file_class in allowed_upload:
            target = applied_root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            copied.append(rel)
        else:
            skipped.append(rel)
            if file_class not in {"update_only"}:
                forbidden.append(f"{file_class}:{rel}")

    if game_data_update_paths:
        errors.append("UPDATE_CONTAINS_GAME_DATA " + ",".join(game_data_update_paths[:20]))
    if forbidden:
        errors.append("UPDATE_CONTAINS_NONUPLOADABLE " + ",".join(forbidden[:20]))

    # Deletion policy is validated independently by check-delete-manifest.py in
    # the normal update Gate. Here we reproduce the intended applied state.
    deleted: list[str] = []
    missing_delete_targets: list[str] = []
    for rel in parse_delete_manifest(update_root):
        target = applied_root / rel
        if target.is_file() or target.is_symlink():
            target.unlink()
            deleted.append(rel)
        elif target.exists() and target.is_dir():
            errors.append(f"DELETE_TARGET_DIRECTORY_FORBIDDEN {rel}")
        else:
            missing_delete_targets.append(rel)

    # Source updates must never mutate baseline game data. The update-only
    # metadata is intentionally not copied into the applied source tree.
    changed_game_data: list[str] = []
    for path in baseline_root.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = path.relative_to(baseline_root).as_posix()
        if classify(rel, policy) != "game_data":
            continue
        other = applied_root / rel
        if not other.is_file() or sha256_file(path) != sha256_file(other):
            changed_game_data.append(rel)
    if changed_game_data:
        errors.append("APPLIED_GAME_DATA_CHANGED " + ",".join(changed_game_data[:20]))

    return {
        "copied_persistent_count": len(copied),
        "skipped_update_only_count": sum(1 for rel in skipped if classify(rel, policy) == "update_only"),
        "deleted_count": len(deleted),
        "missing_delete_targets": missing_delete_targets,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("update_root", type=Path)
    baseline = parser.add_mutually_exclusive_group(required=True)
    baseline.add_argument("--baseline-source", type=Path)
    baseline.add_argument("--baseline-zip", type=Path)
    parser.add_argument("--final-gate", choices=("manifest", "quick", "impact", "accept", "full"), default="accept")
    parser.add_argument("--timeout-per-test", type=int, default=30)
    parser.add_argument("--test-change-approval", type=Path, help="External human approval for protected test/Gate changes. Must not be inside the update or baseline tree.")
    parser.add_argument("--json-output", type=Path)
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    update_root = args.update_root.resolve()
    test_change_approval = args.test_change_approval.resolve() if args.test_change_approval else None
    errors: list[str] = []
    if (update_root / "TEST_CHANGE_APPROVAL.json").exists():
        errors.append("PACKAGED_TEST_CHANGE_APPROVAL_FORBIDDEN")
    if test_change_approval is not None:
        if not test_change_approval.is_file():
            errors.append(f"TEST_CHANGE_APPROVAL_NOT_FOUND {test_change_approval}")
        elif is_inside(test_change_approval, update_root):
            errors.append("TEST_CHANGE_APPROVAL_MUST_BE_EXTERNAL_TO_UPDATE")
    report: dict = {
        "schema_version": 1,
        "update_root": str(update_root),
        "final_gate": args.final_gate,
        "status": "fail",
        "test_change_approval": str(test_change_approval) if test_change_approval else None,
    }

    if not update_root.is_dir():
        print("SOURCE_UPDATE_APPLIED_STATE_FAIL")
        print(f"UPDATE_ROOT_NOT_FOUND {update_root}")
        return 1

    with tempfile.TemporaryDirectory(prefix="gk-source-update-apply-") as td:
        temp = Path(td)
        baseline_root: Path
        if args.baseline_source:
            baseline_root = args.baseline_source.resolve()
            if not baseline_root.is_dir():
                errors.append(f"BASELINE_SOURCE_NOT_FOUND {baseline_root}")
        else:
            baseline_zip = args.baseline_zip.resolve()
            baseline_root = temp / "baseline"
            baseline_root.mkdir(parents=True)
            if not baseline_zip.is_file():
                errors.append(f"BASELINE_ZIP_NOT_FOUND {baseline_zip}")
            else:
                try:
                    extract_source_zip(baseline_zip, baseline_root)
                except Exception as exc:
                    errors.append(f"BASELINE_ZIP_EXTRACT_FAIL {exc}")

        if test_change_approval is not None and baseline_root.exists() and is_inside(test_change_approval, baseline_root):
            errors.append("TEST_CHANGE_APPROVAL_MUST_BE_EXTERNAL_TO_BASELINE")

        if not errors:
            # Baselines fail closed, except for one bounded migration case: an old
            # package_manifest may still list files that the already-deployed
            # system-file policy classifies as nonpersistent. This repair mode is
            # necessary so the gate can accept the update that removes those stale
            # entries; all other baseline failures remain fatal.
            baseline_context = run_checked(
                [sys.executable, "-S", "-B", str(baseline_root / "tools/inspection/check-context.py"), str(baseline_root), "--context", "source"],
                baseline_root,
                args.timeout,
            )
            baseline_manifest = run_checked(
                [sys.executable, "-S", "-B", str(baseline_root / "tools/integrity/check-package-manifest.py"), str(baseline_root)],
                baseline_root,
                args.timeout,
            )
            if baseline_context.returncode != 0 or baseline_manifest.returncode != 0:
                repairable, stale_paths = baseline_manifest_repairable(
                    (baseline_context.stdout + baseline_context.stderr).strip(),
                    (baseline_manifest.stdout + baseline_manifest.stderr).strip(),
                )
                if repairable:
                    report["baseline_repair_mode"] = "nonpersistent_manifest_entries"
                    report["baseline_repair_paths"] = stale_paths
                else:
                    exact_restore, restore_paths = baseline_exact_missing_restore_repairable(
                        update_root, baseline_root, (baseline_manifest.stdout + baseline_manifest.stderr).strip()
                    )
                    if baseline_context.returncode == 0 and exact_restore:
                        report["baseline_repair_mode"] = "exact_missing_persistent_restore"
                        report["baseline_repair_paths"] = restore_paths
                    else:
                        if baseline_context.returncode != 0:
                            errors.append("BASELINE_CONTEXT_INVALID\n" + (baseline_context.stdout + baseline_context.stderr).strip())
                        if baseline_manifest.returncode != 0:
                            errors.append("BASELINE_PACKAGE_MANIFEST_INVALID\n" + (baseline_manifest.stdout + baseline_manifest.stderr).strip())

        if not errors:
            report["baseline"] = validate_baseline_binding(update_root, baseline_root, errors)

        applied_root = temp / "applied"
        if not errors:
            report["application"] = apply_update(update_root, baseline_root, applied_root, errors)
        if not errors:
            report["target"] = validate_target_binding(update_root, report.get("baseline", {}), applied_root, errors)

        final_proc: subprocess.CompletedProcess[str] | None = None
        impact_plan_path = temp / "impact-plan.json"
        integrity_report_path = temp / "test-integrity.json"
        if not errors:
            integrity_checker = baseline_root / "tools/integrity/check-test-integrity.py"
            if not integrity_checker.is_file():
                integrity_checker = update_root / "tools/integrity/check-test-integrity.py"
            if integrity_checker.is_file():
                integrity_cmd = [
                    sys.executable, "-S", "-B", str(integrity_checker),
                    str(baseline_root), str(applied_root),
                    "--json-output", str(integrity_report_path),
                ]
                if test_change_approval is not None:
                    integrity_cmd.extend(["--approval-file", str(test_change_approval)])
                integrity_proc = run_checked(integrity_cmd, baseline_root, args.timeout)
                report["test_integrity_returncode"] = integrity_proc.returncode
                if integrity_report_path.is_file():
                    report["test_integrity"] = json.loads(integrity_report_path.read_text(encoding="utf-8"))
                if integrity_proc.returncode != 0:
                    errors.append("TEST_INTEGRITY_GATE_FAILED\n" + (integrity_proc.stdout + integrity_proc.stderr).strip())
            elif args.final_gate in {"impact", "accept"}:
                errors.append("TEST_INTEGRITY_CHECKER_MISSING")

        selected_final_gate = args.final_gate
        if not errors and args.final_gate in {"impact", "accept"}:
            planner = baseline_root / "tools/inspection/plan-impact-tests.py"
            if not planner.is_file():
                planner = update_root / "tools/inspection/plan-impact-tests.py"
            if not planner.is_file():
                errors.append("IMPACT_PLANNER_MISSING")
            else:
                plan_cmd = [
                    sys.executable, "-S", "-B", str(planner),
                    str(baseline_root), str(applied_root),
                    "--json-output", str(impact_plan_path),
                ]
                if integrity_report_path.is_file():
                    plan_cmd.extend(["--test-integrity-report", str(integrity_report_path)])
                plan_proc = run_checked(plan_cmd, baseline_root, args.timeout)
                if plan_proc.returncode != 0:
                    errors.append("IMPACT_PLANNER_FAILED\n" + (plan_proc.stdout + plan_proc.stderr).strip())
                elif impact_plan_path.is_file():
                    report["impact_plan"] = json.loads(impact_plan_path.read_text(encoding="utf-8"))
                    mode = report["impact_plan"].get("mode")
                    if args.final_gate == "impact" and mode != "impact":
                        errors.append("IMPACT_GATE_ESCALATION_REQUIRED mode=" + str(mode))
                    selected_final_gate = "full" if mode == "full" else "impact"

        if not errors:
            if args.final_gate == "manifest":
                final_command = [
                    sys.executable, "-S", "-B",
                    str(applied_root / "tools/integrity/check-package-manifest.py"),
                    str(applied_root),
                ]
            else:
                profile = selected_final_gate if args.final_gate in {"impact", "accept"} else args.final_gate
                final_command = [
                    sys.executable, "-S", "-B",
                    str(applied_root / "tools/inspection/run.py"),
                    profile,
                    "--context", "source",
                    "--timeout", str(args.timeout),
                    "--timeout-per-test", str(args.timeout_per_test),
                ]
                if profile == "impact":
                    final_command.extend(["--test-selection", str(impact_plan_path)])
            final_proc = run_checked(final_command, applied_root, max(args.timeout * 4, 600))
            report["applied_tree_sha256"] = source_tree_sha256(applied_root)
            report["selected_final_gate"] = selected_final_gate
            report["final_gate_returncode"] = final_proc.returncode
            if final_proc.returncode != 0:
                errors.append("APPLIED_SOURCE_GATE_FAILED\n" + (final_proc.stdout + final_proc.stderr).strip())

    report["status"] = "fail" if errors else "pass"
    report["errors"] = errors
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if errors:
        print("SOURCE_UPDATE_APPLIED_STATE_FAIL")
        print("\n".join(errors))
        return 1
    print(
        "SOURCE_UPDATE_APPLIED_STATE_OK "
        f"final_gate={args.final_gate} selected={report.get('selected_final_gate', args.final_gate)} copied={report['application']['copied_persistent_count']} "
        f"deleted={report['application']['deleted_count']} applied_tree_sha256={report['applied_tree_sha256']}"
    )
    if final_proc and final_proc.stdout:
        # Keep the nested result visible without flooding the normal success path.
        tail = [line for line in final_proc.stdout.splitlines() if line.startswith("INSPECTION_")]
        if tail:
            print("APPLIED_" + tail[-1])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
