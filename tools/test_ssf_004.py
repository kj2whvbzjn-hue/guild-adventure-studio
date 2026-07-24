#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
s=(ROOT/'index.html').read_text(encoding='utf-8')
required=[
 'SSF-004 正本／候補プレビュー比較',
 'function storyLineDiff(',
 'function renderStoryCandidateComparison(',
 'function runStoryCandidateConsistencyValidation(',
 'source_design_version!==design.source_version',
 '承認・統合・Exportは行いません',
 'storyCompareCandidate',
 'storyDiffPreview'
]
missing=[x for x in required if x not in s]
if missing: raise SystemExit('FAIL missing: '+', '.join(missing))
for prohibited in ['approveStoryCandidateRevision()\">整合性を検証','automatic merge inside SSF-004']:
 if prohibited in s: raise SystemExit('FAIL unsafe SSF-004 contract: '+prohibited)
if "if(/\\x00/.test(candidate.text))errors.push('NUL文字が含まれています。');" not in s:
 raise SystemExit('FAIL NUL validation regression')
print('SSF-004 contract test: PASS')
