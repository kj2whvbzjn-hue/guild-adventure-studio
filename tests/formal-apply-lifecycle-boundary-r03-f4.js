const fs=require('fs');
const shared=require('../assets/shared/js/apply-lifecycle-engine.js');
const registry=require('../assets/shared/config/skill-generic-registry.json');
const boundary=require('../shared/dependencies/skill-runtime-boundary.json');
function ok(v,m){if(!v)throw new Error(m)}
const expectedOps=['resolve','apply','expire','cleanup','consume','effective'];
const expectedKinds=['STATUS','DOT','BUFF','DEBUFF','SHIELD'];
ok(shared.VERSION==='R03-F4','shared engine version mismatch');
ok(registry.phase==='R03-F4'||/^R0[4-9]-/.test(String(registry.phase||''))||/^R[1-9][0-9]-/.test(String(registry.phase||'')),'registry phase predates R03-F4');
ok(boundary.phase==='R03-F4','boundary phase mismatch');
ok(JSON.stringify(shared.OPERATIONS)===JSON.stringify(expectedOps),'operation boundary changed');
ok(JSON.stringify(shared.APPLY_KINDS)===JSON.stringify(expectedKinds),'APPLY kind boundary changed');
ok(shared.BOUNDARY.scope==='APPLY_LIFECYCLE_ONLY','shared boundary scope mismatch');
ok(JSON.stringify(registry.lifecycle_engine_boundary.owns)===JSON.stringify(expectedOps),'registry operation boundary mismatch');
ok(JSON.stringify(registry.lifecycle_engine_boundary.applyKinds)===JSON.stringify(expectedKinds),'registry kind boundary mismatch');
ok(JSON.stringify(boundary.apply_lifecycle_engine.owns)===JSON.stringify(expectedOps),'dependency boundary operation mismatch');
for(const effect of Object.values(registry.effects||{}))ok(expectedKinds.includes(effect.kind),`effect kind outside lifecycle boundary: ${effect.kind}`);
const probe=shared.create({
 STATUS:{apply:()=>({ok:true})},
 COUNTER:{apply:()=>({ok:true})},
 FOLLOW_UP:{apply:()=>({ok:true})},
 AURA:{apply:()=>({ok:true})}
});
ok(probe.kinds.length===1&&probe.kinds[0]==='STATUS','non-APPLY kind registered in lifecycle engine');
ok(probe.apply('COUNTER',{}).reason==='LIFECYCLE_ENGINE_KIND_UNREGISTERED','COUNTER leaked into lifecycle engine');
ok(probe.apply('FOLLOW_UP',{}).reason==='LIFECYCLE_ENGINE_KIND_UNREGISTERED','FOLLOW_UP leaked into lifecycle engine');
ok(probe.apply('AURA',{}).reason==='LIFECYCLE_ENGINE_KIND_UNREGISTERED','AURA leaked into lifecycle engine');
for(const forbidden of ['TRIGGER_DISPATCH','TARGET_RESOLUTION','DAMAGE_FORMULA','HEAL_FORMULA','RESOURCE_COST','COVER_ROUTING','COUNTER_CHAIN','FOLLOW_UP_CHAIN','AURA_TRIGGER']){
 ok(shared.BOUNDARY.excludes.includes(forbidden),`missing excluded responsibility ${forbidden}`);
}
for(const rel of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const src=fs.readFileSync(rel,'utf8');
 ok(src.includes("version:'R03-F4-fallback'"),`${rel}: fallback boundary version missing`);
 ok(src.includes("allowed=['STATUS','DOT','BUFF','DEBUFF','SHIELD']"),`${rel}: fallback APPLY allowlist missing`);
}
console.log('GENERIC_APPLY_LIFECYCLE_BOUNDARY_R03_F4_PASS');
