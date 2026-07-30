# Build398 Impact Ledger

## 基礎
- `GA-Build397.zip`

## MODIFY
- `formal-v03/index.html`
- `sw.js`
- `VERSION.txt`

## ADD
- `BUILD398_TAG_DRIVEN_SKILL_INTERACTION_PHASE4_VERIFICATION.md`
- `BUILD398_ADR_AI_FIRST_SKILL_INTERACTION_DATA_MODEL.md`
- `BUILD398_IMPACT_LEDGER.md`

## 実在識別子
- `DEV_TAG_DRIVEN_INTERACTION_SKILL`
- `DEV_SKILL_DATABASE`
- `SkillInteractionEngine`
- `SkillExecutor.execute`
- `VERIFICATION_SCENARIOS.tag_driven_skill_interaction_phase4`
- `logEvent`

## 呼び出し関係
- `SkillExecutor.execute` → `SkillInteractionEngine.execute`
- `SkillInteractionEngine.execute` → 条件評価 → コスト適用 → 効果適用
- 操作処理 → `BattleStatusManager`のタグ／スタックAPI

## JSONLイベント
- `SKILL_INTERACTION_CONDITION_EVALUATED`
- `SKILL_INTERACTION_EXECUTED`
- `SKILL_INTERACTION_ROLLED_BACK`
- `TAG_DRIVEN_SKILL_INTERACTION_PHASE4_COMPLETED`

## 将来置換対象
- 開発用スキル定数は正式JSONスキルDB導入時に置換する。
- インライン定義はJSON Schema検証済み外部データへ移行する。

## Save／Export
- 変更なし。
