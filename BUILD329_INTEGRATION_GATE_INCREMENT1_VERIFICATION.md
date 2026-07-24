# Build 329 Integration Gate — Increment 1 Verification

Build source: 328
Local implementation date: 2026-07-24

## Scope

This increment implements the locally verifiable approved-scenario Export acceptance gate.

## Contract

1. A Chapter or Section that has entered the SSF Revision workflow must be explicitly Export-ready.
2. The selected Revision must exist and remain `approved`.
3. The canonical `summary` must exactly match the approved Revision text.
4. The canonical SHA-256 must match the approval/export-control record.
5. Candidate revisions, design instructions, and export-control metadata are Studio-only and are excluded from Runtime Export JSON.
6. Legacy scenario nodes that have never entered the Revision workflow remain exportable for backward compatibility.
7. Export validation failure blocks ZIP generation; it does not mutate project data.

## Local result

- Approved canonical scenario export: PASS
- Unready workflow node rejection: PASS
- Missing/invalid approval record rejection: PASS
- Canonical text mismatch rejection: PASS
- Canonical hash mismatch rejection: PASS
- Studio-only workflow metadata exclusion: PASS

Remote PHP 8.1–8.4 CI and physical-device browser verification remain unconfirmed.
