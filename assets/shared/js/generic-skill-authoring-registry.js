/* GKS Generic Skill Authoring Registry — G01. Registry-driven Studio authoring definitions. */
(function(root){
'use strict';
const VERSION='G04';
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
function listFieldDefinitions(registry){const a=registryRequired(registry);return clone(a.field_definitions||{});}
function listApplyEffects(registry){registryRequired(registry);return Object.entries(registry.effects||{}).map(([effectId,def])=>({effectId,label:def?.label||effectId,kind:def?.kind||null,budgetWeight:def?.budgetWeight??null,defaults:clone(def?.defaults||{}),lifecycle:clone(def?.lifecycle||{})}));}
function resolveEffectRequirements(registry,effectType,draft={}){
 const a=registryRequired(registry),type=String(effectType||'').toUpperCase(),def=a.effect_types?.[type];
 if(!def)return{ok:false,type,enabled:false,requiredFields:[],optionalFields:[],oneOfRequired:[],errors:[`未定義Generic Effect type: ${type||'(なし)'}`]};
 const required=[...(def.required_fields||[])],optional=[...(def.optional_fields||[])],errors=[];
 if(def.required_fields_by_registry_effect_kind&&draft?.effectId){const effect=registry.effects?.[draft.effectId];if(!effect)errors.push(`未定義Effect ID: ${draft.effectId}`);else for(const f of def.required_fields_by_registry_effect_kind[effect.kind]||[])if(!required.includes(f))required.push(f);}
 for(const rule of def.conditional_required||[]){const when=rule?.when||{};if(pathValue(draft,when.field)===when.equals)for(const f of rule.fields||[])if(!required.includes(f))required.push(f);}
 return{ok:errors.length===0&&def.enabled!==false,type,label:def.label||type,enabled:def.enabled!==false,boundary:def.boundary||null,reason:def.reason||null,requiredFields:required,optionalFields:optional.filter(f=>!required.includes(f)),oneOfRequired:clone(def.one_of_required||[]),supportedValues:clone(def.supported_values||{}),errors};
}

function resolveConditionRequirements(registry,property){
 const a=registryRequired(registry),key=String(property||'').toUpperCase(),def=registry.conditions?.[key];
 if(!def)return{ok:false,property:key,enabled:false,scope:'',operators:[],valueType:null,valueControl:null,errors:[`未定義Condition property: ${key||'(なし)'}`]};
 const valueType=String(def.value_type||'number'),scope=String(def.scope||a.condition?.scope_default||'SELF').toUpperCase();
 const control=clone(a.condition?.value_type_controls?.[valueType]||{control:'number',step:'any'});
 const operators=Array.isArray(control?.operator_options)?[...control.operator_options]:[...(a.condition?.operators||[])];
 return{ok:def.enabled!==false,property:key,label:def.label||key,enabled:def.enabled!==false,scope,scopeLocked:true,operators,valueType,valueControl:control,legacyTag:def.legacy_tag||null,enginePredicate:def.engine_predicate||null,errors:def.enabled===false?[`無効Condition property: ${key}`]:[]};
}
function validateConditionDraft(registry,condition){
 const c=condition&&typeof condition==='object'?condition:{},req=resolveConditionRequirements(registry,c.property),errors=[];
 if(!req.ok){errors.push(...req.errors);return{ok:false,errors,requirements:req};}
 const scope=String(c.scope||'').toUpperCase();if(scope!==req.scope)errors.push(`${req.property}のscopeは${req.scope}が必要です`);
 if(!req.operators.includes(c.operator))errors.push(`${req.property}のoperatorが未対応です: ${c.operator||'(なし)'}`);
 const v=c.value,ctl=req.valueControl||{};
 if(req.valueType==='predicate'){if(v!==true)errors.push(`${req.property} predicateはtrueのみ対応です`);}
 else{if(typeof v!=='number'||!Number.isFinite(v))errors.push(`${req.property}のvalueは有限数が必要です`);else{if(ctl.integer&&!Number.isInteger(v))errors.push(`${req.property}は整数で指定してください`);if(ctl.min!=null&&v<ctl.min)errors.push(`${req.property}は${ctl.min}以上が必要です`);if(ctl.max!=null&&v>ctl.max)errors.push(`${req.property}は${ctl.max}以下が必要です`);}}
 return{ok:errors.length===0,errors,requirements:req};
}
function buildUiDefinition(registry){const a=registryRequired(registry);return{version:VERSION,phase:String(a.phase||''),registryPhase:String(registry.phase||''),skillRequiredFields:clone(a.skill_required_fields||[]),fields:listFieldDefinitions(registry),effects:listRuntimeEffects(registry),applyEffects:listApplyEffects(registry),triggers:listTriggers(registry),conditions:listConditions(registry),targets:listTargets(registry),damageTypes:listDamageTypes(registry),trigger:clone(a.trigger||{}),condition:clone(a.condition||{}),target:clone(a.target||{}),resource:clone(a.resource||{})};}
const api=Object.freeze({VERSION,buildUiDefinition,listFieldDefinitions,listRuntimeEffects,listTriggers,listConditions,listTargets,listDamageTypes,listApplyEffects,resolveEffectRequirements,resolveConditionRequirements,validateConditionDraft});
root.GKSGenericSkillAuthoringRegistry=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
