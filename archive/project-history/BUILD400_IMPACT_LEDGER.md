# Build400 Impact Ledger

## Base
- `GA-Build399.zip`
- `guild-adventure-studio-main(10)(3).zip`

## MODIFY
- `formal-v03/index.html`
- `sw.js`
- `VERSION.txt`

## DELETE
- `data/skills/dev-skills.json`
- `schemas/skill.schema.json`
- `indexes/skills.index.json`

## ADD
- `BUILD400_GK_STUDIO_EXPORT_SOURCE_ALIGNMENT_VERIFICATION.md`
- `BUILD400_ADR_GK_STUDIO_SINGLE_SOURCE.md`
- `BUILD400_IMPACT_LEDGER.md`

## Removed Identifier
- `loadAiFirstSkillData`

## Retained Export Connection
- `loadExportBuffSkills`
- `Export/skill/skills.json`

## Data Flow
- GK Studio → `Export/skill/skills.json` → `loadExportBuffSkills` → game runtime

## Save／Export
- Save変更なし。
- Export形式変更なし。
- JSONキー変更なし。
- ID体系変更なし。
