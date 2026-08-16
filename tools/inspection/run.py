#!/usr/bin/env python3
"""Unified, read-only inspection runner with cryptographic evidence."""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from evidence import (
    compare_trees,
    execution_environment,
    tree_snapshot,
    utc_now,
    write_evidence_manifest,
    write_json,
    zip_entries,
)


def command_available(name: str) -> bool:
    return shutil.which(name) is not None


def readonly_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.pop("PYTHONPYCACHEPREFIX", None)
    return env


def normalize_python_command(command: list[str]) -> list[str]:
    if not command:
        return command
    executable = Path(command[0]).name.lower()
    if executable in {"python", "python3", "py"} or command[0] == sys.executable:
        rest = command[1:]
        if "-B" not in rest[:2]:
            rest = ["-B", *rest]
        return [sys.executable, *rest]
    return command


def assert_outside_root(path: Path, label: str) -> Path:
    resolved = path.expanduser().resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError:
        return resolved
    raise ValueError(f"{label} must be outside source root: {resolved}")


def run_step(name: str, command: list[str], *, required: bool, timeout_seconds: int, env: dict[str, str]) -> dict:
    command = normalize_python_command(command)
    started = time.time()
    try:
        proc = subprocess.run(
            command,
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            timeout=timeout_seconds,
        )
        returncode = proc.returncode
        stdout = proc.stdout.rstrip()
        stderr = proc.stderr.rstrip()
        timed_out = False
    except subprocess.TimeoutExpired as exc:
        returncode = 124
        stdout = (exc.stdout or "").rstrip() if isinstance(exc.stdout, str) else ""
        stderr = (exc.stderr or "").rstrip() if isinstance(exc.stderr, str) else ""
        timed_out = True
        stderr = f"{stderr}\ninspection step timed out after {timeout_seconds} seconds".strip()
    status = "pass" if returncode == 0 else ("fail" if required else "warn")
    result = {
        "name": name,
        "command": command,
        "required": required,
        "status": status,
        "returncode": returncode,
        "timed_out": timed_out,
        "timeout_seconds": timeout_seconds,
        "duration_ms": round((time.time() - started) * 1000),
        "stdout": stdout,
        "stderr": stderr,
    }
    print(f"[{status.upper()}] {name} ({result['duration_ms']} ms)")
    if status != "pass":
        if stdout:
            print(stdout)
        if stderr:
            print(stderr, file=sys.stderr)
    return result


def syntax_steps(profile: str) -> Iterable[tuple[str, list[str], bool]]:
    if profile == "quick":
        yield ("quick_syntax", [sys.executable, "-S", "-B", str(ROOT / "tools/inspection/check-quick-syntax.py"), str(ROOT)], True)
        return
    if command_available("node"):
        yield ("javascript_syntax", ["node", str(ROOT / "tools/inspection/check-full-javascript-syntax.js"), str(ROOT)], True)
    else:
        yield ("javascript_syntax_runtime_missing", ["bash", "-lc", "echo 'node is not installed'"], True)
    if command_available("php"):
        yield ("php_syntax", ["php", str(ROOT / "tools/inspection/check-full-php-syntax.php"), str(ROOT)], True)
    else:
        yield ("php_syntax_runtime_missing", ["bash", "-lc", "echo 'php is not installed'"], True)
    yield ("python_syntax", [sys.executable, "-S", "-B", "-c", "import pathlib,sys; r=pathlib.Path(sys.argv[1]); fs=[p for p in r.rglob('*.py') if '.git' not in p.parts and '__pycache__' not in p.parts]; [compile(p.read_text(encoding='utf-8'),str(p),'exec') for p in fs]; print(f'PYTHON_SYNTAX_OK files={len(fs)}')", str(ROOT)], True)


