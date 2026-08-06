#!/usr/bin/env python3
from datetime import datetime,timezone
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]).resolve();sys.path.insert(0,str(root/'tools/inspection'))
from system_file_policy import classify,load_policy
policy=load_policy(root);mp=root/'package_manifest.json';items=[]
for p in sorted(root.rglob('*'),key=lambda x:x.relative_to(root).as_posix()):
 if not p.is_file() or p==mp or '.git' in p.parts:continue
 rel=p.relative_to(root).as_posix()
 if classify(rel,policy)!='persistent':continue
 d=p.read_bytes();items.append({'path':rel,'size':len(d),'sha256':hashlib.sha256(d).hexdigest()})
mp.write_text(json.dumps({'schema_version':1,'generated_at':datetime.now(timezone.utc).replace(microsecond=0).isoformat(),'file_count':len(items),'files':items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'PACKAGE_MANIFEST_REBUILT files={len(items)}')
