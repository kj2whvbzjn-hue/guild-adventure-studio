const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const trigger=require('../assets/shared/js/trigger-engine.js');
assert.ok(/^R04-D[2-9]$/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
assert.ok(/^R04-D[2-9]$/.test(trigger.VERSION),`unexpected trigger engine version ${trigger.VERSION}`);
assert.ok(trigger.SUPPORTED.includes('WHILE_SOURCE_ALIVE'));

const contract={type:'WHILE_SOURCE_ALIVE',scope:'SELF',engineEvent:'aura_evaluate',dispatchMode:'LEGACY_AURA_ADAPTER',priority:3};
let calls=0;
let dispatched=trigger.dispatchCompiled(contract,'aura_evaluate',{probe:true},()=>{calls++;return true});
assert.strictEqual(dispatched.ok,true);assert.strictEqual(dispatched.triggered,true);assert.strictEqual(calls,1);
dispatched=trigger.dispatchCompiled(contract,'ally_attack',{},()=>{calls++;return true});
assert.strictEqual(dispatched.ok,false);assert.strictEqual(dispatched.reason,'TRIGGER_ENGINE_EVENT_MISMATCH');assert.strictEqual(calls,1);

const sample={schemaVersion:1,id:'R04D2-AURA',name:'Generic Aura Runtime',trigger:{type:'WHILE_SOURCE_ALIVE',scope:'SELF',priority:3},conditions:[],target:{side:'ALLY',range:'ALL'},effects:[{type:'APPLY',effectId:'ATK_UP',power:18}],resource:{mpCost:0,cooldown:0}};
const generated=generic.compileGenericSkill(sample,registry);assert.strictEqual(generated.ok,true,JSON.stringify(generated.errors));
const legacyAura={id:'LEGACY-AURA',name:'Legacy Aura',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=11','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=highest','AURA_PRIORITY=0','ATK']};

for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const source={id:'S',name:'Source',side:'味方',alive:true,auraSkillIds:[generated.legacySkill.id]};
 const target={id:'T',name:'Target',side:'味方',alive:true,auraSkillIds:[]};
 const ctx={console,battle:{tick:0,units:[source,target],log:[]},GKSTriggerEngine:trigger,TAG_SKILLS:[generated.legacySkill,legacyAura]};vm.createContext(ctx);vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
 let entries=ctx.activeAuraEntries(target,'BUFF','ATK');assert.strictEqual(entries.length,1,`${runtimePath}: generic aura missing`);assert.strictEqual(entries[0].power,18);assert.strictEqual(entries[0].genericTrigger,true);
 ctx.GKSTriggerEngine=null;entries=ctx.activeAuraEntries(target,'BUFF','ATK');assert.strictEqual(entries.length,0,`${runtimePath}: generic aura must require trigger engine`);
 source.auraSkillIds=[legacyAura.id];entries=ctx.activeAuraEntries(target,'BUFF','ATK');assert.strictEqual(entries.length,1,`${runtimePath}: legacy aura fallback missing`);assert.strictEqual(entries[0].power,11);assert.strictEqual(entries[0].genericTrigger,false);
 source.alive=false;entries=ctx.activeAuraEntries(target,'BUFF','ATK');assert.strictEqual(entries.length,0,`${runtimePath}: dead source aura must stop`);
 const text=fs.readFileSync(runtimePath,'utf8');assert.ok(text.includes("engine.dispatchCompiled(triggerContract,'aura_evaluate'"),`${runtimePath}: production aura dispatch missing`);
}
console.log('GENERIC_AURA_RUNTIME_R04_D2_PASS');
