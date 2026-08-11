const fs=require('fs'),vm=require('vm');
const shared=require('../assets/shared/js/apply-lifecycle-engine.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(/^R03-F3/.test(shared.VERSION),'shared lifecycle engine must be R03-F3 series');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const calls=[];
 const ctx={console,GKSApplyLifecycleEngine:shared,battle:{tick:77,units:[],log:[],validationEvents:[]},recordValidationEvent(){}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.processApplyLifecycleExpirations==='function',`${path}: processApplyLifecycleExpirations missing`);
 ctx.processModifierStacks=()=>calls.push('BUFF');
 ctx.processShieldEffects=()=>calls.push('SHIELD');
 ctx.processStatusEffects=()=>calls.push('STATUS');
 ctx.processDotStacks=()=>calls.push('DOT');
 // Recreate after replacing handlers so the facade delegates to the current runtime functions.
 ctx.taggedApplyLifecycleEngine=null;
 const r=ctx.processApplyLifecycleExpirations();
 ok(r&&r.ok,`${path}: expiry lifecycle dispatch failed ${JSON.stringify(r)}`);
 ok(calls.join(',')==='BUFF,SHIELD,STATUS,DOT',`${path}: expiry order mismatch ${calls.join(',')}`);
}
for(const path of ['game/assets/js/battle-control.js','game-tag-test/assets/js/battle-control.js']){
 const src=fs.readFileSync(path,'utf8');
 ok(src.includes('processApplyLifecycleExpirations();'),`${path}: lifecycle expiry dispatcher not connected`);
 const tickBlock=(src.match(/function processTicks\(count\)\{[\s\S]*?if\(battle\.result\|\|battle\.pendingResult\)break;/)||[''])[0];
 ok(tickBlock&&!tickBlock.includes('processShieldEffects();'),`${path}: direct SHIELD expiry call remains in tick loop`);
 ok(tickBlock&&!tickBlock.includes('processStatusEffects();'),`${path}: direct STATUS expiry call remains in tick loop`);
 ok(tickBlock&&!tickBlock.includes('processDotStacks();'),`${path}: direct DOT expiry call remains in tick loop`);
}
console.log('GENERIC_APPLY_LIFECYCLE_EXPIRY_R03_F3A_PASS');
