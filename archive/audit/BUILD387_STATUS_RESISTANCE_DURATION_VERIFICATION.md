# Build 387 — Status Resistance Duration Verification

## Scope

- Status resistance reduces status duration
- Effective resistance is capped at 75%
- Resistance never grants immunity; effective duration remains at least 1 Tick
- DOT fixed damage is not reduced by status resistance
- DOT stack behavior and independent timers remain unchanged
- Structured JSONL event: `STATUS_DURATION_CALCULATED`
- Regression scenario: `status_resistance_duration`

## Development verification values

- 50% resistance verifies duration reduction
- 100% input verifies the 75% resistance cap
- Sleep, Stun, and Poison use the existing development-only durations and damage values
- Formal balance values are not defined by this build
