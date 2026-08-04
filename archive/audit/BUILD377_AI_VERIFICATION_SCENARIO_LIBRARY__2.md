# Build 377 — AI Verification Scenario Library

## Implemented

- Central verification scenario library with stable scenario IDs.
- Individual scenario execution from the library.
- One-action execution of all registered scenarios.
- Scenario-level and assertion-level PASS / FAIL aggregation.
- Failed scenario ID collection.
- Batch metadata and all scenario event records exported as one JSONL stream.
- Development-only integration; game Export and Save schemas are unchanged.

## Registered scenarios

- `sleep_damage_wake`
- `stun_damage_persist`
- `poison_tick`

## Verification

- JavaScript syntax check: PASS.
- Build metadata and service-worker cache revision synchronized to Build 377.
