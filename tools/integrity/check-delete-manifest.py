#!/usr/bin/env python3
from pathlib import Path, PurePosixPath
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
path = root / 'DELETE_MANIFEST.txt'
if not path.is_file():
    print('DELETE_MANIFEST_MISSING')
    raise SystemExit(1)
errors=[]
seen=set()
count=0
for lineno, raw in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
    rel=raw.strip()
    if not rel or rel.startswith('#'):
        continue
    count += 1
    posix=PurePosixPath(rel)
    if rel in seen: errors.append(f'DUPLICATE line={lineno} path={rel}')
    seen.add(rel)
    if posix.is_absolute() or '..' in posix.parts or rel.endswith('/') or '\\' in rel:
        errors.append(f'UNSAFE_PATH line={lineno} path={rel}')
    if rel == 'DELETE_MANIFEST.txt':
        errors.append(f'SELF_DELETE line={lineno}')
if errors:
    print('DELETE_MANIFEST_FAIL')
    print('\n'.join(errors))
    raise SystemExit(1)
print(f'DELETE_MANIFEST_OK entries={count}')
