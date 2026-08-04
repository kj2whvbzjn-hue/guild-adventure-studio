# Build401 ADR: GK Studio Test Data Authority

## Decision
- 開発・検証用スキルもGK Studioで作成・管理する。
- ゲーム本体へ検証用スキルの独自正本を置かない。
- データ経路はGK Studio → Export → Gameとする。
- 未定義項目は推論せず確認する。

## Compatibility
- 既存のタグ駆動相互作用データ内容を変更せず移管する。
- Save形式、ID体系、Export envelopeを変更しない。
