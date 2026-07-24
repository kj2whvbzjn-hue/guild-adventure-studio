# Scenario Support Framework Phase Plan

Version: 2.0.0  
Build: 328  
Decision: DEC-SGF-0003

## Status

The automatic scenario generation program is **FROZEN**. SGF is formally redefined as the **Scenario Support Framework**. Existing useful components are retained and redirected toward assisted, non-destructive scenario production.

## Active responsibility boundary

- CPF: import, normalization, validation, locks, transactions, revisions, approval, merge, history, impact analysis, and export.
- SGF Support: chapter/section design forms, prompt assembly, copy-ready work instructions, pasted-result intake, preview linkage, consistency checks, and revision comparison.
- External AI or a human writer may produce drafts outside Studio. Studio does not require an API connection.

## Supported production flow

1. Select a chapter, section, event, or dialogue target.
2. Enter goals, required events, prohibited events, character state, timeline, and output format.
3. Generate a copy-ready prompt or writing brief.
4. Copy it to ChatGPT, another external AI, a writer, or use it for manual drafting.
5. Paste/import the result into Studio.
6. Normalize and analyze the structure.
7. Preview current and candidate versions.
8. Run consistency and dependency validation.
9. Store the result as a candidate Revision.
10. Approve explicitly before promotion and Export.

## Active phases

| Phase | Scope | Status | Dependency |
|---|---|---|---|
| SSF-001 | Chapter/Section design forms and prompt assembly | LOCALLY_IMPLEMENTED | CPF data model |
| SSF-002 | Copy-ready prompt and writing-brief output | LOCALLY_IMPLEMENTED | SSF-001 |
| SSF-003 | Paste/import of manual or external-AI results | LOCALLY_IMPLEMENTED | CPF-002/002A |
| SSF-004 | Story Preview, comparison, consistency validation | LOCALLY_IMPLEMENTED | CPF Preview/Validation |
| SSF-005 | Candidate Revision, protected-field controls, explicit approval, and Export linkage | LOCALLY_IMPLEMENTED | CPF Revision/Approval |

## Frozen phases

| Former function | Status |
|---|---|
| Built-in AI scenario generation | FROZEN |
| OpenAI or other API connector | FROZEN / NOT REQUIRED |
| Automatic regeneration loop | FROZEN |
| Automatic quality scoring | FROZEN |
| Automatic adoption or merge | PROHIBITED |
| Model training or learning function | OUT OF SCOPE |

## Invariants

1. No external or pasted draft may overwrite current data directly.
2. All drafts enter as candidate Revisions.
3. LOCKED nodes and protected/manual fields remain immutable.
4. Promotion requires CPF validation and explicit human approval.
5. Chapter and Section IDs remain stable unless an approved migration is executed.
6. Prompt output must include source snapshot/version and target scope where available.
7. Reactivating automatic generation requires a new formal Decision and a new security, compatibility, cost, and quality audit.

## Build 328 local completion note

SSF-005 is locally implemented with whole-candidate promotion only. Partial adoption and automatic merge remain prohibited. Export linkage is an explicit readiness marker and does not execute Export automatically. Remote CI and device-browser verification remain unconfirmed.


## Build 329 integration-gate increment

Approved scenario Export acceptance is locally implemented. Workflow-managed Chapter/Section nodes require explicit Export readiness, an approved Revision, exact canonical-text equality, and matching SHA-256. Studio-only design, candidate, and export-control metadata are excluded from Runtime Export. Remote CI and device-browser verification remain unconfirmed.


## Build 329 controlled scenario import increment

The authoritative ten-chapter Guild Adventure Story fixture is locally imported through CPF-002A with stable IDs, milestones, transactional rollback protection, revisioned snapshots, hashes, and identical-input idempotency. Impact/dependency review against this real scenario data is the next local target.
