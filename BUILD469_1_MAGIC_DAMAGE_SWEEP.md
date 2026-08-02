# Build 469.1 魔法武器補正一括検証

## 追加内容
- かんたん範囲一括検証に「魔法武器補正（%）」を追加
- AI戦闘実験JSONで `magicWeaponBonusPercent` を受付
- 魔法攻撃式を追加
  - `skillBasePower × skillPowerRate × (1 + magicWeaponBonusPercent / 100)`
  - 属性補正、耐性、クリティカル、乱数も適用
- 実験JSONの `fixed` で以下を固定可能
  - `skillBasePower`
  - `skillPowerRate`
  - `elementBonusPercent`
  - `enemyResistancePercent`
  - `criticalRatePercent`
  - `criticalMultiplier`
  - `randomMin` / `randomMax`

## 魔法スキル判定
以下のいずれかを満たす攻撃スキルを魔法として処理します。
- `damage_type: "magical"` または `"magic"`
- `type: "magic"`
- `magic: true`
- `base_power` を持つ
- 実験JSONの `fixed.skillBasePower` が指定される
