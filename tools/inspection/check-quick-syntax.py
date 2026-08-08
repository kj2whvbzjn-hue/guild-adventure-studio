#!/usr/bin/env python3
"""Lightweight syntax gate for Quick inspection.

Quick checks only critical JavaScript runtime files plus inspection/integrity Python.
Full retains the exhaustive JS/PHP/Python syntax sweep.
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

node=shutil.which('node')
if js_files and not node:
    errors.append('NODE_RUNTIME_MISSING')
elif node:
    for path in js_files:
        if not path.is_file():
            errors.append(f'CRITICAL_JS_MISSING {path.relative_to(root).as_posix()}');continue
        proc=subprocess.run([node,'--check',str(path)],cwd=root,text=True,capture_output=True)
        if proc.returncode:
            errors.append(f'JAVASCRIPT_SYNTAX {path.relative_to(root).as_posix()} {proc.stderr.strip()}')

php=shutil.which('php')
if php_files and not php:
    errors.append('PHP_RUNTIME_MISSING')
elif php:
    for path in php_files:
        if not path.is_file():
            errors.append(f'CRITICAL_PHP_MISSING {path.relative_to(root).as_posix()}');continue
        proc=subprocess.run([php,'-l',str(path)],cwd=root,text=True,capture_output=True)
        if proc.returncode:
            errors.append(f'PHP_SYNTAX {path.relative_to(root).as_posix()} {proc.stderr.strip()}')

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