def build_steps(profile: str, release_output: Path | None, context: str) -> list[tuple[str, list[str], bool]]:
    py = [sys.executable, "-S", "-B"]
    steps = [
        ("inspection_context", [*py, str(ROOT / "tools/inspection/check-context.py"), str(ROOT), "--context", context], True),
        ("ai_governance", [*py, str(ROOT / "tools/inspection/check-ai-governance.py"), str(ROOT)], True),
        ("encoding_iphone", [*py, str(ROOT / "tools/inspection/check-encoding.py"), str(ROOT)], True),
        ("required_paths_and_json", [*py, "-c", "import json,pathlib,sys; r=pathlib.Path(sys.argv[1]); req=['index.html','game/index.html','studio/index.html','project-data.json','package-build.json','package_manifest.json','shared/tests/test-registry.json','docs/operations/ENCODING_POLICY.md','shared/integrity/encoding-policy.json','tools/inspection/check-encoding.py']; missing=[p for p in req if not (r/p).is_file() or (r/p).stat().st_size==0]; [json.loads(p.read_text(encoding='utf-8')) for p in r.rglob('*.json') if '.git' not in p.parts]; [json.loads(p.read_text(encoding='utf-8')) for p in r.rglob('*.webmanifest')]; print('REQUIRED_AND_JSON_OK'); sys.exit(1 if missing else 0)", str(ROOT)], True),
        ("html_links", [*py, str(ROOT / "tools/integrity/check-html-links.py"), str(ROOT)], True),
        ("package_metadata", [*py, str(ROOT / "tools/integrity/check-package-metadata.py")], True),
        ("critical_runtime", [*py, str(ROOT / "tools/integrity/check-critical-runtime.py"), str(ROOT)], True),
        ("package_manifest", [*py, str(ROOT / "tools/integrity/check-package-manifest.py"), str(ROOT)], True),
    ]
    if context == "update":
        steps.insert(4, ("delete_manifest", [*py, str(ROOT / "tools/integrity/check-delete-manifest.py"), str(ROOT)], True))
    steps.extend(syntax_steps(profile))
    if profile in {"full", "release"}:
        steps.extend([
            ("organization", [*py, str(ROOT / "tools/integrity/audit-organization.py"), str(ROOT)], True),
            ("shared_assets", [*py, str(ROOT / "tools/integrity/check-shared-assets.py")], True),
            ("component_map", [*py, str(ROOT / "tools/integrity/check-component-map.py")], True),
            ("runtime_boundary", [*py, str(ROOT / "tools/integrity/check-runtime-boundary.py")], True),
            ("deployment_map", [*py, str(ROOT / "tools/integrity/check-deployment-map.py"), str(ROOT)], True),
            ("root_surface", [*py, str(ROOT / "tools/integrity/check-root-surface.py"), str(ROOT)], True),
            ("full_framework_regression", [*py, str(ROOT / "tools/inspection/test-full-framework.py")], True),
            ("active_test_gate", [*py, str(ROOT / "tools/integrity/check-test-registry.py"), str(ROOT), "--context", context], True),
            ("github_candidate", [*py, str(ROOT / "tools/release/check-github-candidate.py")], True),
        ])
    if profile == "release":
        if release_output is None:
            raise ValueError("release profile requires --release-output outside source root")
        steps.extend([
            ("build_github_package", [*py, str(ROOT / "tools/release/build-github-pages-package.py"), "--output", str(release_output)], True),
            ("release_zip_integrity", [*py, "-c", "import sys,zipfile; p=sys.argv[1]; z=zipfile.ZipFile(p); bad=z.testzip(); print(f'ZIP_OK files={len(z.infolist())}'); sys.exit(1 if bad else 0)", str(release_output)], True),
        ])
    return steps


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("profile", choices=("quick", "full", "release"), nargs="?", default="quick")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--evidence-dir", type=Path)
    parser.add_argument("--input-zip", type=Path, help="Original ZIP used to create this source tree.")
    parser.add_argument("--release-output", type=Path)
    parser.add_argument("--context", choices=("auto", "source", "update"), default="auto")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--fail-fast", action="store_true")
    args = parser.parse_args()

    if args.timeout < 1:
        parser.error("--timeout must be at least 1 second")
    try:
        report_path = assert_outside_root(args.report, "--report") if args.report else None
        evidence_dir = assert_outside_root(args.evidence_dir, "--evidence-dir") if args.evidence_dir else Path(tempfile.mkdtemp(prefix="gk-inspection-evidence-")).resolve()
        release_output = assert_outside_root(args.release_output, "--release-output") if args.release_output else None
    except ValueError as exc:
        parser.error(str(exc))

    context = args.context
    if context == "auto":
        context = "update" if (ROOT / "DELETE_MANIFEST.txt").is_file() else "source"

    env = readonly_env()
    command = [sys.executable, *sys.argv]
    evidence_dir.mkdir(parents=True, exist_ok=True)
    before = tree_snapshot(ROOT)
    write_json(evidence_dir / "tree-before.json", before)
    write_json(evidence_dir / "execution.json", execution_environment(command, ROOT, env))
    write_json(evidence_dir / "input.json", {
        "schema_version": 1,
        "input_type": "zip" if args.input_zip else "directory",
        "root": str(ROOT),
        "input_zip": str(args.input_zip.resolve()) if args.input_zip else None,
        "started_at": utc_now(),
    })
    if args.input_zip:
        if not args.input_zip.is_file():
            parser.error(f"--input-zip not found: {args.input_zip}")
        write_json(evidence_dir / "zip-entries.json", zip_entries(args.input_zip))

    started = time.time()
    results = []
    setup_error = None
    try:
        steps = build_steps(args.profile, release_output, context)
    except ValueError as exc:
        steps = []
        setup_error = str(exc)

    if setup_error:
        results.append({
            "name": "inspection_setup",
            "command": [],
            "required": True,
            "status": "fail",
            "returncode": 2,
            "timed_out": False,
            "timeout_seconds": args.timeout,
            "duration_ms": 0,
            "stdout": "",
            "stderr": setup_error,
        })
    else:
        for name, command_step, required in steps:
            result = run_step(name, command_step, required=required, timeout_seconds=args.timeout, env=env)
            results.append(result)
            if args.fail_fast and result["status"] == "fail":
                break

    after = tree_snapshot(ROOT)
    delta = compare_trees(before, after)
    write_json(evidence_dir / "tree-after.json", after)
    write_json(evidence_dir / "tree-delta.json", delta)

    if not delta["unchanged"]:
        results.append({
            "name": "source_tree_immutability",
            "command": [],
            "required": True,
            "status": "fail",
            "returncode": 1,
            "timed_out": False,
            "timeout_seconds": args.timeout,
            "duration_ms": 0,
            "stdout": json.dumps(delta, ensure_ascii=False),
            "stderr": "Inspection modified the source tree.",
        })
    else:
        results.append({
            "name": "source_tree_immutability",
            "command": [],
            "required": True,
            "status": "pass",
            "returncode": 0,
            "timed_out": False,
            "timeout_seconds": args.timeout,
            "duration_ms": 0,
            "stdout": "SOURCE_TREE_UNCHANGED",
            "stderr": "",
        })

    failed = [r for r in results if r["status"] == "fail"]
    warnings = [r for r in results if r["status"] == "warn"]
    report = {
        "schema_version": 2,
        "profile": args.profile,
        "context": context,
        "root": str(ROOT),
        "status": "fail" if failed else "pass",
        "started_at": utc_now(),
        "duration_ms": round((time.time() - started) * 1000),
        "source_tree_before_sha256": before["tree_sha256"],
        "source_tree_after_sha256": after["tree_sha256"],
        "source_tree_unchanged": delta["unchanged"],
        "input_zip_sha256": zip_entries(args.input_zip)["zip_sha256"] if args.input_zip else None,
        "summary": {
            "passed": sum(r["status"] == "pass" for r in results),
            "failed": len(failed),
            "warnings": len(warnings),
        },
        "steps": results,
        "evidence_directory": str(evidence_dir),
    }
    write_json(evidence_dir / "result.json", report)
    manifest = write_evidence_manifest(evidence_dir)
    report["evidence_set_sha256"] = manifest["evidence_set_sha256"]
    write_json(evidence_dir / "result.json", report)
    write_evidence_manifest(evidence_dir)

    if report_path:
        write_json(report_path, report)
        print(f"REPORT {report_path}")
    print(f"EVIDENCE {evidence_dir}")
    print(f"EVIDENCE_SHA256 {report['evidence_set_sha256']}")
    print(f"INSPECTION_{report['status'].upper()} profile={args.profile} passed={report['summary']['passed']} failed={len(failed)} warnings={len(warnings)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
