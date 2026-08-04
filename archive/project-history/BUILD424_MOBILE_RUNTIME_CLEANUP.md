# BUILD424 Mobile Runtime Cleanup

- Removed runtime portrait/developer-mode coupling.
- Disabled and removed legacy orientation overlays.
- Replaced the fixed 1600×900 canvas with a native responsive layout at 900px and below.
- Rebuilt the title, base, event, battle, and result mobile layout overrides.
- Kept battle animation rotation effects; only screen-orientation rotation behavior was removed.
- Corrected legacy game and Studio navigation paths.
- Applied the same runtime correction to the primary and formal-v03 applications.
