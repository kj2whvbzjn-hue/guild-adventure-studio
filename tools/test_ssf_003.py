#!/usr/bin/env python3
from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
text=(root/'index.html').read_text(encoding='utf-8')
ids=['storyPasteInput','storyPasteAuthor','storyPasteNote','storyPasteValidation','storyCandidateList']
funcs=['normalizeStoryCandidate','storyTextHash','storyPasteIntakePayload','validateStoryPasteIntake','createStoryCandidateRevision','renderStoryCandidateList']
errors=[]
for x in ids:
    if f'id="{x}"' not in text: errors.append('MISSING_ID '+x)
for x in funcs:
    if not re.search(rf'function\s+{re.escape(x)}\s*\(',text): errors.append('MISSING_FUNCTION '+x)
for token in ['candidate_revisions','content_hash','source_design_version','IDEMPOTENT','正本は未変更']:
    if token not in text: errors.append('MISSING_CONTRACT '+token)
if 'obj.summary=storyPasteInput.value' in text or 'obj.summary=text' in text:
    errors.append('DIRECT_OVERWRITE_DETECTED')
phase=(root/'SGF_PHASE_PLAN.md').read_text(encoding='utf-8')
if 'SSF-003' not in phase: errors.append('PHASE_MISSING')
print('SSF003_UI_FIELDS='+str(len(ids)))
print('SSF003_FUNCTIONS='+str(len(funcs)))
for e in errors: print('ERROR',e)
print('SSF_003_RESULT='+('PASS' if not errors else 'FAIL'))
sys.exit(1 if errors else 0)
