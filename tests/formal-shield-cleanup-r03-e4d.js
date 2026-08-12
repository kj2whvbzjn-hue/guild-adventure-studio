const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const makeSkill=(id,power,duration)=>({schemaVersion:1,id,name:id,trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power,duration}]});
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],battle={tick:100,units:[],log:[],validationEvents:events};
 const ctx={console,battle,recordValidationEvent:(type,payload={})=>events.push({type,...payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 for(const fn of ['applyTaggedApplyRuntime','processShieldEffects','resetCombatantOnDeath','clearAllShields','consumeShieldDamage'])ok(typeof ctx[fn]==='function',`${path}: ${fn} missing`);
 const compile=(id,power,duration)=>{const out=generic.compileSkill(makeSkill(id,power,duration),registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);const c=ctx.compileTaggedSkill(out.compiledSkill);ok(c.ok,`${path}: legacy compile failed ${JSON.stringify(c.errors)}`);return c};
 const source={id:'SRC',name:'Source',alive:true,hp:100,maxHp:100};
 const target={id:'TGT',name:'Target',alive:true,hp:100,maxHp:100,gauge:0,statusEffects:[],dotStacks:[],modifierStacks:[],shieldEffects:[],coverEffects:[],cooldowns:{}};battle.units=[source,target];
 const apply=(compiled)=>{const r=ctx.applyTaggedApplyRuntime(source,target,compiled,'SHIELD');ok(r?.result?.ok,`${path}: generic SHIELD apply failed`);return r.result.effect};
 const reset=()=>{battle.tick=100;events.length=0;target.alive=true;target.hp=100;target.gauge=0;target.statusEffects=[];target.dotStacks=[];target.modifierStacks=[];target.shieldEffects=[];target.coverEffects=[];target.cooldowns={};};

 // Expiry: each generic SHIELD layer expires independently at expiresAt.
 reset();const exp10=compile('E4D-EXP10',50,10),exp20=compile('E4D-EXP20',70,20);const a=apply(exp10),b=apply(exp20);
 ok(target.shieldEffects.length===2&&a.expiresAt===110&&b.expiresAt===120,`${path}: expiry setup mismatch`);
 battle.tick=110;ctx.processShieldEffects();
 ok(target.shieldEffects.length===1&&target.shieldEffects[0].id===b.id&&target.shieldEffects[0].remaining===70,`${path}: first expiry did not preserve later layer`);
 ok(events.some(x=>x.type==='shield_expired'&&x.shield_id===a.id&&x.remaining===50),`${path}: first expiry event missing`);
 battle.tick=120;ctx.processShieldEffects();
 ok(target.shieldEffects.length===0,`${path}: second expiry left shield`);
 ok(events.some(x=>x.type==='shield_expired'&&x.shield_id===b.id&&x.remaining===70),`${path}: second expiry event missing`);

 // Death: all generic SHIELD layers are cleared by common death reset.
 reset();apply(compile('E4D-DEATH-A',40,300));apply(compile('E4D-DEATH-B',60,300));
 const dr=ctx.resetCombatantOnDeath(target,{reason:'r03_e4d'});
 ok(target.alive===false&&target.shieldEffects.length===0,`${path}: death cleanup left generic SHIELD`);
 ok(dr?.cleared?.shields===2||events.some(x=>x.type==='unit_death_reset'&&x.cleared?.shields===2),`${path}: death cleanup shield count missing`);

 // Battle end: all generic SHIELD layers are cleared by common battle-end cleanup.
 reset();apply(compile('E4D-END-A',30,300));apply(compile('E4D-END-B',80,300));
 ctx.clearAllShields('battle_end');
 ok(target.shieldEffects.length===0,`${path}: battle-end cleanup left generic SHIELD`);
 const clearEv=events.find(x=>x.type==='shield_cleared'&&x.reason==='battle_end');
 ok(clearEv&&clearEv.count===2&&clearEv.total===110,`${path}: battle-end clear event mismatch`);

 // Multiple hits: FIFO order and remaining values must be stable across successive damage.
 reset();const s100=apply(compile('E4D-HIT100',100,300)),s40=apply(compile('E4D-HIT40',40,300));
 const ids=[s100.id,s40.id];
 let r=ctx.consumeShieldDamage(target,60,{sourceId:'EN',skillId:'HIT-1'});
 ok(r.absorbed===60&&r.hpDamage===0&&target.shieldEffects.length===2,`${path}: hit1 absorb mismatch`);
 ok(target.shieldEffects[0].id===ids[0]&&target.shieldEffects[0].remaining===40&&target.shieldEffects[1].remaining===40,`${path}: hit1 FIFO remaining mismatch`);
 r=ctx.consumeShieldDamage(target,50,{sourceId:'EN',skillId:'HIT-2'});
 ok(r.absorbed===50&&r.hpDamage===0&&r.consumed.length===2,`${path}: hit2 absorb mismatch`);
 ok(r.consumed[0].shield_id===ids[0]&&r.consumed[0].absorbed===40,`${path}: hit2 did not exhaust oldest first`);
 ok(r.consumed[1].shield_id===ids[1]&&r.consumed[1].absorbed===10,`${path}: hit2 second-layer consume mismatch`);
 ok(target.shieldEffects.length===1&&target.shieldEffects[0].id===ids[1]&&target.shieldEffects[0].remaining===30,`${path}: hit2 remainder mismatch`);
 r=ctx.consumeShieldDamage(target,50,{sourceId:'EN',skillId:'HIT-3'});
 ok(r.absorbed===30&&r.hpDamage===20&&target.shieldEffects.length===0,`${path}: hit3 exhaustion / spill damage mismatch`);
 ok(r.consumed.length===1&&r.consumed[0].shield_id===ids[1]&&r.consumed[0].absorbed===30,`${path}: hit3 consume record mismatch`);
}
console.log('GENERIC_SHIELD_CLEANUP_R03_E4D_PASS');
