#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent

def run(cmd, cwd):
    env=os.environ.copy(); env['PYTHONDONTWRITEBYTECODE']='1'; env.pop('PYTHONPYCACHEPREFIX',None)
    return subprocess.run(cmd,cwd=cwd,env=env,text=True,capture_output=True,timeout=10)

def load_runner():
    p=HERE/'run.py'; spec=importlib.util.spec_from_file_location('full_runner',p)
    mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod

def main():
    errors=[]
    runner=load_runner()
    names=[x[0] for x in runner.build_steps('full',None,'source')]
    expected=[
      'inspection_context','ai_governance','encoding_iphone','required_paths_and_json',
      'html_links','package_metadata','studio_cache_policy','critical_runtime','package_manifest',
      'javascript_syntax','php_syntax','python_syntax','organization','shared_assets',
      'component_map','runtime_boundary','deployment_map','root_surface',
      'source_update_application_regression','test_integrity_regression','impact_selection_regression',
      'timeout_classification_regression','active_test_gate','github_candidate'
    ]
    missing=[x for x in expected if x not in names]
    if missing: errors.append('FULL_STEP_REMOVED '+','.join(missing))
    zip_names=[x[0] for x in runner.build_steps('full',None,'source',input_zip=Path('/tmp/source.zip'))]
    if 'source_zip_binding' not in zip_names: errors.append('INPUT_ZIP_BINDING_STEP_MISSING')
    try:
        runner.build_steps('quick',None,'update')
        errors.append('UPDATE_BASELINE_NOT_REQUIRED')
    except ValueError as exc:
        if 'baseline' not in str(exc): errors.append('UPDATE_BASELINE_WRONG_ERROR '+str(exc))
    try:
        runner.build_steps('accept',None,'source')
        errors.append('ACCEPT_SOURCE_CONTEXT_NOT_REJECTED')
    except ValueError as exc:
        if 'update' not in str(exc): errors.append('ACCEPT_SOURCE_CONTEXT_WRONG_ERROR '+str(exc))
    try:
        runner.build_steps('impact',None,'source')
        errors.append('IMPACT_SELECTION_NOT_REQUIRED')
    except ValueError as exc:
        if 'test-selection' not in str(exc): errors.append('IMPACT_SELECTION_WRONG_ERROR '+str(exc))
    update_names=[x[0] for x in runner.build_steps('full',None,'update',baseline_source=Path('/tmp/baseline'))]
    if 'source_update_applied_state' not in update_names: errors.append('APPLIED_STATE_GATE_MISSING')
    if 'active_test_gate' in update_names or 'organization' in update_names:
        errors.append('DUPLICATE_FULL_STEPS_REINTRODUCED')
    accept_names=[x[0] for x in runner.build_steps('accept',None,'update',baseline_source=Path('/tmp/baseline'))]
    if 'source_update_applied_state' not in accept_names: errors.append('ACCEPT_APPLIED_STATE_MISSING')
    for name,cmd,_ in runner.build_steps('full',None,'source'):
        if cmd and cmd[0]==sys.executable and name not in ('javascript_syntax','php_syntax'):
            if '-S' not in cmd[:4] or '-B' not in cmd[:4]:
                errors.append('PYTHON_CHILD_NOT_ISOLATED '+name)
    with tempfile.TemporaryDirectory(prefix='gk-full-regression-') as td:
        t=Path(td)
        (t/'ok.js').write_text("function ok(){return 1;}\n",encoding='utf-8')
        p=run(['node',str(HERE/'check-full-javascript-syntax.js'),str(t)],t)
        if p.returncode: errors.append('VALID_JS_REJECTED '+p.stderr)
        (t/'bad.js').write_text("function {\n",encoding='utf-8')
        p=run(['node',str(HERE/'check-full-javascript-syntax.js'),str(t)],t)
        if p.returncode==0: errors.append('INVALID_JS_NOT_DETECTED')
        (t/'bad.js').unlink()
        (t/'ok.php').write_text("<?php function ok(){ return 1; }\n",encoding='utf-8')
        p=run(['php',str(HERE/'check-full-php-syntax.php'),str(t)],t)
        if p.returncode: errors.append('VALID_PHP_REJECTED '+p.stderr)
        (t/'bad.php').write_text("<?php function broken( {\n",encoding='utf-8')
        p=run(['php',str(HERE/'check-full-php-syntax.php'),str(t)],t)
        if p.returncode==0: errors.append('INVALID_PHP_NOT_DETECTED')

        cache_root=t/'cache-policy'; (cache_root/'studio').mkdir(parents=True)
        (cache_root/'package-build.json').write_text('{"studio_build":"GKS-B777"}\n',encoding='utf-8')
        (cache_root/'studio/index.html').write_text(
            "navigator.serviceWorker.register('./sw.js?v=777',{updateViaCache:'none'});\n",encoding='utf-8')
        good_sw="""const CACHE_NAME=\"gks-studio-b777\";
const OFFLINE_URL='./index.html?appv=777';
const APP_SHELL=[];
async function precacheFreshAppShell(){const cache=await caches.open(CACHE_NAME);const request=new Request('x',{cache:'no-store'});const response=await fetch(request,{cache:'no-store'});await cache.put(request,response.clone());}
self.addEventListener('install',event=>{event.waitUntil(precacheFreshAppShell());});
async function networkFirst(request){try{const response=await fetch(request,{cache:'no-store'});return response;}catch(error){const cached=await caches.match(request);if(cached)return cached;throw error;}}
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(url.origin===self.location.origin){event.respondWith(networkFirst(request));}});
"""
        (cache_root/'studio/sw.js').write_text(good_sw,encoding='utf-8')
        p=run([sys.executable,'-S','-B',str(ROOT/'tools/integrity/check-studio-cache-policy.py'),str(cache_root)],cache_root)
        if p.returncode: errors.append('SAFE_STUDIO_CACHE_POLICY_REJECTED '+p.stdout+p.stderr)
        (cache_root/'studio/sw.js').write_text(good_sw.replace('event.respondWith(networkFirst(request))','event.respondWith(cacheFirst(request))'),encoding='utf-8')
        p=run([sys.executable,'-S','-B',str(ROOT/'tools/integrity/check-studio-cache-policy.py'),str(cache_root)],cache_root)
        if p.returncode==0: errors.append('UNSAFE_STUDIO_CACHE_POLICY_NOT_DETECTED')
    if errors:
        print('\n'.join(errors)); return 1
    print(f'FULL_FRAMEWORK_REGRESSION_OK required_steps={len(expected)} cases=12')
    return 0

if __name__=='__main__': raise SystemExit(main())
