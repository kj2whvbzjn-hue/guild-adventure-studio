const assert=require('assert');
const fs=require('fs');
const engine=require('../assets/shared/js/trigger-engine.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
assert.ok(/^R04-E[23]$/.test(engine.VERSION),`unexpected trigger engine version ${engine.VERSION}`);
assert.ok(/^R04-E[23]$/.test(registry.phase)||/^R0[5-9]-/.test(registry.phase)||/^R[1-9][0-9]-/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
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
const test=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
for(const src of [game,test]){
 assert.ok(src.includes('orderTaggedSimultaneousTriggers'),'shared simultaneous ordering wrapper missing');
 assert.ok(src.includes("trigger_simultaneous_order_fixed"),'simultaneous order audit missing');
 assert.ok(src.includes("{kind:'COUNTER',priority:0,sequence:0},{kind:'FOLLOW_UP',priority:0,sequence:1}"),'reactive family order slots missing');
 assert.ok(src.includes("candidates.splice(0,candidates.length,...orderTaggedSimultaneousTriggers(candidates))"),'FOLLOW_UP candidate ordering must use shared engine helper');
 assert.ok(src.includes("FOLLOW_UP_CANNOT_CHAIN"),'FOLLOW_UP recursion block missing');
 assert.ok(src.includes("triggerActionContext:event?.triggerActionContext"),'FOLLOW_UP action context propagation missing');
}
// The actual FOLLOW_UP dispatcher and base reactive dispatcher must remain byte-equivalent
// between Game and game-tag-test so future changes cannot silently diverge.
for(const name of ['dispatchConditionalFollowUps','dispatchTaggedBaseReactiveTriggers']){
 assert.strictEqual(fnText(game,name),fnText(test,name),`${name} Game/game-tag-test parity`);
}
assert.ok(test.includes("else if(logic==='FOLLOW_UP'){followUpResult=executeRuntimeDamageRuntime"),'game-tag-test formal FOLLOW_UP DAMAGE runtime execution missing');
assert.ok(test.includes("effectiveAttackResult=attackResult||followUpResult"),'game-tag-test derived trigger result parity missing');

console.log('FORMAL_TRIGGER_SIMULTANEOUS_ORDER_R04_E2_PASS');
