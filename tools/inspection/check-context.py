#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
from system_file_policy import classify,load_policy
def main()->int:
 p=argparse.ArgumentParser();p.add_argument('root',nargs='?',default=Path(__file__).resolve().parents[2]);p.add_argument('--context',choices=('source','update'),required=True);a=p.parse_args();root=Path(a.root).resolve();errors=[]
 try:policy=load_policy(root)
 except Exception as e:print(f'INSPECTION_CONTEXT_FAIL\nSYSTEM_FILE_POLICY_INVALID {e}');return 1
 allowed=set(policy['rules'][f'{a.context}_allowed_classes'])
 for f in root.rglob('*'):
  if not f.is_file() or '.git' in f.parts:continue
  rel=f.relative_to(root).as_posix();c=classify(rel,policy)
  if c not in allowed:errors.append(f'{a.context.upper()}_FORBIDDEN_{c.upper()} {rel}')
 if a.context=='update':
  for key in ('require_update_metadata','require_update_delete_manifest'):
   rel=policy['rules'][key]
   if not (root/rel).is_file():errors.append(f'UPDATE_MISSING_REQUIRED {rel}')
 meta_path=root/policy['rules']['require_update_metadata']
 if a.context=='update' or meta_path.exists():
  try:meta=json.loads(meta_path.read_text(encoding='utf-8'))
  except Exception as e:errors.append(f'STUDIO_UPDATE_INVALID {e}');meta={}
  if meta.get('version')!='GKS-B484':errors.append(f'STUDIO_VERSION_UNEXPECTED {meta.get("version")!r}')
  if 'formal' in json.dumps(meta,ensure_ascii=False).lower() and meta.get('formal_build') not in (None,''):errors.append('FORMAL_BUILD_REINTRODUCED')
 try:
  manifest=json.loads((root/'package_manifest.json').read_text(encoding='utf-8'))
  for item in manifest.get('files',[]):
   rel=item.get('path','')
   if classify(rel,policy)!='persistent':errors.append(f'NONPERSISTENT_FILE_LISTED {rel}')
 except Exception as e:errors.append(f'PACKAGE_MANIFEST_INVALID {e}')
 if errors:print('INSPECTION_CONTEXT_FAIL');print('\n'.join(sorted(set(errors))));return 1
 print(f'INSPECTION_CONTEXT_OK context={a.context}');return 0
if __name__=='__main__':raise SystemExit(main())
