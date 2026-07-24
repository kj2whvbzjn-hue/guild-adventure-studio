# GK Studio v1.22.1

## Content Production Framework Planning

- Content Production Frameworkを正式採用
- CPF-001〜007の実行計画を追加
- CPF基本仕様、データ仕様、CLI仕様を追加
- 承認ゲート、ロック、非破壊再生成を正式採用
- 部分再生成、差分、履歴、依存関係、影響分析を正式採用
- GVF-001〜005およびAtomic Updateとの連携方針を追加
- CPF受入基準とテスト計画を追加
- 次期実装をCPF-001 Story Pipeline Coreに設定

## Compatibility

RuntimeおよびGVFの動作変更なし。

Build: 321


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
