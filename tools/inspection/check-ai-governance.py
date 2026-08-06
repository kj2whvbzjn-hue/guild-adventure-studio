#!/usr/bin/env python3
from pathlib import Path
import json, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]).resolve()
required=[
 'AI_WORK_RULES.md',
 'docs/operations/ARTIFACT_SUBMISSION_POLICY.md',
 'shared/integrity/artifact-submission-policy.json',
]
errors=[]
for rel in required:
 p=root/rel
 if not p.is_file() or not p.read_text(encoding='utf-8').strip(): errors.append('MISSING_OR_EMPTY '+rel)
try: manifest=json.loads((root/'ai-gateway-manifest.json').read_text(encoding='utf-8'))
except Exception as exc: errors.append('AI_MANIFEST_INVALID '+str(exc)); manifest={}
for rel in required:
 if rel not in manifest.get('allowedFiles',[]): errors.append('NOT_ALLOWLISTED '+rel)
 if rel not in manifest.get('handoverFiles',[]): errors.append('NOT_IN_HANDOVER '+rel)
 if rel not in manifest.get('requiredGovernanceFiles',[]): errors.append('NOT_REQUIRED_GOVERNANCE '+rel)
gateway=(root/'ai-gateway.js').read_text(encoding='utf-8')
for token in ['loadGovernance','governance:await loadGovernance()','acknowledgementRequired:true']:
 if token not in gateway: errors.append('GATEWAY_WIRING_MISSING '+token)
exporter=(root/'modules/verification/ai-export.js').read_text(encoding='utf-8')
for token in ['loadRequiredGovernance','governance/AI_WORK_RULES.md','必ず1つのZIPで提出']:
 if token not in exporter: errors.append('AI_EXPORT_WIRING_MISSING '+token)
rules=(root/'AI_WORK_RULES.md').read_text(encoding='utf-8')
if 'アップロードを伴う成果物' not in rules or '必ず1つのZIP' not in rules: errors.append('ZIP_RULE_MISSING_FROM_AI_RULES')
policy=json.loads((root/'shared/integrity/artifact-submission-policy.json').read_text(encoding='utf-8'))
if policy.get('default')!='zip_required_for_every_uploaded_artifact': errors.append('MACHINE_POLICY_DEFAULT_INVALID')
if not policy.get('ai_requirements',{}).get('fail_closed_when_rules_unavailable'): errors.append('MACHINE_POLICY_NOT_FAIL_CLOSED')
if errors:
 print('AI_GOVERNANCE_FAIL'); print('\n'.join(errors)); raise SystemExit(1)
print('AI_GOVERNANCE_OK required=3 gateway=connected studio_export=connected fail_closed=true')
