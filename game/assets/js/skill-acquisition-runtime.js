(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameSkillAcquisitionRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const STATS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const idOf=value=>String(value?.id||value||'').trim();
  function integer(value,path,{min=0}={}){
    const n=Number(value);if(!Number.isInteger(n)||n<min)throw new Error(`${path} must be an integer >= ${min}`);return n;
  }
  function normalizeIdCostMap(value,path){
    if(value==null)return{};if(!isObject(value))throw new Error(`${path} must be an object`);
    const out={};for(const [id,raw] of Object.entries(value)){const key=String(id||'').trim();if(!key)throw new Error(`${path} contains an empty id`);out[key]=integer(raw,`${path}.${key}`,{min:1});}return out;
  }
  function normalizeSpendMap(value,path){
    if(value==null)return{};if(!isObject(value))throw new Error(`${path} must be an object`);
    const out={};for(const [id,raw] of Object.entries(value)){const key=String(id||'').trim();if(!key)throw new Error(`${path} contains an empty id`);out[key]=integer(raw,`${path}.${key}`,{min:1});}return out;
  }
  function normalizeSkillPointSpend(value){
    if(value==null)return{skill:{},passive:{}};if(!isObject(value))throw new Error('character.skillPointSpend must be an object');
    return{skill:normalizeSpendMap(value.skill,'character.skillPointSpend.skill'),passive:normalizeSpendMap(value.passive,'character.skillPointSpend.passive')};
  }
  function normalizeBalance(value){
    if(!isObject(value))throw new Error('skill progression balance is required');
    const acquisition=isObject(value.acquisition_cost)?value.acquisition_cost:null;
    if(!acquisition)throw new Error('skill progression acquisition_cost is required');
    return Object.freeze({
      skill_points_per_level:integer(value.skill_points_per_level,'skill_points_per_level',{min:1}),
      acquisition_cost:Object.freeze({
        skill_default:integer(acquisition.skill_default,'acquisition_cost.skill_default',{min:1}),
        passive_default:integer(acquisition.passive_default,'acquisition_cost.passive_default',{min:1}),
        skill_by_id:Object.freeze(normalizeIdCostMap(acquisition.skill_by_id,'acquisition_cost.skill_by_id')),
        passive_by_id:Object.freeze(normalizeIdCostMap(acquisition.passive_by_id,'acquisition_cost.passive_by_id'))
      })
    });
  }
  function normalizeCharacterState(character){
    if(!isObject(character))throw new Error('character is required');
    character.skillPoints=own(character,'skillPoints')?integer(character.skillPoints,'character.skillPoints',{min:0}):0;
    character.skills=Array.isArray(character.skills)?[...new Set(character.skills.map(id=>String(id||'').trim()).filter(Boolean))]:[];
    character.passiveIds=Array.isArray(character.passiveIds)?[...new Set(character.passiveIds.map(id=>String(id||'').trim()).filter(Boolean))]:[];
    const spend=normalizeSkillPointSpend(character.skillPointSpend),skillIds=new Set(character.skills),passiveIds=new Set(character.passiveIds);
    character.skillPointSpend={
      skill:Object.fromEntries(Object.entries(spend.skill).filter(([id])=>skillIds.has(id))),
      passive:Object.fromEntries(Object.entries(spend.passive).filter(([id])=>passiveIds.has(id)))
    };
    return character;
  }
  function skillRequirements(skill){
    const rows=skill?.abilityConditions;if(!Array.isArray(rows))return[];
    return rows.map((row,index)=>normalizeRequirement(row,`skill.abilityConditions[${index}]`));
  }
  function passiveRequirements(passive){
    const contracts=passive?.runtimeContracts?.abilityRequirementContracts;
    const rows=Array.isArray(contracts)?contracts:passive?.params?.ability_conditions;
    if(!Array.isArray(rows))return[];
    return rows.map((row,index)=>normalizeRequirement(row,`passive.abilityRequirementContracts[${index}]`));
  }
  function normalizeRequirement(row,path){
    const stat=String(row?.stat||'').toUpperCase(),min=Number(row?.min);
    if(!STATS.includes(stat)||!Number.isFinite(min)||min<0)throw new Error(`${path} is invalid`);
    return{stat,min};
  }
  function requirementCheck(character,record,kind){
    normalizeCharacterState(character);
    const requirements=kind==='skill'?skillRequirements(record):passiveRequirements(record),missing=[];
    for(const req of requirements){const actual=Number(character.stats?.[req.stat]);if(!Number.isFinite(actual)||actual<req.min)missing.push({stat:req.stat,required:req.min,actual:Number.isFinite(actual)?actual:null});}
    return{ok:missing.length===0,requirements:clone(requirements),missing};
  }
  function acquisitionCost(record,kind,balanceValue){
    const balance=normalizeBalance(balanceValue),id=idOf(record);if(!id)throw new Error(`${kind} id is required`);
    const branch=kind==='skill'?'skill':'passive',map=balance.acquisition_cost[`${branch}_by_id`],fallback=balance.acquisition_cost[`${branch}_default`];
    return own(map,id)?map[id]:fallback;
  }
  function spentSkillPoints(character,kind,id){
    normalizeCharacterState(character);const target=idOf(id);if(!target)return 0;
    const branch=kind==='skill'?'skill':kind==='passive'?'passive':null;if(!branch)throw new Error(`unsupported skill-point spend kind: ${kind}`);
    return Number(character.skillPointSpend?.[branch]?.[target])||0;
  }
  function passiveSelectionCheck(character,record,options){
    const policy=options&&typeof options==='object'?options:{};if(!policy)return{ok:true};
    const maxOwned=policy.maxOwned==null?null:integer(policy.maxOwned,'passive.maxOwned',{min:1});if(maxOwned!=null&&character.passiveIds.length>=maxOwned)return{ok:false,reason:'PASSIVE_SLOT_CAPACITY_REACHED',capacity:maxOwned,count:character.passiveIds.length};
    if(typeof policy.validateAfterAdd==='function'){try{const result=policy.validateAfterAdd([...character.passiveIds,idOf(record)]);if(result===false||result?.ok===false)return{ok:false,reason:result?.reason||'PASSIVE_SELECTION_INVALID',detail:result?.detail||''};}catch(error){return{ok:false,reason:'PASSIVE_SELECTION_INVALID',detail:String(error?.message||error)};}}
    return{ok:true};
  }
  function preview(character,record,kind,balanceValue,options){
    normalizeCharacterState(character);const id=idOf(record);if(!id)return{ok:false,reason:'ID_REQUIRED'};
    const owned=kind==='skill'?character.skills:character.passiveIds;if(owned.includes(id))return{ok:false,reason:kind==='skill'?'SKILL_ALREADY_OWNED':'PASSIVE_ALREADY_OWNED',id};
    const requirements=requirementCheck(character,record,kind);if(!requirements.ok)return{ok:false,reason:'ABILITY_REQUIREMENT_NOT_MET',id,...requirements};
    if(kind==='passive'){const selection=passiveSelectionCheck(character,record,options);if(!selection.ok)return{...selection,id};}
    const cost=acquisitionCost(record,kind,balanceValue),before=character.skillPoints;if(before<cost)return{ok:false,reason:'SKILL_POINTS_SHORTAGE',id,cost,skillPointsBefore:before,skillPointsAfter:before,...requirements};
    return{ok:true,id,kind,cost,skillPointsBefore:before,skillPointsAfter:before-cost,...requirements};
  }
  function acquire(character,record,kind,balanceValue,options){
    const result=preview(character,record,kind,balanceValue,options);if(!result.ok)return{...result,changed:false};
    character.skillPoints=result.skillPointsAfter;
    if(kind==='skill')character.skills.push(result.id);else character.passiveIds.push(result.id);
    character.skillPointSpend[kind][result.id]=result.cost;
    return{...result,changed:true,skillPointsSpent:result.cost};
  }
  function acquireSkill(character,skill,balance){return acquire(character,skill,'skill',balance);}
  function acquirePassive(character,passive,balance,options){return acquire(character,passive,'passive',balance,options);}
  function grantLevelUpSkillPoints(character,balanceValue,{levels=1}={}){
    normalizeCharacterState(character);const balance=normalizeBalance(balanceValue),levelCount=integer(levels,'levels',{min:1}),gained=balance.skill_points_per_level*levelCount,before=character.skillPoints;character.skillPoints=before+gained;
    return{ok:true,changed:gained>0,gained,skillPointsBefore:before,skillPointsAfter:character.skillPoints,levels:levelCount};
  }
  return Object.freeze({STATS,normalizeBalance,normalizeSkillPointSpend,normalizeCharacterState,skillRequirements,passiveRequirements,requirementCheck,acquisitionCost,spentSkillPoints,previewAcquireSkill:(c,r,b)=>preview(c,r,'skill',b),previewAcquirePassive:(c,r,b,o)=>preview(c,r,'passive',b,o),acquireSkill,acquirePassive,grantLevelUpSkillPoints});
});
