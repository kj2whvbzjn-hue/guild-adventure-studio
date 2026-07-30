# Build399 Impact Ledger

## 基礎
- `GA-Build398.zip`

## MODIFY
- `formal-v03/index.html`
- `sw.js`
- `VERSION.txt`

## ADD
- `data/skills/dev-skills.json`
- `schemas/skill.schema.json`
- `indexes/skills.index.json`
- `BUILD399_AI_FIRST_SKILL_DATA_EXTERNALIZATION_PHASE5_VERIFICATION.md`
- `BUILD399_ADR_AI_FIRST_EXTERNAL_SKILL_DATA.md`
- `BUILD399_IMPACT_LEDGER.md`

## 実在識別子
- `DEV_SKILL_DATABASE`
- `loadAiFirstSkillData`
- `SkillInteractionEngine`
- `SkillExecutor.execute`
- `VERIFICATION_SCENARIOS.tag_driven_skill_interaction_phase4`
- `logEvent`

## 呼び出し関係
- 起動処理 → `loadAiFirstSkillData`
- `loadAiFirstSkillData` → `data/skills/dev-skills.json`
- 外部スキルデータ → `DEV_SKILL_DATABASE`
- `DEV_SKILL_DATABASE` → `SkillExecutor.execute`

## JSONLイベント
- `AI_SKILL_DATA_LOADED`
- `AI_SKILL_DATA_FALLBACK`

## 将来置換対象
- インライン開発用スキル定数は外部データ運用安定後に削除候補。
- 正式スキルDB導入時にdevelopmentデータを分離・置換する。

## Save／Export
- 変更なし。
