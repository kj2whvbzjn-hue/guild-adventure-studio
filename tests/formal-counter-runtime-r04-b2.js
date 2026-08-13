const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const triggerEngine=require('../assets/shared/js/trigger-engine.js');

assert.strictEqual(registry.phase,'FORMAL-SKILL-1');
assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
assert.ok(/^R04-[BCDE]\d*$/.test(triggerEngine.VERSION),`unexpected Trigger Engine ${triggerEngine.VERSION}`);

const sample={
  schemaVersion:1,
  id:'R04B2-COUNTER',
  name:'R04B2 Formal Counter',
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority:4},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:110,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

const out=compiler.compileSkill(sample,registry);
assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
const contract=out.compiledSkill.runtimeContracts.triggerContract;
assert.deepStrictEqual(contract,{
  type:'ON_HIT_RECEIVED',scope:'SELF',engineEvent:'hit_received',dispatchMode:'COUNTER',priority:4
});

const ctx={console,battle:{tick:0,units:[],log:[]},GKSTriggerEngine:triggerEngine};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(compiled.definition.runtimeContracts.triggerContract.type,'ON_HIT_RECEIVED');
assert.strictEqual(compiled.definition.runtimeContracts.triggerContract.engineEvent,'hit_received');
assert.strictEqual(compiled.definition.runtimeContracts.triggerContract.dispatchMode,'COUNTER');
assert.strictEqual(compiled.definition.runtimeContracts.triggerContract.priority,4);
assert.strictEqual(compiled.definition.parameters.counterLimit,1);
assert.strictEqual(compiled.definition.parameters.counterPriority,4);

let calls=0;
let r=triggerEngine.dispatchCompiled(contract,'hit_received',{probe:true},()=>{calls++;return{ok:true,damage:33}});
assert.strictEqual(r.ok,true);
assert.strictEqual(r.triggered,true);
assert.strictEqual(r.result.damage,33);
assert.strictEqual(calls,1);
r=triggerEngine.dispatchCompiled(contract,'damage_dealt',{},()=>{calls++;return{ok:true}});
assert.strictEqual(r.ok,false);
assert.strictEqual(r.reason,'TRIGGER_ENGINE_EVENT_MISMATCH');
assert.strictEqual(calls,1);

const source=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
assert.ok(source.includes("engine.dispatchCompiled(triggerContract,'hit_received'"),'Formal COUNTER Trigger Engine dispatch missing');
assert.ok(source.includes("recordValidationEvent('skill_trigger_dispatched'"),'Formal COUNTER dispatch audit event missing');
assert.ok(source.includes("const skill=findSkill(skillId),compiled=compileSkillForRuntime(skill)"),'COUNTER must compile Formal runtimeContracts');

console.log('FORMAL_COUNTER_RUNTIME_R04_B2_PASS');
