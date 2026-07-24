# GK Studio v1.14.0 Release Notes

## 実装内容
- DEC-0002「PHP受渡し用データスキーマ」のStudio側生成機能を実装
- 読込・出力画面に「PHP受渡し Export」を追加
- Studio正本データから22個のExport JSONを生成
- 全JSONにschema_version / data_version / generated_at / generated_by / dataを付与
- Web Crypto APIで各JSONのSHA-256を算出
- required=trueのfiles一覧を持つmanifest.jsonを自動生成
- JSZipでExport/ディレクトリをZIP化
- 既存Studio検証エラーとファイル内ID重複を生成前に検査
- 章・節・シーンをPHP向けに平坦化して別ファイルへ出力

## バージョン
- App: 1.14.0
- Build: 240
- Export Schema: 1.0.0

## 未実装
- PHP実ゲーム側のmanifest読込・SHA-256照合・schema_version判定
- 各データ種別固有のJSON Schema
- マスター間参照のExport専用完全検証


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
