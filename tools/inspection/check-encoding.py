#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, sys, unicodedata, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from evidence import zip_entries
from pathlib import Path

TEXT_EXTS={'.html','.htm','.js','.css','.json','.webmanifest','.md','.txt','.py','.sh','.php','.csv','.xml','.yml','.yaml'}
ESCAPED_RE=re.compile(r'#U[0-9A-Fa-f]{4,6}')

def main()->int:
 p=argparse.ArgumentParser(); p.add_argument('root',nargs='?',default='.'); p.add_argument('--zip',dest='zip_path')
 a=p.parse_args(); root=Path(a.root).resolve(); errors=[]; warnings=[]
 policy_path=root/'shared/integrity/encoding-policy.json'
 try: policy=json.loads(policy_path.read_text(encoding='utf-8'))
 except Exception as e: print('ENCODING_FAIL'); print('POLICY_INVALID',e); return 1
 legacy=set(policy.get('legacy_exceptions',[]))
 ascii_only_prefixes=tuple(str(x) for x in policy.get('ascii_only_path_prefixes',[]))
 for f in root.rglob('*'):
  if not f.is_file() or '.git' in f.parts: continue
  rel=f.relative_to(root).as_posix()
  if unicodedata.normalize('NFC',rel)!=rel: errors.append(f'FILENAME_NOT_NFC {rel}')
  if ascii_only_prefixes and any(rel.startswith(prefix) for prefix in ascii_only_prefixes) and any(ord(ch)>127 for ch in rel): errors.append(f'NON_ASCII_FILENAME_FORBIDDEN {rel}')
  if ESCAPED_RE.search(rel):
   (warnings if rel in legacy else errors).append(f'ESCAPED_UNICODE_FILENAME {rel}')
  if f.suffix.lower() not in TEXT_EXTS: continue
  b=f.read_bytes()
  if b.startswith((b'\xff\xfe',b'\xfe\xff')): errors.append(f'UTF16_FORBIDDEN {rel}'); continue
  try: text=b.decode('utf-8-sig')
  except UnicodeDecodeError as e: errors.append(f'NOT_UTF8 {rel} offset={e.start}'); continue
  if f.suffix.lower() in {'.html','.htm'}:
   head=text[:2048].lower().replace("'",'"')
   if not re.search(r'<meta\s+[^>]*charset\s*=\s*"?utf-8',head): errors.append(f'HTML_CHARSET_MISSING {rel}')
  if f.suffix.lower()=='.csv' and not b.startswith(b'\xef\xbb\xbf'): errors.append(f'CSV_BOM_MISSING {rel}')
 studio_path=root/'studio/index.html'
 try:
  studio_text=studio_path.read_text(encoding='utf-8')
  required_markers=[
   'containsEscapedUnicodeFilename(value)',
   "normalize('NFC')",
   'ZIP_FILENAME_CANONICALIZED',
   'escapedUnicodeNames',
   'rawEntryMetadata(bytes)',
   'unicode_path_extra_field_0x7075',
   'ZIP_FILENAME_LIBRARY_MISMATCH'
  ]
  for required in required_markers:
   if required not in studio_text:
    errors.append(f'STUDIO_FILENAME_GUARD_MISSING {required}')
 except Exception as e:
  errors.append(f'STUDIO_FILENAME_GUARD_READ_FAIL {e}')
 if a.zip_path:
  zp=Path(a.zip_path)
  try:
   evidence=zip_entries(zp)
   for item in evidence['entries']:
    n=item.get('decoded_name')
    if item.get('decode_error'): errors.append(f"ZIP_FILENAME_DECODE_ERROR index={item['index']} {item['decode_error']}")
    if not item.get('library_matches_decoded_name'): errors.append(f"ZIP_LIBRARY_NAME_MISMATCH index={item['index']} decoded={n!r} library={item.get('library_name')!r}")
    if n and unicodedata.normalize('NFC',n)!=n: errors.append(f'ZIP_FILENAME_NOT_NFC {n}')
    if n and ESCAPED_RE.search(n) and n not in legacy: errors.append(f'ZIP_ESCAPED_UNICODE_FILENAME {n}')
   with zipfile.ZipFile(zp) as z:
    bad=z.testzip()
    if bad: errors.append(f'ZIP_CORRUPT {bad}')
  except Exception as e: errors.append(f'ZIP_READ_FAIL {e}')
 if warnings:
  print('ENCODING_WARN'); print('\n'.join(sorted(set(warnings))))
 if errors:
  print('ENCODING_FAIL'); print('\n'.join(sorted(set(errors)))); return 1
 print(f'ENCODING_OK text_policy=utf-8 iphone=true warnings={len(set(warnings))}')
 return 0
if __name__=='__main__': raise SystemExit(main())
