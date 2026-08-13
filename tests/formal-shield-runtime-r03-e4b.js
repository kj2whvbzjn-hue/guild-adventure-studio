const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const skill={schemaVersion:1,id:'E4B-SHIELD',name:'E4B Shield',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power:100,duration:300}]};
const compiledSkill={id:'E4B-LEGACY-SHIELD',name:'Legacy Shield',tags:['SHIELD','味方','単体','SHIELD=100','DURATION=300']};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const battle={tick:25,units:[],log:[]},ctx={console,battle};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.applyShieldStackLifecycle==='function',`${path}: SHIELD stack helper missing`);
 ok(typeof ctx.applyTaggedApplyRuntime==='function',`${path}: APPLY dispatcher missing`);
 const out=generic.compileSkill(skill,registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const compiled=ctx.compileTaggedSkill(out.compiledSkill);ok(compiled.ok,`${path}: generic legacy compile failed ${JSON.stringify(compiled.errors)}`);
 const source={id:'SRC',name:'Source',alive:true},target={id:'TGT',name:'Target',alive:true,shieldEffects:[]};
 const a=ctx.applyTaggedApplyRuntime(source,target,compiled,'SHIELD');
 ok(a?.result?.ok,`${path}: generic SHIELD first apply failed`);
 ok(a.result.policy?.stackRule==='STACK'&&a.result.policy?.effectiveRule==='SUM'&&a.result.policy?.consumeRule==='FIFO',`${path}: lifecycle policy not delegated`);
 const b=ctx.applyTaggedApplyRuntime(source,target,compiled,'SHIELD');
 ok(b?.result?.ok&&target.shieldEffects.length===2,`${path}: generic SHIELD second layer failed`);
 ok(ctx.shieldTotal(target)===200,`${path}: generic SHIELD total mismatch`);
 ok(new Set(target.shieldEffects.map(x=>x.id)).size===2,`${path}: generic SHIELD IDs not independent`);
 ok(target.shieldEffects.every(x=>x.amount===100&&x.remaining===100&&x.expiresAt===325),`${path}: generic SHIELD layer snapshot changed`);
 // Legacy path remains unchanged and must produce the same layer shape.
 const legacyCompiled=ctx.compileTaggedSkill(compiledSkill);ok(legacyCompiled.ok,`${path}: legacy SHIELD compile failed ${JSON.stringify(legacyCompiled.errors)}`);
 const legacyTarget={id:'LEG',name:'Legacy Target',alive:true,shieldEffects:[]};
 const la=ctx.applyTaggedShield(source,legacyTarget,legacyCompiled);const lb=ctx.applyTaggedShield(source,legacyTarget,legacyCompiled);
 ok(la.ok&&lb.ok&&legacyTarget.shieldEffects.length===2&&ctx.shieldTotal(legacyTarget)===200,`${path}: legacy SHIELD parity failed`);
 const shape=x=>({amount:x.amount,remaining:x.remaining,appliedAt:x.appliedAt,expiresAt:x.expiresAt,duration:x.duration,sourceId:x.sourceId});
 ok(JSON.stringify(target.shieldEffects.map(shape))===JSON.stringify(legacyTarget.shieldEffects.map(shape)),`${path}: generic/legacy SHIELD shape mismatch`);
 const src=fs.readFileSync(path,'utf8');
 ok(src.includes("applyTaggedShield(source,target,runtimeCompiled,lifecycleRef.generic?lifecycleRef.policy:null)"),`${path}: production SHIELD path does not delegate lifecycle policy`);
}
console.log('GENERIC_SHIELD_RUNTIME_R03_E4B_PASS');
