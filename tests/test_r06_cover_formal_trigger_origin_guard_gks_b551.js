const fs=require('fs'),vm=require('vm'),assert=require('assert');
const formalCompiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const events=[];
const ctx={
 console,
 battle:{tick:0,units:[],log:[],validationEvents:[]},
 recordValidationEvent:(type,payload)=>{events.push({type,...payload});ctx.battle.validationEvents.push({type,...payload})},
 SKILLS:[],
};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);

const source={id:'C',name:'coverer',side:'ally',alive:true,coverEffects:[]};
const target={id:'P',name:'protected',side:'ally',alive:true,coverEffects:[]};
const enemy={id:'E',name:'enemy',side:'enemy',alive:true};
ctx.battle.units=[source,target,enemy];

const coverSkill={
 schemaVersion:1,id:'COVER-SHIELD',name:'cover+shield',skillLevel:5,
 trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},
 effects:[
  {type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'PERSISTENT'},
  {type:'APPLY',effectId:'BARRIER',power:50,duration:200}
 ],
 resource:{mpCost:0,cooldown:0,activationPriority:0}
};
const formal=formalCompiler.compileSkill(coverSkill,registry);
assert.strictEqual(formal.ok,true,JSON.stringify(formal.errors));
const compiledCover=ctx.compileSkillForRuntime(formal.compiledSkill);
assert.strictEqual(compiledCover.ok,true,compiledCover.errors.join(' / '));
assert.strictEqual(compiledCover.definition.parameters.coverDuration,null);
assert.strictEqual(compiledCover.definition.parameters.shieldDuration,200);
const applied=ctx.applyTaggedCover(source,target,compiledCover);
assert.strictEqual(applied.ok,true);

events.length=0;ctx.battle.validationEvents=[];
const single={definition:{id:'ATK-S',name:'single',logicOrder:['ATTACK'],target:{range:'single'}}};
let r=ctx.resolveCoverIntervention(enemy,target,single,{origin:'base',derivedGeneration:0});
assert.strictEqual(r.covered,true);
assert.ok(events.some(x=>x.type==='cover_triggered'&&x.origin==='base'&&x.derived_generation===0));

events.length=0;ctx.battle.validationEvents=[];
const area={definition:{id:'ATK-A',name:'area',logicOrder:['ATTACK'],target:{range:'all'}}};
r=ctx.resolveCoverIntervention(enemy,target,area,{origin:'base',derivedGeneration:0});
assert.strictEqual(r.covered,false);
assert.ok(events.some(x=>x.type==='cover_skipped'&&x.reason==='AREA_ATTACK'));
assert.ok(!events.some(x=>x.type==='cover_triggered'));

events.length=0;ctx.battle.validationEvents=[];
r=ctx.resolveCoverIntervention(enemy,target,single,{origin:'counter',derivedGeneration:1});
assert.strictEqual(r.covered,true);
assert.ok(events.some(x=>x.type==='cover_triggered'&&x.origin==='counter'&&x.derived_generation===1));

const blocked=ctx.dispatchCounterAfterAttack(enemy,target,single,{ok:true,damage:10,shieldAbsorbed:0},{origin:'counter',derivedGeneration:2,wasCovered:true});
assert.strictEqual(blocked.triggered,false);
assert.strictEqual(blocked.reason,'DERIVED_GENERATION_LIMIT');
assert.ok(events.some(x=>x.type==='counter_skipped'&&x.reason==='DERIVED_GENERATION_LIMIT'&&x.derived_generation===2));

console.log('PASS COVER formal trigger scope + origin/generation guard');
