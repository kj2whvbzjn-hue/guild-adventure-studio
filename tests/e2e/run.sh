#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
node "$ROOT/tests/e2e/generate-export.js" "$TMP/Export"
node "$ROOT/tests/e2e/validate-schemas.js" "$TMP/Export"
php "$ROOT/php-runtime/bin/validate-export.php" "$TMP/Export"
php "$ROOT/php-runtime/tests/run.php"
node "$ROOT/tests/e2e/verify-values.js" "$TMP/Export"
echo '[PASS] automated Studio-core -> Export -> PHP Runtime E2E'
