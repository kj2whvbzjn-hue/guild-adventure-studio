#!/usr/bin/env python3
from __future__ import annotations
import sys
sys.dont_write_bytecode = True

from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import time

def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def source_tree_sha256(root: Path) -> str:
    rows=[]
    for path in sorted(root.rglob("*"), key=lambda p:p.relative_to(root).as_posix()):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel=path.relative_to(root).as_posix()
        rows.append(f"{rel}\0{path.stat().st_size}\0{sha256_file(path)}")
    return hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()

parser = argparse.ArgumentParser()
parser.add_argument('root', nargs='?', default=Path(__file__).resolve().parents[2])
parser.add_argument('--context', choices=('source', 'update'), default='source')
parser.add_argument('--selection-file', type=Path, help='Impact plan JSON containing selected_tests.')
parser.add_argument('--timeout-per-test', type=int, default=30)
parser.add_argument('--json-output', type=Path)
args = parser.parse_args()
if args.timeout_per_test < 1:
    parser.error('--timeout-per-test must be at least 1 second')
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

selection: set[str] | None = None
if args.selection_file:
    try:
        plan = json.loads(args.selection_file.read_text(encoding='utf-8'))
        if plan.get('mode') != 'impact':
            errors.append(f"TEST_SELECTION_MODE_INVALID {plan.get('mode')!r}")
        selected = plan.get('selected_tests')
        if not isinstance(selected, list) or any(not isinstance(x, str) or not x for x in selected):
            errors.append('TEST_SELECTION_LIST_INVALID')
            selected = []
        selection = set(selected)
        active_paths = {x.get('path') for x in registry.get('release_gate', []) if context in x.get('contexts', ['source','update'])}
        unknown = sorted(selection - active_paths)
        if unknown:
            errors.append('TEST_SELECTION_NOT_ACTIVE ' + ','.join(unknown))
        expected_tree = str(plan.get('applied_tree_sha256') or '')
        actual_tree = source_tree_sha256(root)
        if not expected_tree or expected_tree != actual_tree:
            errors.append(f"TEST_SELECTION_TREE_MISMATCH expected={expected_tree!r} actual={actual_tree!r}")
        expected_registry = str(plan.get('test_registry_sha256') or '')
        actual_registry = sha256_file(registry_path)
        if not expected_registry or expected_registry != actual_registry:
            errors.append(f"TEST_SELECTION_REGISTRY_MISMATCH expected={expected_registry!r} actual={actual_registry!r}")
    except Exception as exc:
        errors.append(f"TEST_SELECTION_INVALID {exc}")
if errors:
    print("\n".join(errors)); raise SystemExit(1)

env = os.environ.copy()
env["PYTHONDONTWRITEBYTECODE"] = "1"
env.pop("PYTHONPYCACHEPREFIX", None)

passed = 0
skipped = 0
timeouts = 0
results = []
for item in registry.get("release_gate", []):
    rel = item["path"]
    contexts = item.get("contexts", ["source", "update"])
    if context not in contexts:
        skipped += 1
        continue
    if selection is not None and rel not in selection:
        skipped += 1
        continue
    runtime = item["runtime"]
    if runtime in ("python", "python3", "py"):
        command = [sys.executable, "-S", "-B", str(root / rel)]
    else:
        command = [runtime, str(root / rel)]
    started = time.time()
    try:
        proc = subprocess.run(command, cwd=root, env=env, text=True, capture_output=True, timeout=args.timeout_per_test)
        timed_out = False
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        proc = None
        stdout = exc.stdout if isinstance(exc.stdout, str) else ''
        stderr = exc.stderr if isinstance(exc.stderr, str) else ''
    duration_ms = round((time.time() - started) * 1000)
    if timed_out:
        timeouts += 1
        results.append({'path': rel, 'status': 'timeout', 'duration_ms': duration_ms, 'timeout_seconds': args.timeout_per_test})
        print(f"RELEASE_TEST_TIMEOUT {rel} timeout={args.timeout_per_test}s duration_ms={duration_ms}")
        if stdout: print(stdout.rstrip())
        if stderr: print(stderr.rstrip())
        if args.json_output:
            args.json_output.parent.mkdir(parents=True, exist_ok=True)
            args.json_output.write_text(json.dumps({'status':'fail','failure_kind':'timeout','results':results}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        raise SystemExit(124)
    if proc.returncode:
        results.append({'path': rel, 'status': 'fail', 'duration_ms': duration_ms, 'returncode': proc.returncode})
        print(f"RELEASE_TEST_FAIL {rel}")
        if proc.stdout:
            print(proc.stdout.rstrip())
        if proc.stderr:
            print(proc.stderr.rstrip())
        if args.json_output:
            args.json_output.parent.mkdir(parents=True, exist_ok=True)
            args.json_output.write_text(json.dumps({'status':'fail','failure_kind':'assertion','results':results}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        raise SystemExit(1)
    passed += 1
    results.append({'path': rel, 'status': 'pass', 'duration_ms': duration_ms})
mode = 'impact' if selection is not None else 'full'
summary = {'status':'pass','mode':mode,'context':context,'release_gate':passed,'skipped':skipped,'historical_gap':len(registry.get('historical_gap', [])),'timeouts':timeouts,'timeout_per_test_seconds':args.timeout_per_test,'results':results}
if args.json_output:
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f"TEST_REGISTRY_OK mode={mode} context={context} release_gate={passed} skipped={skipped} historical_gap={len(registry.get('historical_gap', []))} timeout_per_test={args.timeout_per_test}s")
