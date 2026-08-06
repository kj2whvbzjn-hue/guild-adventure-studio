#!/usr/bin/env python3
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import hashlib,json,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]).resolve();sys.path.insert(0,str(root/'tools/inspection'))
from system_file_policy import classify,load_policy
mp=root/'package_manifest.json';errors=[]
try:policy=load_policy(root);m=json.loads(mp.read_text(encoding='utf-8'))
except Exception as e:print(f'PACKAGE_MANIFEST_INVALID {e}');raise SystemExit(1)
entries=m.get('files',[]);seen=set()
for item in entries:
 rel=item.get('path','')
 if classify(rel,policy)!='persistent':errors.append(f'NONPERSISTENT_LISTED {rel}');continue
 if not rel or rel in seen:errors.append(f'DUPLICATE_OR_EMPTY {rel}');continue
 seen.add(rel);p=(root/rel).resolve()
 try:p.relative_to(root)
 except ValueError:errors.append(f'OUTSIDE_ROOT {rel}');continue
 if not p.is_file():errors.append(f'MISSING {rel}');continue
 d=p.read_bytes()
 if len(d)!=item.get('size'):errors.append(f'SIZE_MISMATCH {rel}')
 if hashlib.sha256(d).hexdigest()!=item.get('sha256'):errors.append(f'HASH_MISMATCH {rel}')
actual=set()
for p in root.rglob('*'):
 if not p.is_file() or p==mp or '.git' in p.parts:continue
 rel=p.relative_to(root).as_posix()
 if classify(rel,policy)=='persistent':actual.add(rel)
for rel in sorted(actual-seen):errors.append(f'UNLISTED {rel}')
for rel in sorted(seen-actual):errors.append(f'UNEXPECTED_LISTED {rel}')
if m.get('file_count')!=len(entries):errors.append(f'COUNT_FIELD_MISMATCH declared={m.get("file_count")} actual={len(entries)}')
if errors:print('PACKAGE_MANIFEST_FAIL');print('\n'.join(errors));raise SystemExit(1)
print(f'PACKAGE_MANIFEST_OK files={len(entries)}')
