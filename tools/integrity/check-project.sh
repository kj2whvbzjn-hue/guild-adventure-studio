#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0
required=(
  "index.html"
  "studio/index.html"
  "export-core.js"
  "bootstrap-core.js"
  "bootstrap-ui.js"
  "bootstrap-ui.css"
  "manifest.webmanifest"
  "sw.js"
  "project-data.json"
)
for file in "${required[@]}"; do
  if [[ ! -s "$ROOT/$file" ]]; then
    echo "MISSING_OR_EMPTY $file"
    fail=1
  fi
done

if command -v node >/dev/null 2>&1; then
  while IFS= read -r -d '' js; do
    node --check "$js" >/dev/null || fail=1
  done < <(find "$ROOT" -type f -name '*.js' \
    ! -path '*/vendor/*' ! -name 'jszip.min.js' -print0)
fi

python3 - "$ROOT" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for rel in ['project-data.json','manifest.webmanifest','package_manifest.json','BUILD424_CHANGE_MANIFEST.json']:
    p=root/rel
    if p.exists():
        with p.open(encoding='utf-8') as f: json.load(f)
print('JSON_OK')
PY

python3 "$ROOT/tools/integrity/check-html-links.py" "$ROOT" || fail=1
python3 "$ROOT/tools/integrity/audit-organization.py" "$ROOT" || fail=1

if [[ "$fail" -ne 0 ]]; then
  echo "PROJECT_INTEGRITY_FAILED"
  exit 1
fi
python3 "$ROOT/tools/integrity/check-package-metadata.py"
python3 "$ROOT/tools/integrity/check-shared-assets.py"
python3 "$ROOT/tools/integrity/check-component-map.py"
python3 "$ROOT/tools/integrity/check-runtime-boundary.py"
python3 "$ROOT/tools/integrity/check-deployment-map.py" "$ROOT"
python3 "$ROOT/tools/integrity/check-critical-runtime.py" "$ROOT"
python3 "$ROOT/tools/integrity/check-root-surface.py" "$ROOT"
python3 "$ROOT/tools/integrity/check-test-registry.py" "$ROOT"
python3 "$ROOT/tools/release/check-github-candidate.py"
echo "PROJECT_INTEGRITY_OK"
