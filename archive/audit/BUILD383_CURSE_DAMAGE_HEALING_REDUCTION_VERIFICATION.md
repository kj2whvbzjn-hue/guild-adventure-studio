# Build 383 — Curse Damage / Healing Reduction Verification

## Scope

- Added the development-only Curse verification preset.
- Curse duration is 3000 Tick for visible verification.
- Development verification value reduces outgoing damage to 10%.
- Development verification value reduces healing effect to 0%.
- Added structured healing logs and deterministic AI regression scenario.
- Corrected batch verification build metadata from 381 to 383.

## Regression scenario

`curse_damage_healing_reduction` verifies:

1. Curse is applied.
2. A 100 attack normal attack deals 10 damage.
3. A 100-point healing event restores 0 HP.
4. Remaining duration decreases by one Tick.

These values are development verification values and are not formal balance values.
