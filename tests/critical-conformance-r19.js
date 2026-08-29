'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(process.env.GKS_SOURCE_ROOT||path.resolve(__dirname,'..'));
let passed=0;
function ok(cond,msg){if(!cond)throw new Error(msg);passed++;}
function eq(a,b,msg,eps=1e-12){if(!(Math.abs(Number(a)-Number(b))<=eps))throw new Error(`${msg}: ${a} != ${b}`);passed++;}
function text(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function extractFunction(src,name){
 const start=src.indexOf(`function ${name}(`);if(start<0)throw new Error(`function missing: ${name}`);
 let depth=0,seen=false,quote=null,escape=false;
 for(let i=start;i<src.length;i++){const c=src[i];if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote){quote=null}continue}if(c==="'"||c==='"'||c==='`'){quote=c;continue}if(c==='{'){depth++;seen=true}else if(c==='}'){depth--;if(seen&&depth===0)return src.slice(start,i+1)}}
 throw new Error(`function unterminated: ${name}`);
}

(async function main(){
const generator=text('studio/equipment/equipment-generator.js');
const rules=JSON.parse(text('studio/equipment/equipment-generation-rules.json'));
const config=JSON.parse(text('studio/equipment/equipment-balance-config.json'));
const schema=JSON.parse(text('studio/data-exchange/schemas/equipment-dataset.schema.json'));
const exchange=require(path.join(root,'studio/data-exchange/data-exchange-core.js'));
const resolver=require(path.join(root,'assets/shared/js/formal-contribution-resolver.js'));
const studio=text('studio/index.html');
const game=text('game/assets/js/tag-skill-runtime.js');
const app=text('game/assets/js/app-runtime.js');
const battleControl=text('game/assets/js/battle-control.js');

// Equipment contract hard cut.
ok(generator.includes('weapon_critical_rate'),'generator must emit weapon_critical_rate');
ok(!generator.includes('base_critical_rate'),'generator must not use Equipment base_critical_rate');
ok(JSON.stringify(rules).includes('weapon_critical_rate'),'generation rules must declare weapon_critical_rate');
ok(!JSON.stringify(rules).includes('base_critical_rate'),'generation rules retain old Equipment field');
eq(config.weapon.performance.weapon_critical_rate,0.05,'current weapon critical Balance baseline changed');
ok(config.weapon.performance.base_critical_rate===undefined,'balance config retains old Equipment field');
ok(Object.prototype.hasOwnProperty.call(schema.items.properties,'weapon_critical_rate'),'dataset schema missing weapon_critical_rate');
ok(!Object.prototype.hasOwnProperty.call(schema.items.properties,'base_critical_rate'),'dataset schema exposes old Equipment field');
ok(JSON.stringify(schema.items.not||{}).includes('base_critical_rate'),'dataset schema must reject old Equipment field');
const incomingUnknown=exchange.unknownIncomingFields('equipment',null,{id:'EQP-9000',name:'old',base_critical_rate:0.05});
ok(incomingUnknown.includes('base_critical_rate'),'Data Exchange must reject old Equipment field');

// Equipment resolver must preserve weapon rate and defer CRITICAL_RATE MOD to Battle.
const equipment={id:'EQP-9000',name:'test',attack:10,accuracy:10,magic_weapon_bonus:0,weapon_critical_rate:0.05,hp_bonus:0,mp_bonus:0,evasion:0,block_rate:0,block_damage_cut_rate:0,mod_ids:['MOD-C']};
const critMod={definition:{id:'MOD-C',category:'damage',tags:[],effect_type:'numeric_modifier',target:'CRITICAL_RATE',operation:'RELATIVE_PERCENT',balance_key:'crit',enabled:true,schema_version:'1.0',parameters:{}},balance:{balance_key:'crit',value:0.20,version:'test'}};
const resolvedEquipment=resolver.resolveEquipmentContribution(equipment,{'MOD-C':critMod},{deferRuntimeTargets:true});
eq(resolvedEquipment.base.weapon_critical_rate,0.05,'weapon rate base changed');
eq(resolvedEquipment.modified.weapon_critical_rate,0.05,'Critical MOD mutated weapon rate');
ok(resolvedEquipment.runtime_modifiers.length===1,'Critical MOD was not deferred to Battle');
ok(resolver.TARGET_TO_FIELD.CRITICAL_RATE===undefined,'CRITICAL_RATE still maps to Equipment storage');
let rejected=false;try{resolver.validateFormalEquipment({...equipment,mod_ids:[],base_critical_rate:0.05})}catch(e){rejected=e?.code==='FORMAL_EQUIPMENT_BASE_CRITICAL_RATE_FORBIDDEN'}
ok(rejected,'formal Equipment old base_critical_rate was not rejected');
ok(app.includes('GAME_EQUIPMENT_BASE_CRITICAL_RATE_FORBIDDEN'),'Game Equipment loader must reject old base_critical_rate');

// Studio/Game Base/Contribution/Final contract parity.
const studioCtx={structuredClone:global.structuredClone};vm.createContext(studioCtx);vm.runInContext(extractFunction(studio,'formalBattleResolveModifierTarget')+'\n'+extractFunction(studio,'formalBattleCriticalResolution'),studioCtx);
const gameCtx={};vm.createContext(gameCtx);vm.runInContext(extractFunction(game,'currentBattleFinite')+'\n'+"const CURRENT_BATTLE_CONTRIBUTION_TARGETS=Object.freeze(['CRITICAL_RATE']);"+'\n'+extractFunction(game,'currentBattleModifierEntries')+'\n'+extractFunction(game,'currentBattleResolveModifierTarget')+'\n'+extractFunction(game,'currentBattleCriticalResolution')+'\n'+extractFunction(game,'currentBattleCriticalRatePercent'),gameCtx);
for(const [weapon,luk,expected] of [[0.05,0,0.05],[0.05,20,0.06],[0,100,0]]){
 const s=studioCtx.formalBattleCriticalResolution(weapon,luk,{MOD:{},__entries:[]});
 const g=gameCtx.currentBattleCriticalResolution({weaponCriticalRate:weapon,luk,formalModifierContributions:[]});
 eq(s.base_critical_rate,expected,`Studio base critical ${weapon}/${luk}`);
 eq(g.base_critical_rate,expected,`Game base critical ${weapon}/${luk}`);
 eq(s.final_critical_rate,g.final_critical_rate,`Studio/Game no-source parity ${weapon}/${luk}`);
}

// Same-base connected MOD Critical parity and provenance: 5% weapon, LUK20 => Base 6%, +10% MOD +20% MOD => Final 7.8%.
const criticalEntries=[
 {source_type:'MOD',source_id:'EQP-M1',modifier_id:'M1',target_stat:'CRITICAL_RATE',mode:'RELATIVE_PERCENT',raw_modifier_value:0.10},
 {source_type:'MOD',source_id:'EQP-M2',modifier_id:'M2',target_stat:'CRITICAL_RATE',mode:'RELATIVE_PERCENT',raw_modifier_value:0.20}
];
const criticalBoxes={MOD:{},__entries:criticalEntries};
const studioCritical=studioCtx.formalBattleCriticalResolution(0.05,20,criticalBoxes);
const gameCritical=gameCtx.currentBattleCriticalResolution({weaponCriticalRate:0.05,luk:20,formalModifierContributions:criticalEntries});
eq(studioCritical.base_critical_rate,0.06,'Studio Critical Base must be 6%');
eq(gameCritical.base_critical_rate,0.06,'Game Critical Base must be 6%');
eq(studioCritical.final_critical_rate,0.078,'Studio Critical Final must be 7.8%');
eq(gameCritical.final_critical_rate,0.078,'Game Critical Final must be 7.8%');
eq(studioCritical.final_critical_rate,gameCritical.final_critical_rate,'Studio/Game Critical Final mismatch with connected MOD sources');
ok(studioCritical.contributions.length===2&&gameCritical.contributions.length===2,'Studio/Game Critical contribution count mismatch');
for(let i=0;i<2;i++){
 const sr=studioCritical.contributions[i],gr=gameCritical.contributions[i];
 for(const key of ['source_type','source_id','target_stat','mode','raw_modifier_value','base_value_used','resolved_contribution']){
  ok(Object.prototype.hasOwnProperty.call(sr,key),`Studio contribution trace missing ${key}`);
  ok(Object.prototype.hasOwnProperty.call(gr,key),`Game contribution trace missing ${key}`);
  if(typeof sr[key]==='number'||typeof gr[key]==='number')eq(sr[key],gr[key],`Studio/Game contribution ${i} ${key}`);else ok(String(sr[key])===String(gr[key]),`Studio/Game contribution ${i} ${key} mismatch`);
 }
}
eq(gameCritical.contributions[0].resolved_contribution,0.006,'Game first MOD contribution must be 0.6%');
eq(gameCritical.contributions[1].resolved_contribution,0.012,'Game second MOD contribution must be 1.2%');

// Frozen Current Game consumer set is based on actual Battle consumer calls, not resolver capability.
const frozenTargets=['CRITICAL_RATE'];
ok(game.includes("CURRENT_BATTLE_CONTRIBUTION_TARGETS=Object.freeze(['CRITICAL_RATE'])"),'Game connected target freeze set drifted');
const connectedRows=[
 {source_type:'MOD',source_id:'EQP-FROZEN',modifier_id:'MOD-FROZEN-A',target_stat:'CRITICAL_RATE',mode:'RELATIVE_PERCENT',raw_modifier_value:0.10},
 {source_type:'MOD',source_id:'EQP-FROZEN',modifier_id:'MOD-FROZEN-B',target_stat:'CRITICAL_RATE',mode:'FLAT_ADD',raw_modifier_value:0.005}
];
const frozenStudio=studioCtx.formalBattleResolveModifierTarget(0.06,'CRITICAL_RATE',{MOD:{},__entries:connectedRows});
const frozenGame=gameCtx.currentBattleResolveModifierTarget(0.06,'CRITICAL_RATE',connectedRows);
eq(frozenStudio.final_value,frozenGame.final_value,'CRITICAL_RATE frozen target parity');
for(const target of ['PHYSICAL_DAMAGE','MAGIC_DAMAGE','CRITICAL_DAMAGE','ACCURACY','EVASION','STATUS_RESIST','SURVIVAL']){
 let rejectedTarget=false;try{gameCtx.currentBattleResolveModifierTarget(100,target,[])}catch(e){rejectedTarget=e?.code==='GAME_BATTLE_MODIFIER_TARGET_UNCONNECTED'}
 ok(rejectedTarget,`${target} must remain unconnected in Current Game contribution consumer set`);
}

// Game battle transport must carry the formal modifier contribution input into the combatant used by Critical resolution.
ok(battleControl.includes('formalModifierContributions:Array.isArray(row?.formalModifierContributions)?clone(row.formalModifierContributions):[]'),'Game Adventure Battle does not transport formalModifierContributions');
ok(!app.includes('formalModifierContributions:[]'),'Game direct battle/snapshot still hard-codes empty contributions');

// Production Game loader route: mocked Export responses -> loader -> Equipment MOD catalog -> Character -> Snapshot -> Battle Critical.
ok(app.includes("FORMAL_MOD_EXPORT_URL=window.GA_PROJECT_CONFIG?.equipmentModExportUrl||'../Export/equipment/mods.json'"),'Game does not load the current Equipment MOD export');
ok(app.includes('formalPassiveCatalog'),'Game must expose the Current Formal Passive Master catalog for character.passiveIds resolution');
ok(app.includes('formalModifierContributions:characterFormalModifierContributions(c)'),'Game snapshot/unit path does not generate contributions from Character sources');
const producerEquipmentRaw={id:'EQP-REAL',name:'Real Route Weapon',kind:'weapon',slot:'weapon',attack:10,accuracy:10,magic_weapon_bonus:0,weapon_critical_rate:0.05,hp_bonus:0,mp_bonus:0,evasion:0,block_rate:0,block_damage_cut_rate:0,mod_ids:['MOD-REAL-10','MOD-REAL-20']};
const producerMod10={definition:{id:'MOD-REAL-10',category:'damage',tags:[],effect_type:'numeric_modifier',target:'CRITICAL_RATE',operation:'RELATIVE_PERCENT',balance_key:'crit10',enabled:true,schema_version:'1.0',parameters:{}},balance:{balance_key:'crit10',value:0.10,version:'test'}};
const producerMod20={definition:{id:'MOD-REAL-20',category:'damage',tags:[],effect_type:'numeric_modifier',target:'CRITICAL_RATE',operation:'RELATIVE_PERCENT',balance_key:'crit20',enabled:true,schema_version:'1.0',parameters:{}},balance:{balance_key:'crit20',value:0.20,version:'test'}};
const producerCharacter={id:'C-REAL',name:'Real Route Character',job:'JOB-TEST',level:20,stats:{STR:10,VIT:10,AGI:10,DEX:10,INT:10,MND:10,LUK:20},equipment:{weapon1:'EQP-REAL'},passiveIds:[],skills:[],equippedSkillId:''};
const equipmentPayload={schema_version:'1.0',data_version:'test',generated_by:'critical-conformance',data:[producerEquipmentRaw]};
const modPayload={schema_version:'1.0',data_version:'test',generated_by:'critical-conformance',data:[producerMod10,producerMod20]};
const producerCtx={
 window:{GKSFormalContribution:resolver},Map,Object,Array,String,Number,Error,JSON,Math,Date,Promise,
 FORMAL_EQUIPMENT_EXPORT_URL:'../Export/equipment/equipment.json',FORMAL_MOD_EXPORT_URL:'../Export/equipment/mods.json',
 FORMAL_EQUIPMENT_SLOT_MAP:{weapon:'weapon'},FORMAL_EQUIPMENT_TARGET_LABEL:{weapon:'武器'},
 formalEquipmentCatalog:new Map(),formalModCatalog:new Map(),formalEquipmentBridge:{status:'idle',source_url:'../Export/equipment/equipment.json',mods_url:'../Export/equipment/mods.json',schema_version:null,data_version:null,generated_by:null,loaded_at:null,imported_ids:[],imported_mod_ids:[],errors:[]},
 clone:o=>JSON.parse(JSON.stringify(o)),
 fetch:async url=>({ok:true,status:200,json:async()=>String(url).includes('/mods.json')?modPayload:equipmentPayload}),
 characterEquipmentEntries:c=>c?.equipment?.weapon1?[{slot:'weapon1',ref:c.equipment.weapon1}]:[],
 equipmentIsQuiver:()=>false,
 partyMaxSize:()=>6,
 data:{partyIds:['C-REAL'],characters:[producerCharacter]},
 characterBattleValues:()=>({maxHp:100,maxMp:20,attack:10,agi:10,accuracy:10,evasion:10,magicWeaponBonus:0,weaponCriticalRate:0.05,luk:20}),
 jobDisplayName:x=>x
};
vm.createContext(producerCtx);
vm.runInContext(
 extractFunction(app,'formalEquipmentNumber')+'\n'+
 extractFunction(app,'normalizeFormalEquipmentRecord')+'\n'+
 extractFunction(app,'equipmentDefinition')+'\n'+
 extractFunction(app,'formalModifierCandidateId')+'\n'+
 extractFunction(app,'replaceFormalModifierSourceCatalog')+'\n'+
 extractFunction(app,'formalModifierEntry')+'\n'+
 extractFunction(app,'characterFormalModifierContributions')+'\n'+
 'async '+extractFunction(app,'loadFormalEquipmentDefinitions')+'\n'+
 extractFunction(app,'adventurePartySnapshot'),producerCtx);
const loaderResult=await producerCtx.loadFormalEquipmentDefinitions();
ok(loaderResult.status==='loaded','Production Equipment/MOD loader route did not load');
ok(loaderResult.imported_ids.length===1&&loaderResult.imported_ids[0]==='EQP-REAL','Production loader Equipment import mismatch');
ok(loaderResult.imported_mod_ids.length===2,'Production loader MOD import mismatch');
const produced=producerCtx.characterFormalModifierContributions(producerCharacter);
ok(produced.length===2,'Production loader route contribution count');
ok(produced.every(row=>row.source_type==='MOD'),'Production loader route must freeze Current Critical sources to MOD only');
ok(produced.every(row=>row.source_id==='EQP-REAL'),'Production loader route Equipment source id mismatch');
const realSnapshot=producerCtx.adventurePartySnapshot();
ok(realSnapshot.length===1,'Production loader route snapshot character count');
ok(realSnapshot[0].formalModifierContributions.length===2,'Production loader route Snapshot contribution transport');
eq(realSnapshot[0].weapon_critical_rate,0.05,'Production loader route Snapshot weapon critical');
eq(realSnapshot[0].luk,20,'Production loader route Snapshot LUK');
const realCritical=gameCtx.currentBattleCriticalResolution(realSnapshot[0]);
eq(realCritical.base_critical_rate,0.06,'Production loader route Critical Base must be 6%');
eq(realCritical.final_critical_rate,0.078,'Production loader route Critical Final must be 7.8%');
eq(realCritical.contributions[0].resolved_contribution,0.006,'Production loader route first MOD contribution must be 0.6%');
eq(realCritical.contributions[1].resolved_contribution,0.012,'Production loader route second MOD contribution must be 1.2%');
eq(realCritical.final_critical_rate,studioCritical.final_critical_rate,'Production loader route Game/Studio Critical Final parity');

// Existing Skill BUFF/DEBUFF ATK uses the same base while HIGHEST lifecycle remains owner-local.
const studioAttackCtx={formalBattleEffectiveModifierPower:(u,k)=>k==='BUFF'?10:20};vm.createContext(studioAttackCtx);vm.runInContext(extractFunction(studio,'formalBattleEffectiveAttack'),studioAttackCtx);eq(studioAttackCtx.formalBattleEffectiveAttack({attack:100}),90,'Studio ATK BUFF/DEBUFF cross term remains');
const gameAttackCtx={Math,effectiveModifierPower:(u,k)=>k==='BUFF'?10:20};vm.createContext(gameAttackCtx);vm.runInContext(extractFunction(game,'effectiveAttackValue'),gameAttackCtx);eq(gameAttackCtx.effectiveAttackValue({attack:100}),90,'Game ATK BUFF/DEBUFF cross term remains');

// Weapon-owner strike semantics.
ok(/weapon_shield[\s\S]{0,1600}weaponCriticalRate:Number\(b\.weaponCriticalRate\)\|\|0/.test(app),'weapon+shield strike must use attack weapon critical only');
ok(/bow_quiver[\s\S]{0,1600}weaponCriticalRate:Number\(bb\.weaponCriticalRate\)\|\|0/.test(app),'bow+quiver strike must use bow critical only');
ok(/for\(const slot of \['weapon1','weapon2'\]\)[\s\S]{0,800}weaponCriticalRate:Number\(b\.weaponCriticalRate\)\|\|0/.test(app),'dual wield must keep per-weapon critical rates');
ok(studio.includes("formalBattleEquipmentRowCombatContribution(hand,'weapon_critical_rate')"),'Studio strike profile must resolve per attack hand');

// Multi-hit each DAMAGE contract keeps its own hitIndex critical roll.
ok(game.includes("currentBattleRoll(attacker,target,compiled?.definition?.id,'critical',hitIndex)"),'Game Skill critical roll is not per hitIndex');
ok(game.includes('for(let i=0;i<resolved.contracts.length;i++)'),'Game Formal DAMAGE contracts are not independent hits');

// Critical-before-hit guaranteed-hit correction contract.
const gameBasicStart=battleControl.indexOf('function performBasicAttack('),gameBasicEnd=battleControl.indexOf('\nfunction commitActivatedAction',gameBasicStart),gameBasicAttackFn=battleControl.slice(gameBasicStart,gameBasicEnd);
const gameFormalStart=game.indexOf('function applyCurrentFormalDamage('),gameFormalEnd=game.indexOf('\nfunction executeRuntimeDamageRuntime',gameFormalStart),gameFormalDamageFn=game.slice(gameFormalStart,gameFormalEnd);
const studioBasicAttackFn=extractFunction(studio,'performFormalBasicAttack');
const studioFormalDamageFn=extractFunction(studio,'formalBattleApplyDamage');
for(const [label,fn] of [['Game basic',gameBasicAttackFn],['Game formal',gameFormalDamageFn],['Studio basic',studioBasicAttackFn],['Studio formal',studioFormalDamageFn]]){
 ok(fn.indexOf('criticalRoll')<fn.indexOf('hitRoll'),`${label} must resolve Critical before Hit`);
 ok(fn.includes('CRITICAL_GUARANTEED_HIT'),`${label} must trace Critical guaranteed-hit bypass`);
 ok(fn.includes('critical?null'),`${label} must skip normal hit data on Critical`);
}

// Game Formal DAMAGE: Critical success must bypass hit-rate calculation and hit roll entirely.
const guaranteedGameCalls=[];
const guaranteedGameCtx={
 currentBattleCriticalResolution:()=>({weapon_critical_rate:1,LUK:0,base_critical_rate:1,final_critical_rate:1,contributions:[]}),
 currentBattleRoll:(a,t,id,purpose,idx)=>{guaranteedGameCalls.push(purpose);return 0},
 currentBattleHitRatePercent:()=>{throw new Error('hit rate must not be evaluated for Critical guaranteed hit')},
 effectiveDamageResist:()=>0,currentBattleCriticalDamagePercent:()=>0,
 resolveCurrentBlockDamage:(t,d)=>({blocked:false,blockRate:0,blockRoll:null,blockDamageCutRate:0,damage:d}),
 consumeShieldDamage:(t,d)=>({absorbed:0,hpDamage:d}),queueSceneEvent:()=>{},recordValidationEvent:()=>{},
 recordModifierSourceDefeated:()=>{},resetCombatantOnDeath:()=>{},finishIfNeeded:()=>{},
 currentBattleAccuracy:()=>0,currentBattleEvasion:()=>999,
 battle:{tick:1,log:[]},Math
};
vm.createContext(guaranteedGameCtx);vm.runInContext(gameFormalDamageFn,guaranteedGameCtx);
const guaranteedAttacker={id:'A',name:'A',side:'ally',damageDealt:0},guaranteedTarget={id:'T',name:'T',side:'enemy',alive:true,hp:100,damageTaken:0,blockRate:0};
const guaranteedCompiled={definition:{id:'S',name:'S'}};
const guaranteedGame=guaranteedGameCtx.applyCurrentFormalDamage(guaranteedAttacker,guaranteedTarget,10,guaranteedCompiled,{damageType:'PHYSICAL',power:100},{hitIndex:0});
ok(guaranteedGame.ok===true&&guaranteedGame.critical===true,'Game Critical guaranteed hit must succeed');
ok(guaranteedGame.hitBypass==='CRITICAL_GUARANTEED_HIT','Game Critical guaranteed hit bypass trace mismatch');
ok(guaranteedGame.hitRate===null&&guaranteedGame.hitRoll===null,'Game Critical guaranteed hit must not expose normal hit roll');
ok(guaranteedGameCalls.length===1&&guaranteedGameCalls[0]==='critical','Game Critical guaranteed hit must not consume hit roll');

// Game Formal DAMAGE: non-Critical path must perform the normal hit roll after Critical.
const missGameCalls=[];
const missGameCtx={...guaranteedGameCtx,
 currentBattleCriticalResolution:()=>({weapon_critical_rate:0,LUK:0,base_critical_rate:0,final_critical_rate:0,contributions:[]}),
 currentBattleRoll:(a,t,id,purpose,idx)=>{missGameCalls.push(purpose);return purpose==='critical'?0.5:0.5},
 currentBattleHitRatePercent:()=>0,
 battle:{tick:1,log:[]}
};
vm.createContext(missGameCtx);vm.runInContext(gameFormalDamageFn,missGameCtx);
const missGame=missGameCtx.applyCurrentFormalDamage({id:'A',name:'A',side:'ally',damageDealt:0},{id:'T',name:'T',side:'enemy',alive:true,hp:100,damageTaken:0},10,guaranteedCompiled,{damageType:'PHYSICAL',power:100},{hitIndex:0});
ok(missGame.miss===true&&missGame.critical===false,'Game non-Critical miss contract changed');
ok(missGameCalls.join(',')==='critical,hit','Game non-Critical path must roll Critical then Hit');

// Studio Formal DAMAGE: Critical guaranteed hit consumes one RNG value; non-Critical consumes Critical then Hit.
function makeStudioDamageCtx(){return{
 formalBattleCriticalResolution:()=>({weapon_critical_rate:1,LUK:0,base_critical_rate:1,final_critical_rate:1,contributions:[]}),
 formalBattleHitRatePercent:()=>{throw new Error('Studio hit rate must not be evaluated for Critical guaranteed hit')},
 formalBattleDamageBase:()=>10,formalBattleResolveBlock:(t,d)=>({blocked:false,blockRate:0,blockRoll:null,blockDamageCutRate:0,damage:d}),
 formalBattleConsumeShield:(t,d)=>({absorbed:0,hpDamage:d}),formalBattleDeathCleanup:()=>{},tracePush:()=>{},battleTraceOptions:{damage:false},battleLogPush:()=>{},structuredClone:global.structuredClone,Math
}}
const studioGuaranteedCtx=makeStudioDamageCtx();vm.createContext(studioGuaranteedCtx);vm.runInContext(studioFormalDamageFn,studioGuaranteedCtx);let studioRngCalls=0;
const studioGuaranteed=studioGuaranteedCtx.formalBattleApplyDamage({id:'A',name:'A',criticalDamage:0,damageDealt:0,hits:0,crits:0},{id:'T',name:'T',alive:true,hp:100,damageResist:0,damageTaken:0},{id:'S',name:'S'},{damageType:'PHYSICAL',power:100},0,1,()=>{studioRngCalls++;return 0},[],100,[]);
ok(studioGuaranteed.ok===true&&studioGuaranteed.critical===true,'Studio Critical guaranteed hit must succeed');
ok(studioGuaranteed.hitBypass==='CRITICAL_GUARANTEED_HIT'&&studioGuaranteed.hitRate===null&&studioGuaranteed.hitRoll===null,'Studio Critical bypass trace mismatch');
ok(studioRngCalls===1,'Studio Critical guaranteed hit must not consume hit RNG');
const studioMissCtx=makeStudioDamageCtx();studioMissCtx.formalBattleCriticalResolution=()=>({weapon_critical_rate:0,LUK:0,base_critical_rate:0,final_critical_rate:0,contributions:[]});studioMissCtx.formalBattleHitRatePercent=()=>0;vm.createContext(studioMissCtx);vm.runInContext(studioFormalDamageFn,studioMissCtx);const studioRolls=[0.5,0.5],studioMiss=studioMissCtx.formalBattleApplyDamage({id:'A',name:'A',criticalDamage:0,damageDealt:0,hits:0,misses:0,crits:0},{id:'T',name:'T',alive:true,hp:100,damageResist:0,damageTaken:0},{id:'S',name:'S'},{damageType:'PHYSICAL',power:100},0,1,()=>studioRolls.shift(),[],100,[]);
ok(studioMiss.miss===true&&studioRolls.length===0,'Studio non-Critical path must consume Critical then Hit RNG');


// Formal Passive Product Master and Game capability path must be data-driven, not fixed passive-ID authority.
const product=JSON.parse(text('project-data.json'));
const dualPassive=(product?.masters?.passives||[]).find(x=>x?.id==='PAS-DUAL-WIELD-001');
ok(!!dualPassive,'Product Formal Passive PAS-DUAL-WIELD-001 missing');
ok(String(dualPassive.passiveSeriesId||'').length>0,'Formal Passive passiveSeriesId missing');
ok(Array.isArray(dualPassive.params?.ability_conditions),'Formal Passive ability_conditions missing');
ok((dualPassive.runtimeContracts?.modifierRefs?.combatCapabilities||[]).includes('DUAL_WIELD'),'Formal Passive DUAL_WIELD runtime contract missing');
ok(!app.includes("const DUAL_WIELD_PASSIVE_ID='PAS-DUAL-WIELD-001'"),'Game must not restore fixed DUAL_WIELD passive ID authority');
ok(app.includes('characterFormalPassiveSelection'),'Game must resolve character.passiveIds through Formal Passive Master selection');

// Critical verification trace fields in both runtimes.
for(const src of [studio,game,battleControl])for(const key of ['weapon_critical_rate','LUK','base_critical_rate','final_critical_rate','critical_roll','result'])ok(src.includes(key),`Critical verification trace missing ${key}`);
console.log(`CRITICAL_CONFORMANCE_R19_OK checks=${passed}`);
})().catch(error=>{console.error(error?.stack||error);process.exit(1)});
