/* GKS Generic Skill Authoring Registry — G01. Registry-driven Studio authoring definitions. */
(function(root){
'use strict';
const VERSION='G01';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function registryRequired(registry){
 if(!registry||typeof registry!=='object')throw new Error('Generic Skill Registryが必要です');
 const a=registry.authoring;if(!a||typeof a!=='object')throw new Error('Generic Skill Registry authoring定義がありません');
 if(!a.effect_types||typeof a.effect_types!=='object')throw new Error('authoring.effect_typesがありません');
 return a;
}
function pathValue(obj,path){return String(path||'').split('.').reduce((v,k)=>v==null?undefined:v[k],obj)}
function listRuntimeEffects(registry){const a=registryRequired(registry);return (registry.runtime?.effects||[]).map(type=>({type,label:a.effect_types?.[type]?.label||type,enabled:a.effect_types?.[type]?.enabled!==false,boundary:a.effect_types?.[type]?.boundary||null,reason:a.effect_types?.[type]?.reason||null}));}
function listTriggers(registry){registryRequired(registry);return Object.entries(registry.triggers||{}).map(([type,def])=>({type,...clone(def)}));}
function listConditions(registry){registryRequired(registry);return Object.entries(registry.conditions||{}).map(([property,def])=>({property,...clone(def)}));}
function listTargets(registry){registryRequired(registry);return{ sides:Object.entries(registry.targets?.sides||{}).map(([value,label])=>({value,label})), ranges:Object.entries(registry.targets?.ranges||{}).map(([value,label])=>({value,label}))};}
function listDamageTypes(registry){registryRequired(registry);return Object.entries(registry.damage_types||{}).map(([value,label])=>({value,label}));}
function listApplyEffects(registry){registryRequired(registry);return Object.entries(registry.effects||{}).map(([effectId,def])=>({effectId,label:def?.label||effectId,kind:def?.kind||null,budgetWeight:def?.budgetWeight??null,defaults:clone(def?.defaults||{}),lifecycle:clone(def?.lifecycle||{})}));}
function resolveEffectRequirements(registry,effectType,draft={}){
 const a=registryRequired(registry),type=String(effectType||'').toUpperCase(),def=a.effect_types?.[type];
 if(!def)return{ok:false,type,enabled:false,requiredFields:[],optionalFields:[],oneOfRequired:[],errors:[`未定義Generic Effect type: ${type||'(なし)'}`]};
 const required=[...(def.required_fields||[])],optional=[...(def.optional_fields||[])],errors=[];
 if(def.required_fields_by_registry_effect_kind&&draft?.effectId){const effect=registry.effects?.[draft.effectId];if(!effect)errors.push(`未定義Effect ID: ${draft.effectId}`);else for(const f of def.required_fields_by_registry_effect_kind[effect.kind]||[])if(!required.includes(f))required.push(f);}
 for(const rule of def.conditional_required||[]){const when=rule?.when||{};if(pathValue(draft,when.field)===when.equals)for(const f of rule.fields||[])if(!required.includes(f))required.push(f);}
 return{ok:errors.length===0&&def.enabled!==false,type,label:def.label||type,enabled:def.enabled!==false,boundary:def.boundary||null,reason:def.reason||null,requiredFields:required,optionalFields:optional.filter(f=>!required.includes(f)),oneOfRequired:clone(def.one_of_required||[]),supportedValues:clone(def.supported_values||{}),errors};
}
function buildUiDefinition(registry){const a=registryRequired(registry);return{version:VERSION,phase:String(a.phase||''),registryPhase:String(registry.phase||''),skillRequiredFields:clone(a.skill_required_fields||[]),effects:listRuntimeEffects(registry),applyEffects:listApplyEffects(registry),triggers:listTriggers(registry),conditions:listConditions(registry),targets:listTargets(registry),damageTypes:listDamageTypes(registry),trigger:clone(a.trigger||{}),condition:clone(a.condition||{}),target:clone(a.target||{}),resource:clone(a.resource||{})};}
const api=Object.freeze({VERSION,buildUiDefinition,listRuntimeEffects,listTriggers,listConditions,listTargets,listDamageTypes,listApplyEffects,resolveEffectRequirements});
root.GKSGenericSkillAuthoringRegistry=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
