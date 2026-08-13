const assert=require('assert');
const fs=require('fs');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
assert.ok(/^R04-E[23]$/.test(engine.VERSION),`unexpected trigger engine version ${engine.VERSION}`);
assert.ok(registry.phase==='FORMAL-SKILL-1'||/^R04-E[23]$/.test(registry.phase)||/^R0[5-9]-/.test(registry.phase)||/^R[1-9][0-9]-/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
assert.deepStrictEqual(engine.REACTIVE_FAMILY_ORDER,{COUNTER:0,FOLLOW_UP:1});

// Reactive families keep the established production boundary: COUNTER before FOLLOW_UP.
// Within the same family, higher trigger priority wins; equal priority preserves discovery order.
const ordered=engine.orderSimultaneousCandidates([
 {kind:'FOLLOW_UP',priority:100,sequence:3,id:'f-late'},
 {kind:'COUNTER',priority:-100,sequence:2,id:'counter'},
 {kind:'FOLLOW_UP',priority:7,sequence:1,id:'f-second'},
 {kind:'FOLLOW_UP',priority:7,sequence:0,id:'f-first'}
]);
assert.deepStrictEqual(ordered.map(x=>x.id),['counter','f-late','f-first','f-second']);
assert.deepStrictEqual(ordered.map(x=>x.familyRank),[0,1,1,1]);

const game=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
assert.ok(game.includes('orderTaggedSimultaneousTriggers'),'shared simultaneous ordering wrapper missing');
assert.ok(game.includes("trigger_simultaneous_order_fixed"),'simultaneous order audit missing');
assert.ok(game.includes("{kind:'COUNTER',priority:0,sequence:0},{kind:'FOLLOW_UP',priority:0,sequence:1}"),'reactive family order slots missing');
assert.ok(game.includes("candidates.splice(0,candidates.length,...orderTaggedSimultaneousTriggers(candidates))"),'FOLLOW_UP candidate ordering must use shared engine helper');
assert.ok(game.includes("FOLLOW_UP_CANNOT_CHAIN"),'FOLLOW_UP recursion block missing');
assert.ok(game.includes("triggerActionContext:event?.triggerActionContext"),'FOLLOW_UP action context propagation missing');
assert.ok(game.includes("else if(logic==='FOLLOW_UP'){followUpResult=executeRuntimeDamageRuntime"),'Formal Game FOLLOW_UP DAMAGE runtime execution missing');
assert.ok(game.includes("effectiveAttackResult=attackResult||followUpResult"),'Formal Game derived trigger result handling missing');

console.log('FORMAL_TRIGGER_SIMULTANEOUS_ORDER_R04_E2_PASS');
