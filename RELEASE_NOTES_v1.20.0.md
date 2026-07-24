# GK Studio v1.20.0 Release Notes

## GVF-003 Scenario Validation
- `ScenarioValidator`を追加
- `scenario-validation-rules.json`を追加
- `gvf-scenario.php` CLIを追加
- 章・節・シーン・クエスト順序検査を追加
- ボス配置検査を追加
- イベントフラグ進行検査を追加
- 物語マイルストーン検査を追加
- 制作時Warning／リリース時Criticalの切替に対応

Build 300


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
