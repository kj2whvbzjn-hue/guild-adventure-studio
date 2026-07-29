# Build 375 — AI-First Skill / Status Verification Foundation

- Added common SkillExecutor for Normal Attack and Power Strike.
- Added AI decision records with candidates, selection, and reason codes.
- Added development verification presets (normal, sleep, stun, poison, buff, AI).
- Added extreme verification durations (sleep/stun: 3000 Tick).
- Added zero-attack / high-HP verification isolation.
- Added status storage, Tick countdown, action blocking, poison DOT, expiry, and manual clear.
- Added AI-first JSONL event logging and export/copy/clear controls.
- Structured logs include schema, Build, session, preset, Tick, sequence, event type, IDs, values, and reason codes.
- Development-only values remain isolated from Export and Save data.
