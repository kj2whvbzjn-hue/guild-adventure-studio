#!/usr/bin/env python3
from pathlib import Path
import csv,json,re,sys
root=Path(__file__).resolve().parents[1]
errors=[]; warnings=[]
# JSON syntax
for p in root.rglob('*.json'):
    try: json.loads(p.read_text(encoding='utf-8-sig'))
    except Exception as e: errors.append(f'JSON_INVALID {p.relative_to(root)}: {e}')
# decision synchronization
jp=root/'decision_tracker.json'; cp=root/'decision_tracker.csv'
if jp.exists() and cp.exists():
    jd=json.loads(jp.read_text(encoding='utf-8-sig')).get('data',[])
    with cp.open(encoding='utf-8-sig',newline='') as f: cd=list(csv.DictReader(f))
    ji=[x.get('id') for x in jd]; ci=[x.get('id') for x in cd]
    if len(ji)!=len(set(ji)): errors.append('DECISION_DUPLICATE_ID_JSON')
    if len(ci)!=len(set(ci)): errors.append('DECISION_DUPLICATE_ID_CSV')
    if ji!=ci: errors.append('DECISION_ORDER_OR_MEMBERSHIP_MISMATCH')
    for a,b in zip(jd,cd):
        for k in cd[0].keys() if cd else []:
            if str(a.get(k,''))!=str(b.get(k,'')): errors.append(f'DECISION_FIELD_MISMATCH {a.get("id")} {k}')
# build consistency
version=(root/'VERSION.txt').read_text(encoding='utf-8')
m=re.search(r'Build\s+(\d+)',version); build=m.group(1) if m else None
su=json.loads((root/'studio-update.json').read_text(encoding='utf-8'))
if build!=str(su.get('build')): errors.append('BUILD_VERSION_STUDIO_UPDATE_MISMATCH')
for p in [root/'manifest.webmanifest',root/'sw.js']:
    txt=p.read_text(encoding='utf-8')
    for x in re.findall(r'(?:appv=|\?v=|build)(\d+)',txt,re.I):
        if x!=build: errors.append(f'PWA_BUILD_MISMATCH {p.name}: {x}!={build}')

# formal release manifest consistency
fm=root/'CPF_FORMAL_RELEASE_MANIFEST.json'
if fm.exists():
    formal=json.loads(fm.read_text(encoding='utf-8-sig'))
    if str(formal.get('build'))!=str(build): errors.append('FORMAL_MANIFEST_BUILD_MISMATCH')
    previous=formal.get('previous_build')
    if previous is not None and int(previous)>=int(build): errors.append('FORMAL_MANIFEST_PREVIOUS_BUILD_INVALID')
    for doc in formal.get('formal_documents',[]):
        if not (root/doc).exists(): errors.append(f'FORMAL_DOCUMENT_MISSING {doc}')
# frozen-generation boundary consistency
phase=(root/'CPF_PHASE_PLAN.md').read_text(encoding='utf-8')
prohibited=['SGF manages automatic plot/chapter/section generation','Plot Generator\n5. Chapter Generator','Single-chapter regeneration']
for text in prohibited:
    if text in phase: errors.append(f'CPF_PHASE_FROZEN_FUNCTION_ACTIVE {text}')

# prohibited root decision entries
raw=json.loads(jp.read_text(encoding='utf-8'))
for k in raw:
    if k.startswith('DEC-'): errors.append(f'DECISION_OUTSIDE_DATA {k}')
print(f'AUDIT_BUILD={build}')
print(f'JSON_FILES={sum(1 for _ in root.rglob("*.json"))}')
print(f'DECISIONS={len(json.loads(jp.read_text(encoding="utf-8"))["data"])}')
for w in warnings: print('WARN',w)
for e in errors: print('ERROR',e)
print('AUDIT_RESULT=' + ('PASS' if not errors else 'FAIL'))
sys.exit(1 if errors else 0)
