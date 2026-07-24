# GK Studio v1.14.1 Release Notes

## 実装内容
- DEC-0023 manifest完全照合を実装
- Export内のmanifest未登録ファイルを検出
- manifest掲載済み実体欠落ファイルを検出
- 新規エラーコード `MANIFEST_UNKNOWN_FILE` / `MANIFEST_MISSING_FILE`
- シンボリックリンク対策をディレクトリ走査にも適用

## バージョン
- Package: 1.14.1
- Export Schema: 1.0.0（変更なし）

## 次工程
- DEC-0024 PHP 8.1〜8.4 CI
- DEC-0025 Atomic Update
- DEC-0026 Rollback


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
