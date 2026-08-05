#!/usr/bin/env python3
"""Generate a non-destructive organization audit for the current project."""
from __future__ import annotations
import hashlib, json, re, sys
from collections import defaultdict
from pathlib import Path

args = sys.argv[1:]
root_arg = next((arg for arg in args if not arg.startswith('--')), '.')
ROOT = Path(root_arg).resolve()
WRITE_REPORTS = '--write' in args
OUT_JSON = ROOT / 'reports/organization-audit.json'
OUT_MD = ROOT / 'reports/organization-audit.md'
GENERATED_NAMES = {'ARTIFACT_SHA256SUMS.txt','SHA256SUMS.txt'}
TEXT_EXTS = {'.html','.js','.css','.json','.md','.txt','.py','.sh','.php','.csv','.webmanifest'}

def sha(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()

def category(rel: Path) -> str:
    first=rel.parts[0] if rel.parts else ''
    if first == 'studio': return 'studio-runtime'
    if first == 'game' or rel.as_posix() == 'index.html': return 'game-runtime'
    if first in {'shared','data'}: return first
    if first in {'tools','tests'}: return 'verification'
    if rel.suffix.lower() in {'.md','.txt'} or rel.name.startswith(('BUILD','RELEASE','DECISION','AUDIT','WORK_REPORT')): return 'documentation'
    return 'root-or-support'

files=[]
by_hash=defaultdict(list)
for p in sorted(ROOT.rglob('*')):
    if not p.is_file() or '.git' in p.parts or '__pycache__' in p.parts: continue
    rel=p.relative_to(ROOT)
    digest=sha(p)
    rec={'path':rel.as_posix(),'bytes':p.stat().st_size,'sha256':digest,'category':category(rel)}
    files.append(rec); by_hash[digest].append(rec)

duplicates=[]
for digest, group in by_hash.items():
    if len(group)>1:
        duplicates.append({'sha256':digest,'bytes':group[0]['bytes'],'paths':[x['path'] for x in group]})
duplicates.sort(key=lambda x:(-x['bytes'],x['paths']))

# Conservative filename reference scan. This is advisory only.
text=''
for rec in files:
    p=ROOT/rec['path']
    if p.suffix.lower() in TEXT_EXTS and p.stat().st_size < 2_000_000:
        try: text += '\n' + p.read_text(encoding='utf-8', errors='ignore')
        except OSError: pass
unused_candidates=[]
for rec in files:
    rel=Path(rec['path'])
    if rec['category'] not in {'root-or-support','documentation'}: continue
    if rel.name in GENERATED_NAMES or rel.name in {'index.html','README.md','DELETE_MANIFEST.txt'}: continue
    # Only mark as candidate if basename is unique enough and absent elsewhere.
    if len(rel.name) >= 8 and len(re.findall(re.escape(rel.name), text)) <= 1:
        unused_candidates.append({'path':rec['path'],'bytes':rec['bytes'],'reason':'filename not referenced by other scanned text; review only'})
unused_candidates.sort(key=lambda x:(-x['bytes'],x['path']))

summary=defaultdict(lambda:{'files':0,'bytes':0})
for rec in files:
    summary[rec['category']]['files']+=1; summary[rec['category']]['bytes']+=rec['bytes']
report={
 'mode':'non-destructive-audit',
 'root':ROOT.name,
 'summary':dict(sorted(summary.items())),
 'duplicate_groups':duplicates,
 'unused_review_candidates':unused_candidates,
 'safety':{
   'files_deleted':0,
   'runtime_paths_moved':0,
   'existing_public_urls_changed':False,
   'notes':'Candidates and duplicates are informational; no automatic deletion is authorized.'
 }
}
lines=['# Organization Audit','',
       'This is a non-destructive inventory. No files were deleted or moved.','',
       '## Category summary','', '| Category | Files | Bytes |','|---|---:|---:|']
for k,v in report['summary'].items(): lines.append(f"| {k} | {v['files']} | {v['bytes']} |")
lines += ['',f"## Exact duplicate groups: {len(duplicates)}",'',
          'Only byte-identical files are listed. Duplicate status does not mean safe to delete.']
for d in duplicates[:30]:
    lines.append(f"- `{d['bytes']}` bytes: " + ', '.join(f"`{p}`" for p in d['paths']))
if len(duplicates)>30: lines.append(f"- …and {len(duplicates)-30} more groups; see JSON report.")
lines += ['',f"## Unused review candidates: {len(unused_candidates)}",'',
          'These are filename-reference heuristics only. They must not be deleted without a later dependency review.']
for u in unused_candidates[:40]: lines.append(f"- `{u['path']}` ({u['bytes']} bytes)")
if len(unused_candidates)>40: lines.append(f"- …and {len(unused_candidates)-40} more candidates; see JSON report.")
lines += ['','## Safety result','','- Deleted files: 0','- Runtime files moved: 0','- Existing public URLs changed: no','']
if WRITE_REPORTS:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    OUT_MD.write_text('\n'.join(lines),encoding='utf-8')
print(f"ORGANIZATION_AUDIT_OK files={len(files)} duplicate_groups={len(duplicates)} candidates={len(unused_candidates)} reports_written={str(WRITE_REPORTS).lower()}")
