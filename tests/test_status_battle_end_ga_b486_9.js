const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const battle = fs.readFileSync(path.join(root, 'game/assets/js/battle-control.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'game/assets/js/studio-skill-bridge.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'assets/shared/config/runtime-config.js'), 'utf8');
const build = JSON.parse(fs.readFileSync(path.join(root, 'package-build.json'), 'utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(battle.includes("clearAllShields('battle_end');clearAllStatuses('battle_end');"), 'battle-end STATUS cleanup is not connected');
ok(bridge.includes("FORMAL-STATUS-BATTLE-END"), 'formal status battle-end regression case missing');
ok(config.includes('GA-B486.9') && config.includes('4869'), 'runtime config build/cache not updated');
ok(build.game_build === 'GA-B486.9', 'package-build game_build mismatch');
console.log('STATUS_BATTLE_END_GA_B486_9_OK');
