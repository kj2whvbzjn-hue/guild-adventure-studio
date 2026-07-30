from pathlib import Path
p=Path(__file__).resolve().parents[1]/'studio'/'index.html'
s=p.read_text(encoding='utf-8')
required=['buildTagGovernanceReport','exportTagGovernanceReport','exportTagMigrationPlanCsv','gk.tag-governance-report.v1','migration_candidates','acceptance:{pass:']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('missing: '+', '.join(missing))
print('BUILD413 static verification: PASS')
