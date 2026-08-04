# SSF-004 Implementation Verification

Build: 328 incremental development  
Status: LOCALLY_IMPLEMENTED / REMOTE_BROWSER_MATRIX_UNCONFIRMED

## Implemented

- Chapter/Section current-text and Candidate Revision preview
- Candidate selector from revision history
- Side-by-side full-text comparison
- Line-oriented current/candidate diff
- Source Design version and source-update staleness warning
- Required-event, prohibited-condition, target-length, empty, oversized, script, and NUL checks
- Read-only comparison workflow without approval, merge, promotion, or Export

## Safety invariants

1. Comparison never modifies current or candidate text.
2. Validation results are advisory and do not approve a Revision.
3. Candidate promotion, partial adoption, merge, and Export remain outside SSF-004.
4. Required/prohibited checks are deterministic text-presence checks and are not presented as semantic proof.
5. Automatic generation and API-connected generation remain frozen.

## Local verification

- HTML inline JavaScript syntax: PASS
- SSF-001/002/003 regression: PASS
- SSF-004 contract test: PASS
- CPF regression suite: PASS
- Runtime/GVF regression suite: PASS
- Studio to Export to PHP Runtime E2E: PASS
- Project audit: PASS
- SHA-256 verification: PASS after package finalization
