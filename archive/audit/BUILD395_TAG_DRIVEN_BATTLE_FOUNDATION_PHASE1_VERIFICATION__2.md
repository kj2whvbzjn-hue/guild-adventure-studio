# Build395 Tag-Driven Battle Foundation Phase1 Verification

## Scope

Build395 implements the first minimal phase of the tag-driven battle system in `formal-v03/index.html`.

Implemented:

- Combatant `tags` collection.
- `BattleStatusManager.addTag()`.
- `BattleStatusManager.hasTag()`.
- `BattleStatusManager.getTag()`.
- `BattleStatusManager.getTags()` defensive list copy.
- `BattleStatusManager.removeTag()`.
- Skill executor support for `kind: "tag"` with `add` and `remove` operations.
- Development-only FIRE/炎 tag add/remove skills.
- Battle UI tag display.
- JSONL events for add, duplicate rejection, removal, missing-tag rejection, and skill operations.
- `tag_foundation_phase1` PASS/FAIL verification scenario.

Not implemented in this phase:

- Stack quantities.
- Stack consumption.
- Tag conversion.
- BUFF/DEBUFF tag integration.
- Refrigeration／冷却 to Freeze integration.
- Export changes.
- Save schema changes.

## Compatibility policy

Build393 was used as the direct base. Existing Build393 development skills, status logic, DOT independent instances, BUFF logic, verification scenarios, Export, and Save structures were retained. No existing skill or data was deleted. Build394-only changes were not included.

## Verification

- JavaScript syntax check with Node.js: PASS.
- Build metadata in active Battle Core changed from 393 to 395: PASS.
- Embedded scenario assertions: 8.
- Integrated browser execution could not be run in the current container because local HTTP navigation is blocked by the browser administrator policy. The scenario remains available from the development verification UI for execution and JSONL export.
