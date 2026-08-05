#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
source = Path(__file__).resolve().parents[1] / 'modules' / 'verification'
base = root / 'studio'
html = base / 'index.html'

if not html.exists():
    print(f'skip: {html}')
    raise SystemExit(0)

target = base / 'modules' / 'verification'
target.mkdir(parents=True, exist_ok=True)
for name in ('verification-guide.css', 'verification-guide.js', 'ai-export.js'):
    shutil.copy2(source / name, target / name)

text = html.read_text(encoding='utf-8')
css = '<link rel="stylesheet" href="modules/verification/verification-guide.css">'
scripts = (
    '\n<script src="modules/verification/verification-guide.js"></script>'
    '\n<script src="modules/verification/ai-export.js"></script>\n'
)
if css not in text:
    text = text.replace('</head>', f'  {css}\n</head>', 1)
if 'modules/verification/verification-guide.js' not in text:
    text = text.replace('</body>', scripts + '</body>', 1)
html.write_text(text, encoding='utf-8')
print(f'updated: {html}')
