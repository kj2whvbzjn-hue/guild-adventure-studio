const assert=require('assert');
const fs=require('fs');
const path=require('path');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/shared/config/skill-generic-registry.json'),'utf8'));

assert.strictEqual(engine.VERSION,'R04-A');
const seen=[];
const runtime=engine.create(registry,{eventSink:e=>seen.push(e)});
const expected=['ON_USE','ON_HIT_RECEIVED','ON_DAMAGE_DEALT','ON_TURN_START','ON_TURN_END','ON_DEATH','ON_STATUS_APPLIED'];
for(const type of expected){
  const r=runtime.resolve(type);
  assert.strictEqual(r.ok,true,type);
  assert.strictEqual(r.definition.dispatch_mode,'RESOLVE_ONLY',type);
  const v=runtime.validate({type,scope:'SELF'});
  assert.strictEqual(v.ok,true,type);
  const rec=runtime.record(type,{probe:true});
  assert.strictEqual(rec.ok,true,type);
}
assert.strictEqual(seen.length,expected.length);
assert.strictEqual(runtime.resolve('COUNTER').ok,false);
assert.strictEqual(runtime.resolve('COUNTER').reason,'TRIGGER_TYPE_UNSUPPORTED');
assert.strictEqual(runtime.validate({type:'ON_USE',scope:'TARGET'}).ok,false);
assert.ok(runtime.boundary.excludes.includes('COUNTER_CHAIN'));
assert.ok(runtime.boundary.excludes.includes('FOLLOW_UP_CHAIN'));
assert.ok(runtime.boundary.excludes.includes('AURA_EFFECT'));
console.log('GENERIC_TRIGGER_ENGINE_R04_A_PASS');
