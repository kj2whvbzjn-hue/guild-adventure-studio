const fs=require('fs'),vm=require('vm');
const shared=require('../assets/shared/js/apply-lifecycle-engine.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(/^R03-F3/.test(shared.VERSION),'shared lifecycle engine must remain in R03-F3 series or later');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[];
 const unit={id:'U1',name:'Unit',alive:true,statusEffects:[{instanceId:'S1',statusId:'STATUS-X'}],dotStacks:[{id:'D1'}],modifierStacks:[{id:'M1',kind:'BUFF',stat:'ATK',power:10}],shieldEffects:[{id:'H1',remaining:30}]};
 const ctx={console,GKSApplyLifecycleEngine:shared,battle:{tick:10,units:[unit],log:[],validationEvents:[]},recordValidationEvent(type,payload){events.push({type,...payload})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.processApplyLifecycleCleanup==='function',`${path}: cleanup dispatcher missing`);
 ctx.taggedApplyLifecycleEngine=null;
 const r=ctx.processApplyLifecycleCleanup('battle_end');
 ok(r&&r.ok,`${path}: cleanup failed ${JSON.stringify(r)}`);
 ok(unit.statusEffects.length===0,`${path}: statuses remain`);
 ok(unit.dotStacks.length===0,`${path}: dots remain`);
 ok(unit.modifierStacks.length===0,`${path}: modifiers remain`);
 ok(unit.shieldEffects.length===0,`${path}: shields remain`);
 ok(events.some(x=>x.type==='generic_apply_lifecycle_cleanup'),`${path}: cleanup event missing`);
}
for(const path of ['game/assets/js/battle-control.js','game-tag-test/assets/js/battle-control.js']){
 const src=fs.readFileSync(path,'utf8');
 ok(src.includes("processApplyLifecycleCleanup('battle_end');"),`${path}: battle-end lifecycle cleanup not connected`);
 const finish=(src.match(/function finishIfNeeded\(\)\{[\s\S]*?return true;\n\}/)||[''])[0];
 ok(finish&&!finish.includes("clearAllShields('battle_end')"),`${path}: direct SHIELD battle-end cleanup remains`);
 ok(finish&&!finish.includes("clearAllStatuses('battle_end')"),`${path}: direct STATUS battle-end cleanup remains`);
}
console.log('GENERIC_APPLY_LIFECYCLE_BATTLE_END_R03_F3B_PASS');
