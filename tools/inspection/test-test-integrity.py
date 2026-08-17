#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
CHECK = ROOT / 'tools/integrity/check-test-integrity.py'
POLICY = ROOT / 'shared/integrity/test-integrity-policy.json'

def write_json(path: Path, data):
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def sha(path: Path): return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
def run(base: Path, applied: Path, approval: Path|None=None):
    cmd=[sys.executable,'-S','-B',str(CHECK),str(base),str(applied)]
    if approval: cmd += ['--approval-file',str(approval)]
    env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
    return subprocess.run(cmd,cwd=ROOT,env=env,text=True,capture_output=True,timeout=10)
def fixture(root: Path, build='GKS-B620', body="assert.strictEqual(value, 1);\n"):
    (root/'shared/integrity').mkdir(parents=True,exist_ok=True); shutil.copy2(POLICY,root/'shared/integrity/test-integrity-policy.json')
    write_json(root/'package-build.json',{'game_build':'GA-B486.197','studio_build':build})
    p=root/'tests/example.js';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body,encoding='utf-8')
    write_json(root/'shared/tests/test-registry.json',{'schema_version':1,'release_gate':[{'path':'tests/example.js','runtime':'node'}],'historical_gap':[]})

def approval_for(path: Path, base: Path, applied: Path, changes: list[str]):
    entries=[]
    for rel in changes:
        entries.append({'path':rel,'baseline_sha256':sha(base/rel),'updated_sha256':sha(applied/rel),'reason':'explicit regression fixture approval'})
    write_json(path,{
        'schema_version':1,'scope':'PROTECTED_TEST_CHANGE','actor_type':'human','approved_by':'regression-human-fixture','entries':entries
    })

def main():
    errors=[]
    with tempfile.TemporaryDirectory(prefix='test-integrity-regression-') as td:
        t=Path(td); base=t/'base'; applied=t/'applied'; fixture(base); shutil.copytree(base,applied)
        r=run(base,applied)
        if r.returncode: errors.append('UNCHANGED_REJECTED '+r.stdout+r.stderr)
        # Build token-only change is allowed without approval.
        (applied/'tests/example.js').write_text("const build='GKS-B621'; assert.strictEqual(value, 1);\n",encoding='utf-8')
        (base/'tests/example.js').write_text("const build='GKS-B620'; assert.strictEqual(value, 1);\n",encoding='utf-8')
        write_json(applied/'package-build.json',{'game_build':'GA-B486.197','studio_build':'GKS-B621'})
        r=run(base,applied)
        if r.returncode or 'build_only=1' not in r.stdout: errors.append('BUILD_ONLY_REJECTED '+r.stdout+r.stderr)
        # Logic weakening must fail without approval.
        (applied/'tests/example.js').write_text("const build='GKS-B621'; /* assertion removed */\n",encoding='utf-8')
        r=run(base,applied)
        if r.returncode==0 or 'PROTECTED_TEST_CHANGE_APPROVAL_REQUIRED' not in r.stdout: errors.append('LOGIC_CHANGE_NOT_BLOCKED '+r.stdout+r.stderr)
        approval=t/'external-approval.json'; approval_for(approval,base,applied,['tests/example.js'])
        r=run(base,applied,approval)
        if r.returncode or 'HUMAN_CONFIRMATION_REQUIRED' not in r.stdout: errors.append('EXACT_APPROVAL_REJECTED '+r.stdout+r.stderr)
        # Approval inside either trusted tree is not independent and must fail.
        packaged=applied/'TEST_CHANGE_APPROVAL.json'; approval_for(packaged,base,applied,['tests/example.js'])
        r=run(base,applied,packaged)
        if r.returncode==0 or 'MUST_BE_EXTERNAL' not in r.stdout: errors.append('PACKAGED_APPROVAL_NOT_BLOCKED '+r.stdout+r.stderr)
        # New protected files also require approval, closing module-shadow/additive bypasses.
        shutil.copytree(base,applied,dirs_exist_ok=True)
        write_json(applied/'package-build.json',{'game_build':'GA-B486.197','studio_build':'GKS-B621'})
        newp=applied/'tools/inspection/json.py';newp.parent.mkdir(parents=True,exist_ok=True);newp.write_text('# shadow attempt\n',encoding='utf-8')
        r=run(base,applied)
        if r.returncode==0 or 'tools/inspection/json.py' not in r.stdout: errors.append('PROTECTED_ADD_NOT_BLOCKED '+r.stdout+r.stderr)
        add_approval=t/'add-approval.json'; approval_for(add_approval,base,applied,['tools/inspection/json.py'])
        r=run(base,applied,add_approval)
        if r.returncode: errors.append('PROTECTED_ADD_APPROVAL_REJECTED '+r.stdout+r.stderr)
        # Extra approval entries must fail exact-set validation.
        (applied/'tests/example.js').write_text("const build='GKS-B621'; /* assertion removed */\n",encoding='utf-8')
        bad=t/'BAD_APPROVAL.json'
        write_json(bad,{'schema_version':1,'scope':'PROTECTED_TEST_CHANGE','actor_type':'human','approved_by':'fixture','entries':[
            {'path':'tests/example.js','baseline_sha256':sha(base/'tests/example.js'),'updated_sha256':sha(applied/'tests/example.js'),'reason':'ok'},
            {'path':'tests/extra.js','baseline_sha256':None,'updated_sha256':'0'*64,'reason':'extra'}]})
        r=run(base,applied,bad)
        if r.returncode==0 or 'PATH_MISMATCH' not in r.stdout: errors.append('EXTRA_APPROVAL_NOT_BLOCKED '+r.stdout+r.stderr)
    if errors:
        print('TEST_INTEGRITY_REGRESSION_FAIL');print('\n'.join(errors));return 1
    print('TEST_INTEGRITY_REGRESSION_OK cases=7 silent_weakening=blocked protected_add=blocked external_exact_human_approval=required build_token_only=allowed')
    return 0
if __name__=='__main__': raise SystemExit(main())
