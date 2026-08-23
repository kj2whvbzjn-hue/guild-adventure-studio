#!/usr/bin/env python3
"""Lightweight syntax gate for Quick inspection.

Quick checks only critical JavaScript runtime files plus inspection/integrity Python.
Full retains the exhaustive JS/PHP/Python syntax sweep.

Runtime startup is batched: all critical JavaScript files are parsed by one Node
process and all critical PHP files by one PHP process. The checked file set and
fail-closed behavior remain unchanged.
"""
from __future__ import annotations
import json, shutil, subprocess, sys
from pathlib import Path

root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]).resolve()
errors=[]
manifest_path=root/'shared/integrity/critical-runtime-manifest.json'
try:
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'QUICK_SYNTAX_FAIL\nCRITICAL_RUNTIME_MANIFEST_INVALID {exc}')
    raise SystemExit(1)

critical=[str(x.get('path','')) for x in manifest.get('files',[]) if x.get('path')]
js_files=[root/p for p in critical if p.endswith('.js')]
php_files=[root/p for p in critical if p.endswith('.php')]

missing_js=[path for path in js_files if not path.is_file()]
for path in missing_js:
    errors.append(f'CRITICAL_JS_MISSING {path.relative_to(root).as_posix()}')
existing_js=[path for path in js_files if path.is_file()]
node=shutil.which('node')
if js_files and not node:
    errors.append('NODE_RUNTIME_MISSING')
elif node and existing_js:
    js_batch=r"""
const fs=require('fs');
const vm=require('vm');
const errors=[];
for(const file of process.argv.slice(1)){
  try{new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});}
  catch(e){errors.push(`${file}\t${e.message}`);}
}
if(errors.length){for(const e of errors)console.error(e);process.exit(1);}
"""
    proc=subprocess.run([node,'-e',js_batch,*map(str,existing_js)],cwd=root,text=True,capture_output=True)
    if proc.returncode:
        for line in proc.stderr.splitlines():
            if not line.strip():
                continue
            raw,sep,message=line.partition('\t')
            try: rel=Path(raw).resolve().relative_to(root).as_posix()
            except Exception: rel=raw
            errors.append(f'JAVASCRIPT_SYNTAX {rel} {message if sep else line}')

missing_php=[path for path in php_files if not path.is_file()]
for path in missing_php:
    errors.append(f'CRITICAL_PHP_MISSING {path.relative_to(root).as_posix()}')
existing_php=[path for path in php_files if path.is_file()]
php=shutil.which('php')
if php_files and not php:
    errors.append('PHP_RUNTIME_MISSING')
elif php and existing_php:
    php_batch='$errors=[]; foreach(array_slice($argv,1) as $path){ try { token_get_all((string)file_get_contents($path), TOKEN_PARSE); } catch (ParseError $e) { $errors[]=$path."\\t".$e->getMessage(); }} if($errors){fwrite(STDERR,implode("\\n",$errors)."\\n");exit(1);}'
    proc=subprocess.run([php,'-r',php_batch,'--',*map(str,existing_php)],cwd=root,text=True,capture_output=True)
    if proc.returncode:
        for line in proc.stderr.splitlines():
            if not line.strip():
                continue
            raw,sep,message=line.partition('\t')
            try: rel=Path(raw).resolve().relative_to(root).as_posix()
            except Exception: rel=raw
            errors.append(f'PHP_SYNTAX {rel} {message if sep else line}')

py_files=[]
for base in ('tools/inspection','tools/integrity'):
    d=root/base
    if d.is_dir():py_files.extend(sorted(d.rglob('*.py')))
for path in py_files:
    try:compile(path.read_text(encoding='utf-8'),str(path),'exec')
    except Exception as exc:errors.append(f'PYTHON_SYNTAX {path.relative_to(root).as_posix()} {exc}')

if errors:
    print('QUICK_SYNTAX_FAIL');print('\n'.join(errors));raise SystemExit(1)
print(f'QUICK_SYNTAX_OK js={len(js_files)} php={len(php_files)} python={len(py_files)}')
