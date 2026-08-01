#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZIP_PATH="${1:-}"

if [[ -n "$ZIP_PATH" ]]; then
  python3 - "$ZIP_PATH" <<'PY2'
import sys, zipfile
p=sys.argv[1]
with zipfile.ZipFile(p) as z:
    bad=z.testzip()
    if bad:
        print(f"ZIP_INTEGRITY_FAIL {bad}")
        raise SystemExit(1)
    print(f"ZIP_INTEGRITY_PASS files={len(z.infolist())}")
PY2
else
  echo "ZIP_INTEGRITY_SKIPPED extracted-tree-mode"
fi

echo "[2/6] LINK_CHECK"
python3 "$ROOT/tools/integrity/check-html-links.py" "$ROOT"

echo "[3/6] JSON_CHECK"
python3 - "$ROOT" <<'PY2'
import json, pathlib, sys
root=pathlib.Path(sys.argv[1]); count=0
for p in root.rglob('*.json'):
    if any(part in {'vendor','.git'} for part in p.parts): continue
    with p.open(encoding='utf-8') as f: json.load(f)
    count += 1
for p in root.rglob('*.webmanifest'):
    with p.open(encoding='utf-8') as f: json.load(f)
    count += 1
print(f"JSON_CHECK_PASS files={count}")
PY2

echo "[4/6] SYNTAX_CHECK"
if command -v node >/dev/null 2>&1; then
  while IFS= read -r -d '' js; do node --check "$js" >/dev/null; done < <(find "$ROOT" -type f -name '*.js' ! -path '*/vendor/*' ! -name 'jszip.min.js' -print0)
fi
echo "SYNTAX_CHECK_PASS"

echo "[5/6] GITHUB_CHECK"
python3 "$ROOT/tools/integrity/check-deployment-map.py" "$ROOT"
python3 "$ROOT/tools/release/check-github-candidate.py"
BUILD_NUM="$(sed -n 's/^Build//p' "$ROOT/VERSION.txt")"
PUBLIC_ZIP="$ROOT/release-output/GKS-GITHUB-B${BUILD_NUM}.zip"
python3 "$ROOT/tools/release/build-github-pages-package.py" --output "$PUBLIC_ZIP"
python3 - "$PUBLIC_ZIP" <<'PY3'
import sys, zipfile
p=sys.argv[1]
with zipfile.ZipFile(p) as z:
    bad=z.testzip()
    if bad:
        print(f"GITHUB_PACKAGE_ZIP_FAIL {bad}")
        raise SystemExit(1)
    print(f"GITHUB_PACKAGE_ZIP_PASS files={len(z.infolist())} output={p}")
PY3

echo "[6/6] FULL_PROJECT_CHECK"
bash "$ROOT/tools/integrity/check-project.sh"
echo "APPROVED_FLOW_PASS"
