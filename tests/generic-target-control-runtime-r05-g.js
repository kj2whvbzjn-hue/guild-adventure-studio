const assert=require('assert'),fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8')),generic=require('../assets/shared/js/generic-skill-compiler.js');
assert.strictEqual(generic.VERSION,'R05-H');assert.strictEqual(registry.phase,'R05-H');
const cases=[
 {lifetime:'PERSISTENT',priority:3,removable:false},
 {lifetime:'USES',priority:7,removable:true,uses:2},
 {lifetime:'DURATION',priority:-2,removable:true,duration:50}
];
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],ctx={console,battle:{tick:100,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 for(const [index,c] of cases.entries()){
  const effect={type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:c.priority,removable:c.removable,lifetime:c.lifetime};if(c.uses)effect.uses=c.uses;if(c.duration)effect.duration=c.duration;
  const skill={schemaVersion:1,id:`R05G-${index}`,name:'Target Control',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[effect],resource:{mpCost:0,cooldown:0}};
  const out=generic.compileGenericSkill(skill,registry,ctx.compileTaggedSkill);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
  const contract=out.legacySkill.genericRuntime.effectContracts.find(x=>x.type==='TARGET_CONTROL');assert.ok(contract);assert.strictEqual(contract.priority,c.priority);assert.strictEqual(contract.removable,c.removable);assert.strictEqual(contract.lifetime,c.lifetime);
  const tampered=JSON.parse(JSON.stringify(out.legacySkill));tampered.tags=tampered.tags.map(x=>x.startsWith('COVER_PRIORITY=')?'COVER_PRIORITY=999':x).map(x=>x==='COVER_REMOVABLE=true'?'COVER_REMOVABLE=false':x);
  const compiled=ctx.compileTaggedSkill(tampered);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
  const source={id:`S${index}`,name:'Source',side:'ally',alive:true},target={id:`T${index}`,name:'Target',side:'ally',alive:true};ctx.battle.units=[source,target];
  const result=ctx.executeGenericTargetControlRuntime(source,target,compiled);assert.strictEqual(result.ok,true);assert.strictEqual(result.genericRuntime,true);assert.strictEqual(result.effect.priority,c.priority);assert.strictEqual(result.effect.removable,c.removable);assert.strictEqual(result.effect.lifetime,c.lifetime.toLowerCase());
  if(c.uses)assert.strictEqual(result.effect.remainingUses,c.uses);if(c.duration)assert.strictEqual(result.effect.expiresAt,ctx.battle.tick+c.duration);
 }
 assert.ok(events.some(x=>x.type==='generic_target_control_executed'));
}
for(const bad of [
 {type:'TARGET_CONTROL',mode:'TAUNT',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'PERSISTENT'},
 {type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'USES',uses:0},
 {type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'DURATION',duration:0}
]){
 const skill={schemaVersion:1,id:'BAD',name:'Bad',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[bad],resource:{}};assert.strictEqual(generic.compileGenericSkill(skill,registry).ok,false);
}
console.log('GENERIC_TARGET_CONTROL_RUNTIME_R05_G_PASS');
