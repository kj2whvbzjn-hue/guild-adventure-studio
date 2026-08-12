const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const sample={schemaVersion:1,id:'R03E2C-STUN',name:'R03E2C STUN',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}]};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],battle={tick:10,units:[],log:[],validationEvents:events};
 const ctx={console,battle,recordValidationEvent:(type,payload={})=>events.push({type,...payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 for(const fn of ['applyTaggedApplyRuntime','cleanseStatusEffects','processStatusEffects','resetCombatantOnDeath','clearAllStatuses'])ok(typeof ctx[fn]==='function',`${path}: ${fn} missing`);
 const out=generic.compileSkill(sample,registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const compiled=ctx.compileTaggedSkill(out.compiledSkill);ok(compiled.ok,`${path}: legacy compile failed ${JSON.stringify(compiled.errors)}`);
 const source={id:'SRC',name:'Source',alive:true,hp:100,maxHp:100},target={id:'TGT',name:'Target',alive:true,hp:100,maxHp:100,gauge:0,statusResistance:0,statusEffects:[],dotStacks:[],modifierStacks:[],shieldEffects:[],coverEffects:[],cooldowns:{}};battle.units=[source,target];
 const apply=()=>{const r=ctx.applyTaggedApplyRuntime(source,target,compiled,'STATUS');ok(r?.result?.ok,`${path}: generic STATUS apply failed`);ok(target.statusEffects.length===1,`${path}: STATUS apply count mismatch`);return target.statusEffects[0]};
 const reset=()=>{battle.tick=10;events.length=0;target.alive=true;target.hp=target.maxHp;target.gauge=0;target.statusEffects=[];target.dotStacks=[];target.modifierStacks=[];target.shieldEffects=[];target.coverEffects=[];target.cooldowns={};};
 // CLEANSE: Generic由来STATUSも既存CLEANSE経路で解除されること。
 reset();apply();const cleanse=ctx.compileTaggedSkill({id:'R03E2C-CLEANSE',name:'R03E2C Cleanse',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=1','CLEANSE_CATEGORY=status','CLEANSE_ORDER=oldest']});ok(cleanse.ok,`${path}: cleanse compile failed ${JSON.stringify(cleanse.errors)}`);const cr=ctx.cleanseStatusEffects(source,target,cleanse);ok(cr.ok&&cr.removedCount===1&&target.statusEffects.length===0,`${path}: CLEANSE did not remove generic STATUS`);ok(events.some(x=>x.type==='status_removed'&&x.reason==='manual_dispel'),`${path}: CLEANSE removal event missing`);
 // Expiry: Generic由来STATUSもexpiresTickで自然満了すること。
 reset();const exp=apply().expiresTick;battle.tick=exp;ctx.processStatusEffects();ok(target.statusEffects.length===0,`${path}: expired generic STATUS remains`);ok(events.some(x=>x.type==='status_removed'&&x.reason==='expired'),`${path}: expiry removal event missing`);
 // Death: 死亡リセットでGeneric由来STATUSが消去されること。
 reset();apply();const dr=ctx.resetCombatantOnDeath(target,{reason:'r03_e2c'});ok(target.alive===false&&target.statusEffects.length===0,`${path}: death cleanup left generic STATUS`);ok(dr?.cleared?.statuses===1||events.some(x=>x.type==='unit_death_reset'&&x.cleared?.statuses===1),`${path}: death cleanup status count missing`);
 // Battle end: 戦闘終了の共通clearでGeneric由来STATUSが消去されること。
 reset();apply();ctx.clearAllStatuses('battle_end');ok(target.statusEffects.length===0,`${path}: battle-end cleanup left generic STATUS`);ok(events.some(x=>x.type==='status_removed'&&x.reason==='battle_end'),`${path}: battle-end removal event missing`);
}
console.log('GENERIC_STATUS_CLEANUP_R03_E2C_PASS');
