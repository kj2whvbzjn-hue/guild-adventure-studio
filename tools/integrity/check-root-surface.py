#!/usr/bin/env python3
from pathlib import Path
import json, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2])
manifest_path=root/'shared/integrity/root-surface-manifest.json'
errors=[]
try:
    data=json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'ROOT_SURFACE_MANIFEST_INVALID {exc}')
    raise SystemExit(1)
for rel in ['index.html','game/index.html','studio/index.html','game-tag-test/index.html','bootstrap-core.js','bootstrap-ui.js','export-core.js']:
    p=root/rel
    text=p.read_text(encoding='utf-8',errors='ignore')
    for marker in ['BUILD327_','RELEASE_NOTES_','DECISION_APPLICATION_','formal-v03/']:
        if marker in text: errors.append(f'HISTORICAL_RUNTIME_REFERENCE {rel} -> {marker}')
if errors:
    print('ROOT_SURFACE_CONTRACT_FAIL')
    for e in errors: print(e)
    raise SystemExit(1)
print(f"ROOT_SURFACE_CONTRACT_OK protected={len(data.get('protected_runtime_paths',[]))}")
