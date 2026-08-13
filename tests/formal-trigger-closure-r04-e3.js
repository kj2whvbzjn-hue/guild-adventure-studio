const assert=require('assert');
const fs=require('fs');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));

assert.strictEqual(engine.VERSION,'R04-E3');
assert.ok(registry.phase==='FORMAL-SKILL-1'||registry.phase==='R04-E3'||/^R0[5-9]-/.test(registry.phase)||/^R[1-9][0-9]-/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
assert.strictEqual(engine.DEFAULT_ACTION_TRIGGER_LIMIT,16);

// Registry/engine boundary: every enabled registry trigger must resolve, and unknown triggers fail closed.
for(const [type,definition] of Object.entries(registry.triggers||{})){
  if(definition&&definition.enabled!==false){
    assert.ok(engine.SUPPORTED.includes(type),`enabled registry trigger is not supported by engine: ${type}`);
    const resolved=engine.create(registry).resolve(type);
    assert.strictEqual(resolved.ok,true,`enabled trigger failed resolve: ${type}`);
  }
}
let unknown=engine.create(registry).resolve('ON_FUTURE_UNKNOWN');
assert.strictEqual(unknown.ok,false);
assert.strictEqual(unknown.reason,'TRIGGER_TYPE_UNSUPPORTED');

// Compiled contracts fail closed on event mismatch / unsupported dispatch mode.
let calls=0;
let dispatched=engine.dispatchCompiled({type:'ON_HIT_RECEIVED',engineEvent:'hit_received',dispatchMode:'COUNTER'},'ally_attack',{},()=>{calls++;});
assert.strictEqual(dispatched.ok,false);assert.strictEqual(dispatched.reason,'TRIGGER_ENGINE_EVENT_MISMATCH');assert.strictEqual(calls,0);
dispatched=engine.dispatchCompiled({type:'ON_HIT_RECEIVED',engineEvent:'hit_received',dispatchMode:'FUTURE_UNSAFE'},'hit_received',{},()=>{calls++;});
assert.strictEqual(dispatched.ok,false);assert.strictEqual(dispatched.reason,'TRIGGER_DISPATCH_MODE_UNSUPPORTED');assert.strictEqual(calls,0);

// R04-E ordering: COUNTER family always precedes FOLLOW_UP; within a family priority desc then discovery order.
const order=engine.orderSimultaneousCandidates([
  {id:'f-low',kind:'FOLLOW_UP',priority:1,sequence:0},
  {id:'c-low',kind:'COUNTER',priority:-100,sequence:1},
  {id:'f-high',kind:'FOLLOW_UP',priority:9,sequence:3},
  {id:'f-tie-first',kind:'FOLLOW_UP',priority:5,sequence:2},
  {id:'f-tie-last',kind:'FOLLOW_UP',priority:5,sequence:4}
]);
assert.deepStrictEqual(order.map(x=>x.id),['c-low','f-high','f-tie-first','f-tie-last','f-low']);

// R04-E guard: re-entry is blocked and cumulative activation budget cannot exceed 16 in one action.
const action=engine.createActionContext({actionId:'R04-E3-CLOSURE'});
let token=engine.tryActivate(action,'COUNTER:A',{kind:'COUNTER'});assert.strictEqual(token.ok,true);
let reentry=engine.tryActivate(action,'COUNTER:A',{kind:'COUNTER'});assert.strictEqual(reentry.ok,false);assert.strictEqual(reentry.reason,'TRIGGER_REENTRY_BLOCKED');
token.release();
for(let i=1;i<16;i++){
  const t=engine.tryActivate(action,`FOLLOW_UP:${i}`,{kind:'FOLLOW_UP'});
  assert.strictEqual(t.ok,true,`activation ${i+1} should fit cap`);t.release();
}
assert.strictEqual(action.activationCount,16);
const overflow=engine.tryActivate(action,'FOLLOW_UP:OVER',{kind:'FOLLOW_UP'});
assert.strictEqual(overflow.ok,false);assert.strictEqual(overflow.reason,'TRIGGER_ACTION_LIMIT_REACHED');

function fnText(source,name){
  const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,`${name} missing`);
  let depth=0,started=false,quote=null,escape=false;
  for(let i=start;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote=null;continue;}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{'){depth++;started=true}else if(ch==='}'){depth--;if(started&&depth===0)return source.slice(start,i+1)}
  }
  throw new Error(`${name} unterminated`);
}
const game=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const tagTest=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
for(const name of ['dispatchCounterAfterAttack','dispatchConditionalFollowUps','dispatchTaggedBaseReactiveTriggers','activeAuraEntries']){
  assert.strictEqual(fnText(game,name),fnText(tagTest,name),`${name} Game/game-tag-test parity`);
}
for(const src of [game,tagTest]){
  assert.ok(src.includes("engine.dispatchCompiled(triggerContract,'hit_received'"),'COUNTER Trigger Engine boundary missing');
  assert.ok(src.includes("engine.dispatchCompiled(triggerContract,'ally_attack'"),'FOLLOW_UP Trigger Engine boundary missing');
  assert.ok(src.includes("engine.dispatchCompiled(triggerContract,'aura_evaluate'"),'AURA Trigger Engine boundary missing');
  assert.ok(src.includes('formalTrigger:false'),'Tag reactive/aura fallback marker missing');
  assert.ok(src.includes('createTaggedTriggerActionContext'),'shared per-action Trigger Guard missing');
  assert.ok(src.includes('orderTaggedSimultaneousTriggers'),'shared simultaneous Trigger ordering missing');
}

console.log('GENERIC_TRIGGER_CLOSURE_R04_E3_PASS');
