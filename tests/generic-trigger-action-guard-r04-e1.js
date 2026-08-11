const assert=require('assert');
const fs=require('fs');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
assert.ok(/^R04-E[12]$/.test(engine.VERSION),`unexpected trigger engine version ${engine.VERSION}`);
assert.ok(/^R04-E[12]$/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
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

// Production runtimes must create/share the same action context through derived COUNTER execution.
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const src=fs.readFileSync(runtimePath,'utf8');
  assert.ok(src.includes('createTaggedTriggerActionContext'),'action context helper missing: '+runtimePath);
  assert.ok(src.includes('acquireTaggedTriggerActivation'),'activation guard helper missing: '+runtimePath);
  assert.ok(src.includes("triggerActionContext=createTaggedTriggerActionContext(attacker,incomingCompiled,triggerActionContext)"),'COUNTER context normalization missing: '+runtimePath);
  assert.ok(src.includes("triggerActionContext})"),'derived COUNTER must inherit action context: '+runtimePath);
  assert.ok(src.includes("trigger_action_activation"),'activation audit event missing: '+runtimePath);
}

// Game FOLLOW_UP shares the base action context and keeps the established ordering:
// COUNTER dispatch occurs before FOLLOW_UP candidate dispatch, while FOLLOW_UP candidates
// remain priority-desc / discovery-order stable.
const game=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
assert.ok(game.includes("event={...(event||{}),triggerActionContext}"),'FOLLOW_UP action context inheritance missing');
assert.ok(game.includes("`FOLLOW_UP:${follower.id}:${skillId}`"),'FOLLOW_UP activation key missing');
assert.ok(game.includes("candidates.splice(0,candidates.length,...orderTaggedSimultaneousTriggers(candidates))"),'FOLLOW_UP shared priority order missing');
assert.ok(game.includes("{kind:'COUNTER',priority:0,sequence:0},{kind:'FOLLOW_UP',priority:0,sequence:1}"),'COUNTER must remain before FOLLOW_UP for the same base hit');
assert.ok(game.includes('dispatchTaggedBaseReactiveTriggers(actor,actionTarget,compiled,effectiveAttackResult'),'base hit must use shared reactive ordering');

console.log('GENERIC_TRIGGER_ACTION_GUARD_R04_E1_PASS');
