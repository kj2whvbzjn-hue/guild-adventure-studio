# 証跡付き・読取り専用検査

## 目的

検査結果を入力ZIP、展開ツリー、実行環境と暗号学的に結び付ける。
検査自身が`.pyc`、レポート、成果物などをソース内へ生成した場合は失敗とする。

## 実行例

```bash
python3 -B tools/inspection/run.py full \
  --context source \
  --input-zip /outside/source.zip \
  --evidence-dir /outside/evidence \
  --report /outside/full-result.json
```

`--evidence-dir`と`--report`はソースルート外のみ許可される。

## 証跡

- `input.json`: 入力種別と対象
- `zip-entries.json`: ZIP名、UTF-8フラグ、CRC、extra field、NFC状態
- `tree-before.json`: 検査開始前ツリー
- `execution.json`: Python、OS、環境変数、コマンド
- `result.json`: 検査結果と対象指紋
- `tree-after.json`: 検査終了後ツリー
- `tree-delta.json`: 追加・削除・変更
- `evidence-manifest.json`: 証跡一式のSHA-256

## ファイル名

`#Uxxxx`をUnicodeへ推測変換しない。入力に存在した場合は、その文字列を証跡へ残して配置を停止する。
NFC正規化は行うが、異なる意味の文字列への置換は行わない。

## 完了判定

自動検査PASSは技術的整合性の証拠であり、回復機能の実機完了証拠ではない。
iPhone実機証跡が登録されるまで回復ステータスは「検証中」とする。
