# GK Studio v1.15.0 Release Notes

## 実装内容
- DEC-0024 PHP 8.1〜8.4 CIを追加
- GitHub ActionsのPHPマトリクス試験を追加
- PHP全ファイルの構文検査を追加
- Runtime自動試験と同梱Export検証をCIへ追加
- Repository統合試験のfixture不整合を修正

## バージョン
- Package: 1.15.0
- Export Schema: 1.0.0（変更なし）
- Build: 250

## 次工程
- DEC-0025 Atomic Update
- DEC-0026 Rollback


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
