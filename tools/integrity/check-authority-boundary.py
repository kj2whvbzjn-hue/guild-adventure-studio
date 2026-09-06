#!/usr/bin/env python3
import argparse,json,re,sys
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('root',nargs='?',default='.')
parser.add_argument('--context',choices=['source','update'],default='source')
args=parser.parse_args()
ROOT=Path(args.root).resolve()
CONTEXT=args.context
policy_path=ROOT/'shared/integrity/authority-boundary-policy.json'
system_policy_path=ROOT/'shared/integrity/system-file-policy.json'
manifest_path=ROOT/'package_manifest.json'
errors=[]
try: policy=json.loads(policy_path.read_text(encoding='utf-8'))
except Exception as e: print('AUTHORITY_BOUNDARY_POLICY_ERROR',e);raise SystemExit(1)
try: system_policy=json.loads(system_policy_path.read_text(encoding='utf-8'))
except Exception as e: print('SYSTEM_FILE_POLICY_ERROR',e);raise SystemExit(1)
phase=policy.get('phase')
root_pd=ROOT/policy['authority']['system_path']
if phase=='migration_retained_non_authoritative':
    if CONTEXT=='source':
        if not root_pd.is_file(): errors.append('AUTHORITY_MIGRATION_RESIDUE_MISSING')
    elif root_pd.exists():
        errors.append('AUTHORITY_FILE_INCLUDED_IN_UPDATE')
    cls=system_policy.get('classes',{}).get(policy['migration']['required_class'],{})
    if policy['authority']['system_path'] not in cls.get('exact_paths',[]): errors.append('AUTHORITY_MIGRATION_CLASS_MISSING')
elif phase=='post_delete':
    if root_pd.exists(): errors.append('AUTHORITY_FILE_REINTRODUCED project-data.json')
else: errors.append('AUTHORITY_BOUNDARY_PHASE_INVALID '+str(phase))
# Manifest must never carry Authority residue during migration/post-delete.
if manifest_path.is_file():
    try:
        manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
        paths=[x.get('path') for x in manifest.get('files',[]) if isinstance(x,dict)]
        if policy['authority']['system_path'] in paths: errors.append('AUTHORITY_FILE_LISTED_IN_PACKAGE_MANIFEST')
    except Exception as e: errors.append('PACKAGE_MANIFEST_PARSE_ERROR '+str(e))
# Persistent connection schema is source-defined exact JSON contract in index.html.
index=(ROOT/'studio/index.html').read_text(encoding='utf-8')
required="localStorage.setItem(AUTHORITY_CONNECTION_KEY,JSON.stringify({owner,repository}))"
if required not in index: errors.append('AUTHORITY_PERSISTENT_SCHEMA_NOT_EXACT_OWNER_REPOSITORY')
# Authority functions may not use ambient/legacy Git credential symbols.
def function_body(source,name):
    m=re.search(r'(?:async\s+)?function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',source)
    if not m:return None
    i=m.end()-1;depth=0;quote=None;escape=False
    for j in range(i,len(source)):
        ch=source[j]
        if quote:
            if escape: escape=False
            elif ch=='\\': escape=True
            elif ch==quote: quote=None
            continue
        if ch in "'\"`": quote=ch;continue
        if ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:return source[m.start():j+1]
    return None
authority_functions=re.findall(r'(?:async\s+)?function\s+((?:authority|Authority|ghRequestWithExplicitConfig|getAuthority|getGitHeadExplicit|getGitBlobBytesExplicit|createGitBlobExplicit|createGitTreeExplicit|createGitCommitExplicit|updateGitRefExplicit|pullFromAuthority|pushToAuthority|buildAuthority|commitAuthority|testAuthority|loadAuthority|saveAuthority|clearAuthority|hasAuthority|activateProjectFromStorage|captureAuthority|assertAuthority)[A-Za-z0-9_]*)\s*\(',index)
for name in sorted(set(authority_functions)):
    body=function_body(index,name)
    if not body: errors.append('AUTHORITY_FUNCTION_PARSE_FAILED '+name);continue
    for symbol in policy.get('forbidden_authority_symbol_dependencies',[]):
        if re.search(r'\b'+re.escape(symbol)+r'\b',body): errors.append(f'AUTHORITY_CROSS_COPY {name} {symbol}')
    for call in policy.get('forbidden_authority_calls',[]):
        if re.search(r'\b'+re.escape(call)+r'\s*\(',body): errors.append(f'AUTHORITY_AMBIENT_TRANSPORT {name} {call}')
# Actual credentials in source text files. Regex definitions do not match themselves.
patterns=[re.compile(x) for x in policy.get('credential_patterns',[])]
text_suffix={'.js','.json','.html','.php','.py','.md','.txt','.css','.xml','.yml','.yaml','.webmanifest'}
for path in ROOT.rglob('*'):
    if not path.is_file() or '.git' in path.parts or path.suffix.lower() not in text_suffix: continue
    try:text=path.read_text(encoding='utf-8')
    except Exception:continue
    for rx in patterns:
        for match in rx.finditer(text):
            token=match.group(0)
            if '[A-' in token or '.*' in token: continue
            errors.append(f'AUTHORITY_CREDENTIAL_MATERIAL {path.relative_to(ROOT).as_posix()}')
            break
        if errors and errors[-1].startswith('AUTHORITY_CREDENTIAL_MATERIAL '+path.relative_to(ROOT).as_posix()): break
if errors:
    print('\n'.join(errors));raise SystemExit(1)
print('AUTHORITY_BOUNDARY_OK phase='+str(phase)+' context='+CONTEXT)
