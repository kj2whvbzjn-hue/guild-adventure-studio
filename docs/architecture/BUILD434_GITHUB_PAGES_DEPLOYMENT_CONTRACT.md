# BUILD434 GitHub Pages deployment contract

BUILD434 fixes the public deployment contract without moving runtime files.

## Public entrypoints

- `index.html`: game
- `studio/index.html`: Studio
- `apps/index.html`: optional selector

All paths remain repository-relative, so the project can be uploaded to a GitHub Pages project site without changing repository names.

## Safety gate

`tools/integrity/check-deployment-map.py` verifies:

- public entrypoints exist and are non-empty;
- the web manifest, service worker, and icons exist;
- manifest URLs remain repository-relative;
- required application-shell files are listed by the service worker;
- current entrypoints do not require localhost servers.

No runtime file was moved or deleted in this build.
