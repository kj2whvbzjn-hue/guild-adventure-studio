# Content Production Framework Phase Plan

| Phase | Scope | Status |
|---|---|---|
| CPF-001 | Story Pipeline Core | LOCAL_TEST_COMPLETE / REMOTE_CI_UNCONFIRMED |
| CPF-002 | Story Import / Preview integration | IN_PROGRESS |
| CPF-002A | Import Safety Hardening | LOCALLY_IMPLEMENTED / REMOTE_CI_UNCONFIRMED |
| CPF-003 | World and Map Planner | PLANNED |
| CPF-004 | Character Management | PLANNED |
| CPF-005 | Section Management | PLANNED |
| CPF-006 | Event Management | PLANNED |
| CPF-007 | Production Orchestrator | PLANNED |

## Current position

- Runtime Foundation: COMPLETE
- GVF-001〜005: COMPLETE
- CPF Planning: APPROVED
- CPF-002 Increment 1: IMPLEMENTED AND LOCALLY VERIFIED
- CPF-002A Import Safety Hardening: LOCALLY_IMPLEMENTED / REMOTE_CI_UNCONFIRMED
- SGF is redefined as Scenario Support Framework by DEC-SGF-0003
- Automatic scenario generation and API-connected generation remain FROZEN
- SSF-001 Chapter/Section Design Form and Prompt Assembly: LOCALLY_IMPLEMENTED
- SSF-002 Copy-ready Prompt Output: LOCALLY_IMPLEMENTED
- SSF-003 Paste Intake through CPF import safety gate: LOCALLY_IMPLEMENTED
- SSF-004 Story Preview and current/candidate comparison: LOCALLY_IMPLEMENTED
- SSF-005 Protected-field controls, explicit approval, and Export linkage: LOCALLY_IMPLEMENTED

## Responsibility boundary

- CPF manages import contracts, normalization, project locks, transactions, rollback, child synchronization, snapshots, validation, revisions, approval, history, impact analysis, and export integration.
- SSF manages scenario design forms, prompt assembly, copy-ready writing briefs, pasted-result intake, preview linkage, consistency checks, and revision comparison.
- External AI or a human writer creates draft prose outside Studio. Studio does not automatically generate or automatically approve scenario text.

## CPF-002 completed increments

1. Story Importer
2. Story Structure Analyzer
3. CPF-002A Import Safety Hardening
   - pre-write validation
   - project import lock and stale-lock recovery
   - transaction backup and rollback
   - stable internal IDs separated from display names
   - Milestone node as detail source of truth; Chapter stores milestone IDs
   - removed child archive and protected-child conflict
   - managed dependency rebuild
   - revisioned snapshots and source/normalized hashes
   - identical-input idempotency

## Next implementation order

1. Build 329 integration gate Increment 1: approved scenario Export acceptance — LOCALLY_IMPLEMENTED
2. Remote PHP 8.1–8.4 CI — UNCONFIRMED
3. iPhone and supported desktop-browser verification — UNCONFIRMED
4. Guild Adventure Story 10-chapter controlled import — LOCALLY_IMPLEMENTED
5. Impact/dependency review against real scenario data — NEXT LOCAL TARGET

Partial adoption and automatic merge remain prohibited. Whole-candidate promotion requires explicit human approval.

Built-in Plot Generator, Chapter Generator, automatic regeneration, automatic scoring, and automatic adoption are not in the active implementation path.
