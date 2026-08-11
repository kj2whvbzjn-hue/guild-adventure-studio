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
const phase=String(registry.phase||'');
const m=phase.match(/^R03-([A-Z])(\d+)?([a-z])?$/);
const phaseOk=phase==='R03-C'||phase==='R03-D'||(/^R03-E\d+[a-z]?$/.test(phase));
ok(phaseOk,'registry phase predates R03-C');
console.log('GENERIC_APPLY_RUNTIME_R03_C_PASS');
