# Build403 Impact Ledger

## Base
- `GA-Build402.zip`

## MODIFY
- `studio/index.html`
- `Export/skill/skills.json`
- `Export/manifest.json`
- `formal-v03/index.html`
- `sw.js`
- `VERSION.txt`

## ADD
- `BUILD403_ADR_GK_STUDIO_VERIFICATION_SKILL_COMPLETE_AUTHORITY.md`
- `BUILD403_GK_STUDIO_VERIFICATION_SKILL_COMPLETE_AUTHORITY_VERIFICATION.md`
- `BUILD403_IMPACT_LEDGER.md`

## Changed Data
- `devBattleBlessWeak`
- `devBattleBlessStrong`
- `devTagDrivenRollback`

## Changed Identifier Usage
- `requiredDevelopmentSkillIds`
- `skill_buff_application` verification scenario
- `tag_driven_skill_interaction_phase4` verification scenario

## Data Flow
- GK Studio `masters.skills` → `Export/skill/skills.json` → `loadGKStudioExportSkills` → verification scenarios

## Save／Export
- Save変更なし。
- Export envelope／JSONキー／ID体系変更なし。
- Exportデータ内容のみ追加。
