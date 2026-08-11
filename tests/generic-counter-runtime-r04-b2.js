const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const triggerEngine=require('../assets/shared/js/trigger-engine.js');

assert.ok(/^R04-[BC]\d+$/.test(registry.phase));
assert.ok(/^R04-[BC]\d+$/.test(generic.VERSION));
assert.ok(/^R04-[BC]\d+$/.test(triggerEngine.VERSION));

const sample={
  schemaVersion:1,
  id:'R04B2-COUNTER',
  name:'R04B2 Generic Counter',
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority:4},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:110,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const ctx={console,battle:{tick:0,units:[],log:[]},GKSTriggerEngine:triggerEngine};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
  const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);
  assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
  const contract=out.legacySkill.genericRuntime.triggerContract;
  assert.deepStrictEqual(contract,{
    type:'ON_HIT_RECEIVED',scope:'SELF',engineEvent:'hit_received',dispatchMode:'LEGACY_COUNTER_ADAPTER',priority:4
  });
  const compiled=ctx.compileTaggedSkill(out.legacySkill);
  assert.strictEqual(compiled.ok,true,`${runtimePath}: ${JSON.stringify(compiled.errors)}`);
  assert.strictEqual(compiled.definition.genericRuntime.triggerContract.type,'ON_HIT_RECEIVED');
  assert.strictEqual(compiled.definition.genericRuntime.triggerContract.engineEvent,'hit_received');
  assert.strictEqual(compiled.definition.genericRuntime.triggerContract.priority,4);
}

let calls=0;
const contract={type:'ON_HIT_RECEIVED',scope:'SELF',engineEvent:'hit_received',dispatchMode:'LEGACY_COUNTER_ADAPTER',priority:4};
let r=triggerEngine.dispatchCompiled(contract,'hit_received',{probe:true},()=>{calls++;return{ok:true,damage:33}});
assert.strictEqual(r.ok,true);
assert.strictEqual(r.triggered,true);
assert.strictEqual(r.result.damage,33);
assert.strictEqual(calls,1);
r=triggerEngine.dispatchCompiled(contract,'damage_dealt',{},()=>{calls++;return{ok:true}});
assert.strictEqual(r.ok,false);
assert.strictEqual(r.reason,'TRIGGER_ENGINE_EVENT_MISMATCH');
assert.strictEqual(calls,1);

for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const source=fs.readFileSync(runtimePath,'utf8');
  assert.ok(source.includes("engine.dispatchCompiled(triggerContract,'hit_received'"),`${runtimePath}: Trigger Engine dispatch missing`);
  assert.ok(source.includes("generic_trigger_dispatched"),`${runtimePath}: dispatch event missing`);
  assert.ok(source.includes("genericTrigger:false"),`${runtimePath}: Legacy COUNTER fallback missing`);
}
console.log('GENERIC_COUNTER_RUNTIME_R04_B2_PASS');
