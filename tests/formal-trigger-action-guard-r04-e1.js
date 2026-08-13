const assert=require('assert');
const fs=require('fs');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
assert.ok(/^R04-E[123]$/.test(engine.VERSION),`unexpected trigger engine version ${engine.VERSION}`);
assert.ok(registry.phase==='FORMAL-SKILL-1'||/^R04-E[123]$/.test(registry.phase)||/^R0[5-9]-/.test(registry.phase)||/^R[1-9][0-9]-/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
assert.strictEqual(engine.DEFAULT_ACTION_TRIGGER_LIMIT,16);

// One action owns one cumulative trigger budget. Released triggers may fire again,
// but the total number of activations never exceeds the action cap.
const ctx=engine.createActionContext({actionId:'probe',maxActivations:3});
let a=engine.tryActivate(ctx,'COUNTER:A',{kind:'COUNTER'});assert.strictEqual(a.ok,true);assert.strictEqual(a.index,1);
let re=engine.tryActivate(ctx,'COUNTER:A',{kind:'COUNTER'});assert.strictEqual(re.ok,false);assert.strictEqual(re.reason,'TRIGGER_REENTRY_BLOCKED');
a.release();
let b=engine.tryActivate(ctx,'FOLLOW_UP:B',{kind:'FOLLOW_UP'});assert.strictEqual(b.ok,true);b.release();
let c=engine.tryActivate(ctx,'COUNTER:A',{kind:'COUNTER'});assert.strictEqual(c.ok,true);c.release();
let over=engine.tryActivate(ctx,'FOLLOW_UP:C',{kind:'FOLLOW_UP'});assert.strictEqual(over.ok,false);assert.strictEqual(over.reason,'TRIGGER_ACTION_LIMIT_REACHED');
assert.strictEqual(ctx.activationCount,3);assert.strictEqual(ctx.history.length,3);

// The Production Formal Game runtime must create/share the same action context through derived COUNTER execution.
const game=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
assert.ok(game.includes('createTaggedTriggerActionContext'),'Formal Game action context helper missing');
assert.ok(game.includes('acquireTaggedTriggerActivation'),'Formal Game activation guard helper missing');
assert.ok(game.includes("triggerActionContext=createTaggedTriggerActionContext(attacker,incomingCompiled,triggerActionContext)"),'Formal Game COUNTER context normalization missing');
assert.ok(game.includes("triggerActionContext})"),'Formal Game derived COUNTER must inherit action context');
assert.ok(game.includes("trigger_action_activation"),'Formal Game activation audit event missing');

// Formal Game FOLLOW_UP shares the base action context and keeps the established ordering:
// COUNTER dispatch occurs before FOLLOW_UP candidate dispatch, while FOLLOW_UP candidates
// remain priority-desc / discovery-order stable.
assert.ok(game.includes("event={...(event||{}),triggerActionContext}"),'FOLLOW_UP action context inheritance missing');
assert.ok(game.includes("`FOLLOW_UP:${follower.id}:${skillId}`"),'FOLLOW_UP activation key missing');
assert.ok(game.includes("candidates.splice(0,candidates.length,...orderTaggedSimultaneousTriggers(candidates))"),'FOLLOW_UP shared priority order missing');
assert.ok(game.includes("{kind:'COUNTER',priority:0,sequence:0},{kind:'FOLLOW_UP',priority:0,sequence:1}"),'COUNTER must remain before FOLLOW_UP for the same base hit');
assert.ok(game.includes('dispatchTaggedBaseReactiveTriggers(actor,actionTarget,compiled,effectiveAttackResult'),'base hit must use shared reactive ordering');

console.log('FORMAL_TRIGGER_ACTION_GUARD_R04_E1_PASS');
