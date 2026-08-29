(function(root){
'use strict';
const VERSION='1.0.0';
const AUTHORING=Object.freeze({
 skill:Object.freeze(['schemaVersion','id','name','skillLevel','abilityConditions','trigger','conditions','useRequirements','target','effects','resource']),
 trigger:Object.freeze(['type','scope','priority','dispatchMode','activationChance']),
 condition:Object.freeze(['scope','property','operator','value']),
 target:Object.freeze(['side','range','randomCount','excludeSelf']),
 resource:Object.freeze(['mpCost','cooldown','activationPriority','castTime'])
});
const MASTER=Object.freeze([
 'schemaVersion','id','name','skillLevel','abilityConditions','trigger','conditions','useRequirements','target','effects','resource','runtimeContracts',
 'status','description','created_at','updated_at'
]);
const BATCH=Object.freeze({
 schema:'GKS_SKILL_BATCH',version:'1.0.0',
 root:Object.freeze(['schema','version','sourceSchema','aiGenerationRuleVersion','budgetRuleVersion','skills']),
 row:Object.freeze(['index','skill','generation','validation'])
});
const allowed=(section)=>[...(AUTHORING[section]||[])];
const masterAllowed=()=>[...MASTER];
const api=Object.freeze({VERSION,AUTHORING,MASTER,BATCH,allowed,masterAllowed});
root.GKSSkillSchema=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
