# CPF-002A Import Safety Hardening Implementation Verification

Build: 328  
Status: LOCALLY_IMPLEMENTED / REMOTE_CI_UNCONFIRMED

## Implemented

- Story import JSON Schema with chapter range 1–20 and field limits.
- Full normalization and validation before writes.
- Project-scoped atomic import lock with stale-lock recovery.
- Transaction backup across nodes, history, dependencies, imports, and revisions.
- Automatic rollback when any import operation fails.
- Stable internal IDs independent from Japanese display names.
- Milestone detail source-of-truth moved to Milestone nodes; Chapter payload stores `milestone_ids`.
- Removed unlocked draft/rejected children become `ARCHIVED`.
- Removed APPROVED/LOCKED children raise `STORY_CHILD_PROTECTED` and roll back the import.
- Managed PARENT/CONTAINS dependencies are rebuilt without stale edges.
- Revisioned snapshots at `imports/<story-id>/<revision>.json` plus `latest.json`.
- `import_id`, timestamp, source hash, and normalized hash recorded.
- Identical normalized input returns an idempotent success without node/dependency duplication.
- Active concurrent import returns `STORY_IMPORT_LOCKED`.

## Local verification

The CPF test suite verifies:

- initial normalized import;
- manual-field preservation;
- structure analysis;
- identical-input idempotency;
- removed-child archive;
- stale dependency removal;
- archived-child restoration;
- protected-child rejection;
- full rollback of writes made before a later conflict;
- concurrent import lock rejection;
- revisioned and hashed snapshots;
- existing CPF approval, locking, revision, migration, dependency, diff, and validation regression tests.

## Remaining gate

- Execute the same suite in GitHub Actions on PHP 8.1, 8.2, 8.3, and 8.4.
- Confirm Runtime, GVF, and browser/E2E regression in the remote repository environment.
