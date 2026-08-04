# Build 472.27 Battle Package Executable Sample

## Scope
- Added an executable Battle Package sample ZIP generator.
- The sample contains one roster, one battle-test, and one enabled battle-test job.
- Expected execution count is 10 trials.
- Existing project data and saved verification results remain unchanged.

## User verification
1. Export `GK_BattleVerification_Executor_QA_v1.0.0.zip`.
2. Import it through the Battle Package reader.
3. Confirm 1 executable job and 10 estimated trials.
4. Execute and confirm the job completes with summary metrics.
