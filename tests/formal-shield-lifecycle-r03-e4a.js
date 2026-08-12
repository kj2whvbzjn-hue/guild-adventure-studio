const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const lifecycle=registry.effects?.BARRIER?.lifecycle;
const skill={schemaVersion:1,id:'E4A-SHIELD',name:'E4A Shield',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power:100,duration:300}]};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const battle={tick:25,units:[],log:[]},ctx={console,battle};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.resolveShieldStackLifecyclePolicy==='function',`${path}: SHIELD policy resolver missing`);
 ok(typeof ctx.applyShieldStackLifecycle==='function',`${path}: SHIELD stack helper missing`);
 const good=ctx.resolveShieldStackLifecyclePolicy(lifecycle);ok(good.ok&&good.stackRule==='STACK'&&good.effectiveRule==='SUM'&&good.consumeRule==='FIFO',`${path}: valid SHIELD lifecycle rejected`);
 const bad=ctx.resolveShieldStackLifecyclePolicy({...lifecycle,consumeRule:'LIFO'});ok(!bad.ok&&bad.field==='consumeRule',`${path}: invalid SHIELD consume rule accepted`);
 const out=generic.compileSkill(skill,registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const compiled=ctx.compileTaggedSkill(out.compiledSkill);ok(compiled.ok,`${path}: legacy compile failed ${JSON.stringify(compiled.errors)}`);
 const source={id:'SRC',name:'Source',alive:true};
 const helperTarget={id:'H',name:'Helper',alive:true,shieldEffects:[]};
 const h1=ctx.applyShieldStackLifecycle(helperTarget,{source,compiled,amount:100,duration:300},lifecycle);
 const h2=ctx.applyShieldStackLifecycle(helperTarget,{source,compiled,amount:100,duration:300},lifecycle);
 ok(h1.ok&&h2.ok&&helperTarget.shieldEffects.length===2,`${path}: helper did not retain independent shield layers`);
 ok(h2.totalShield===200&&ctx.shieldTotal(helperTarget)===200,`${path}: helper SUM total mismatch`);
 ok(helperTarget.shieldEffects[0].expiresAt===325&&helperTarget.shieldEffects[1].expiresAt===325,`${path}: helper expiry changed`);
 ok(helperTarget.shieldEffects.every(x=>x.amount===100&&x.remaining===100),`${path}: helper snapshot amount changed`);
 ok(new Set(helperTarget.shieldEffects.map(x=>x.id)).size===2,`${path}: helper shield IDs not independent`);
 // Legacy path parity under identical numeric inputs. R03-E4a does not wire production delegation yet.
 const legacyTarget={id:'L',name:'Legacy',alive:true,shieldEffects:[]};
 const l1=ctx.applyTaggedShield(source,legacyTarget,compiled);const l2=ctx.applyTaggedShield(source,legacyTarget,compiled);
 ok(l1.ok&&l2.ok&&legacyTarget.shieldEffects.length===2,`${path}: legacy shield layer count mismatch`);
 ok(ctx.shieldTotal(legacyTarget)===200,`${path}: legacy shield total mismatch`);
 const shape=x=>({amount:x.amount,remaining:x.remaining,appliedAt:x.appliedAt,expiresAt:x.expiresAt,duration:x.duration,sourceId:x.sourceId,skillId:x.skillId});
 ok(JSON.stringify(helperTarget.shieldEffects.map(shape))===JSON.stringify(legacyTarget.shieldEffects.map(shape)),`${path}: helper/legacy shield layer shape mismatch`);
 const srcText=fs.readFileSync(path,'utf8');
 ok(srcText.includes("function applyShieldStackLifecycle"),`${path}: SHIELD lifecycle helper missing from runtime source`);
}
console.log('GENERIC_SHIELD_LIFECYCLE_R03_E4A_PASS');
