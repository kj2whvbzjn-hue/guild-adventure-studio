from pathlib import Path

text = Path('studio/index.html').read_text(encoding='utf-8')
required = [
    'function collectTagReferences()',
    'function validateTagSystem()',
    'validateTagSystem().forEach(issue=>validation.push(issue));',
    'タグ親子関係が循環しています',
    'が未登録タグ ${r.tag_id} を参照しています',
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('BUILD407 FAIL: ' + ', '.join(missing))
print('BUILD407 PASS: tag acceptance validation gate is connected')
