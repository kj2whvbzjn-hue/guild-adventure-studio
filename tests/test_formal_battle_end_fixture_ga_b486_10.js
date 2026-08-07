const fs=require('fs');
function ok(value,message){if(!value)throw new Error(message)}
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const battle=fs.readFileSync('game/assets/js/battle-control.js','utf8');
const config=fs.readFileSync('assets/shared/config/runtime-config.js','utf8');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const killAll="battle.units.filter(unit=>unit.side==='敵')";
ok(bridge.split(killAll).length-1>=2,'formal battle-end cases do not defeat every enemy in battle.units');
ok(!bridge.includes("for(const enemy of f.enemies){enemy.hp=0;enemy.alive=false}finishIfNeeded();"),'fixture-subset battle-end loop remains');
ok(battle.includes("clearAllShields('battle_end');clearAllStatuses('battle_end');"),'battle-end cleanup is not connected');
ok(config.includes('GA-B486.10')&&config.includes('48610'),'runtime config build/cache not updated');
ok(build.game_build==='GA-B486.10','package-build game_build mismatch');
console.log('FORMAL_BATTLE_END_FIXTURE_GA_B486_10_OK');
