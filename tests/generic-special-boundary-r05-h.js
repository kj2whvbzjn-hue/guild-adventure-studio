const assert=require('assert'),fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
assert.strictEqual(generic.VERSION,'R05-H');
assert.strictEqual(registry.phase,'R05-H');
assert.ok(registry.runtime.effects.includes('SPECIAL'));
assert.ok(!registry.runtime.legacy_adapter_supported.includes('SPECIAL'));
assert.deepStrictEqual(registry.runtime.special_boundary,{
 status:'DEFERRED',generic_model_visible:true,legacy_adapter_supported:false,direct_runtime_supported:false,emit_effect_contract:false,execution_owner:null,
 reason:'SPECIAL requires an effect-specific contract and execution owner before Generic Battle Runtime admission.'
});
const specialSkill={schemaVersion:1,id:'R05H-SPECIAL',name:'Special Boundary',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'SPECIAL'}],resource:{mpCost:0,cooldown:0}};
let legacyCalls=0;
const specialOut=generic.compileGenericSkill(specialSkill,registry,()=>{legacyCalls++;return{ok:true,errors:[]}});
assert.strictEqual(specialOut.ok,false);
assert.strictEqual(legacyCalls,0);
assert.ok(specialOut.errors.some(x=>x.code==='SPECIAL_BOUNDARY_DEFERRED'));
assert.strictEqual(specialOut.legacySkill.genericRuntime.effectContracts.length,0);
assert.strictEqual(specialOut.normalizedEffects.length,0);
const damageSkill={schemaVersion:1,id:'R05H-DAMAGE-CONTROL',name:'Damage Control',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:10,damageType:'PHYSICAL'}],resource:{mpCost:0,cooldown:0}};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 const good=generic.compileGenericSkill(damageSkill,registry,ctx.compileTaggedSkill);assert.strictEqual(good.ok,true,JSON.stringify(good.errors));
 const tampered=JSON.parse(JSON.stringify(good.legacySkill));tampered.genericRuntime.effectContracts=[{type:'SPECIAL'}];
 const compiled=ctx.compileTaggedSkill(tampered);assert.strictEqual(compiled.ok,false);
 assert.ok(compiled.errors.some(x=>String(x).includes('SPECIALはR05-H境界外です')),JSON.stringify(compiled.errors));
}
console.log('GENERIC_SPECIAL_BOUNDARY_R05_H_PASS');
