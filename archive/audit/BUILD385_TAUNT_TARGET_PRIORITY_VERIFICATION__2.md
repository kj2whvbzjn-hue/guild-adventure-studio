# Build 385 — Taunt Target Priority Verification

## Scope

- Development-only taunt preset
- Verification duration: 3000 Tick
- A taunted unit prioritizes the living status source as its target
- Normal HP-based target selection resumes after taunt removal
- Structured JSONL event: `TARGET_FORCED_BY_TAUNT`
- Regression scenario: `taunt_target_priority`

## Balance

The 3000 Tick duration is a development verification value, not a formal balance value.
