const fs=require('fs'),vm=require('vm');
const shared=require('../assets/shared/js/apply-lifecycle-engine.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(/^R03-F/.test(shared.VERSION),'shared lifecycle engine F-series version mismatch');
for(const op of ['resolve','apply','expire','cleanup','consume','effective'])ok(shared.OPERATIONS.includes(op),`operation ${op} missing`);
const calls=[];
const probe=shared.create({
 STATUS:{expire:(p)=>{calls.push(['STATUS','expire',p]);return{ok:true,count:1}},cleanup:(p)=>{calls.push(['STATUS','cleanup',p]);return{ok:true,count:2}}},
 SHIELD:{consume:({rawDamage})=>({ok:true,hpDamage:rawDamage}),cleanup:()=>({ok:true})},
 BUFF:{effective:()=>({ok:true,power:25})}
});
ok(probe.expire('status',{tick:5}).count===1,'expire dispatch failed');
ok(probe.cleanup('STATUS',{reason:'battle_end'}).count===2,'cleanup dispatch failed');
ok(probe.consume('SHIELD',{rawDamage:9}).hpDamage===9,'consume dispatch failed');
ok(probe.effective('BUFF',{}).power===25,'effective dispatch failed');
ok(probe.cleanup('UNKNOWN',{}).reason==='LIFECYCLE_ENGINE_KIND_UNREGISTERED','unknown cleanup kind accepted');
ok(probe.apply('STATUS',{}).reason==='LIFECYCLE_ENGINE_OPERATION_UNAVAILABLE','missing operation accepted');

for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console,GKSApplyLifecycleEngine:shared,battle:{tick:0,units:[],log:[],validationEvents:[]},recordValidationEvent(){}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.getTaggedApplyLifecycleEngine==='function',`${path}: lifecycle engine missing`);
 const engine=ctx.getTaggedApplyLifecycleEngine();
 ok(/^R03-F/.test(engine.version),`${path}: shared F-series engine not connected`);
 ok(engine.expire('STATUS',{}).ok,`${path}: STATUS expire op unavailable`);
 ok(engine.cleanup('STATUS',{reason:'test'}).ok,`${path}: STATUS cleanup op unavailable`);
 ok(engine.expire('DOT',{}).ok,`${path}: DOT expire op unavailable`);
 ok(engine.expire('BUFF',{}).ok,`${path}: BUFF expire op unavailable`);
 ok(engine.expire('DEBUFF',{}).ok,`${path}: DEBUFF expire op unavailable`);
 ok(engine.expire('SHIELD',{}).ok,`${path}: SHIELD expire op unavailable`);
 ok(engine.cleanup('SHIELD',{reason:'test'}).ok,`${path}: SHIELD cleanup op unavailable`);
 const dotCleanup=engine.cleanup('DOT',{reason:'test'});
 if(/^R03-F2/.test(shared.VERSION))ok(dotCleanup.reason==='LIFECYCLE_ENGINE_OPERATION_UNAVAILABLE',`${path}: DOT cleanup must remain unwired in F2`);
 else ok(dotCleanup.ok,`${path}: DOT cleanup must be available after F3b`);
}
console.log('GENERIC_APPLY_LIFECYCLE_ENGINE_R03_F2_PASS');
