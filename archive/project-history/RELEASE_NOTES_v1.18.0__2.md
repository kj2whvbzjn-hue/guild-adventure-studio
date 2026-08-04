# GK Studio v1.18.0 リリースノート

## GVF-001 Data Integrity Validation
- Game Validation Frameworkフェーズへ移行
- 既存の重複ID・参照切れ検査をGVF-001として正式化
- 孤立データ警告レポートを追加
- `--strict-orphans`による厳格検査を追加
- GVF専用CLIと自動試験を追加

次工程はGVF-002 Game Balance Validationです。


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
