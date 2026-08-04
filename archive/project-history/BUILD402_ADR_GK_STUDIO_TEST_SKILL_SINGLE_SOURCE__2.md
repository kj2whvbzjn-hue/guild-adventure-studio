# Build402 ADR: GK Studio Test Skill Single Source

## Decision
- 開発・検証用スキルデータの正本をGK Studioに一本化する。
- ゲーム本体へ同一データのインライン定義を置かない。
- 必須データ不足時にゲーム側で推論・補完・フォールバック生成を行わない。

## Compatibility
- 既存のスキルID、数値、効果、対象、条件、コストを変更せず移管する。
- Save形式、Export envelope、JSONキー、ID体系を変更しない。
