# 文字化け防止ポリシー（iPhone運用必須）

このプロジェクトでは、iPhoneのSafari・ファイルApp・共有シートで成果物を扱うことを前提とし、文字化け対策を必須とする。

## 必須規則

1. テキストファイルは UTF-8 で保存する。Shift_JIS、CP932、UTF-16を使用しない。
2. HTMLは先頭付近に `<meta charset="utf-8">` を置く。
3. JSON、Web Manifest、JavaScript、CSS、Markdown、PHP、Python、TXTはUTF-8とする。
4. CSVはUTF-8 BOM付きとし、改行はCRLFを推奨する。
5. ZIP内のファイル名はUnicode NFCへ正規化し、UTF-8ファイル名フラグ（general purpose bit 11）を付ける。
6. 新規のZIP内ファイル名は原則としてASCII安全名を使用する。日本語名が必要な場合もUTF-8フラグを必須とする。
7. `#Uxxxx`形式へ日本語を置換したファイル名を新規生成してはならない。
8. AIが作成するアップロード成果物も同じ規則を満たした1つのZIPで提出する。
9. ZIP作成後は、破損検査、UTF-8ファイル名フラグ検査、テキストUTF-8検査を実行する。

## 既存例外

`README_GITHUB#U53cd#U6620.md`は過去の文字化け対策前に生成された互換用ファイルである。新規生成は禁止するが、削除禁止原則により別途承認なしには削除しない。

## 完了条件

- `python3 tools/inspection/run.py full --context update` が合格する。
- iPhoneでZIPを展開し、日本語本文と日本語ファイル名が正しく表示される。
