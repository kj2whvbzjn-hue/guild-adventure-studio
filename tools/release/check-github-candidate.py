#!/usr/bin/env python3
from pathlib import Path
import json,sys
root=Path(__file__).resolve().parents[2]
m=json.loads((root/'shared/release/github-pages-package.json').read_text())
err=[]
for rel in m['required_files']+m['entrypoints']:
 p=root/rel
 if not p.is_file() or p.stat().st_size==0: err.append('MISSING '+rel)
for rel in m['required_roots']:
 if not (root/rel).is_dir(): err.append('MISSING_DIR '+rel)
print('GITHUB_CANDIDATE_'+('PASS' if not err else 'FAIL'))
for e in err: print(e)
sys.exit(bool(err))
