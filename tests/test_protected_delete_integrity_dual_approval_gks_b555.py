#!/usr/bin/env python3
from __future__ import annotations
import json, shutil, subprocess, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHECKER=ROOT/'tools/integrity/check-delete-manifest.py'
POLICY=ROOT/'shared/integrity/delete-policy.json'

def write_json(p,v):
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def run(tmp):
    return subprocess.run([sys.executable,'-S','-B',str(CHECKER),str(tmp)],text=True,capture_output=True)

with tempfile.TemporaryDirectory(prefix='protected-delete-dual-') as td:
    base=Path(td)
    (base/'shared/integrity').mkdir(parents=True)
    shutil.copy2(POLICY,base/'shared/integrity/delete-policy.json')

    # Protected path without approval is rejected.
    (base/'DELETE_MANIFEST.txt').write_text('tests/old-test.js\n',encoding='utf-8')
    r=run(base)
    assert r.returncode!=0 and 'PROTECTED_PATH path=tests/old-test.js' in r.stdout,(r.stdout,r.stderr)

    # Ordinary approval without explicit protected flag is rejected.
    approval={'schema_version':1,'approval_scope':'single_update','approval_actor_type':'human','approved_by':'tester',
      'approved_at':'2026-08-13T00:00:00Z','general_instruction_used_as_approval':False,'deletion_controls_changed':False,
      'entries':[{'path':'tests/old-test.js','category':'migration_complete','reason':'migrated','non_delete_alternative':'cutover completed',
      'impact':'old test only','recovery':'git','protected_delete':False}]}
    write_json(base/'DELETE_APPROVAL.json',approval)
    r=run(base)
    assert r.returncode!=0 and 'PROTECTED_DELETE_APPROVAL_REQUIRED path=tests/old-test.js' in r.stdout,(r.stdout,r.stderr)

    # Explicit protected intent is checker-valid. Studio still supplies the second runtime human approval.
    approval['entries'][0]['protected_delete']=True
    write_json(base/'DELETE_APPROVAL.json',approval)
    r=run(base)
    assert r.returncode==0 and 'protected=1' in r.stdout,(r.stdout,r.stderr)

    # Deletion-control paths remain undeletable even with protected approval.
    (base/'DELETE_MANIFEST.txt').write_text('studio/index.html\n',encoding='utf-8')
    approval['entries'][0]['path']='studio/index.html'
    write_json(base/'DELETE_APPROVAL.json',approval)
    r=run(base)
    assert r.returncode!=0 and 'DELETION_CONTROL_PATH_DELETE_FORBIDDEN path=studio/index.html' in r.stdout,(r.stdout,r.stderr)

print('PROTECTED_DELETE_INTEGRITY_DUAL_APPROVAL_PASS')
