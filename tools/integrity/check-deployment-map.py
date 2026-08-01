#!/usr/bin/env python3
import json, pathlib, re, sys
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2])
map_path = root / 'shared/dependencies/deployment-map.json'
errors=[]
try:
    data=json.loads(map_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'DEPLOYMENT_MAP_INVALID {exc}')
    raise SystemExit(1)
for item in data.get('public_entrypoints', []):
    p=root/item.get('path','')
    if not p.is_file() or p.stat().st_size == 0:
        errors.append(f"ENTRYPOINT_MISSING {item.get('id')} {item.get('path')}")
pwa=data.get('pwa',{})
for rel in [pwa.get('manifest'), pwa.get('service_worker'), *pwa.get('icons',[])]:
    if not rel or not (root/rel).is_file(): errors.append(f'PWA_ASSET_MISSING {rel}')
manifest=json.loads((root/pwa['manifest']).read_text(encoding='utf-8'))
for key in ('start_url','scope','id'):
    value=str(manifest.get(key,''))
    if value.startswith('/') or '://' in value:
        errors.append(f'MANIFEST_NOT_REPOSITORY_RELATIVE {key}={value}')
sw=(root/pwa['service_worker']).read_text(encoding='utf-8')
for rel in ('./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'):
    if rel not in sw: errors.append(f'SW_SHELL_REFERENCE_MISSING {rel}')
# GitHub Pages must not depend on server-side execution in current entrypoints.
for rel in [x['path'] for x in data.get('public_entrypoints',[])]:
    text=(root/rel).read_text(encoding='utf-8',errors='ignore')
    if re.search(r'https?://(?:localhost|127\.0\.0\.1)', text, re.I):
        errors.append(f'LOCALHOST_RUNTIME_DEPENDENCY {rel}')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print(f"DEPLOYMENT_MAP_OK entrypoints={len(data.get('public_entrypoints',[]))} hosting={data.get('hosting')}")
