# DEC-0018 Exportファイルサイズ制限

## 決定
PHP RuntimeはExport読込前にファイルサイズを検証する。

## 既定上限
- manifest.json: 1 MiB
- 各Export JSON: 16 MiB
- Export総容量（manifestを含む）: 64 MiB

## 方針
- 上限はExportLoaderのコンストラクタ引数で変更可能とする。
- サイズ超過はJSON読込・SHA-256計算より前に停止する。
- 実データ計測後に既定値を再評価できる。

## エラーコード
- MANIFEST_TOO_LARGE
- FILE_TOO_LARGE
- EXPORT_TOTAL_TOO_LARGE
- FILE_SIZE_READ_FAILED

## 計画影響
A-2を完了。正式データ量産およびPHP接続計画は継続可能。次はA-3 エラー記録方式。
