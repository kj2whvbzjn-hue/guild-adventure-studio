# Build 376 — AI Verification Scenario Engine

## Scope

Development-only deterministic verification scenarios for Battle Core.

## Added

- JSONL-integrated scenario runner with PASS / FAIL assertions.
- Sleep scenario: apply sleep, confirm action block, inject 1 damage, confirm removal, confirm action recovery.
- Stun scenario: confirm damage does not remove stun and action remains blocked.
- Poison scenario: confirm Tick damage and independent duration decrement.
- `SCENARIO_START`, `SCENARIO_INJECT_DAMAGE`, `SCENARIO_ASSERT`, `SCENARIO_COMPLETE`, and summary records.
- Sleep removal on positive applied damage with reason code `DAMAGE_RECEIVED`.

## Isolation

The scenario runner is development UI only. It does not modify Export data or the save schema.

## Local verification

- Inline JavaScript syntax: PASS (`node --check`).
- Build metadata and service-worker cache revision synchronized to Build 376.
- Physical iPhone/GitHub Pages verification remains pending.
