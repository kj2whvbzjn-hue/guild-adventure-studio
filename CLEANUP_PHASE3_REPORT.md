# Cleanup Phase 3

- Removed obsolete aggregate project Build and Formal Build assumptions from active metadata and integrity checks.
- Current identifiers are read from `assets/shared/config/runtime-config.js` as separate Game and Studio series.
- Removed checks for nonexistent `VERSION.txt` and `apps/*` entrypoints.
- Kept the existing 109-file deletion manifest unchanged.
- No game logic, Studio data editing logic, Export data, schemas, fixtures, or tests were deleted.
