#!/usr/bin/env python3
from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[2]
manifest_path = root / 'shared/dependencies/component-map.json'
errors=[]
try:
    data=json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as exc:
    print('COMPONENT_MAP_FAIL')
    print(f'INVALID_MANIFEST {exc}')
    sys.exit(1)
seen=set()
for component in data.get('components',[]):
    cid=component.get('id','<missing>')
    if cid in seen: errors.append(f'DUPLICATE_COMPONENT {cid}')
    seen.add(cid)
    for key in ('entrypoint',):
        rel=component.get(key)
        if not rel or not (root/rel).is_file(): errors.append(f'MISSING_{key.upper()} {cid} {rel}')
    for key in ('owned_paths','required_shared_assets'):
        for rel in component.get(key,[]):
            if not (root/rel).is_file(): errors.append(f'MISSING_PATH {cid} {rel}')
print('COMPONENT_MAP_' + ('PASS' if not errors else 'FAIL'))
for error in errors: print(error)
sys.exit(1 if errors else 0)
