#!/usr/bin/env python3
from __future__ import annotations
import sys
sys.dont_write_bytecode = True

from pathlib import Path
import argparse
import json
import os
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('root', nargs='?', default=Path(__file__).resolve().parents[2])
parser.add_argument('--context', choices=('source', 'update'), default='source')
args = parser.parse_args()
root = Path(args.root).resolve()
context = args.context
registry_path = root / "shared/tests/test-registry.json"
errors = []
try:
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"TEST_REGISTRY_INVALID {exc}")
    raise SystemExit(1)

seen = set()
for group in ("release_gate", "historical_gap"):
    for item in registry.get(group, []):
        rel = item.get("path", "")
        if not rel or rel in seen:
            errors.append(f"DUPLICATE_OR_EMPTY {rel}")
        seen.add(rel)
        if not (root / rel).is_file():
            errors.append(f"MISSING_TEST {rel}")
for path in sorted((root / "tools").glob("test_*")):
    rel = path.relative_to(root).as_posix()
    if path.is_file() and path.suffix in (".py", ".js", ".php") and rel not in seen:
        errors.append(f"UNCLASSIFIED_TEST {rel}")
if errors:
    print("\n".join(errors))
    raise SystemExit(1)

env = os.environ.copy()
env["PYTHONDONTWRITEBYTECODE"] = "1"
env.pop("PYTHONPYCACHEPREFIX", None)

passed = 0
skipped = 0
for item in registry.get("release_gate", []):
    rel = item["path"]
    contexts = item.get("contexts", ["source", "update"])
    if context not in contexts:
        skipped += 1
        continue
    runtime = item["runtime"]
    if runtime in ("python", "python3", "py"):
        command = [sys.executable, "-S", "-B", str(root / rel)]
    else:
        command = [runtime, str(root / rel)]
    proc = subprocess.run(command, cwd=root, env=env, text=True, capture_output=True)
    if proc.returncode:
        print(f"RELEASE_TEST_FAIL {rel}")
        if proc.stdout:
            print(proc.stdout.rstrip())
        if proc.stderr:
            print(proc.stderr.rstrip())
        raise SystemExit(1)
    passed += 1
print(f"TEST_REGISTRY_OK context={context} release_gate={passed} skipped={skipped} historical_gap={len(registry.get('historical_gap', []))}")
