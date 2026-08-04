# SSF-001 / SSF-002 Implementation Verification

Build: 328 incremental development
Status: LOCALLY_IMPLEMENTED / REMOTE_BROWSER_MATRIX_UNCONFIRMED

## Implemented

- Chapter and Section design form
- Writing goal
- Character and state constraints
- Required events
- Prohibited events and protected facts
- Timeline and continuity constraints
- Stage, tone, and direction constraints
- Output format and target length
- Design revision counter
- Copy-ready prompt assembly
- Source snapshot containing project ID, target ID, target type, source update time, design version, and generation time
- Clipboard copy with fallback selection path
- Legacy project normalization without destructive overwrite

## Safety invariants

1. Prompt generation does not modify approved scenario prose.
2. Design data is stored only on the selected Chapter or Section.
3. Pasted output is not accepted by this increment; SSF-003 must route it through CPF-002A.
4. Automatic generation, API connection, scoring, approval, and merge remain frozen.
5. Chapter and Section IDs are included in prompt output and remain stable.

## Local verification

- HTML inline JavaScript syntax: PASS
- Required UI fields and functions: PASS
- CPF regression suite: PASS (27 tests)
- Runtime/GVF regression suite: PASS
- Studio → Export → PHP Runtime E2E: PASS
- Project audit: PASS
- SHA-256 verification: PASS after package finalization
