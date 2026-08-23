#!/usr/bin/env python3
from __future__ import annotations
import sys
sys.dont_write_bytecode = True

from pathlib import Path
import argparse
import concurrent.futures
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
for path in sorted((root / "php-runtime" / "tests").glob("*")):
    rel = path.relative_to(root).as_posix()
    if path.is_file() and path.suffix == ".php" and rel not in seen:
        errors.append(f"UNCLASSIFIED_PHP_RUNTIME_TEST {rel}")
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

# Tests that orchestrate nested subprocess/file fixtures remain serial. They are
# already isolated, but keeping them out of the worker pool removes avoidable
# contention while the remaining independent test processes run concurrently.
SERIAL_RELEASE_TESTS = {
    "tools/test_source_zip_binding.py",
    "tests/test_protected_delete_integrity_dual_approval_gks_b555.py",
    "php-runtime/tests/run.php",
}
MAX_PARALLEL_TESTS = 4

def run_release_test(index: int, item: dict) -> dict:
    rel = item["path"]
    runtime = item["runtime"]
    if runtime in ("python", "python3", "py"):
        command = [sys.executable, "-S", "-B", str(root / rel)]
    else:
        command = [runtime, str(root / rel)]
    started = time.time()
    try:
        proc = subprocess.run(command, cwd=root, env=env, text=True, capture_output=True, timeout=args.timeout_per_test)
        duration_ms = round((time.time() - started) * 1000)
        return {
            "index": index, "path": rel,
            "status": "pass" if proc.returncode == 0 else "fail",
            "duration_ms": duration_ms, "returncode": proc.returncode,
            "stdout": proc.stdout, "stderr": proc.stderr,
        }
    except subprocess.TimeoutExpired as exc:
        duration_ms = round((time.time() - started) * 1000)
        return {
            "index": index, "path": rel, "status": "timeout",
            "duration_ms": duration_ms, "returncode": 124,
            "timeout_seconds": args.timeout_per_test,
            "stdout": exc.stdout if isinstance(exc.stdout, str) else "",
            "stderr": exc.stderr if isinstance(exc.stderr, str) else "",
        }
    except OSError as exc:
        duration_ms = round((time.time() - started) * 1000)
        return {
            "index": index, "path": rel, "status": "fail",
            "duration_ms": duration_ms, "returncode": 127,
            "stdout": "", "stderr": str(exc),
        }

active = []
for index, item in enumerate(registry.get("release_gate", [])):
    rel = item["path"]
    contexts = item.get("contexts", ["source", "update"])
    if context not in contexts:
        skipped += 1
        continue
    if selection is not None and rel not in selection:
        skipped += 1
        continue
    active.append((index, item))

serial = [(index, item) for index, item in active if item["path"] in SERIAL_RELEASE_TESTS]
parallel = [(index, item) for index, item in active if item["path"] not in SERIAL_RELEASE_TESTS]
collected = [run_release_test(index, item) for index, item in serial]
if parallel:
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL_TESTS, thread_name_prefix="release-test") as executor:
        future_map = {executor.submit(run_release_test, index, item): (index, item) for index, item in parallel}
        for future in concurrent.futures.as_completed(future_map):
            index, item = future_map[future]
            try:
                collected.append(future.result())
            except Exception as exc:
                collected.append({
                    "index": index, "path": item["path"], "status": "fail",
                    "duration_ms": 0, "returncode": 1, "stdout": "",
                    "stderr": f"RELEASE_TEST_RUNNER_EXCEPTION {type(exc).__name__}: {exc}",
                })

# Missing worker results are themselves a fail-closed test-runner error.
returned = {x["index"] for x in collected}
for index, item in active:
    if index not in returned:
        collected.append({
            "index": index, "path": item["path"], "status": "fail",
            "duration_ms": 0, "returncode": 1, "stdout": "",
            "stderr": "RELEASE_TEST_RESULT_MISSING",
        })

# Restore registry order so report contents stay deterministic.
collected.sort(key=lambda x: x["index"])
for result in collected:
    rel = result["path"]
    public = {k: v for k, v in result.items() if k not in {"index", "stdout", "stderr"}}
    results.append(public)
    if result["status"] == "pass":
        passed += 1
        continue
    if result["status"] == "timeout":
        timeouts += 1
        print(f"RELEASE_TEST_TIMEOUT {rel} timeout={args.timeout_per_test}s duration_ms={result['duration_ms']}")
    else:
        print(f"RELEASE_TEST_FAIL {rel}")
    if result.get("stdout"):
        print(result["stdout"].rstrip())
    if result.get("stderr"):
        print(result["stderr"].rstrip())

if timeouts or any(x["status"] == "fail" for x in results):
    failure_kind = "timeout" if timeouts else "assertion"
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps({
            "status": "fail", "failure_kind": failure_kind,
            "mode": "impact" if selection is not None else "full", "context": context,
            "release_gate": passed, "skipped": skipped,
            "historical_gap": len(registry.get("historical_gap", [])), "timeouts": timeouts,
            "timeout_per_test_seconds": args.timeout_per_test,
            "max_parallel_tests": MAX_PARALLEL_TESTS, "results": results,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(124 if timeouts else 1)

mode = 'impact' if selection is not None else 'full'
summary = {'status':'pass','mode':mode,'context':context,'release_gate':passed,'skipped':skipped,'historical_gap':len(registry.get('historical_gap', [])),'timeouts':timeouts,'timeout_per_test_seconds':args.timeout_per_test,'max_parallel_tests':MAX_PARALLEL_TESTS,'results':results}
if args.json_output:
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f"TEST_REGISTRY_OK mode={mode} context={context} release_gate={passed} skipped={skipped} historical_gap={len(registry.get('historical_gap', []))} timeout_per_test={args.timeout_per_test}s")
