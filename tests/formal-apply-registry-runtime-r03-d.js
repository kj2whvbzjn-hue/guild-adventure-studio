const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
function loadLegacy(path){const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);return ctx.compileTaggedSkill}
ok(/^R03-(D|E\d+[a-z]?|F\d+[a-z]?)$/.test(String(registry.phase||''))||/^R0[4-9]-/.test(String(registry.phase||''))||/^R[1-9][0-9]-/.test(String(registry.phase||'')),'registry phase predates R03-D');
const sample={schemaVersion:1,id:'R03D-STUN',name:'R03D',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}]};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const legacy=loadLegacy(path);
 const out=generic.compileSkill(sample,registry,legacy);
 ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const rt=out.compiledSkill.runtimeContracts;ok(rt&&rt.schemaVersion===1,`${path}: runtimeContracts missing`);
 ok(rt.registryPhase===registry.phase,`${path}: registryPhase missing`);
 ok(rt.applyContracts.length===1,`${path}: apply contract missing`);
 const c=rt.applyContracts[0];ok(c.effectId==='STUN'&&c.logic==='STATUS',`${path}: wrong apply contract`);
 ok(c.lifecycle.refreshRule==='REFRESH',`${path}: lifecycle not registry-derived`);
 const compiled=legacy(out.compiledSkill);ok(compiled.ok,`${path}: legacy compile rejected runtimeContracts ${compiled.errors}`);
 ok(compiled.definition.runtimeContracts?.applyContracts?.[0]?.effectId==='STUN',`${path}: compileTaggedSkill did not preserve contract`);
 const bad=JSON.parse(JSON.stringify(out.compiledSkill));bad.runtimeContracts.applyContracts=[];
 const rejected=legacy(bad);ok(!rejected.ok,`${path}: missing contract accepted`);ok(rejected.errors.some(x=>String(x).includes('lifecycle契約')),`${path}: missing contract error absent`);
 const src=fs.readFileSync(path,'utf8');ok(src.includes('resolveGenericApplyLifecycle'),`${path}: registry lifecycle resolver missing`);ok(src.includes('generic_apply_contract_resolved'),`${path}: registry lifecycle audit event missing`);
}
const duplicate={schemaVersion:1,id:'R03D-DUP',name:'dup',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100},{type:'APPLY',effectId:'ACCURACY_DOWN',duration:100}]};
const dup=generic.compileSkill(duplicate,registry,null);ok(!dup.ok,'duplicate legacy APPLY logic accepted');ok(dup.errors.some(x=>x.code==='LEGACY_APPLY_LOGIC_DUPLICATE'),'duplicate apply logic error missing');
console.log('GENERIC_APPLY_REGISTRY_RUNTIME_R03_D_PASS');
