#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2])
registry_path=root/'shared/tests/test-registry.json'
errors=[]
try:
    registry=json.loads(registry_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'TEST_REGISTRY_INVALID {exc}')
    raise SystemExit(1)
version=(root/'VERSION.txt').read_text(encoding='utf-8').strip()
expected='Build'+str(registry.get('package_build'))
if version != expected:
    errors.append(f'BUILD_MISMATCH registry={expected} version={version}')
seen=set()
for group in ('release_gate','historical_gap'):
    for item in registry.get(group,[]):
        rel=item.get('path','')
        if not rel or rel in seen: errors.append(f'DUPLICATE_OR_EMPTY {rel}')
        seen.add(rel)
        if not (root/rel).is_file(): errors.append(f'MISSING_TEST {rel}')
for p in sorted((root/'tools').glob('test_*')):
    rel=p.relative_to(root).as_posix()
    if p.is_file() and p.suffix in ('.py','.js','.php') and rel not in seen:
        errors.append(f'UNCLASSIFIED_TEST {rel}')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
passed=0
for item in registry.get('release_gate',[]):
    rel=item['path']; runtime=item['runtime']
    proc=subprocess.run([runtime,str(root/rel)],cwd=root,text=True,capture_output=True)
    if proc.returncode:
        print(f'RELEASE_TEST_FAIL {rel}')
        if proc.stdout: print(proc.stdout.rstrip())
        if proc.stderr: print(proc.stderr.rstrip())
        raise SystemExit(1)
    passed+=1
print(f'TEST_REGISTRY_OK release_gate={passed} historical_gap={len(registry.get("historical_gap",[]))}')
