#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[2]
config=json.loads((root/'shared/dependencies/runtime-boundary.json').read_text(encoding='utf-8'))
archives=tuple(config.get('archive_roots',[]))
allowed=set(config.get('allowed_archive_references',[]))
errors=[]
# Scan only active HTML/JS/CSS entry trees, excluding archive roots and third-party minified library.
scan=[]
for item in config.get('active_roots',[]):
 p=root/item
 if p.is_file(): scan.append(p)
 elif p.is_dir(): scan.extend(x for x in p.rglob('*') if x.is_file() and x.suffix.lower() in {'.html','.js','.css'})
pattern=re.compile(r'''(?:src|href|action)\s*=\s*["']([^"'#?]+)|(?:fetch|importScripts)\s*\(\s*["']([^"']+)''',re.I)
for p in scan:
 if p.name=='jszip.min.js': continue
 try: text=p.read_text(encoding='utf-8')
 except UnicodeDecodeError: continue
 for m in pattern.finditer(text):
  ref=(m.group(1) or m.group(2) or '').replace('\\','/').lstrip('./')
  if ref in allowed: continue
  if any(ref==a or ref.startswith(a+'/') or ('/'+a+'/') in '/'+ref for a in archives):
   errors.append(f'{p.relative_to(root)} -> {ref}')
print('RUNTIME_BOUNDARY_'+('PASS' if not errors else 'FAIL'))
for e in errors: print(e)
sys.exit(1 if errors else 0)
