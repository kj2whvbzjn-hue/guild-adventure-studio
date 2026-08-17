#!/usr/bin/env python3
"""Regression tests for SOURCE_UPDATE applied-state and artifact-identity validation."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / "tools/inspection/check-source-update-application.py"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_sha(root: Path) -> str:
    rows = []
    for path in sorted(root.rglob("*"), key=lambda p: p.relative_to(root).as_posix()):
        if path.is_file() and ".git" not in path.parts:
            rel = path.relative_to(root).as_posix()
            rows.append(f"{rel}\0{path.stat().st_size}\0{sha256_file(path)}")
    return hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()


def copy_common(root: Path) -> None:
    for rel in (
        "shared/integrity/system-file-policy.json",
        "tools/inspection/system_file_policy.py",
        "tools/inspection/check-context.py",
        "tools/integrity/check-package-manifest.py",
    ):
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, target)


def load_fixture_policy(root: Path):
    spec = importlib.util.spec_from_file_location("fixture_policy", root / "tools/inspection/system_file_policy.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod, mod.load_policy(root)


def rebuild_manifest(root: Path) -> None:
    mod, policy = load_fixture_policy(root)
    items = []
    for path in sorted(root.rglob("*"), key=lambda p: p.relative_to(root).as_posix()):
        if not path.is_file() or path.name == "package_manifest.json" or ".git" in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        if mod.classify(rel, policy) != "persistent":
            continue
        data = path.read_bytes()
        items.append({"path": rel, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    write_json(root / "package_manifest.json", {
        "schema_version": 1,
        "generated_at": "2026-08-17T00:00:00+00:00",
        "file_count": len(items),
        "files": items,
    })


def make_baseline(root: Path) -> None:
    copy_common(root)
    write_json(root / "package-build.json", {"game_build": "GA-B1.1", "studio_build": "GKS-B100"})
    (root / "sample.txt").write_text("baseline\n", encoding="utf-8")
    exporter = root / "cpf/src/Export/CpfDemoRuntimeExporter.php"
    exporter.parent.mkdir(parents=True, exist_ok=True)
    exporter.write_text("<?php // active nested Export source\n", encoding="utf-8")
    rebuild_manifest(root)


def simulate_applied(update: Path, baseline: Path, destination: Path) -> None:
    shutil.copytree(baseline, destination)
    mod, policy = load_fixture_policy(update)
    allowed = set(policy.get("rules", {}).get("studio_upload_classes", ["persistent"]))
    for path in sorted(update.rglob("*"), key=lambda p: p.relative_to(update).as_posix()):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = path.relative_to(update).as_posix()
        if mod.classify(rel, policy) not in allowed:
            continue
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def make_update(root: Path, baseline: Path, include_exporter: bool, target_build: str = "GKS-B101") -> None:
    copy_common(root)
    write_json(root / "package-build.json", {"game_build": "GA-B1.1", "studio_build": target_build})
    (root / "sample.txt").write_text("updated\n", encoding="utf-8")
    if include_exporter:
        target = root / "cpf/src/Export/CpfDemoRuntimeExporter.php"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(baseline / "cpf/src/Export/CpfDemoRuntimeExporter.php", target)
    rebuild_manifest(root)

    simulated = root.parent / f"{root.name}-simulated"
    if simulated.exists():
        shutil.rmtree(simulated)
    simulate_applied(root, baseline, simulated)
    target_tree = tree_sha(simulated)
    write_json(root / "studio-update.json", {
        "version": target_build,
        "studio_version": target_build,
        "game_version": "GA-B1.1",
        "work_type": "SOURCE_UPDATE",
        "baseline_source": {
            "game_build": "GA-B1.1",
            "studio_build": "GKS-B100",
            "package_manifest_sha256": sha256_file(baseline / "package_manifest.json"),
            "source_tree_sha256": tree_sha(baseline),
        },
        "target_source": {
            "game_build": "GA-B1.1",
            "studio_build": target_build,
            "package_manifest_sha256": sha256_file(simulated / "package_manifest.json"),
            "source_tree_sha256": target_tree,
        },
        "artifact_id": f"{target_build}-{target_tree[:12]}",
    })
    (root / "DELETE_MANIFEST.txt").write_text("# no deletion\n", encoding="utf-8")
    shutil.rmtree(simulated)


def run_checker(update: Path, baseline: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, "-S", "-B", str(CHECKER), str(update), "--baseline-source", str(baseline), "--final-gate", "manifest"],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )


def main() -> int:
    errors: list[str] = []
    # The machine policy must distinguish the root Game-data Export from nested
    # source directories whose segment happens to be named Export.
    spec = importlib.util.spec_from_file_location("policy", ROOT / "tools/inspection/system_file_policy.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    policy = mod.load_policy(ROOT)
    if mod.classify("Export/ai/ai_nodes.json", policy) != "game_data":
        errors.append("ROOT_EXPORT_NOT_GAME_DATA")
    if mod.classify("cpf/src/Export/CpfDemoRuntimeExporter.php", policy) != "persistent":
        errors.append("NESTED_EXPORT_SOURCE_MISCLASSIFIED")

    with tempfile.TemporaryDirectory(prefix="gk-applied-state-regression-") as td:
        base = Path(td)
        baseline = base / "baseline"
        bad = base / "bad-update"
        good = base / "good-update"
        same_build = base / "same-build-update"
        baseline.mkdir(); bad.mkdir(); good.mkdir(); same_build.mkdir()
        make_baseline(baseline)
        make_update(bad, baseline, include_exporter=False)
        make_update(good, baseline, include_exporter=True)
        make_update(same_build, baseline, include_exporter=True, target_build="GKS-B100")

        bad_result = run_checker(bad, baseline)
        if bad_result.returncode == 0:
            errors.append("OMITTED_PERSISTENT_FILE_NOT_DETECTED")
        elif "UNLISTED cpf/src/Export/CpfDemoRuntimeExporter.php" not in (bad_result.stdout + bad_result.stderr):
            errors.append("OMITTED_PERSISTENT_FILE_WRONG_FAILURE " + (bad_result.stdout + bad_result.stderr))

        good_result = run_checker(good, baseline)
        if good_result.returncode != 0 or "SOURCE_UPDATE_APPLIED_STATE_OK" not in good_result.stdout:
            errors.append("COMPLETE_UPDATE_REJECTED " + (good_result.stdout + good_result.stderr))

        same_result = run_checker(same_build, baseline)
        if same_result.returncode == 0 or "STUDIO_BUILD_TRANSITION_NOT_FORWARD" not in (same_result.stdout + same_result.stderr):
            errors.append("SAME_BUILD_REUSE_NOT_REJECTED " + (same_result.stdout + same_result.stderr))

        bad_artifact = base / "bad-artifact-update"
        shutil.copytree(good, bad_artifact)
        meta = json.loads((bad_artifact / "studio-update.json").read_text(encoding="utf-8"))
        meta["artifact_id"] = "GKS-B101-000000000000"
        write_json(bad_artifact / "studio-update.json", meta)
        artifact_result = run_checker(bad_artifact, baseline)
        if artifact_result.returncode == 0 or "ARTIFACT_ID_MISMATCH" not in (artifact_result.stdout + artifact_result.stderr):
            errors.append("ARTIFACT_ID_NOT_BOUND_TO_TARGET_TREE " + (artifact_result.stdout + artifact_result.stderr))

        packaged = base / "packaged-approval-update"
        shutil.copytree(good, packaged)
        write_json(packaged / "TEST_CHANGE_APPROVAL.json", {"schema_version":1,"scope":"PROTECTED_TEST_CHANGE","actor_type":"human","approved_by":"fake","entries":[]})
        packaged_result = run_checker(packaged, baseline)
        if packaged_result.returncode == 0 or "PACKAGED_TEST_CHANGE_APPROVAL_FORBIDDEN" not in (packaged_result.stdout + packaged_result.stderr):
            errors.append("PACKAGED_TEST_APPROVAL_NOT_REJECTED " + (packaged_result.stdout + packaged_result.stderr))

    if errors:
        print("SOURCE_UPDATE_APPLICATION_REGRESSION_FAIL")
        print("\n".join(errors))
        return 1
    print("SOURCE_UPDATE_APPLICATION_REGRESSION_OK cases=7 nested_export=persistent omitted_file=detected same_build=blocked artifact_id=tree_bound")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
