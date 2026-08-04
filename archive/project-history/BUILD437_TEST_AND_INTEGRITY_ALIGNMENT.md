# BUILD437 Test and Integrity Alignment

## Purpose
Ensure that verification added during the repair/organization builds matches the current implementation and does not mislabel retired specification tests as current runtime failures.

## Changes
- Added `shared/tests/test-registry.json` as the authority for test scope.
- Added `tools/integrity/check-test-registry.py` to verify classification and run current release-gating tests.
- Integrated the test registry into `tools/integrity/check-project.sh`.
- Classified six current tag-system tests as release-gating.
- Classified four SSF tests as historical implementation gaps. They remain preserved and visible, but are not treated as regressions introduced by current organization work.

## Safety
No runtime application file was moved or deleted. Public URLs, localStorage keys, data formats, and GitHub Pages deployment remain unchanged.
