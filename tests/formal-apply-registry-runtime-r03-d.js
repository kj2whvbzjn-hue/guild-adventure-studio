const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(compiler.VERSION==='FORMAL-SKILL-1','Formal compiler version mismatch');
ok(registry.phase==='FORMAL-SKILL-1','registry phase mismatch');
const sample={schemaVersion:1,id:'SKL-9331',name:'R03D Formal STUN',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}],resource:{mpCost:0,cooldown:0}};
const path='game/assets/js/tag-skill-runtime.js';
const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
const out=compiler.compileSkill(sample,registry);ok(out.ok,`${path}: formal compile failed ${JSON.stringify(out.errors)}`);
const rt=out.compiledSkill.runtimeContracts;ok(rt&&rt.schemaVersion===1,`${path}: runtimeContracts missing`);
ok(rt.registryPhase===registry.phase,`${path}: registryPhase missing`);ok(rt.applyContracts.length===1,`${path}: apply contract missing`);
const c=rt.applyContracts[0];ok(c.effectId==='STUN'&&c.logic==='STATUS',`${path}: wrong apply contract`);ok(c.lifecycle.refreshRule==='REFRESH',`${path}: lifecycle not registry-derived`);
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);ok(compiled.ok,`${path}: Formal runtime compile rejected ${JSON.stringify(compiled.errors)}`);
ok(compiled.definition.runtimeContracts?.applyContracts?.[0]?.effectId==='STUN',`${path}: Formal runtime did not preserve contract`);
const missing=JSON.parse(JSON.stringify(compiled));missing.definition.runtimeContracts.applyContracts=[];
const rejected=ctx.resolveRuntimeApplyLifecycle(missing,'STATUS');ok(!rejected.ok&&rejected.reason==='SKILL_RUNTIME_APPLY_CONTRACT_MISSING',`${path}: missing lifecycle contract accepted`);
const src=fs.readFileSync(path,'utf8');ok(src.includes('resolveRuntimeApplyLifecycle'),`${path}: Formal lifecycle resolver missing`);ok(src.includes('runtime_apply_contract_resolved'),`${path}: Formal lifecycle audit event missing`);
console.log('FORMAL_APPLY_REGISTRY_RUNTIME_R03_D_PASS');
