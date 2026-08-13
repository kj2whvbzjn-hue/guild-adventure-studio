const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');

const cases=[
 {id:'STATUS',target:{side:'ENEMY',range:'SINGLE'},effect:{type:'APPLY',effectId:'STUN',duration:300},legacy:'DURATION=300',tampered:'DURATION=999',expect:{statusId:'STATUS-STUN',statusDuration:300}},
 {id:'DOT',target:{side:'ENEMY',range:'SINGLE'},effect:{type:'APPLY',effectId:'POISON',power:12,duration:300,interval:100,stackGain:1},legacy:'DOT_POWER=12',tampered:'DOT_POWER=999',expect:{dotPower:12,dotDuration:300,dotInterval:100,stackGain:1}},
 {id:'BUFF',target:{side:'ALLY',range:'SINGLE'},effect:{type:'APPLY',effectId:'ATK_UP',power:20,duration:400,stackGain:1},legacy:'POWER=20',tampered:'POWER=999',expect:{modifierStat:'ATK',modifierPower:20,modifierDuration:400,stackGain:1}},
 {id:'DEBUFF',target:{side:'ENEMY',range:'SINGLE'},effect:{type:'APPLY',effectId:'DEF_DOWN',power:15,duration:350,stackGain:1},legacy:'POWER=15',tampered:'POWER=999',expect:{modifierStat:'DEF',modifierPower:15,modifierDuration:350,stackGain:1}},
 {id:'SHIELD',target:{side:'ALLY',range:'SINGLE'},effect:{type:'APPLY',effectId:'BARRIER',power:80,duration:500},legacy:'SHIELD=80',tampered:'SHIELD=999',expect:{shield:80,shieldDuration:500}}
];

assert.strictEqual(generic.VERSION,'R05-H');
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
 for(const item of cases){
  const skill={schemaVersion:1,id:`R05C-${item.id}`,name:`R05-C ${item.id}`,trigger:{type:'ON_USE',scope:'SELF'},target:item.target,effects:[item.effect],resource:{mpCost:0,cooldown:0}};
  const out=generic.compileSkill(skill,registry,ctx.compileTaggedSkill);assert.strictEqual(out.ok,true,`${runtimePath}/${item.id}: ${JSON.stringify(out.errors)}`);
  const contract=out.compiledSkill.runtimeContracts.applyContracts[0];assert.ok(contract.values,`${item.id}: Generic values missing`);
  const tampered=JSON.parse(JSON.stringify(out.compiledSkill));tampered.tags=tampered.tags.map(x=>x===item.legacy?item.tampered:x);
  const compiled=ctx.compileTaggedSkill(tampered);assert.strictEqual(compiled.ok,true,`${runtimePath}/${item.id}: ${JSON.stringify(compiled.errors)}`);
  const resolved=ctx.resolveGenericApplyDefinition(compiled,compiled.definition.runtimeContracts.applyContracts[0]);assert.strictEqual(resolved.ok,true);
  for(const [key,value] of Object.entries(item.expect))assert.strictEqual(resolved.compiled.definition.parameters[key],value,`${runtimePath}/${item.id}: ${key} read Legacy tag`);
 }
 const source=fs.readFileSync(runtimePath,'utf8');assert.ok(source.includes('generic_apply_executed'),`${runtimePath}: Generic APPLY audit missing`);
}
console.log('GENERIC_APPLY_RUNTIME_R05_C_PASS');
