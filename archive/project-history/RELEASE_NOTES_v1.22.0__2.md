# GK Studio v1.22.0

## GVF-005 Release Quality Report
- Runtime、GVF-001、GVF-002、GVF-003、GVF-004の統合判定を追加
- 総合品質スコアとRelease Ready判定を追加
- JSON / HTML出力を追加
- `--strict-release`によるCI Release Gateを追加
- 設定駆動型の品質重み・必須検査ポリシーを追加

Build: 320


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
