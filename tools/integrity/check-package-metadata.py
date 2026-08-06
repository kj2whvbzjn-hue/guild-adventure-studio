#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[2]
errors=[]
config=(root/'assets/shared/config/runtime-config.js').read_text(encoding='utf-8')
gm=re.search(r'gameBuild:\s*["\'](GA-B\d+(?:\.\d+)?)',config)
sm=re.search(r'studioBuild:\s*["\'](GKS-B\d+)',config)
if not gm: errors.append('GAME_BUILD_MISSING')
if not sm: errors.append('STUDIO_BUILD_MISSING')
meta=json.loads((root/'package-build.json').read_text(encoding='utf-8'))
if gm and meta.get('game_build')!=gm.group(1): errors.append('GAME_BUILD_MISMATCH')
if sm and meta.get('studio_build')!=sm.group(1): errors.append('STUDIO_BUILD_MISMATCH')
for path in meta.get('public_entrypoints',[]):
    if not (root/path).is_file(): errors.append('ENTRYPOINT_MISSING_'+path)
print('PACKAGE_METADATA_' + ('PASS' if not errors else 'FAIL'))
for e in errors: print(e)
sys.exit(1 if errors else 0)
