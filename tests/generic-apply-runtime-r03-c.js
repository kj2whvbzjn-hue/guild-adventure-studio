const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const game=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const test=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
for(const [name,src] of [['game',game],['game-tag-test',test]]){
 ok(src.includes('function applyTaggedApplyRuntime('),`${name}: APPLY dispatcher missing`);
 ok(src.includes("['SHIELD','STATUS','DOT'"),`${name}: execute loop does not use APPLY dispatcher`);
 ok(src.includes("reason:'ATTACK_FAILED'"),`${name}: ATTACK failure guard missing`);
 ok(src.includes("reason:'TARGET_DEAD'"),`${name}: dead-target guard missing`);
}
ok(game.includes("logic==='BUFF'||logic==='DEBUFF'"), 'game: modifier APPLY dispatch missing');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
ok(registry.phase==='R03-C','registry phase is not R03-C');
console.log('GENERIC_APPLY_RUNTIME_R03_C_PASS');
