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
      'html_links','package_metadata','critical_runtime','package_manifest',
      'javascript_syntax','php_syntax','python_syntax','organization','shared_assets',
      'component_map','runtime_boundary','deployment_map','root_surface',
      'active_test_gate','github_candidate'
    ]
    missing=[x for x in expected if x not in names]
    if missing: errors.append('FULL_STEP_REMOVED '+','.join(missing))
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
    if errors:
        print('\n'.join(errors)); return 1
    print(f'FULL_FRAMEWORK_REGRESSION_OK required_steps={len(expected)} cases=4')
    return 0

if __name__=='__main__': raise SystemExit(main())
