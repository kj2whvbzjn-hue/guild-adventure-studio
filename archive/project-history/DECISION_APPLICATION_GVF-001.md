# GVF-001 適用決定書

## 件名
データ参照整合性検査と品質レポート

## 採用内容
既存の起動時整合性検査をGVF-001として正式化し、重複ID、参照切れ、孤立データを検出する。参照切れは起動拒否、孤立データは通常警告、厳格モードでは拒否とする。

## 実装
- `GameValidationReporter`
- `php-runtime/bin/gvf-validate.php`
- `schemas/data-integrity-rules.json` v1.1.0
- `--strict-orphans` オプション
- 自動回帰試験

## 次工程
GVF-002 ゲームバランス検査
