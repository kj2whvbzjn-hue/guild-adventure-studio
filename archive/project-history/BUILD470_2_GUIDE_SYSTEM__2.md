# BUILD 470.2 — Guide System

## Summary
Adds an in-app guide home to Guild Adventure Studio without changing existing project data formats.

## Implemented
- Guide entry in the production launcher and navigation
- Searchable feature guide cards
- Direct navigation to project, character, calculation-card, battle, and verification screens
- Three-step beginner tutorial
- Empty-result feedback and responsive mobile layout
- Studio version updated to 1.34.0-dev / development build 470.2
- `studio/index.html` and `apps/studio/index.html` synchronized

## Compatibility
- No project schema changes
- No battle-runtime changes
- Existing local-storage data remains compatible

## Verification
- Inline JavaScript syntax checked with Node.js
- Studio copies compared byte-for-byte
