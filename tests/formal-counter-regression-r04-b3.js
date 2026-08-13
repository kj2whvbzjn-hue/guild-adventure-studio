const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const triggerEngine=require('../assets/shared/js/trigger-engine.js');

assert.strictEqual(registry.phase,'FORMAL-SKILL-1');
assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
assert.ok(/^R04-[BCDE]\d*$/.test(String(triggerEngine.VERSION||'')),`unexpected trigger engine version ${triggerEngine.VERSION}`);

const sample={
  schemaVersion:1,
  id:'R04B3-COUNTER',
  name:'R04B3 Formal Counter',
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority:9},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

const src=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const ctx={console,battle:{tick:0,units:[],log:[]},GKSTriggerEngine:triggerEngine};
vm.createContext(ctx);
vm.runInContext(src,ctx);
const out=compiler.compileSkill(sample,registry);
assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(compiled.definition.parameters.counterPriority,9,'Formal priority lost');
assert.strictEqual(compiled.definition.parameters.counterAllowZeroDamage,'true','zero damage policy lost');
assert.strictEqual(compiled.definition.runtimeContracts.triggerContract.priority,9,'trigger priority lost');
assert.strictEqual(compiled.definition.runtimeContracts.triggerContract.dispatchMode,'COUNTER','Formal dispatch mode lost');

// Zero HP damage can still be a hit when Shield absorbed it.
assert.ok(src.includes("if(!attackResult?.ok)return skip('NO_HIT')"),'hit gate missing');
assert.ok(!src.includes("if(!(attackResult?.damage>0))return skip"),'zero-damage gate unexpectedly added');
assert.ok(src.includes('shield_absorbed:attackResult.shieldAbsorbed||0,hp_damage:attackResult.damage||0'),'zero-damage audit fields missing');

// Derived counter/follow-up must not recurse indefinitely.
assert.ok(src.includes("if(Number(derivedGeneration)>=2)return skip('DERIVED_GENERATION_LIMIT')"),'derived generation guard missing');
assert.ok(src.includes('counter_chain_blocked'),'counter chain block missing');
assert.ok(src.includes('COUNTER_CANNOT_CHAIN'),'counter chain reason missing');

// COVER-aware derived hits must not be rejected by the shared counter dispatcher.
assert.ok(src.includes("if(origin!=='base'&&!wasCovered)return skip('DERIVED_ORIGIN')"),'cover exception gate missing');
assert.ok(src.includes('else if(coverResult.covered){dispatchCounterAfterAttack'),'covered derived counter dispatch missing');
assert.ok(src.includes('wasCovered:true'),'covered flag propagation missing');

let handlerCalls=0;
let seenPriority=null;
const contract=out.compiledSkill.runtimeContracts.triggerContract;
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

console.log('FORMAL_COUNTER_REGRESSION_R04_B3_PASS');
