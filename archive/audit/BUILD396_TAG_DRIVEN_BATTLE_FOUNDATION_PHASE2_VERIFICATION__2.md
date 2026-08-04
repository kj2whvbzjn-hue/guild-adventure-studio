# Build396 Tag-driven Battle Foundation Phase2 Verification

## Base
- Rebuilt Build395 based directly on Build393
- Build394-specific changes are not introduced

## Implemented
- Unified active build identity to Build396
- Added combatant stack collection independent from DOT/status instances
- Added stack add, read, remove, and consume operations
- Added insufficient-stack rejection without mutation
- Added development-only Refrigeration／冷却 stack skills
- Added battle UI stack count rendering
- Added JSONL stack operation events
- Added `stack_foundation_phase2` verification scenario

## Scope
- No maximum stack count was introduced because no maximum specification has been established
- Export and Save formats were not extended with development battle stacks
