# Build 472.19

## Result comparison / regression foundation

- Added previous-result comparison for fixed battle tests.
- Added previous-result comparison for Benchmark runs.
- Added deltas for win rate, average Tick, ally damage, enemy damage, and error count.
- Added per-target deltas to Benchmark AI JSON.
- Added comparison data to complete and AI-analysis JSON outputs.
- Separated regular battle-result history from battle-benchmark-result history in the UI.
- Removed extra completion dialogs for JSON downloads.
- Kept dialogs for import, execution, errors, and deletion.
- Kept variable roster sizes; no fixed 6-vs-6 rule was introduced.

## Verification

- JavaScript syntax check passed.
- studio/index.html and apps/studio/index.html are identical.
- Existing battle engine and formula were not changed.
