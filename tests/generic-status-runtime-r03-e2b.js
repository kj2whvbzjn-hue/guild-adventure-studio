const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const sample={schemaVersion:1,id:'R03E2B-STUN',name:'R03E2B STUN',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}]};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const battle={tick:10,units:[],log:[]},ctx={console,battle};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.applyTaggedApplyRuntime==='function',`${path}: APPLY dispatcher missing`);
 ok(typeof ctx.applyStatusUniqueRefreshLifecycle==='function',`${path}: STATUS lifecycle helper missing`);
 const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const compiled=ctx.compileTaggedSkill(out.legacySkill);ok(compiled.ok,`${path}: legacy compile failed ${JSON.stringify(compiled.errors)}`);
 const source={id:'SRC',name:'Source',alive:true},target={id:'TGT',name:'Target',alive:true,statusResistance:0,statusEffects:[]};
 const first=ctx.applyTaggedApplyRuntime(source,target,compiled,'STATUS');
 ok(first?.result?.ok&&!first.result.refreshed,`${path}: first STATUS apply failed`);
 ok(first.result.lifecyclePolicy?.stackRule==='UNIQUE'&&first.result.lifecyclePolicy?.refreshRule==='REFRESH',`${path}: lifecycle policy not delegated`);
 ok(target.statusEffects.length===1,`${path}: first STATUS instance count mismatch`);
 const instanceId=target.statusEffects[0].instanceId,firstExpires=target.statusEffects[0].expiresTick;
 battle.tick=40;
 const second=ctx.applyTaggedApplyRuntime(source,target,compiled,'STATUS');
 ok(second?.result?.ok&&second.result.refreshed,`${path}: STATUS refresh failed`);
 ok(target.statusEffects.length===1,`${path}: UNIQUE contract broken`);
 ok(target.statusEffects[0].instanceId===instanceId,`${path}: refresh replaced STATUS instance`);
 ok(target.statusEffects[0].expiresTick>firstExpires,`${path}: refresh did not update duration`);
 const src=fs.readFileSync(path,'utf8');
 ok(src.includes("applyTaggedStatus(source,target,compiled,lifecycleRef.generic?lifecycleRef.policy:null)"),`${path}: production STATUS path does not delegate policy`);
}
console.log('GENERIC_STATUS_RUNTIME_R03_E2B_PASS');
