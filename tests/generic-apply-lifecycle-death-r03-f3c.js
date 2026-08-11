const fs=require('fs'),vm=require('vm');
const shared=require('../assets/shared/js/apply-lifecycle-engine.js');
function ok(v,m){if(!v)throw new Error(m)}
ok(/^R03-F/.test(shared.VERSION),'shared lifecycle engine must remain in R03-F series');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[];
 const target={id:'TGT',name:'Target',alive:true,hp:100,maxHp:100,gauge:77,reservedAction:{id:'A'},statusEffects:[{instanceId:'S1'},{instanceId:'S2'}],dotStacks:[{id:'D1'}],modifierStacks:[{id:'M1',kind:'BUFF',stat:'ATK',power:10},{id:'M2',kind:'DEBUFF',stat:'DEF',power:20}],shieldEffects:[{id:'H1',remaining:30},{id:'H2',remaining:20}],coverEffects:[],cooldowns:{},followUpQueue:[1],followUpReservations:[1],temporaryResources:{x:1}};
 const other={id:'O',name:'Other',alive:true,hp:100,maxHp:100,statusEffects:[],dotStacks:[],modifierStacks:[],shieldEffects:[],coverEffects:[]};
 const ctx={console,GKSApplyLifecycleEngine:shared,battle:{tick:10,units:[target,other],log:[],validationEvents:[]},recordValidationEvent(type,payload={}){events.push({type,...payload})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.processApplyLifecycleDeathCleanup==='function',`${path}: death cleanup dispatcher missing`);
 ctx.taggedApplyLifecycleEngine=null;
 const r=ctx.resetCombatantOnDeath(target,{reason:'r03_f3c',sourceId:'SRC'});
 ok(r&&r.ok,`${path}: death reset failed`);
 ok(target.alive===false&&target.hp===0&&target.gauge===0&&target.reservedAction===null,`${path}: core death state mismatch`);
 ok(target.statusEffects.length===0&&target.dotStacks.length===0&&target.modifierStacks.length===0&&target.shieldEffects.length===0,`${path}: APPLY state remains after death`);
 ok(r.cleared.statuses===2&&r.cleared.dots===1&&r.cleared.modifiers===2&&r.cleared.shields===2,`${path}: cleared counts mismatch ${JSON.stringify(r.cleared)}`);
 const ev=events.find(x=>x.type==='generic_apply_lifecycle_death_cleanup');ok(ev,`${path}: lifecycle death event missing`);
 ok(ev.cleared.statuses===2&&ev.cleared.modifiers===2&&ev.cleared.shields===2,`${path}: lifecycle death event counts mismatch`);
 ok(events.some(x=>x.type==='unit_death_reset'),`${path}: unit_death_reset event missing`);
 const src=fs.readFileSync(path,'utf8');
 const reset=(src.match(/function resetCombatantOnDeath\([\s\S]*?\n\}/)||[''])[0];
 ok(reset.includes('processApplyLifecycleDeathCleanup(target,{reason,sourceId})'),`${path}: reset path not delegated`);
 ok(!reset.includes('target.statusEffects=[];target.dotStacks=[];target.modifierStacks=[];target.shieldEffects=[];removeCoverEffects'),`${path}: legacy direct cleanup remains in primary path`);
}
console.log('GENERIC_APPLY_LIFECYCLE_DEATH_R03_F3C_PASS');
