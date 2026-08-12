const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(/^R03-(E\d+[a-z]?|F\d+[a-z]?)$/.test(String(registry.phase||''))||/^R0[4-9]-/.test(String(registry.phase||''))||/^R[1-9][0-9]-/.test(String(registry.phase||'')),'registry phase predates R03-E1');
ok(/^R03-(E\d+[a-z]?|F\d+[a-z]?)$/.test(String(compiler.VERSION||''))||/^R0[4-9]-/.test(String(compiler.VERSION||''))||/^R[1-9][0-9]-/.test(String(compiler.VERSION||'')),'compiler version predates R03-E1');
const sample={schemaVersion:1,id:'R03E1-STUN',name:'R03E1',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}]};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.resolveGenericApplyPolicy==='function',`${path}: policy resolver missing`);
 const out=compiler.compileSkill(sample,registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const compiled=ctx.compileTaggedSkill(out.compiledSkill);ok(compiled.ok,`${path}: compile failed`);ok(compiled.definition?.runtimeContracts,`${path}: runtimeContracts missing`);
 const resolved=ctx.resolveGenericApplyPolicy(compiled,'STATUS');ok(resolved.ok&&resolved.generic,`${path}: valid policy rejected`);
 ok(resolved.policy.stackRule==='UNIQUE',`${path}: stackRule mismatch`);ok(resolved.policy.refreshRule==='REFRESH',`${path}: refreshRule mismatch`);ok(resolved.policy.effectiveRule==='LATEST',`${path}: effectiveRule mismatch`);
 const bad=JSON.parse(JSON.stringify(compiled));bad.definition.runtimeContracts.applyContracts[0].lifecycle.refreshRule='UNKNOWN_RULE';
 const rejected=ctx.resolveGenericApplyPolicy(bad,'STATUS');ok(!rejected.ok&&rejected.reason==='GENERIC_APPLY_POLICY_UNKNOWN',`${path}: unknown policy accepted`);
 const mismatch=JSON.parse(JSON.stringify(compiled));mismatch.definition.runtimeContracts.applyContracts[0].lifecycle.dispelCategory='DOT';
 const rejectedMismatch=ctx.resolveGenericApplyPolicy(mismatch,'STATUS');ok(!rejectedMismatch.ok&&rejectedMismatch.reason==='GENERIC_APPLY_POLICY_CATEGORY_MISMATCH',`${path}: category mismatch accepted`);
 const src=fs.readFileSync(path,'utf8');ok(src.includes('generic_apply_policy_resolved'),`${path}: policy audit event missing`);ok(src.includes('generic_apply_policy_rejected'),`${path}: policy reject event missing`);
}
console.log('FORMAL_APPLY_POLICY_R03_E1_PASS');
