#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
manifest_path = root / 'package_manifest.json'
ignored_roots = {'reports', 'release-output', '.git'}
control_files = {'DELETE_MANIFEST.txt'}
errors = []
try:
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
except Exception as exc:
    print(f'PACKAGE_MANIFEST_INVALID {exc}')
    raise SystemExit(1)
entries = manifest.get('files', [])
seen = set()
for item in entries:
    rel = item.get('path', '')
    if rel in control_files:
        continue
    if not rel or rel in seen:
        errors.append(f'DUPLICATE_OR_EMPTY {rel}')
        continue
    seen.add(rel)
    p = (root / rel).resolve()
    try:
        p.relative_to(root)
    except ValueError:
        errors.append(f'OUTSIDE_ROOT {rel}')
        continue
    if not p.is_file():
        errors.append(f'MISSING {rel}')
        continue
    data = p.read_bytes()
    if len(data) != item.get('size'):
        errors.append(f'SIZE_MISMATCH {rel}')
    if hashlib.sha256(data).hexdigest() != item.get('sha256'):
        errors.append(f'HASH_MISMATCH {rel}')
actual = set()
for p in root.rglob('*'):
    if not p.is_file() or p == manifest_path:
        continue
    rel = p.relative_to(root)
    if rel.as_posix() in control_files:
        continue
    if rel.parts and rel.parts[0] in ignored_roots:
        continue
    if '__pycache__' in rel.parts or p.suffix == '.pyc':
        continue
    actual.add(rel.as_posix())
for rel in sorted(actual - seen):
    errors.append(f'UNLISTED {rel}')
for rel in sorted(seen - actual):
    if not (root / rel).is_file():
        continue
    errors.append(f'UNEXPECTED_LISTED {rel}')
if manifest.get('file_count') != len(entries):
    errors.append(f'COUNT_FIELD_MISMATCH declared={manifest.get("file_count")} actual={len(entries)}')
if errors:
    print('PACKAGE_MANIFEST_FAIL')
    print('\n'.join(errors))
    raise SystemExit(1)
print(f'PACKAGE_MANIFEST_OK files={len(entries)}')
