# Build401 Impact Ledger

## Base
- `GA-Build400(1).zip`
- `guild-adventure-studio-main(10)(3).zip`

## MODIFY
- `studio/index.html`
- `Export/skill/skills.json`
- `Export/manifest.json`
- `formal-v03/index.html`
- `sw.js`
- `VERSION.txt`

## ADD
- `BUILD401_GK_STUDIO_TEST_SKILL_EXPORT_INTEGRATION_VERIFICATION.md`
- `BUILD401_ADR_GK_STUDIO_TEST_DATA_AUTHORITY.md`
- `BUILD401_IMPACT_LEDGER.md`

## Removed Identifier
- `DEV_TAG_DRIVEN_INTERACTION_SKILL`

## Added／Changed Identifier
- `loadGKStudioExportSkills`
- `DEV_SKILL_DATABASE` receives GK Studio Export rows

## Data Flow
- GK Studio `masters.skills` → `Export/skill/skills.json` → `loadGKStudioExportSkills` → verification runtime

## Save／Export
- Save変更なし。
- Export envelope／JSONキー／ID体系変更なし。
- Exportデータ内容のみ追加。
