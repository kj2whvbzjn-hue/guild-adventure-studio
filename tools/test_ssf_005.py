#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
s=(ROOT/'index.html').read_text(encoding='utf-8')
required=[
 'SSF-005 保護フィールド・明示承認・Export連携',
 'const STORY_PROMOTABLE_FIELDS=[\'summary\']',
 'const STORY_PROTECTED_FIELDS=',
 'function storyProtectedSnapshot(',
 'function verifyStoryProtectedSnapshot(',
 'function approveStoryCandidateRevision(',
 'function rejectStoryCandidateRevision(',
 'function markStoryNodeExportReady(',
 'storyApprovalConfirm',
 'approval_note',
 'promoted_from_hash',
 'promoted_to_hash',
 'approved_revision_id',
 'canonical_hash',
 "obj.summary=stored.text",
 "if(!window.storyApprovalConfirm?.checked)",
 "if(!note)",
 "candidate.status!=='approved'",
 "obj.summary!==candidate.text"
]
missing=[x for x in required if x not in s]
if missing: raise SystemExit('FAIL missing: '+', '.join(missing))
prohibited=[
 'obj.id=stored.', 'obj.title=stored.', 'obj.design=stored.',
 'automaticApprove', 'partialAdopt', 'autoExportStory'
]
for x in prohibited:
 if x in s: raise SystemExit('FAIL prohibited contract: '+x)
plan=(ROOT/'SGF_PHASE_PLAN.md').read_text(encoding='utf-8')
if '| SSF-005 | Candidate Revision, protected-field controls, explicit approval, and Export linkage | LOCALLY_IMPLEMENTED |' not in plan:
 raise SystemExit('FAIL phase plan not synchronized')
print('SSF-005 contract test: PASS')
