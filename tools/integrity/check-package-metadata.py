#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[2]
errors=[]
version=(root/'VERSION.txt').read_text(encoding='utf-8').strip()
m=re.fullmatch(r'Build(\d+)',version)
if not m: errors.append('VERSION_FORMAT')
build=int(m.group(1)) if m else -1
meta=json.loads((root/'package-build.json').read_text(encoding='utf-8'))
if meta.get('package_build') != build: errors.append('PACKAGE_BUILD_MISMATCH')
manifest=json.loads((root/'manifest.webmanifest').read_text(encoding='utf-8'))
if f'appv={build}' not in manifest.get('start_url',''): errors.append('MANIFEST_CACHE_MISMATCH')
sw=(root/'sw.js').read_text(encoding='utf-8')
for expected in [f'build{build}',f'appv={build}',f'manifest.webmanifest?v={build}',f'icon-192.png?v={build}',f'icon-512.png?v={build}']:
    if expected not in sw: errors.append('SW_MISSING_'+expected)
for path in meta.get('public_entrypoints',[]):
    if not (root/path).exists(): errors.append('ENTRYPOINT_MISSING_'+path)
print('PACKAGE_METADATA_' + ('PASS' if not errors else 'FAIL'))
for e in errors: print(e)
sys.exit(1 if errors else 0)
