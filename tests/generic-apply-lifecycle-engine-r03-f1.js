const fs=require('fs'),vm=require('vm');
const shared=require('../assets/shared/js/apply-lifecycle-engine.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(/^R03-F/.test(shared.VERSION),'shared lifecycle engine F-series version mismatch');
const probe=shared.create({STATUS:{resolve:({lifecycle})=>({ok:true,lifecycle}),apply:({value})=>({ok:true,value})},SHIELD:{consume:({rawDamage})=>({ok:true,hpDamage:rawDamage})}});
ok(probe.resolve('status',{lifecycle:{stackRule:'UNIQUE'}}).ok,'shared resolve failed');
ok(probe.apply('STATUS',{value:7}).value===7,'shared apply failed');
ok(probe.consume('shield',{rawDamage:9}).hpDamage===9,'shared consume failed');
ok(probe.apply('UNKNOWN',{}).reason==='LIFECYCLE_ENGINE_KIND_UNREGISTERED','unknown kind was accepted');
ok(probe.consume('STATUS',{}).reason==='LIFECYCLE_ENGINE_OPERATION_UNAVAILABLE','missing operation was accepted');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console,GKSApplyLifecycleEngine:shared,battle:{tick:0,units:[],log:[],validationEvents:[]},recordValidationEvent(){}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.getTaggedApplyLifecycleEngine==='function',`${path}: lifecycle engine facade missing`);const engine=ctx.getTaggedApplyLifecycleEngine();ok(/^R03-F/.test(engine.version),`${path}: shared lifecycle engine not connected`);
 for(const kind of ['STATUS','DOT','BUFF','DEBUFF','SHIELD'])ok(engine.kinds.includes(kind),`${path}: ${kind} handler missing`);
 const src=fs.readFileSync(path,'utf8');ok(src.includes("getTaggedApplyLifecycleEngine().apply('STATUS'"),`${path}: STATUS does not use facade`);ok(src.includes("getTaggedApplyLifecycleEngine().apply('DOT'"),`${path}: DOT does not use facade`);ok(src.includes('getTaggedApplyLifecycleEngine().apply(logic'),`${path}: modifier does not use facade`);ok(src.includes("getTaggedApplyLifecycleEngine().apply('SHIELD'"),`${path}: SHIELD apply does not use facade`);ok(src.includes("getTaggedApplyLifecycleEngine().consume('SHIELD'"),`${path}: SHIELD consume does not use facade`);
}
const build=JSON.parse(fs.readFileSync('package-build.json','utf8')).game_build;
const cache=String(build).replace(/^GA-B/,'').replaceAll('.','');
for(const html of ['game/index.html','game-tag-test/index.html','studio/index.html']){const src=fs.readFileSync(html,'utf8');ok(src.includes(`apply-lifecycle-engine.js?v=${cache}`),`${html}: shared lifecycle engine script missing`)}
console.log('GENERIC_APPLY_LIFECYCLE_ENGINE_R03_F1_PASS');
