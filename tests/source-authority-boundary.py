#!/usr/bin/env python3
import subprocess,sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
r=subprocess.run([sys.executable,'-S','-B',str(root/'tools/integrity/check-authority-boundary.py'),str(root)],capture_output=True,text=True)
if r.returncode: print(r.stdout+r.stderr);raise SystemExit(r.returncode)
manifest=json.loads((root/'package_manifest.json').read_text())
assert 'project-data.json' not in [x.get('path') for x in manifest.get('files',[])]
assert (root/'project-data.json').is_file(), 'migration phase must physically retain project-data'
print('SOURCE_AUTHORITY_BOUNDARY_OK')
