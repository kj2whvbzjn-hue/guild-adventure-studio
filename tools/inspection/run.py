#!/usr/bin/env python3
"""Unified inspection runner for Guild Adventure Studio.

Profiles:
  quick   Fast checks for ordinary edits.
  full    Complete repository integrity and active test gate.
  release Full checks plus GitHub Pages package generation and ZIP validation.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]


def command_available(name: str) -> bool:
    return shutil.which(name) is not None


def run_step(name: str, command: list[str], *, required: bool = True) -> dict:
    started = time.time()
    proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    result = {
        "name": name,
        "command": command,
        "required": required,
        "status": "pass" if proc.returncode == 0 else ("fail" if required else "warn"),
        "returncode": proc.returncode,
        "duration_ms": round((time.time() - started) * 1000),
        "stdout": proc.stdout.rstrip(),
        "stderr": proc.stderr.rstrip(),
    }
    marker = {"pass": "PASS", "fail": "FAIL", "warn": "WARN"}[result["status"]]
    print(f"[{marker}] {name} ({result['duration_ms']} ms)")
    if result["status"] != "pass":
        if result["stdout"]:
            print(result["stdout"])
        if result["stderr"]:
            print(result["stderr"], file=sys.stderr)
    return result


def python_inline(name: str, source: str) -> dict:
    return run_step(name, [sys.executable, "-c", source, str(ROOT)])


def syntax_steps(profile: str) -> Iterable[tuple[str, list[str], bool]]:
    if command_available("node"):
        yield (
            "javascript_syntax",
            [
                "bash",
                "-lc",
                "set -euo pipefail; while IFS= read -r -d '' f; do node --check \"$f\" >/dev/null; done < <(find . -type f -name '*.js' ! -path '*/vendor/*' ! -name 'jszip.min.js' -print0)",
            ],
            True,
        )
    else:
        yield ("javascript_syntax_runtime_missing", ["bash", "-lc", "echo 'node is not installed'"], profile != 'quick')

    if command_available("php"):
        yield (
            "php_syntax",
            [
                "bash",
                "-lc",
                "set -euo pipefail; while IFS= read -r -d '' f; do php -l \"$f\" >/dev/null; done < <(find . -type f -name '*.php' -print0)",
            ],
            True,
        )
    else:
        yield ("php_syntax_runtime_missing", ["bash", "-lc", "echo 'php is not installed'"], profile != 'quick')

    yield (
        "python_syntax",
        [
            sys.executable,
            "-c",
            "import pathlib,sys; root=pathlib.Path(sys.argv[1]); files=[p for p in root.rglob('*.py') if '.git' not in p.parts and '__pycache__' not in p.parts]; [compile(p.read_text(encoding='utf-8'),str(p),'exec') for p in files]; print(f'PYTHON_SYNTAX_OK files={len(files)}')",
            str(ROOT),
        ],
        True,
    )


def build_steps(profile: str, release_output: Path | None, context: str) -> list[tuple[str, list[str], bool]]:
    py = sys.executable
    steps: list[tuple[str, list[str], bool]] = [
        (
            "required_paths_and_json",
            [
                py,
                "-c",
                "import json,pathlib,sys; r=pathlib.Path(sys.argv[1]); req=['index.html','game/index.html','studio/index.html','game-tag-test/index.html','project-data.json','package-build.json','package_manifest.json','shared/tests/test-registry.json']; missing=[p for p in req if not (r/p).is_file() or (r/p).stat().st_size==0]; [json.loads(p.read_text(encoding='utf-8')) for p in r.rglob('*.json') if '.git' not in p.parts]; [json.loads(p.read_text(encoding='utf-8')) for p in r.rglob('*.webmanifest')]; print('REQUIRED_AND_JSON_OK'); sys.exit(1 if missing else 0)",
                str(ROOT),
            ],
            True,
        ),
        ("html_links", [py, str(ROOT / "tools/integrity/check-html-links.py"), str(ROOT)], True),
        ("package_metadata", [py, str(ROOT / "tools/integrity/check-package-metadata.py")], True),
        ("critical_runtime", [py, str(ROOT / "tools/integrity/check-critical-runtime.py"), str(ROOT)], True),
        ("package_manifest", [py, str(ROOT / "tools/integrity/check-package-manifest.py"), str(ROOT)], True),
    ]
    if context == "update":
        steps.insert(4, ("delete_manifest", [py, str(ROOT / "tools/integrity/check-delete-manifest.py"), str(ROOT)], True))
    steps.insert(0, ("inspection_context", [py, str(ROOT / "tools/inspection/check-context.py"), str(ROOT), "--context", context], True))
    steps.extend(syntax_steps(profile))

    if profile in {"full", "release"}:
        steps.extend(
            [
                ("organization", [py, str(ROOT / "tools/integrity/audit-organization.py"), str(ROOT)], True),
                ("shared_assets", [py, str(ROOT / "tools/integrity/check-shared-assets.py")], True),
                ("component_map", [py, str(ROOT / "tools/integrity/check-component-map.py")], True),
                ("runtime_boundary", [py, str(ROOT / "tools/integrity/check-runtime-boundary.py")], True),
                ("deployment_map", [py, str(ROOT / "tools/integrity/check-deployment-map.py"), str(ROOT)], True),
                ("root_surface", [py, str(ROOT / "tools/integrity/check-root-surface.py"), str(ROOT)], True),
                ("active_test_gate", [py, str(ROOT / "tools/integrity/check-test-registry.py"), str(ROOT)], True),
                ("github_candidate", [py, str(ROOT / "tools/release/check-github-candidate.py")], True),
            ]
        )

    if profile == "release":
        output = release_output or ROOT / "release-output" / "github-pages-package.zip"
        steps.extend(
            [
                ("build_github_package", [py, str(ROOT / "tools/release/build-github-pages-package.py"), "--output", str(output)], True),
                (
                    "release_zip_integrity",
                    [
                        py,
                        "-c",
                        "import sys,zipfile; p=sys.argv[1]; z=zipfile.ZipFile(p); bad=z.testzip(); print(f'ZIP_OK files={len(z.infolist())}'); sys.exit(1 if bad else 0)",
                        str(output),
                    ],
                    True,
                ),
            ]
        )
    return steps


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("profile", choices=("quick", "full", "release"), nargs="?", default="quick")
    parser.add_argument("--report", type=Path, help="Write a JSON result report.")
    parser.add_argument("--release-output", type=Path)
    parser.add_argument("--context", choices=("auto", "source", "update"), default="auto", help="source=GitHub checkout, update=Studio deployment ZIP")
    args = parser.parse_args()

    context = args.context
    if context == "auto":
        context = "update" if (ROOT / "DELETE_MANIFEST.txt").is_file() else "source"
    started = time.time()
    print(f"INSPECTION_CONTEXT {context}")
    results = [run_step(name, command, required=required) for name, command, required in build_steps(args.profile, args.release_output, context)]
    failed = [r for r in results if r["status"] == "fail"]
    warnings = [r for r in results if r["status"] == "warn"]
    report = {
        "schema_version": 1,
        "profile": args.profile,
        "context": context,
        "root": str(ROOT),
        "status": "fail" if failed else "pass",
        "duration_ms": round((time.time() - started) * 1000),
        "summary": {"passed": sum(r["status"] == "pass" for r in results), "failed": len(failed), "warnings": len(warnings)},
        "steps": results,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"REPORT {args.report}")
    print(f"INSPECTION_{report['status'].upper()} profile={args.profile} passed={report['summary']['passed']} failed={len(failed)} warnings={len(warnings)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
