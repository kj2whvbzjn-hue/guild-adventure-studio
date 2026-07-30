# Build402 Impact Ledger

## Base
- `GA-Build401.zip`

## MODIFY
- `studio/index.html`
- `Export/skill/skills.json`
- `Export/manifest.json`
- `formal-v03/index.html`
- `sw.js`
- `VERSION.txt`

## ADD
- `BUILD402_GK_STUDIO_TEST_SKILL_DATA_AUTHORITY_VERIFICATION.md`
- `BUILD402_ADR_GK_STUDIO_TEST_SKILL_SINGLE_SOURCE.md`
- `BUILD402_IMPACT_LEDGER.md`

## Removed Data Definitions
- `DEV_HEAL_SKILL` inline data
- `DEV_POISON_SKILL` inline data
- `DEV_BURN_SKILL` inline data
- `DEV_BLEED_SKILL` inline data
- `DEV_SLEEP_SKILL` inline data
- `DEV_STUN_SKILL` inline data
- `DEV_FREEZE_SKILL` inline data
- `DEV_BUFF_SKILL` inline data
- `DEV_ADD_FIRE_TAG_SKILL` inline data
- `DEV_REMOVE_FIRE_TAG_SKILL` inline data
- `DEV_ADD_REFRIGERATION_STACK_SKILL` inline data
- `DEV_REMOVE_REFRIGERATION_STACK_SKILL` inline data
- `DEV_CONSUME_REFRIGERATION_STACK_SKILL` inline data

## Changed Identifier
- `loadGKStudioExportSkills`

## Data Flow
- GK Studio `masters.skills` → `Export/skill/skills.json` → `loadGKStudioExportSkills` → `DEV_SKILL_DATABASE`／検証実行

## Save／Export
- Save変更なし。
- Export envelope／JSONキー／ID体系変更なし。
- Exportデータ内容のみ追加。
