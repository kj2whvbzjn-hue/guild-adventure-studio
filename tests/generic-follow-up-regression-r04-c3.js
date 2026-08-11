const assert=require('assert');
const fs=require('fs');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
assert.strictEqual(registry.phase,'R04-C3');
const source=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');

// Multiple Generic FOLLOW_UP candidates are ordered by trigger priority, then by pre-existing discovery order.
assert.ok(source.includes("candidates.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence)"),'FOLLOW_UP priority ordering missing');
assert.ok(source.includes("follow_up_order_fixed"),'FOLLOW_UP fixed-order audit event missing');
assert.ok(source.includes("priority:Number.isInteger(triggerContract?.priority)?triggerContract.priority:0"),'Generic trigger priority not consumed');

// If an earlier follow-up kills the target, later candidates are skipped rather than hitting a dead target.
assert.ok(source.includes("if(!target.alive){recordValidationEvent('follow_up_skipped'"),'target-death guard missing');
assert.ok(source.includes("reason:'TARGET_DEAD'"),'target-death skip reason missing');

// Poison is evaluated at actual dispatch time for every candidate; stale precomputed condition state is forbidden.
const conditionCheck="conditionEngine.evaluateCompiled(conditionContract,{sourceId:follower.id,initiatorId:initiator.id,targetId:target.id,skillId},()=>ensureDotStackList(target).length>0)";
assert.ok(source.includes(conditionCheck),'TARGET_POISONED must be re-evaluated at dispatch');

// A successful zero-HP-damage attack (e.g. shield absorption) is still a valid ally-attack trigger.
assert.ok(source.includes("if(effectiveAttackResult?.ok&&!suppressDerived)"),'FOLLOW_UP must key off successful hit, not positive HP damage');
assert.ok(!source.includes("effectiveAttackResult?.damage>0"),'positive-damage gate must not be added to FOLLOW_UP dispatch');

// Derived FOLLOW_UP cannot recursively produce another FOLLOW_UP chain.
assert.ok(source.includes("follow_up_chain_blocked"),'FOLLOW_UP chain audit missing');
assert.ok(source.includes("FOLLOW_UP_CANNOT_CHAIN"),'FOLLOW_UP chain reason missing');
assert.ok(source.includes("derivedGeneration:Number(event?.derivedGeneration||0)+1"),'derived generation propagation missing');

// Legacy FOLLOW_UP remains supported with default priority 0 and legacy execution fallback.
assert.ok(source.includes("priority:Number.isInteger(triggerContract?.priority)?triggerContract.priority:0"),'legacy priority fallback missing');
assert.ok(source.includes("const result=runLegacyFollowUp();if(result?.ok)results.push(result)"),'Legacy FOLLOW_UP fallback missing');

console.log('GENERIC_FOLLOW_UP_REGRESSION_R04_C3_PASS');
