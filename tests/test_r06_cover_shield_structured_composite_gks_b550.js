const assert=require('assert'),fs=require('fs'),vm=require('vm');
const payload=JSON.parse(fs.readFileSync('/mnt/data/PRJ-GKS-CH01-DEMO_SKILLS_GPT_81.json','utf8'));
const rows=payload.datasets.skills.filter(x=>/^R06-B547-MASS-0(?:4[3-8])$/.test(x.id));
assert.strictEqual(rows.length,6,'expected the six Master COVER+SHIELD cases');
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
 // Legacy tag-only COVER remains intentionally strict during transition.
 const legacy={id:'LEGACY-COVER-SHIELD',name:'Legacy',tags:['COVER','COVER_TARGET=single_ally','COVER_TRIGGER=direct_attack','COVER_PRIORITY=0','COVER_REMOVABLE=true','COVER_LIFETIME=persistent','味方','単体','SHIELD','SHIELD=20','DURATION=100']};
 const old=ctx.compileTaggedSkill(legacy);assert.strictEqual(old.ok,false);assert.ok(old.errors.some(x=>x.includes('persistentではDURATION')));assert.ok(old.errors.some(x=>x.includes('COVER定義は専用関係')));
}
console.log('PASS GKS-B550 R06 structured COVER+SHIELD composite runtime contract separation');
