# Build 381 — Blind Accuracy Reduction Verification

- Added development-only Blind preset with 3000 Tick duration.
- Blind uses an extreme verification miss chance of 95%; this is not formal balance data.
- Skill execution records hit roll and miss chance in JSONL.
- Misses deal zero damage while MP and cooldown consumption follow normal skill execution.
- Added deterministic regression scenario `blind_accuracy_reduction`.
- Verified forced miss below threshold, hit above threshold, and Tick duration decrement.
