const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const game=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
ok(game.includes('function applyTaggedApplyRuntime('),'game: Formal APPLY dispatcher missing');
ok(game.includes("['SHIELD','STATUS','DOT'"),'game: execute loop does not use APPLY dispatcher');
ok(game.includes("reason:'ATTACK_FAILED'"),'game: ATTACK failure guard missing');
ok(game.includes("reason:'TARGET_DEAD'"),'game: dead-target guard missing');
ok(game.includes("logic==='BUFF'||logic==='DEBUFF'"),'game: modifier APPLY dispatch missing');
ok(game.includes('function resolveRuntimeApplyLifecycle('),'game: Formal lifecycle resolver missing');
ok(game.includes('function resolveRuntimeApplyPolicy('),'game: Formal policy resolver missing');
ok(game.includes('function resolveRuntimeApplyDefinition('),'game: Formal values resolver missing');
ok(!game.includes('function compileTaggedSkill('),'game: Legacy compileTaggedSkill returned');
ok(!game.includes('function parseSkillTags('),'game: Legacy Tag parser returned');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
ok(registry.phase==='FORMAL-SKILL-1','registry phase is not Formal');
console.log('FORMAL_APPLY_RUNTIME_R03_C_PASS');
