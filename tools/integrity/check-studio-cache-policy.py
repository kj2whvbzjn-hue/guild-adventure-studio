#!/usr/bin/env python3
"""Fail closed if Studio can prefer stale same-origin code/data over the network."""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]).resolve()
errors=[]

try:
    build=json.loads((root/'package-build.json').read_text(encoding='utf-8'))
    studio_build=str(build.get('studio_build',''))
except Exception as exc:
    print(f'STUDIO_CACHE_POLICY_FAIL\nPACKAGE_BUILD_INVALID {exc}')
    raise SystemExit(1)

match=re.fullmatch(r'GKS-B(\d+)',studio_build)
if not match:
    errors.append(f'STUDIO_BUILD_INVALID {studio_build!r}')
    build_no=''
else:
    build_no=match.group(1)

try:
    html=(root/'studio/index.html').read_text(encoding='utf-8')
    sw=(root/'studio/sw.js').read_text(encoding='utf-8')
except Exception as exc:
    print(f'STUDIO_CACHE_POLICY_FAIL\nSTUDIO_CACHE_SOURCE_MISSING {exc}')
    raise SystemExit(1)

if build_no:
    if f"navigator.serviceWorker.register('./sw.js?v={build_no}'" not in html:
        errors.append('SW_REGISTRATION_BUILD_MISMATCH')
    if f'const CACHE_NAME="gks-studio-b{build_no}"' not in sw:
        errors.append('SW_CACHE_NAMESPACE_BUILD_MISMATCH')
    if f"const OFFLINE_URL='./index.html?appv={build_no}'" not in sw:
        errors.append('SW_OFFLINE_URL_BUILD_MISMATCH')

if "{updateViaCache:'none'}" not in html:
    errors.append('SW_UPDATE_CACHE_BYPASS_MISSING')
if 'async function precacheFreshAppShell()' not in sw:
    errors.append('FRESH_PRECACHE_MISSING')
if "fetch(request,{cache:'no-store'})" not in sw:
    errors.append('NETWORK_NO_STORE_MISSING')
if 'cache.addAll(APP_SHELL)' in sw:
    errors.append('STALE_PRECACHE_ADDALL_FORBIDDEN')
if "if(url.origin===self.location.origin){" not in sw:
    errors.append('SAME_ORIGIN_FETCH_POLICY_MISSING')
if 'event.respondWith(networkFirst(request))' not in sw:
    errors.append('SAME_ORIGIN_NOT_NETWORK_FIRST')
if re.search(r'\bcacheFirst\s*\(',sw):
    errors.append('CACHE_FIRST_CALL_FORBIDDEN')

if "self.addEventListener('install'" not in sw or 'precacheFreshAppShell()' not in sw:
    errors.append('INSTALL_FRESH_PRECACHE_NOT_ENFORCED')

if 'async function networkFirst(request)' not in sw:
    errors.append('NETWORK_FIRST_FUNCTION_MISSING')
if "fetch(request,{cache:'no-store'})" not in sw:
    errors.append('NETWORK_FIRST_NO_STORE_MISSING')
if 'caches.match(request)' not in sw:
    errors.append('NETWORK_FIRST_OFFLINE_FALLBACK_MISSING')

if errors:
    print('STUDIO_CACHE_POLICY_FAIL')
    print('\n'.join(sorted(set(errors))))
    raise SystemExit(1)
print(f'STUDIO_CACHE_POLICY_PASS studio_build={studio_build} strategy=network-first-no-store offline_fallback=cache')
