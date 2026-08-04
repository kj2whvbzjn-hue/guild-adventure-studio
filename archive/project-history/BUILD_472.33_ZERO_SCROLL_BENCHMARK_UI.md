# Build 472.33 — Zero-scroll Benchmark ZIP workflow

## Purpose
Benchmark operations are reduced to a single full-screen launcher: select, execute, export result package, and import received result package. No movement between the top and bottom of the long battle verification page is required.

## Changes
- Added full-screen Benchmark ZIP workflow overlay.
- Replaced the long inline execution center with one launcher button.
- Kept existing execution, JSON export, result package export/import, and validation functions unchanged.
- Hidden long result history from the launcher; existing saved history remains unchanged.
- Added close and receive-ZIP actions at the fixed footer.

## Base
Build 472.32.1.
