# Runtime Metadata Verification

Date: 2026-07-23

## Result

PASS

## Verified

- Official Export package loads successfully.
- schema_version mismatch is rejected with SCHEMA_VERSION_MISMATCH.
- data_version mismatch is rejected with DATA_VERSION_MISMATCH.
- generated_at mismatch is rejected with GENERATED_AT_MISMATCH.
- generated_by mismatch is rejected with GENERATED_BY_MISMATCH.
- Existing Schema and Data Integrity tests remain green.
- Automated Studio-core -> Export -> PHP Runtime E2E passes.

## Command

```bash
./tests/e2e/run.sh
php php-runtime/bin/validate-export.php Export
```
