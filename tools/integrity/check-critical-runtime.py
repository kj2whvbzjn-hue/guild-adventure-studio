#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2])
path=root/'shared/integrity/critical-runtime-manifest.json'
errors=[]
try:
    data=json.loads(path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'CRITICAL_RUNTIME_MANIFEST_INVALID {exc}')
    raise SystemExit(1)
version=(root/'VERSION.txt').read_text(encoding='utf-8').strip()
expected='Build'+str(data.get('package_build'))
if version!=expected: errors.append(f'BUILD_MISMATCH manifest={expected} version={version}')
for item in data.get('files',[]):
    rel=item.get('path',''); p=root/rel
    if not p.is_file():
        errors.append(f'MISSING {rel}'); continue
    b=p.read_bytes()
    if len(b)!=item.get('size'): errors.append(f'SIZE_MISMATCH {rel}')
    if hashlib.sha256(b).hexdigest()!=item.get('sha256'): errors.append(f'HASH_MISMATCH {rel}')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print(f"CRITICAL_RUNTIME_INTEGRITY_OK files={len(data.get('files',[]))} build={data.get('package_build')}")
