# Build 348 — Fixed Canvas Foundation

## Purpose

The official game screen now uses a fixed 16:9 internal coordinate system instead of responsive reflow.

## Implemented

- Internal resolution: 1600 × 900
- Uniform whole-screen scaling to the browser viewport
- Centered letterbox presentation
- All phases retain the same coordinates and proportions
- Title, Base, Event, Battle, and Result remain landscape
- Base content scrolls only inside the fixed game canvas
- Existing Phase Controller, Battle Core, Battle Scene, save data, and Studio return route are preserved
- A small scale indicator is shown outside the game canvas for development verification

## Routing

- Repository root continues to open GK Studio
- GK Studio's “正式版を起動” continues to open `formal-v03/`
- This build changes only the official game presentation foundation

## GitHub mobile update

Upload the replacement `index.html` inside the repository's `formal-v03` folder.
