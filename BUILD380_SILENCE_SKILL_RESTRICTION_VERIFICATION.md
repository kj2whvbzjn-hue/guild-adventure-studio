# Build 380 — Silence Skill Restriction Verification

## Implemented

- Added the development-only Silence preset with a 3000 Tick verification duration.
- Silence excludes Power Strike and other non-normal skills from the AI usable-skill list.
- Direct skill execution rejects non-normal skills with reason code `SILENCED`.
- Normal Attack remains executable while Silence is active.
- Added regression scenario `silence_skill_restriction`.
- Added assertions for application, skill-list filtering, rejection without MP consumption, normal-attack execution, and Tick duration decrement.
- Updated structured-log build metadata, session IDs, batch IDs, export filenames, title metadata, and service-worker cache to Build 380.

## Scope

This is a development verification implementation. The 3000 Tick duration is not a formal balance value.
