const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(compiler.VERSION==='FORMAL-SKILL-1','Formal compiler version mismatch');
const sample={schemaVersion:1,id:'SKL-9321',name:'R03E1 Formal STUN',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}],resource:{mpCost:0,cooldown:0}};
const path='game/assets/js/tag-skill-runtime.js';
const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
ok(typeof ctx.resolveRuntimeApplyPolicy==='function',`${path}: Formal policy resolver missing`);
const out=compiler.compileSkill(sample,registry);ok(out.ok,`${path}: formal compile failed ${JSON.stringify(out.errors)}`);
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);ok(compiled.ok,`${path}: runtime compile failed ${JSON.stringify(compiled.errors)}`);ok(compiled.definition?.runtimeContracts,`${path}: runtimeContracts missing`);
const resolved=ctx.resolveRuntimeApplyPolicy(compiled,'STATUS');ok(resolved.ok&&resolved.formal,`${path}: valid Formal policy rejected`);
ok(resolved.policy.stackRule==='UNIQUE',`${path}: stackRule mismatch`);ok(resolved.policy.refreshRule==='REFRESH',`${path}: refreshRule mismatch`);ok(resolved.policy.effectiveRule==='LATEST',`${path}: effectiveRule mismatch`);
const bad=JSON.parse(JSON.stringify(compiled));bad.definition.runtimeContracts.applyContracts[0].lifecycle.refreshRule='UNKNOWN_RULE';
const rejected=ctx.resolveRuntimeApplyPolicy(bad,'STATUS');ok(!rejected.ok&&rejected.reason==='SKILL_RUNTIME_APPLY_POLICY_UNKNOWN',`${path}: unknown policy accepted`);
const mismatch=JSON.parse(JSON.stringify(compiled));mismatch.definition.runtimeContracts.applyContracts[0].lifecycle.dispelCategory='DOT';
const rejectedMismatch=ctx.resolveRuntimeApplyPolicy(mismatch,'STATUS');ok(!rejectedMismatch.ok&&rejectedMismatch.reason==='SKILL_RUNTIME_APPLY_POLICY_CATEGORY_MISMATCH',`${path}: category mismatch accepted`);
const src=fs.readFileSync(path,'utf8');ok(src.includes('runtime_apply_policy_resolved'),`${path}: Formal policy audit event missing`);ok(src.includes('runtime_apply_policy_rejected'),`${path}: Formal policy reject event missing`);
console.log('FORMAL_APPLY_POLICY_R03_E1_PASS');
