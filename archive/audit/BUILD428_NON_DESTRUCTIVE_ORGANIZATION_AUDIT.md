# BUILD428 — Non-destructive organization audit

## Changes

- Added `tools/integrity/audit-organization.py`.
- Added a machine-readable inventory and a human-readable organization audit under `docs/architecture/`.
- Added exact byte-duplicate detection.
- Added conservative unused-file review candidates.

## Safety boundaries

- No existing file was deleted.
- No runtime file was moved.
- `/index.html`, `/studio/`, and `/apps/` remain compatible.
- Candidate files are informational only and are not approved for deletion.
