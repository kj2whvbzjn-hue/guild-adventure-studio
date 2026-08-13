const assert=require('assert');
const fs=require('fs');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const gameIndex=fs.readFileSync('game/index.html','utf8');
const gameRuntime=fs.readFileSync('game/assets/js/app-runtime.js','utf8');

assert.ok(gameIndex.includes('id="tagTestRunR04TriggerFoundationJson"'),'R04 Trigger foundation device button missing from Formal Game');
assert.ok(gameRuntime.includes('runR04TriggerFoundationDeviceValidation'),'R04 Trigger Formal device runner missing');
assert.ok(gameRuntime.includes("'ON_USE','ON_HIT_RECEIVED','ON_DAMAGE_DEALT','ON_TURN_START','ON_TURN_END','ON_DEATH','ON_STATUS_APPLIED'"),'R04-A seven-trigger device scope missing');
assert.ok(gameRuntime.includes('TRIGGER_TYPE_UNSUPPORTED'),'unknown trigger rejection missing');
assert.ok(gameRuntime.includes('TRIGGER_ENGINE_EVENT_MISMATCH'),'event mismatch rejection missing');
assert.ok(gameRuntime.includes('TRIGGER_DISPATCH_MODE_UNSUPPORTED'),'dispatch rejection missing');
assert.ok(gameRuntime.includes('TRIGGER_REENTRY_BLOCKED'),'re-entry rejection missing');
assert.ok(gameRuntime.includes('TRIGGER_ACTION_LIMIT_REACHED'),'action limit rejection missing');
assert.ok(gameRuntime.includes("uses_studio_export:false,uses_retired_demo_export:false"),'device provenance must exclude old exports');
assert.ok(gameRuntime.includes('tagTestRunR04TriggerFoundationJson'),'R04 Trigger button binding missing');

const expected=['ON_USE','ON_HIT_RECEIVED','ON_DAMAGE_DEALT','ON_TURN_START','ON_TURN_END','ON_DEATH','ON_STATUS_APPLIED'];
const runtime=engine.create(registry);
for(const type of expected){
  assert.strictEqual(runtime.resolve(type).ok,true,type);
  assert.strictEqual(runtime.validate({type,scope:'SELF'}).ok,true,type);
}
assert.strictEqual(runtime.resolve('COUNTER').reason,'TRIGGER_TYPE_UNSUPPORTED');
assert.strictEqual(runtime.validate({type:'ON_USE',scope:'TARGET'}).ok,false);
const hit=registry.triggers.ON_HIT_RECEIVED;
assert.strictEqual(engine.validateCompiledContract({type:'ON_HIT_RECEIVED',engineEvent:hit.engine_event,dispatchMode:hit.dispatch_mode},'ally_attack').reason,'TRIGGER_ENGINE_EVENT_MISMATCH');
assert.strictEqual(engine.validateCompiledContract({type:'ON_HIT_RECEIVED',engineEvent:hit.engine_event,dispatchMode:'FUTURE_UNSAFE'},hit.engine_event).reason,'TRIGGER_DISPATCH_MODE_UNSUPPORTED');
const context=engine.createActionContext({actionId:'DEVICE-GATE'});
const first=engine.tryActivate(context,'COUNTER:A');assert.strictEqual(first.ok,true);
assert.strictEqual(engine.tryActivate(context,'COUNTER:A').reason,'TRIGGER_REENTRY_BLOCKED');first.release();
for(let i=1;i<engine.DEFAULT_ACTION_TRIGGER_LIMIT;i++){const token=engine.tryActivate(context,`FOLLOW_UP:${i}`);assert.strictEqual(token.ok,true);token.release();}
assert.strictEqual(engine.tryActivate(context,'OVERFLOW').reason,'TRIGGER_ACTION_LIMIT_REACHED');
console.log('DEVICE_R04_TRIGGER_FOUNDATION_FORMAL_GAME_RUNTIME_PASS');
