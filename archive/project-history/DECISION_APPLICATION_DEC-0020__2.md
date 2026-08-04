# DEC-0020 適用記録 — Runtime異常系テスト拡充

## 適用内容
PHP Runtimeの既存検証機能に対し、未網羅だった15の異常系ケースを `php-runtime/tests/run.php` に追加した。

## 追加ケース
- manifest欠落
- manifest root不正
- manifest JSON破損
- manifest余剰項目
- manifest重複path
- SHA-256形式不正
- required型不正
- 非JSON拡張子
- Export JSON破損
- UTF-8不正
- JSON root配列
- Envelope必須項目欠落
- Envelope余剰項目
- 空メタデータ
- generated_at形式不正

## 判定
全ケースが想定した固有error_codeで停止し、正常Studio-core→Export→PHP Runtime E2E、既存Schema・整合性・サイズ・エラー記録試験も合格した。
