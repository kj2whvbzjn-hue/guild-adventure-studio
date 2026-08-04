# 精査項目3 採用・適用記録

## 採用方針
StudioのExport生成処理を共通モジュールへ分離し、同一コードから最小実データFixtureを生成してPHP Runtimeで検証する自動E2E試験を採用する。

## 手動テスト方針
本計画では手動テストを基本的に行わない。PCブラウザ操作およびiPhone Safari操作は完了条件に含めない。端末固有障害が報告された場合のみ、別Decisionとして実施を検討する。

## 適用内容
- `export-core.js` を追加
- Studio本体と自動試験が同じExport生成コードを使用
- `tests/e2e/minimum-data.js` を追加
- `tests/e2e/generate-export.js` を追加
- `tests/e2e/verify-values.js` を追加
- `tests/e2e/run.sh` を追加
- Chapter/Section/Scene、日本語・改行、Job、Quest、Equipment MOD、Monster MOD、Stone MODの値一致を自動確認
- 自動生成ExportをPHP Runtimeへ渡し、22ファイル読込を確認
- v1.13.0空Exportを `tests/fixtures/legacy-v1.13.0-empty/` に保持
- 正式Exportを共通モジュールからv1.14.0として再生成

## 完了条件
1. Studioと試験が同じ共通モジュールを利用する
2. 最小実データから22 JSONとmanifestを自動生成できる
3. PHP Runtimeで22ファイルを読込できる
4. 主要入力値がPHP受渡しJSON内で一致する
5. 既存PHP異常系試験が継続合格する

## 判定
適用済み・自動E2E合格。
