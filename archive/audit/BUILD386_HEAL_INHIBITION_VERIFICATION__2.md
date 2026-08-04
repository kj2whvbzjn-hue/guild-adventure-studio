# Build 386 — Heal Inhibition Verification

- Development-only HEAL inhibition preset
- Duration: 3000 Tick
- Development verification value: incoming healing reduced by 95%
- Healing remains above zero, matching the adopted status specification
- Structured `HEALING_APPLIED` log records source and target multipliers
- Regression scenario: `heal_inhibition_reduction`
- Formal balance values are not defined by this build
