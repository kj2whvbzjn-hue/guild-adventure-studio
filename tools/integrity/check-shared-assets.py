#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parents[2]
manifest_path=root/'shared/assets/asset-manifest.json'
errors=[]
try:
    data=json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as e:
    print('SHARED_ASSET_FAIL'); print(f'MANIFEST_READ:{e}'); sys.exit(1)
for item in data.get('assets',[]):
    rel=item.get('path','')
    p=root/rel
    if not p.is_file():
        errors.append('MISSING:'+rel); continue
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    if digest != item.get('sha256'):
        errors.append('HASH_MISMATCH:'+rel)
