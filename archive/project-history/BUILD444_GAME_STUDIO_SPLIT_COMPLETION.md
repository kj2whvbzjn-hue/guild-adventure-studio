# BUILD444 Game / Studio Split Completion

## Final structure
- `/index.html`: launcher only
- `/game/`: full playable game runtime and its own PWA files
- `/studio/`: authoring Studio and its own runtime dependencies
- `/shared/`: governance and shared contracts; neither app requires the other app to boot

## Independence
- Game can be packaged without `/studio/`.
- Studio can be packaged without `/game/`; the game button is an optional navigation link only.
- Studio no longer uses `<base href="../">` and has local copies of `jszip.min.js`, `export-core.js`, manifest, service worker, and icons.
- Root is no longer the game implementation; it is a neutral launcher.

## Compatibility
- GitHub Pages root remains `/index.html`.
- Game URL is `/game/`.
- Studio URL remains `/studio/`.
