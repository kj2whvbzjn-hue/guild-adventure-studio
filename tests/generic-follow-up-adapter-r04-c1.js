const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
assert.ok(/^R04-C[23]$/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
assert.strictEqual(registry.triggers.ON_ALLY_ATTACK.dispatch_mode,'LEGACY_FOLLOW_UP_ADAPTER');
assert.strictEqual(registry.conditions.TARGET_POISONED.engine_predicate,'target_poisoned');
const sample={schemaVersion:1,id:'R04C-FOLLOW',name:'Generic Follow',trigger:{type:'ON_ALLY_ATTACK',scope:'SELF'},conditions:[{property:'TARGET_POISONED',scope:'TARGET',operator:'=',value:true}],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:75,damageType:'PHYSICAL'}],resource:{mpCost:0,cooldown:0}};
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
 const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
 for(const tag of ['FOLLOW_UP','TRIGGER_ALLY_ATTACK','CONDITION_POISONED','敵','単体','DAMAGE=75','物理'])assert.ok(out.legacySkill.tags.includes(tag),`${runtimePath}: missing ${tag}`);
 assert.ok(!out.legacySkill.tags.includes('ATTACK'),`${runtimePath}: generic FOLLOW_UP must not also become ATTACK`);
 assert.deepStrictEqual(out.legacySkill.genericRuntime.triggerContract,{type:'ON_ALLY_ATTACK',scope:'SELF',engineEvent:'ally_attack',dispatchMode:'LEGACY_FOLLOW_UP_ADAPTER',priority:0});
 assert.deepStrictEqual(out.legacySkill.genericRuntime.conditionContracts,[{property:'TARGET_POISONED',scope:'TARGET',enginePredicate:'target_poisoned',expected:true}]);
 const compiled=ctx.compileTaggedSkill(out.legacySkill);assert.strictEqual(compiled.ok,true,`${runtimePath}: ${JSON.stringify(compiled.errors)}`);assert.ok(compiled.definition.logicOrder.includes('FOLLOW_UP'));
}
const bad=JSON.parse(JSON.stringify(sample));bad.conditions=[];const out=generic.compileGenericSkill(bad,registry);assert.strictEqual(out.ok,false);assert.ok(out.errors.some(e=>e.code==='FOLLOW_UP_CONDITION_REQUIRED'));
console.log('GENERIC_FOLLOW_UP_ADAPTER_R04_C1_PASS');
