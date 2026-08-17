#!/usr/bin/env python3
from __future__ import annotations
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
sys.dont_write_bytecode = True
ROOT=Path(__file__).resolve().parents[2]
PLAN=ROOT/'tools/inspection/plan-impact-tests.py'
REGISTRY_GATE=ROOT/'tools/integrity/check-test-registry.py'

def wj(p,d): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def seed(root:Path):
    (root/'shared/integrity').mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/'shared/integrity/impact-test-policy.json',root/'shared/integrity/impact-test-policy.json')
    wj(root/'package-build.json',{'game_build':'GA-B486.198','studio_build':'GKS-B620'})
    tests=[
      {'path':'tools/test_source_zip_binding.py','runtime':'python3'},
      {'path':'tests/studio-update-export-boundary-gks-b592.js','runtime':'node'},
      {'path':'tests/ai-production/schema-contract-r1.js','runtime':'node'},
      {'path':'tests/adventure-battle-core.js','runtime':'node'},
      {'path':'tests/adventure-battle-runtime-integration.js','runtime':'node'},
      {'path':'tests/device-test-harness-ga-b486-92.js','runtime':'node'},
      {'path':'tests/device-validation-fixture-ga-b486-93.js','runtime':'node'},
      {'path':'tests/counter-formal-regression-ga-b486-33.js','runtime':'node'},
      {'path':'tests/formal-follow-up-runtime-r04-c2.js','runtime':'node'},
      {'path':'tests/formal-trigger-action-guard-r04-e1.js','runtime':'node'},
      {'path':'tests/formal-trigger-closure-r04-e3.js','runtime':'node'},
      {'path':'tests/aura-revive-connection-ga-b486-28.js','runtime':'node'},
      {'path':'tests/battle-end-effect-clear-formal-p01-14.js','runtime':'node'}]
    wj(root/'shared/tests/test-registry.json',{'schema_version':1,'release_gate':tests,'historical_gap':[]})
    for x in tests:
      p=root/x['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_text('// test\n',encoding='utf-8')
    (root/'docs').mkdir(exist_ok=True);(root/'docs/a.md').write_text('a\n',encoding='utf-8')
    p=root/'shared/ai/ai-program-model.js';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('const a=1;\n',encoding='utf-8')
    p=root/'assets/shared/js/adventure-battle-core.js';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('const b=1;\n',encoding='utf-8')
    p=root/'tools/inspection/run.py';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('# gate\n',encoding='utf-8')

def plan(base,applied,out):
    env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
    r=subprocess.run([sys.executable,'-S','-B',str(PLAN),str(base),str(applied),'--json-output',str(out)],cwd=ROOT,env=env,text=True,capture_output=True,timeout=10)
    return r, json.loads(out.read_text(encoding='utf-8')) if out.is_file() else {}
def main():
    errors=[]
    with tempfile.TemporaryDirectory(prefix='impact-selection-regression-') as td:
      t=Path(td);base=t/'base';seed(base)
      # docs -> impact
      a=t/'docs';shutil.copytree(base,a);(a/'docs/a.md').write_text('b\n',encoding='utf-8');r,p=plan(base,a,t/'docs.json')
      if r.returncode or p.get('mode')!='impact':errors.append('DOCS_NOT_IMPACT '+r.stdout+r.stderr)
      # AI -> impact and AI tests selected
      a=t/'ai';shutil.copytree(base,a);(a/'shared/ai/ai-program-model.js').write_text('const a=2;\n',encoding='utf-8');r,p=plan(base,a,t/'ai.json')
      if p.get('mode')!='impact' or 'tests/ai-production/schema-contract-r1.js' not in p.get('selected_tests',[]):errors.append('AI_SELECTION_WRONG '+json.dumps(p))
      # Battle -> impact
      a=t/'battle';shutil.copytree(base,a);(a/'assets/shared/js/adventure-battle-core.js').write_text('const b=2;\n',encoding='utf-8');r,p=plan(base,a,t/'battle.json')
      if p.get('mode')!='impact' or 'tests/adventure-battle-core.js' not in p.get('selected_tests',[]):errors.append('BATTLE_SELECTION_WRONG '+json.dumps(p))
      # Gate -> Full
      a=t/'gate';shutil.copytree(base,a);(a/'tools/inspection/run.py').write_text('# weakened\n',encoding='utf-8');r,p=plan(base,a,t/'gate.json')
      if p.get('mode')!='full':errors.append('GATE_CHANGE_NOT_FULL '+json.dumps(p))
      # Unknown -> Full
      a=t/'unknown';shutil.copytree(base,a);p0=a/'mystery.js';p0.write_text('x\n',encoding='utf-8');r,p=plan(base,a,t/'unknown.json')
      if p.get('mode')!='full':errors.append('UNKNOWN_NOT_FULL '+json.dumps(p))
      # Build-token-only -> impact with no effective functional change
      a=t/'build';shutil.copytree(base,a);wj(a/'package-build.json',{'game_build':'GA-B486.198','studio_build':'GKS-B621'});p0=a/'docs/build.md';p0.parent.mkdir(parents=True,exist_ok=True);p0.write_text('GKS-B621\n',encoding='utf-8');(base/'docs/build.md').write_text('GKS-B620\n',encoding='utf-8');r,p=plan(base,a,t/'build.json')
      if p.get('mode')!='impact' or 'docs/build.md' in p.get('effective_changed_paths',[]):errors.append('BUILD_ONLY_NOT_IGNORED '+json.dumps(p))
      # Selection plans are cryptographically bound to the exact applied tree.
      a=t/'stale';shutil.copytree(base,a);(a/'shared/ai/ai-program-model.js').write_text('const a=2;\n',encoding='utf-8');plan_path=t/'stale-plan.json';r,p=plan(base,a,plan_path)
      (a/'shared/ai/ai-program-model.js').write_text('const a=3;\n',encoding='utf-8')
      env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
      rr=subprocess.run([sys.executable,'-S','-B',str(REGISTRY_GATE),str(a),'--context','source','--selection-file',str(plan_path)],cwd=ROOT,env=env,text=True,capture_output=True,timeout=10)
      if rr.returncode==0 or 'TEST_SELECTION_TREE_MISMATCH' not in (rr.stdout+rr.stderr):errors.append('STALE_SELECTION_NOT_BLOCKED '+rr.stdout+rr.stderr)
    if errors:print('IMPACT_SELECTION_REGRESSION_FAIL');print('\n'.join(errors));return 1
    print('IMPACT_SELECTION_REGRESSION_OK cases=7 fallback=full safety_critical=full scoped=impact build_only=ignored stale_plan=blocked')
    return 0
if __name__=='__main__':raise SystemExit(main())
