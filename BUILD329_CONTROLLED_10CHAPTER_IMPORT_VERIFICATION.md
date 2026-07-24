# Build 329 Controlled 10-Chapter Import Verification

Local implementation date: 2026-07-24

## Scope

Adds the authoritative controlled-import fixture for the ten-chapter Guild Adventure Story and verifies the CPF-002A safety contract against real scenario structure.

## Rules preserved

- Ten chapters only, stable CH001–CH010 identifiers, and deterministic order 1–10.
- Confirmed bosses are retained: Orc King, Treant Elder, and Kraken.
- Elysia joins in Chapter 3 and awakens to clear miasma in Chapter 7.
- Cain and Flare join in Chapter 5; Nadia remains a cooperation partner.
- The queen's location is learned in Chapter 6, but rescue occurs only in Chapter 9.
- The final Chapter 10 prevents the demon king's revival and retakes the capital.
- Import is transactional, locked, snapshot-versioned, hashed, and idempotent.
- No automatic prose generation, automatic approval, partial merge, or automatic Export is introduced.

## Local verification

- JSON/schema-compatible source fixture: PASS
- First controlled import: PASS
- Ten normalized Chapter nodes: PASS
- Milestone source-of-truth nodes: PASS
- Structure analyzer: PASS
- Identical second import idempotency: PASS
- Revisioned snapshot and SHA-256: PASS

Remote CI and physical-device browser verification remain unconfirmed.

## Audit correction found during real-data verification

The structure analyzer still counted the legacy inline `milestones` field after CPF-002A moved milestone detail to dedicated nodes and Chapter `milestone_ids`. The analyzer now counts `milestone_ids` first, with a legacy fallback. This correction prevents false low-milestone-density warnings and is covered by the controlled-import test.
