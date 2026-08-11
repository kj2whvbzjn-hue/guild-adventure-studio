const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const triggerEngine=require('../assets/shared/js/trigger-engine.js');

assert.ok(/^R04-[BCD]\d+/.test(String(registry.phase||'')),`unexpected registry phase ${registry.phase}`);
assert.ok(/^R04-[BCD]\d+/.test(String(generic.VERSION||'')),`unexpected generic compiler version ${generic.VERSION}`);
assert.ok(/^R04-[BCD]\d+/.test(String(triggerEngine.VERSION||'')),`unexpected trigger engine version ${triggerEngine.VERSION}`);

const sample={
  schemaVersion:1,
  id:'R04B3-COUNTER',
  name:'R04B3 Generic Counter',
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority:9},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const src=fs.readFileSync(runtimePath,'utf8');
  const ctx={console,battle:{tick:0,units:[],log:[]},GKSTriggerEngine:triggerEngine};
  vm.createContext(ctx);
  vm.runInContext(src,ctx);
  const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);
  assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
  const compiled=ctx.compileTaggedSkill(out.legacySkill);
  assert.strictEqual(compiled.ok,true,`${runtimePath}: ${JSON.stringify(compiled.errors)}`);
  assert.strictEqual(compiled.definition.parameters.counterPriority,9,`${runtimePath}: legacy priority lost`);
  assert.strictEqual(compiled.definition.parameters.counterAllowZeroDamage,'true',`${runtimePath}: zero damage policy lost`);
  assert.strictEqual(compiled.definition.genericRuntime.triggerContract.priority,9,`${runtimePath}: trigger priority lost`);

  // zero damage must still be a hit: no hp-damage > 0 gate before counter dispatch.
  assert.ok(src.includes("if(!attackResult?.ok)return skip('NO_HIT')"),`${runtimePath}: hit gate missing`);
  assert.ok(!src.includes("if(!(attackResult?.damage>0))return skip"),`${runtimePath}: zero-damage gate unexpectedly added`);
  assert.ok(src.includes("shield_absorbed:attackResult.shieldAbsorbed||0,hp_damage:attackResult.damage||0"),`${runtimePath}: zero-damage audit fields missing`);

  // derived counter/follow-up must not recurse indefinitely.
  assert.ok(src.includes("if(Number(derivedGeneration)>=2)return skip('DERIVED_GENERATION_LIMIT')"),`${runtimePath}: derived generation guard missing`);
  assert.ok(src.includes("counter_chain_blocked"),`${runtimePath}: counter chain block missing`);
  assert.ok(src.includes("COUNTER_CANNOT_CHAIN"),`${runtimePath}: counter chain reason missing`);

  // COVER-aware derived hits must not be rejected by the shared counter dispatcher.
  assert.ok(src.includes("if(origin!=='base'&&!wasCovered)return skip('DERIVED_ORIGIN')"),`${runtimePath}: cover exception gate missing`);
  if(runtimePath.startsWith('game/')){
    assert.ok(src.includes("else if(coverResult.covered){dispatchCounterAfterAttack"),`${runtimePath}: covered derived counter dispatch missing`);
    assert.ok(src.includes("wasCovered:true"),`${runtimePath}: covered flag propagation missing`);
  }
}

let handlerCalls=0;
let seenPriority=null;
const contract={type:'ON_HIT_RECEIVED',scope:'SELF',engineEvent:'hit_received',dispatchMode:'LEGACY_COUNTER_ADAPTER',priority:9};
const dispatched=triggerEngine.dispatchCompiled(contract,'hit_received',{shieldAbsorbed:999,hpDamage:0},({contract:received,payload})=>{
  handlerCalls++;
  seenPriority=received.priority;
  assert.strictEqual(payload.hpDamage,0);
  assert.strictEqual(payload.shieldAbsorbed,999);
  return{ok:true};
});
assert.strictEqual(dispatched.ok,true);
assert.strictEqual(dispatched.triggered,true);
assert.strictEqual(handlerCalls,1);
assert.strictEqual(seenPriority,9);

const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
for(const marker of [
  'COUNTER-RUNTIME-SHIELD-ZERO',
  'COUNTER-RUNTIME-NO-CHAIN',
  'COVER-RUNTIME-COUNTER-COVER-COUNTER'
])assert.ok(app.includes(marker),`formal regression marker missing: ${marker}`);

console.log('GENERIC_COUNTER_REGRESSION_R04_B3_PASS');
