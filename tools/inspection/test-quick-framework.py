#!/usr/bin/env python3
"""Regression checks for the Quick inspection framework itself."""
from __future__ import annotations
import hashlib,json,shutil,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PY=sys.executable

def run(script:Path,args:list[str],cwd:Path):
    return subprocess.run([PY,'-B',str(script),*args],cwd=cwd,text=True,capture_output=True)

def write_json(path:Path,value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def context_fixture(tmp:Path,version:str,include_controls:bool=True,expected_version:str='GKS-B485'):
    (tmp/'shared/integrity').mkdir(parents=True,exist_ok=True);(tmp/'tools/inspection').mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'shared/integrity/system-file-policy.json',tmp/'shared/integrity/system-file-policy.json')
    shutil.copy2(ROOT/'tools/inspection/system_file_policy.py',tmp/'tools/inspection/system_file_policy.py')
    write_json(tmp/'package-build.json',{'studio_build':expected_version})
    write_json(tmp/'package_manifest.json',{'schema_version':1,'file_count':0,'files':[]})
    if include_controls:
        write_json(tmp/'studio-update.json',{'version':version,'studio_version':version,'formal_build':None})
        (tmp/'DELETE_MANIFEST.txt').write_text('# no deletion\n',encoding='utf-8')

def syntax_fixture(tmp:Path,source:str|None):
    (tmp/'shared/integrity').mkdir(parents=True,exist_ok=True)
    files=[]
    if source is not None:
        (tmp/'app.js').write_text(source,encoding='utf-8');files=[{'path':'app.js'}]
    else:files=[{'path':'missing.js'}]
    write_json(tmp/'shared/integrity/critical-runtime-manifest.json',{'schema_version':1,'files':files})

errors=[]
with tempfile.TemporaryDirectory(prefix='quick-framework-test-') as td:
    base=Path(td)
    # Current component version must pass update context.
    a=base/'version-ok';context_fixture(a,'GKS-B485')
    r=run(ROOT/'tools/inspection/check-context.py',[str(a),'--context','update'],a)
    if r.returncode!=0:errors.append('CURRENT_VERSION_REJECTED '+r.stdout+r.stderr)
    # Future component versions must pass without editing inspection code.
    future=base/'version-future';context_fixture(future,'GKS-B777',expected_version='GKS-B777')
    r=run(ROOT/'tools/inspection/check-context.py',[str(future),'--context','update'],future)
    if r.returncode!=0:errors.append('FUTURE_VERSION_REJECTED '+r.stdout+r.stderr)
    # Wrong version must fail.
    b=base/'version-bad';context_fixture(b,'GKS-B999')
    r=run(ROOT/'tools/inspection/check-context.py',[str(b),'--context','update'],b)
    if r.returncode==0 or 'STUDIO_VERSION_UNEXPECTED' not in r.stdout:errors.append('WRONG_VERSION_NOT_REJECTED')
    # Missing update controls must fail.
    c=base/'update-invalid';context_fixture(c,'GKS-B485',include_controls=False)
    r=run(ROOT/'tools/inspection/check-context.py',[str(c),'--context','update'],c)
    if r.returncode==0 or 'UPDATE_MISSING_REQUIRED' not in r.stdout:errors.append('INVALID_UPDATE_NOT_REJECTED')
    # JavaScript syntax error must fail lightweight syntax.
    d=base/'js-bad';syntax_fixture(d,'function broken( {')
    r=run(ROOT/'tools/inspection/check-quick-syntax.py',[str(d)],d)
    if r.returncode==0 or 'JAVASCRIPT_SYNTAX' not in r.stdout:errors.append('JS_SYNTAX_NOT_REJECTED')
    # Missing critical file must fail lightweight syntax.
    e=base/'critical-missing';syntax_fixture(e,None)
    r=run(ROOT/'tools/inspection/check-quick-syntax.py',[str(e)],e)
    if r.returncode==0 or 'CRITICAL_JS_MISSING' not in r.stdout:errors.append('CRITICAL_MISSING_NOT_REJECTED')
    # Package manifest hash mismatch must fail.
    f=base/'manifest-bad';(f/'shared/integrity').mkdir(parents=True,exist_ok=True);(f/'tools/inspection').mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'shared/integrity/system-file-policy.json',f/'shared/integrity/system-file-policy.json')
    shutil.copy2(ROOT/'tools/inspection/system_file_policy.py',f/'tools/inspection/system_file_policy.py')
    (f/'sample.txt').write_text('actual',encoding='utf-8')
    write_json(f/'package_manifest.json',{'schema_version':1,'file_count':1,'files':[{'path':'sample.txt','size':5,'sha256':'0'*64}]})
    r=run(ROOT/'tools/integrity/check-package-manifest.py',[str(f)],f)
    if r.returncode==0 or 'HASH_MISMATCH' not in r.stdout:errors.append('MANIFEST_MISMATCH_NOT_REJECTED')
    # Protected deletion without approval must fail.
    g=base/'delete-bad';(g/'shared/integrity').mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'shared/integrity/delete-policy.json',g/'shared/integrity/delete-policy.json')
    (g/'DELETE_MANIFEST.txt').write_text('studio/index.html\n',encoding='utf-8')
    r=run(ROOT/'tools/integrity/check-delete-manifest.py',[str(g)],g)
    if r.returncode==0 or 'PROTECTED_PATH' not in r.stdout:errors.append('PROTECTED_DELETE_NOT_REJECTED')

if errors:
    print('QUICK_FRAMEWORK_REGRESSION_FAIL');print('\n'.join(errors));raise SystemExit(1)
print('QUICK_FRAMEWORK_REGRESSION_OK cases=8')
