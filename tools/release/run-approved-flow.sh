#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZIP_PATH="${1:-}"
if [[ -n "$ZIP_PATH" ]]; then
  python3 - "$ZIP_PATH" <<'PY'
import sys, zipfile
p=sys.argv[1]
with zipfile.ZipFile(p) as z:
    bad=z.testzip()
    print(f"INPUT_ZIP_OK files={len(z.infolist())}")
    if bad: raise SystemExit(1)
PY
fi
exec python3 "$ROOT/tools/inspection/run.py" release --report "$ROOT/reports/inspection-release.json"
