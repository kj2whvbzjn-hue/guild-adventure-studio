#!/usr/bin/env python3
from pathlib import Path
import json, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]).resolve()
startup=[
 'AI_START.md',
 'AI_PROJECT_INDEX.json',
 'AI_PROJECT_STATUS.json',
 'AI_WORK_RULES.md',
 'docs/operations/ARTIFACT_SUBMISSION_POLICY.md',
 'docs/operations/DELETION_POLICY.md',
 'package-build.json',
 'package_manifest.json',
]
governance=[
 'AI_START.md','AI_PROJECT_INDEX.json','AI_PROJECT_STATUS.json','AI_WORK_RULES.md',
 'docs/operations/ARTIFACT_SUBMISSION_POLICY.md',
 'docs/operations/DELETION_POLICY.md',
 'package-build.json',
 'package_manifest.json',
 'shared/integrity/artifact-submission-policy.json',
]
errors=[]
for rel in startup+['shared/integrity/artifact-submission-policy.json']:
 p=root/rel
 if not p.is_file() or not p.read_text(encoding='utf-8').strip(): errors.append('MISSING_OR_EMPTY '+rel)
try: manifest=json.loads((root/'ai-gateway-manifest.json').read_text(encoding='utf-8'))
except Exception as exc: errors.append('AI_MANIFEST_INVALID '+str(exc)); manifest={}
for rel in governance:
 if rel not in manifest.get('allowedFiles',[]): errors.append('NOT_ALLOWLISTED '+rel)
 if rel not in manifest.get('handoverFiles',[]): errors.append('NOT_IN_HANDOVER '+rel)
 if rel not in manifest.get('requiredGovernanceFiles',[]): errors.append('NOT_REQUIRED_GOVERNANCE '+rel)
start=(root/'AI_START.md').read_text(encoding='utf-8') if (root/'AI_START.md').is_file() else ''
sequence=startup[1:]
pos=[]
for rel in sequence:
 i=start.find('`'+rel+'`')
 if i<0: errors.append('START_SEQUENCE_MISSING '+rel)
 pos.append(i)
if all(i>=0 for i in pos) and pos != sorted(pos): errors.append('START_SEQUENCE_ORDER_INVALID')
if '必ず1つのZIP' not in start: errors.append('ZIP_RULE_MISSING_FROM_AI_START')
if '成果物生成を開始してはならない' not in start: errors.append('START_FAIL_CLOSED_MISSING')
for rel in ['AI_PROJECT_INDEX.json','AI_PROJECT_STATUS.json']:
 try: json.loads((root/rel).read_text(encoding='utf-8'))
 except Exception as exc: errors.append('STARTUP_JSON_INVALID '+rel+' '+str(exc))
gateway=(root/'ai-gateway.js').read_text(encoding='utf-8')
for token in ['loadGovernance','governance:await loadGovernance()','acknowledgementRequired:true','AI_START.md','AI_PROJECT_INDEX.json','AI_PROJECT_STATUS.json']:
 if token not in gateway: errors.append('GATEWAY_WIRING_MISSING '+token)
exporter=(root/'modules/verification/ai-export.js').read_text(encoding='utf-8')
export_sequence=[
 'governance/AI_START.md',
 'governance/AI_PROJECT_INDEX.json',
 'governance/AI_PROJECT_STATUS.json',
 'governance/AI_WORK_RULES.md',
 'governance/docs/operations/ARTIFACT_SUBMISSION_POLICY.md',
 'governance/docs/operations/DELETION_POLICY.md',
 'governance/package-build.json',
 'governance/package_manifest.json',
]
for token in ['loadRequiredGovernance','必ず1つのZIPで提出']+export_sequence:
 if token not in exporter: errors.append('AI_EXPORT_WIRING_MISSING '+token)
export_positions=[exporter.find(token) for token in export_sequence]
if all(i>=0 for i in export_positions) and export_positions != sorted(export_positions): errors.append('AI_EXPORT_START_SEQUENCE_ORDER_INVALID')
if '1. governance/AI_START.md' not in exporter or '8. governance/package_manifest.json' not in exporter: errors.append('AI_EXPORT_README_SEQUENCE_INCOMPLETE')
if '3. guides/verification-guide.md' in exporter or '4. data/design-cards.json\n5. data/project.json' in exporter: errors.append('AI_EXPORT_README_NUMBERING_LEGACY')
rules=(root/'AI_WORK_RULES.md').read_text(encoding='utf-8')
if 'AI_START.md' not in rules or '必ず1つのZIP' not in rules: errors.append('START_OR_ZIP_RULE_MISSING_FROM_AI_RULES')
policy=json.loads((root/'shared/integrity/artifact-submission-policy.json').read_text(encoding='utf-8'))
if policy.get('default')!='zip_required_for_every_uploaded_artifact': errors.append('MACHINE_POLICY_DEFAULT_INVALID')
if not policy.get('ai_requirements',{}).get('fail_closed_when_rules_unavailable'): errors.append('MACHINE_POLICY_NOT_FAIL_CLOSED')
if errors:
 print('AI_GOVERNANCE_FAIL'); print('\n'.join(errors)); raise SystemExit(1)
print(f'AI_GOVERNANCE_OK startup={len(startup)} governance={len(governance)} gateway=connected studio_export=connected fail_closed=true')
