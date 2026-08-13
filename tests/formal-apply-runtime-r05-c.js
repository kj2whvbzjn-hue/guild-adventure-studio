const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

const cases=[
 {id:'STATUS',target:{side:'ENEMY',range:'SINGLE'},effect:{type:'APPLY',effectId:'STUN',duration:300},fakeTag:'DURATION=999',expect:{statusId:'STATUS-STUN',statusDuration:300}},
 {id:'DOT',target:{side:'ENEMY',range:'SINGLE'},effect:{type:'APPLY',effectId:'POISON',power:12,duration:300,interval:100,stackGain:1},fakeTag:'DOT_POWER=999',expect:{dotPower:12,dotDuration:300,dotInterval:100,stackGain:1}},
 {id:'BUFF',target:{side:'ALLY',range:'SINGLE'},effect:{type:'APPLY',effectId:'ATK_UP',power:20,duration:400,stackGain:1},fakeTag:'POWER=999',expect:{modifierStat:'ATK',modifierPower:20,modifierDuration:400,stackGain:1}},
 {id:'DEBUFF',target:{side:'ENEMY',range:'SINGLE'},effect:{type:'APPLY',effectId:'DEF_DOWN',power:15,duration:350,stackGain:1},fakeTag:'POWER=999',expect:{modifierStat:'DEF',modifierPower:15,modifierDuration:350,stackGain:1}},
 {id:'SHIELD',target:{side:'ALLY',range:'SINGLE'},effect:{type:'APPLY',effectId:'BARRIER',power:80,duration:500},fakeTag:'SHIELD=999',expect:{shield:80,shieldDuration:500}}
];

assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
const runtimePath='game/assets/js/tag-skill-runtime.js';
const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
for(const [index,item] of cases.entries()){
 const skill={schemaVersion:1,id:`SKL-${String(9341+index).padStart(4,'0')}`,name:`R05-C ${item.id}`,trigger:{type:'ON_USE',scope:'SELF'},target:item.target,effects:[item.effect],resource:{mpCost:0,cooldown:0}};
 const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,`${runtimePath}/${item.id}: ${JSON.stringify(out.errors)}`);
 const contract=out.compiledSkill.runtimeContracts.applyContracts[0];assert.ok(contract.values,`${item.id}: Formal values missing`);
 const withLegacyNoise=JSON.parse(JSON.stringify(out.compiledSkill));withLegacyNoise.tags=[item.fakeTag,'POWER=777','DURATION=888'];
 const compiled=ctx.compileSkillForRuntime(withLegacyNoise);assert.strictEqual(compiled.ok,true,`${runtimePath}/${item.id}: ${JSON.stringify(compiled.errors)}`);
 assert.strictEqual(compiled.definition.sourceTags.length,0,`${runtimePath}/${item.id}: Legacy tags affected Formal runtime compile`);
 const resolved=ctx.resolveRuntimeApplyDefinition(compiled,compiled.definition.runtimeContracts.applyContracts[0]);assert.strictEqual(resolved.ok,true);
 for(const [key,value] of Object.entries(item.expect))assert.strictEqual(resolved.compiled.definition.parameters[key],value,`${runtimePath}/${item.id}: ${key} did not come from runtimeContracts`);
}
const source=fs.readFileSync(runtimePath,'utf8');assert.ok(source.includes('runtime_apply_executed'),`${runtimePath}: Formal APPLY audit missing`);assert.ok(!source.includes('generic_apply_executed'),`${runtimePath}: Legacy Generic APPLY audit returned`);
console.log('FORMAL_APPLY_RUNTIME_R05_C_PASS');
