# BUILD436 Repository Root Surface Contract

## Purpose

Classify the current public runtime surface separately from historical and governance documents without moving or deleting existing files.

## Changes

- Added `shared/integrity/root-surface-manifest.json`.
- Added `tools/integrity/check-root-surface.py`.
- Integrated the root-surface check into `tools/integrity/check-project.sh`.
- Protected 19 runtime and deployment paths.
- Kept all historical documents in their existing locations.
- Changed no public URL and moved no runtime file.

## Safety policy

A later build may move historical documents only after confirming that current game, Studio, PWA, and deployment files do not reference them.
