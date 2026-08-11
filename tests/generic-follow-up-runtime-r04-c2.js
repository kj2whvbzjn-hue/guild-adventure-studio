const assert=require('assert');
const fs=require('fs');
const trigger=require('../assets/shared/js/trigger-engine.js');
const condition=require('../assets/shared/js/condition-engine.js');
assert.ok(/^R04-(?:C2|D\d+)$/.test(trigger.VERSION),`unexpected trigger engine version ${trigger.VERSION}`);assert.ok(trigger.SUPPORTED.includes('ON_ALLY_ATTACK'));assert.strictEqual(condition.VERSION,'R04-C2');
let calls=0;const tc={type:'ON_ALLY_ATTACK',scope:'SELF',engineEvent:'ally_attack',dispatchMode:'LEGACY_FOLLOW_UP_ADAPTER',priority:0};let r=trigger.dispatchCompiled(tc,'ally_attack',{},()=>{calls++;return{ok:true}});assert.strictEqual(r.ok,true);assert.strictEqual(calls,1);r=trigger.dispatchCompiled(tc,'hit_received',{},()=>{calls++});assert.strictEqual(r.ok,false);assert.strictEqual(calls,1);
const cc={property:'TARGET_POISONED',scope:'TARGET',enginePredicate:'target_poisoned',expected:true};let c=condition.evaluateCompiled(cc,{},()=>true);assert.strictEqual(c.ok,true);assert.strictEqual(c.passed,true);c=condition.evaluateCompiled(cc,{},()=>false);assert.strictEqual(c.ok,true);assert.strictEqual(c.passed,false);
const source=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');assert.ok(source.includes("engine.dispatchCompiled(triggerContract,'ally_attack'"));assert.ok(source.includes('conditionEngine.evaluateCompiled(conditionContract'));assert.ok(source.includes("const result=runLegacyFollowUp();if(result?.ok)results.push(result)"),'Legacy FOLLOW_UP fallback missing');
console.log('GENERIC_FOLLOW_UP_RUNTIME_R04_C2_PASS');
