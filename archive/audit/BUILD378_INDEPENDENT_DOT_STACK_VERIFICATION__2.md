# Build 378 — Independent DOT Stack Verification

- DOT statuses use independent stack instances.
- Each DOT stack stores its own duration, remaining Tick, interval, next-effect Tick, source, and instance ID.
- Poison stacks deal additive fixed damage while advancing independent timers.
- DOT stack additions are recorded as `DOT_STACK_ADDED` JSONL events.
- DOT Tick events include the status instance ID.
- Added regression scenario `poison_stack_independent`.
- Build metadata and service-worker cache updated to 378.
