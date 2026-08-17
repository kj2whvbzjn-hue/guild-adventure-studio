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
8. AIが作成する成果物は、作業種別に定めた正式形式を使用する。ZIP成果物は本ポリシーのZIP規則を満たし、直接提出するProject JSON等もUTF-8/NFCを維持する。
9. ZIP作成後は、破損検査、UTF-8ファイル名フラグ検査、テキストUTF-8検査を実行する。

## 旧形式ファイル名の解消

過去に`README_GITHUB反映.md`が一部の展開環境で`README_GITHUB#U53cd#U6620.md`へ変換された事例があった。
再発防止のため、この永続ファイルは人間の個別承認に基づきASCII安全名`README_GITHUB_REFLECTION.md`へ移行する。
永続ファイルの新規命名は原則ASCII安全名を使用し、`#Uxxxx`形式の新規生成は禁止する。

## 完了条件

- `python3 tools/inspection/run.py accept --context update --baseline-source <exact-baseline-root>` が合格する。
- ZIP成果物はiPhoneで展開し、日本語本文と日本語ファイル名が正しく表示される。
- 直接JSON等の成果物はiPhone上で日本語本文が正しく表示される。

## Studio配置時のファイル名保護

- ZIP内の`#Uxxxx`形式は、読込時にUnicode文字へ復元してNFCへ正規化する。
- GitHub送信直前に、`#Uxxxx`残存とNFC未正規化を再検査する。
- 不正な配置パスが1件でもある場合は配置を停止する。
- PythonなどUTF-8フラグ対応のZIP処理を検証基準とし、端末側の表示だけで文字化けを断定しない。
