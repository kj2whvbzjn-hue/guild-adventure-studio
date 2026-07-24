# PHP Export Runtime v1.0.0 Release Notes

## DEC-0002 PHP側実装
- manifest先行読込
- schema_version対応判定
- 必須ファイル不足時の起動停止
- SHA-256照合
- UTF-8 / JSON / 共通Envelope検査
- manifestと文書のschema_version一致検査
- パストラバーサル・重複パス拒否
- CLI検証コマンド
- Web組込み例
- 正常系・異常系自動テスト

## 未実装
- データ種別ごとの個別Schema
- データ間参照整合性検証


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
