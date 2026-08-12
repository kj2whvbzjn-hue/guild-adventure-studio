const assert=require('assert'),fs=require('fs'),vm=require('vm');

// Self-contained regression fixtures.
// This test verifies the COVER + SHIELD runtime contract separation itself; it must not
// depend on a developer-local demo Master JSON under /mnt/data. Keep six variants so
// both runtimes are exercised repeatedly with different SHIELD values/durations.
function coverShieldFixture(index,power,duration,priority,removable){
 return {
  id:`R06-B550-COVER-SHIELD-${String(index).padStart(2,'0')}`,
  name:`COVER+SHIELD regression ${String(index).padStart(2,'0')}`,
  tags:['COVER','COVER_TARGET=single_ally','COVER_TRIGGER=direct_attack',`COVER_PRIORITY=${priority}`,`COVER_REMOVABLE=${removable}`,'COVER_LIFETIME=persistent','味方','単体','SHIELD',`SHIELD=${power}`,`DURATION=${duration}`],
  genericRuntime:{
   schemaVersion:1,registryPhase:'R05-H',
   triggerContract:{type:'ON_USE',scope:'SELF',engineEvent:'use',dispatchMode:'RESOLVE_ONLY',priority:0},
   conditionContracts:[],
   effectContracts:[{type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority,removable,lifetime:'PERSISTENT'}],
   applyContracts:[{
    effectId:`R06-B550-SHIELD-${String(index).padStart(2,'0')}`,kind:'SHIELD',logic:'SHIELD',
    values:{power,duration},
    lifecycle:{stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',dispelCategory:'SHIELD',removeOnDeath:true,removeOnBattleEnd:true,removable:true,effectiveRule:'SUM',consumeRule:'FIFO'}
   }],
   auraEffectContract:null
  }
 };
}
const rows=[
 coverShieldFixture(1,10,20,0,true),
 coverShieldFixture(2,15,40,1,true),
 coverShieldFixture(3,20,60,2,false),
 coverShieldFixture(4,25,80,3,true),
 coverShieldFixture(5,30,100,4,false),
 coverShieldFixture(6,40,120,5,true)
];
assert.strictEqual(rows.length,6,'expected six self-contained COVER+SHIELD regression cases');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],ctx={console,battle:{tick:100,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 for(const skill of rows){
  const compiled=ctx.compileTaggedSkill(skill);assert.strictEqual(compiled.ok,true,`${path} ${skill.id}: ${compiled.errors.join(' / ')}`);
  assert.ok(compiled.definition.genericRuntime,'structured runtime missing');
  assert.deepStrictEqual(Array.from(compiled.definition.logicOrder),['COVER','SHIELD']);
  const control=compiled.definition.genericRuntime.effectContracts.find(x=>x.type==='TARGET_CONTROL');
  const shield=compiled.definition.genericRuntime.applyContracts.find(x=>x.logic==='SHIELD');
  assert.ok(control&&shield,`${skill.id}: contracts missing`);
  assert.strictEqual(control.lifetime,'PERSISTENT');
  assert.strictEqual(control.duration,null,'persistent COVER must not inherit SHIELD DURATION');
  assert.strictEqual(compiled.definition.parameters.coverDuration,null,'compiled COVER duration must stay null');
  assert.strictEqual(compiled.definition.parameters.shieldDuration,shield.values.duration,'SHIELD duration must remain available');
  const source={id:'S',name:'Source',side:'ally',alive:true},target={id:'T',name:'Target',side:'ally',alive:true,shieldEffects:[]};ctx.battle.units=[source,target];
  const cover=ctx.executeGenericTargetControlRuntime(source,target,compiled);assert.strictEqual(cover.ok,true,`${skill.id}: COVER failed`);assert.strictEqual(cover.effect.lifetime,'persistent');assert.strictEqual(cover.effect.expiresAt,null);
  const shieldResult=ctx.applyTaggedApplyRuntime(source,target,compiled,'SHIELD');assert.strictEqual(shieldResult?.result?.ok,true,`${skill.id}: SHIELD failed`);assert.ok(ctx.shieldTotal(target)>0,`${skill.id}: shield not applied`);
 }
 assert.ok(events.some(x=>x.type==='generic_target_control_executed'));
 assert.ok(events.some(x=>x.type==='generic_apply_executed'));
 // Formalized rule: COVER is not a dedicated-skill-only logic. SHIELD duration must remain separate from persistent COVER lifetime.
 const mixed={id:'COVER-SHIELD-FORMAL',name:'Formal mixed',tags:['COVER','COVER_TARGET=single_ally','COVER_TRIGGER=direct_attack','COVER_PRIORITY=0','COVER_REMOVABLE=true','COVER_LIFETIME=persistent','味方','単体','SHIELD','SHIELD=20','DURATION=100']};
 const mixedCompiled=ctx.compileTaggedSkill(mixed);assert.strictEqual(mixedCompiled.ok,true,mixedCompiled.errors.join(' / '));assert.strictEqual(mixedCompiled.definition.parameters.coverDuration,null);assert.strictEqual(mixedCompiled.definition.parameters.shieldDuration,100);
}
console.log('PASS GKS-B550 R06 structured COVER+SHIELD composite runtime contract separation');
