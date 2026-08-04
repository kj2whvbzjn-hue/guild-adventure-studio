# Build 382 — Freeze Action Inhibition Verification

- Added Freeze verification preset with 3000 Tick duration.
- Freeze prevents actions through the shared action inhibition check.
- Freeze remains active after receiving damage.
- Sleep remains the only implemented status removed by positive damage.
- Added deterministic regression scenario `freeze_action_inhibition`.
- Added timer-decrement verification for Freeze.
- Verification values are development-only and are not formal balance values.
