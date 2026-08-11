const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const trigger=require('../assets/shared/js/trigger-engine.js');
assert.strictEqual(registry.phase,'R04-D1');
assert.strictEqual(registry.triggers.WHILE_SOURCE_ALIVE.dispatch_mode,'LEGACY_AURA_ADAPTER');
assert.ok(trigger.SUPPORTED.includes('WHILE_SOURCE_ALIVE'));
const sample={schemaVersion:1,id:'R04D-AURA',name:'Generic Aura',trigger:{type:'WHILE_SOURCE_ALIVE',scope:'SELF',priority:7},conditions:[],target:{side:'ALLY',range:'ALL'},effects:[{type:'APPLY',effectId:'ATK_UP',power:18}],resource:{mpCost:0,cooldown:0}};
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
 const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
 for(const tag of ['AURA','AURA_EFFECT=BUFF','AURA_VALUE=18','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=highest','AURA_PRIORITY=7','ATK'])assert.ok(out.legacySkill.tags.includes(tag),`${runtimePath}: missing ${tag}`);
 assert.ok(!out.legacySkill.tags.includes('BUFF'),`${runtimePath}: AURA adapter must not create normal BUFF logic`);
 assert.ok(!out.legacySkill.tags.some(x=>x.startsWith('DURATION=')),`${runtimePath}: source-dependent AURA must not create duration`);
 assert.deepStrictEqual(out.legacySkill.genericRuntime.triggerContract,{type:'WHILE_SOURCE_ALIVE',scope:'SELF',engineEvent:'aura_evaluate',dispatchMode:'LEGACY_AURA_ADAPTER',priority:7});
 assert.deepStrictEqual(out.legacySkill.genericRuntime.auraEffectContract,{effectId:'ATK_UP',kind:'BUFF',logic:'AURA',modifierStat:'ATK',power:18,targetSide:'ally',targetScope:'self_and_allies',stack:'highest',sourceDependent:true});
 const compiled=ctx.compileTaggedSkill(out.legacySkill);assert.strictEqual(compiled.ok,true,`${runtimePath}: ${JSON.stringify(compiled.errors)}`);assert.ok(compiled.definition.logicOrder.includes('AURA'));assert.strictEqual(compiled.definition.parameters.auraValue,18);
}
const enemy=JSON.parse(JSON.stringify(sample));enemy.id='R04D-AURA-ENEMY';enemy.target={side:'ENEMY',range:'ALL'};enemy.effects=[{type:'APPLY',effectId:'DEF_DOWN',power:12}];let out=generic.compileGenericSkill(enemy,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));assert.ok(out.legacySkill.tags.includes('AURA_EFFECT=DEBUFF'));assert.ok(out.legacySkill.tags.includes('AURA_TARGET=enemy'));assert.ok(out.legacySkill.tags.includes('AURA_SCOPE=all'));assert.ok(out.legacySkill.tags.includes('DEF'));
const exclude=JSON.parse(JSON.stringify(sample));exclude.target.excludeSelf=true;out=generic.compileGenericSkill(exclude,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));assert.ok(out.legacySkill.tags.includes('AURA_SCOPE=allies_excluding_self'));
const badDuration=JSON.parse(JSON.stringify(sample));badDuration.effects[0].duration=100;out=generic.compileGenericSkill(badDuration,registry);assert.strictEqual(out.ok,false);assert.ok(out.errors.some(e=>e.code==='AURA_DURATION_FORBIDDEN'));
const badSingle=JSON.parse(JSON.stringify(sample));badSingle.target.range='SINGLE';out=generic.compileGenericSkill(badSingle,registry);assert.strictEqual(out.ok,false);assert.ok(out.errors.some(e=>e.code==='AURA_TARGET_RANGE_REQUIRED'));
console.log('GENERIC_AURA_ADAPTER_R04_D1_PASS');
