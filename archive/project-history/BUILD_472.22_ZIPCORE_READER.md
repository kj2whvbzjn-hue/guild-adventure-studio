# Build 472.22 — ZipCore Reader

## Scope
- Added `GKZipCore.reader.inspect()`.
- Added lazy `getBytes()`, `getText()`, and `getJson()` accessors.
- Added raw central-directory path inspection before JSZip sanitization.
- Added normalized duplicate-path detection.
- Added common diagnostics helpers (`FATAL`, `JOB_ERROR`, `WARNING`, `INFO`).
- Added optional extension policy support.
- Migrated Studio Deploy ZIP inspection to the shared reader while preserving the existing UI and GitHub workflow.

## Compatibility
- Existing Deploy limits remain 5,000 files / 20 MiB per file / 100 MiB total.
- GitHub API, commit, Pages, rollback, PHP Export, and battle logic were not changed.
- `studio/index.html` and `apps/studio/index.html` remain identical.

## Automated checks
- JavaScript syntax check passed.
- Valid public and patch ZIP fixtures accepted.
- Parent traversal, normalized duplicates, excessive entry count, and oversized single-file fixtures rejected.
