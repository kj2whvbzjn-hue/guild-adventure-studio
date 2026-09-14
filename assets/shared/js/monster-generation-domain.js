(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GKMonsterGenerationDomain=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION='GS-22-1';
const STATS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
const VIRTUAL_LOADOUTS=Object.freeze({
 '剣士':Object.freeze({main_weapon:'大剣',offhand:null,two_handed:true,armor:'重装'}),
 '騎士':Object.freeze({main_weapon:'片手剣',offhand:'盾',two_handed:false,armor:'重装'}),
 '盗賊':Object.freeze({main_weapon:'短剣',offhand:'盾',two_handed:false,armor:'軽装'}),
 '狩人':Object.freeze({main_weapon:'弓',offhand:'矢筒',two_handed:false,armor:'軽装'}),
 '魔術師':Object.freeze({main_weapon:'杖',offhand:null,two_handed:true,armor:'ローブ'}),
 '神官':Object.freeze({main_weapon:'魔導書',offhand:'盾',two_handed:false,armor:'ローブ'}),
 '冒険家':Object.freeze({main_weapon:'片手剣',offhand:'盾',two_handed:false,armor:'重装'})
});
function fail(code,message,details={}){return{ok:false,code,message,...details}}
function finite(value,path){const n=Number(value);if(!Number.isFinite(n))throw Object.assign(new Error(`${path} が数値ではありません。`),{code:'MONSTER_GENERATION_NUMBER_INVALID',path});return n}
function positive(value,path){const n=finite(value,path);if(n<=0)throw Object.assign(new Error(`${path} は正数が必要です。`),{code:'MONSTER_GENERATION_POSITIVE_REQUIRED',path});return n}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function roundHalfUpNonNegative(v){const n=Math.max(0,finite(v,'round_value'));return Math.floor(n+0.5)}
function roundFinal(v){const n=Math.max(0,finite(v,'final_value'));if(n===0)return 0;return Math.max(1,roundHalfUpNonNegative(n))}
function roundPercentPoints(v){const n=Math.max(0,finite(v,'percent_points'));return roundHalfUpNonNegative(n)}
function normalizeAiBinding(value){if(!value||typeof value!=='object'||Array.isArray(value))return fail('MONSTER_FORMAL_AI_BINDING_REQUIRED','Formal AI参照が必要です。');const keys=Object.keys(value).sort(),allowed=['layout_id','program_id'];if(keys.length!==2||keys.some(k=>!allowed.includes(k)))return fail('MONSTER_FORMAL_AI_BINDING_INVALID','Formal AI参照はprogram_id/layout_idのみです。');const program_id=String(value.program_id||'').trim(),layout_id=String(value.layout_id||'').trim();if(!program_id||!layout_id)return fail('MONSTER_FORMAL_AI_BINDING_INVALID','program_id/layout_idが必要です。');return{ok:true,program_id,layout_id}}
function aptitudesFromJob(job){
 const src=job?.params?.aptitudes??job?.aptitudes??job;
 if(!src||typeof src!=='object'||Array.isArray(src))throw Object.assign(new Error('Job aptitudeが必要です。'),{code:'MONSTER_JOB_APTITUDES_REQUIRED'});
 const out={};for(const stat of STATS)out[stat]=Math.max(0,finite(src[stat],`aptitudes.${stat}`));return out;
}
function baseAndExpected(level,aptitudes){
 const L=finite(level,'level');if(!Number.isInteger(L)||L<1||L>50)throw Object.assign(new Error('Monster Levelは1〜50です。'),{code:'MONSTER_LEVEL_OUT_OF_RANGE',level:L});
 const M={},P={};for(const s of STATS){const g=aptitudes[s];M[s]=L*g/10;P[s]=10+(L-1)*g/10;}return{M,P};
}
function assertContinuousEquipmentConfig(config){
 if(!config||typeof config!=='object')throw Object.assign(new Error('Equipment Balance Configが必要です。'),{code:'MONSTER_EQUIPMENT_CONFIG_REQUIRED'});
 const min=Number(config?.item_level?.min),max=Number(config?.item_level?.max);if(min!==1||max!==11)throw Object.assign(new Error('GS-22の仮想iLv範囲1〜11とEquipment Configが一致しません。'),{code:'MONSTER_EQUIPMENT_ILV_RANGE_MISMATCH',min,max});
 const growth=config?.growth||{};
 const inspect=(branch)=>{if(!branch||branch.enabled!==true)return;for(const [metric,rows] of Object.entries(branch)){if(metric==='enabled')continue;if(!rows||typeof rows!=='object')continue;for(const value of Object.values(rows)){if(Number(value)!==1)throw Object.assign(new Error('小数iLvでの非1.0成長補間はGS-22に未定義です。'),{code:'MONSTER_CONTINUOUS_GROWTH_UNDEFINED',metric,value});}}};
 inspect(growth.weapon);inspect(growth.armor);return true;
}
function effectiveWeaponRequirementCoefficients(type,config,{two_handed=false}={}){
 const c=config?.weapon?.requirement_coefficients?.[type];if(!c)throw Object.assign(new Error(`未定義の武器種です: ${type}`),{code:'MONSTER_WEAPON_TYPE_UNKNOWN',type});
 const out={STR:Math.max(0,finite(c.str,`${type}.str`)),DEX:Math.max(0,finite(c.dex,`${type}.dex`)),INT:Math.max(0,finite(c.int,`${type}.int`))};
 if(two_handed&&out.STR>0)out.STR/=2;return out;
}
function armorRequirementCoefficients(type,config){
 const c=config?.armor?.requirement_coefficients?.[type];if(!c)throw Object.assign(new Error(`未定義の防具種です: ${type}`),{code:'MONSTER_ARMOR_TYPE_UNKNOWN',type});
 return{VIT:Math.max(0,finite(c.vit,`${type}.vit`)),MND:Math.max(0,finite(c.mnd,`${type}.mnd`)),AGI:Math.max(0,finite(c.agi,`${type}.agi`))};
}
function virtualItemLevel(expectedStats,coefficients,{min=1,max=11}={}){
 const ratios=[];for(const [stat,coefRaw] of Object.entries(coefficients||{})){const coef=Number(coefRaw);if(!Number.isFinite(coef)||coef<0)throw Object.assign(new Error(`要求係数が不正です: ${stat}`),{code:'MONSTER_REQUIREMENT_COEFFICIENT_INVALID',stat});if(coef===0)continue;ratios.push({stat,expected:finite(expectedStats?.[stat],`expected.${stat}`),coefficient:coef,ratio:finite(expectedStats?.[stat],`expected.${stat}`)/coef});}
 if(!ratios.length)throw Object.assign(new Error('仮想iLv計算に使う要求能力値がありません。'),{code:'MONSTER_VIRTUAL_ILV_NO_REQUIREMENTS'});
 const raw=Math.min(...ratios.map(x=>x.ratio)),value=clamp(raw,min,max);return{raw,value,ratios};
}
function weaponContinuousPerformance(type,itemLevel,config){
 const c=config.weapon.requirement_coefficients[type],perf=config.weapon.performance||{},i=positive(itemLevel,'weapon.item_level');
 if(!c)throw Object.assign(new Error(`未定義の武器種です: ${type}`),{code:'MONSTER_WEAPON_TYPE_UNKNOWN',type});
 const str=finite(c.str,`${type}.str`),dex=finite(c.dex,`${type}.dex`),intel=finite(c.int,`${type}.int`);
 return{attack:i*str*finite(perf.attack_multiplier,'weapon.performance.attack_multiplier'),accuracy:i*dex*finite(perf.accuracy_multiplier,'weapon.performance.accuracy_multiplier'),magic_weapon_bonus:i*intel*str,weapon_critical_rate:finite(perf.weapon_critical_rate,'weapon.performance.weapon_critical_rate')};
}
function armorContinuousPerformance(type,itemLevel,config){
 const c=config.armor.requirement_coefficients[type],i=positive(itemLevel,'armor.item_level');if(!c)throw Object.assign(new Error(`未定義の防具種です: ${type}`),{code:'MONSTER_ARMOR_TYPE_UNKNOWN',type});
 return{hp:i*finite(c.vit,`${type}.vit`)*50,mp:i*finite(c.mnd,`${type}.mnd`)*50,evasion:i*finite(c.agi,`${type}.agi`)*4};
}
function blockRatePercent(shieldVirtualItemLevel){const i=positive(shieldVirtualItemLevel,'shield.item_level');return 20+2*(i-1)}
function generate(input){
 try{
  const s=input&&typeof input==='object'?input:{},jobName=String(s.internal_job??s.job?.name??'').trim(),loadout=VIRTUAL_LOADOUTS[jobName];if(!loadout)return fail('MONSTER_INTERNAL_JOB_UNKNOWN','7ジョブの内部ジョブが必要です。',{internal_job:jobName});
  const cfg=s.equipment_config;assertContinuousEquipmentConfig(cfg);
  const apt=aptitudesFromJob(s.job??s.aptitudes),{M,P}=baseAndExpected(s.level,apt);
  const ai=normalizeAiBinding(s.formal_ai_binding);if(!ai.ok)return ai;
  const mainCoeffs=effectiveWeaponRequirementCoefficients(loadout.main_weapon,cfg,{two_handed:loadout.two_handed}),mainIlv=virtualItemLevel(P,mainCoeffs);
  let offIlv=null;if(loadout.offhand)offIlv=virtualItemLevel(P,effectiveWeaponRequirementCoefficients(loadout.offhand,cfg,{two_handed:false}));
  const armorIlv=virtualItemLevel(P,armorRequirementCoefficients(loadout.armor,cfg));
  const wf=weaponContinuousPerformance(loadout.main_weapon,mainIlv.value,cfg),af=armorContinuousPerformance(loadout.armor,armorIlv.value,cfg);
  const scaled=(raw,stat)=>raw*(P[stat]===0?0:(M[stat]/P[stat]));
  const attackRaw=scaled(wf.attack,'STR'),accuracyRaw=scaled(wf.accuracy,'DEX'),magicWeaponRaw=scaled(wf.magic_weapon_bonus,'INT'),hpRaw=scaled(af.hp,'VIT'),mpRaw=scaled(af.mp,'MND'),evasionRaw=scaled(af.evasion,'AGI');
  const critPercentRaw=wf.weapon_critical_rate*100*(1+M.LUK/100),shield=loadout.offhand==='盾',blockPercentRaw=shield?blockRatePercent(offIlv.value):0,blockCutPercentRaw=shield?30:0;
  const final={attack:roundFinal(attackRaw),accuracy:roundFinal(accuracyRaw),magic_weapon_bonus:roundFinal(magicWeaponRaw),max_hp:roundFinal(hpRaw),max_mp:roundFinal(mpRaw),evasion:roundFinal(evasionRaw),critical_rate_percent:roundPercentPoints(critPercentRaw),block_rate_percent:roundPercentPoints(blockPercentRaw),block_damage_cut_rate_percent:roundPercentPoints(blockCutPercentRaw)};
  return{ok:true,version:VERSION,monster_id:String(s.id||''),name:String(s.name||''),internal_job:jobName,level:Number(s.level),base_stats:M,adventurer_expected_stats:P,virtual_loadout:clone(loadout),virtual_item_levels:{main_weapon:mainIlv,offhand:offIlv,armor:armorIlv},unrounded:{attack:attackRaw,accuracy:accuracyRaw,magic_weapon_bonus:magicWeaponRaw,max_hp:hpRaw,max_mp:mpRaw,evasion:evasionRaw,critical_rate_percent:critPercentRaw,block_rate_percent:blockPercentRaw,block_damage_cut_rate_percent:blockCutPercentRaw},combat:final,formal_ai_binding:{program_id:ai.program_id,layout_id:ai.layout_id},skills:Array.isArray(s.skills)?clone(s.skills):[],mods:Array.isArray(s.mods)?clone(s.mods):[],standard_formation:s.standard_formation==null?null:String(s.standard_formation),unresolved_boundaries:['magic_accuracy','magic_resistance']};
 }catch(error){return fail(error?.code||'MONSTER_GENERATION_FAILED',String(error?.message||error),{details:{path:error?.path||null,type:error?.type||null}})}
}
return Object.freeze({VERSION,STATS,VIRTUAL_LOADOUTS,baseAndExpected,virtualItemLevel,effectiveWeaponRequirementCoefficients,weaponContinuousPerformance,armorContinuousPerformance,blockRatePercent,roundFinal,roundPercentPoints,generate});
});
