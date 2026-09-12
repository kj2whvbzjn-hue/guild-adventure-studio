/* GS-17 shared skill condition evaluators. Compiler/runtime contracts only. */
(function(root){'use strict';
const VERSION='GS17-1';
const STATS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
function tagsOf(subject){
 const raw=Array.isArray(subject)?subject:(Array.isArray(subject?.equipmentTagIds)?subject.equipmentTagIds:[]);
 return new Set(raw.map(x=>String(x||'').trim()).filter(Boolean));
}
function evaluateEquipmentTagRequirements(subject,contracts){
 const rows=Array.isArray(contracts)?contracts:[];
 const owned=tagsOf(subject);
 for(const [index,row] of rows.entries()){
  if(String(row?.type||'').toUpperCase()!=='EQUIPMENT_TAGS'||String(row?.scope||'SELF').toUpperCase()!=='SELF'){
   return{ok:false,reason:'USE_REQUIREMENT_CONTRACT_INVALID',requirement_index:index,ownedTags:[...owned]};
  }
  const allTags=Array.isArray(row?.allTags)?row.allTags.map(String):[];
  const anyTags=Array.isArray(row?.anyTags)?row.anyTags.map(String):[];
  const missingAllTags=allTags.filter(tag=>!owned.has(tag));
  const anyMatchedTags=anyTags.filter(tag=>owned.has(tag));
  if(missingAllTags.length||Boolean(anyTags.length&&!anyMatchedTags.length)){
   return{ok:false,reason:'USE_REQUIREMENT_FAILED',requirement_index:index,type:'EQUIPMENT_TAGS',missingAllTags,anyTags:[...anyTags],anyMatchedTags,ownedTags:[...owned]};
  }
 }
 return{ok:true,ownedTags:[...owned]};
}
function evaluateAcquisitionConditions(stats,contracts){
 const source=stats&&typeof stats==='object'?stats:{};
 const rows=Array.isArray(contracts)?contracts:[];
 for(const [index,row] of rows.entries()){
  const stat=String(row?.stat||'').toUpperCase(),min=Number(row?.min),actual=Number(source?.[stat]??source?.[stat.toLowerCase()]);
  if(!STATS.includes(stat)||!Number.isFinite(min)||min<0)return{ok:false,reason:'ACQUISITION_CONTRACT_INVALID',condition_index:index};
  if(!Number.isFinite(actual)||actual<min)return{ok:false,reason:'ACQUISITION_CONDITION_FAILED',condition_index:index,stat,min,actual:Number.isFinite(actual)?actual:null};
 }
 return{ok:true};
}
const api=Object.freeze({VERSION,evaluateEquipmentTagRequirements,evaluateAcquisitionConditions});
root.GKSkillUseConditionRuntime=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
