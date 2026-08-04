# Build403 ADR: GK Studio Verification Skill Complete Authority

## Decision
- 検証シナリオ内で生成していた派生スキルデータもGK Studioへ一本化する。
- ゲーム本体はGK Studio Exportに存在する検証スキルのみを参照する。
- 検証用データ不足時にゲーム側で生成・推論・補完しない。

## Scope
- 弱BUFF検証スキル
- 強BUFF検証スキル
- ロールバック検証スキル

## Compatibility
- Save形式、Export envelope、JSONキー、ID体系を変更しない。
