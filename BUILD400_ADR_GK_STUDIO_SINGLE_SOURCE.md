# Build400 ADR: GK Studio Single Source

## Decision
- GK Studioを唯一の正式仕様・マスターデータ正本とする。
- データ経路はGK Studio → Export → Gameとする。
- ゲーム側に独自マスターデータ正本を追加しない。
- 未定義だが実装上必要な項目は推論せず確認する。

## Compatibility
- Export形式、JSONキー、保存形式、ID体系は変更しない。
- 開発検証用インライン定義は正式マスターデータと分離して維持する。
