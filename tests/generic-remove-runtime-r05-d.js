const assert=require('assert'),fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const sample={schemaVersion:1,id:'R05D-REMOVE',name:'R05-D Remove',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'REMOVE',category:'STATUS',count:1}],resource:{mpCost:0,cooldown:0}};
assert.strictEqual(generic.VERSION,'R05-F');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],ctx={console,battle:{tick:10,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
 assert.deepStrictEqual(out.legacySkill.genericRuntime.effectContracts,[{type:'REMOVE',category:'STATUS',count:1,all:false,order:'oldest'}]);
 const tampered=JSON.parse(JSON.stringify(out.legacySkill));tampered.tags=tampered.tags.map(x=>x==='CLEANSE_COUNT=1'?'CLEANSE_COUNT=9':x);const compiled=ctx.compileTaggedSkill(tampered);assert.strictEqual(compiled.ok,true);
 const source={id:'S',name:'Source'},target={id:'T',name:'Target',alive:true,statusEffects:[{instanceId:'old',statusId:'A',appliedTick:1,expiresTick:100,removable:true},{instanceId:'new',statusId:'B',appliedTick:2,expiresTick:100,removable:true}]};
 const result=ctx.executeGenericRemoveRuntime(source,target,compiled);assert.strictEqual(result.removedCount,1);assert.strictEqual(target.statusEffects[0].instanceId,'new');assert.ok(events.some(x=>x.type==='generic_remove_executed'&&x.payload.count===1));
}
console.log('GENERIC_REMOVE_RUNTIME_R05_D_PASS');
