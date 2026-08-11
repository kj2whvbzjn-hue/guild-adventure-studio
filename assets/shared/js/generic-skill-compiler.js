/* GKS Generic Skill Compiler — R02-A foundation. Converts Generic Skill Model to the current legacy tag skill format without executing battle effects. */
(function(root){
'use strict';
const VERSION='R03-F3b';
const OPS=new Set(['=','!=','>','>=','<','<=']);
const SUPPORTED_SCHEMA=1;
function own(o,k){return Object.prototype.hasOwnProperty.call(o||{},k)}
function num(v){return typeof v==='number'&&Number.isFinite(v)}
function err(errors,code,path,message){errors.push({code,path,message})}
function pushUnique(list,value){if(value!=null&&value!==''&&!list.includes(String(value)))list.push(String(value))}
function addNumeric(tags,key,value,errors,path){if(!num(value)){err(errors,'INVALID_NUMBER',path,`${key}は有限数が必要です`);return}pushUnique(tags,`${key}=${value}`)}
function validateConditionValue(def,value,errors,path){if(!num(value)){err(errors,'INVALID_CONDITION_VALUE',path,'条件値は有限数が必要です');return}if(def?.value_type==='rate'&&(value<0||value>1))err(errors,'INVALID_CONDITION_RATE',path,'割合条件は0以上1以下が必要です');if(def?.value_type==='non_negative_integer'&&(!Number.isInteger(value)||value<0))err(errors,'INVALID_CONDITION_INTEGER',path,'0以上の整数が必要です')}
function normalizeRegistry(registry){return registry&&typeof registry==='object'?registry:null}
function resolveLifecycle(def,registry,errors,path){
 const model=registry?.apply_model,lifecycle=def?.lifecycle;if(!model||!lifecycle||typeof lifecycle!=='object'){err(errors,'EFFECT_LIFECYCLE_REQUIRED',path,'APPLY Effectにはlifecycle定義が必要です');return null}
 const req=Array.isArray(model.required_lifecycle_fields)?model.required_lifecycle_fields:[];for(const key of req)if(!own(lifecycle,key)||lifecycle[key]==null||lifecycle[key]==='')err(errors,'EFFECT_LIFECYCLE_FIELD_REQUIRED',`${path}.${key}`,`lifecycle.${key}が必要です`);
 const checks=[['stackRule','stack_rules'],['refreshRule','refresh_rules'],['snapshotPolicy','snapshot_policies'],['dispelCategory','dispel_categories'],['effectiveRule','effective_rules'],['consumeRule','consume_rules']];
 for(const [key,listKey] of checks){const allowed=model[listKey];if(Array.isArray(allowed)&&own(lifecycle,key)&&!allowed.includes(lifecycle[key]))err(errors,'EFFECT_LIFECYCLE_VALUE_INVALID',`${path}.${key}`,`未定義lifecycle値: ${lifecycle[key]}`)}
 for(const key of ['removeOnDeath','removeOnBattleEnd','removable'])if(own(lifecycle,key)&&typeof lifecycle[key]!=='boolean')err(errors,'EFFECT_LIFECYCLE_BOOLEAN_INVALID',`${path}.${key}`,`lifecycle.${key}はbooleanが必要です`);
 if(own(lifecycle,'maxStacks')&&(!Number.isInteger(lifecycle.maxStacks)||lifecycle.maxStacks<1))err(errors,'EFFECT_LIFECYCLE_MAX_STACKS_INVALID',`${path}.maxStacks`,'maxStacksは1以上の整数が必要です');
 return {...lifecycle};
}
function compileGenericSkill(skill,registry,legacyCompile){
 const errors=[],warnings=[],tags=[],normalizedEffects=[],applyContracts=[];registry=normalizeRegistry(registry);
 if(!registry){err(errors,'REGISTRY_REQUIRED','registry','Generic Skill Registryが必要です');return result()}
 if(!skill||typeof skill!=='object'||Array.isArray(skill)){err(errors,'INVALID_SKILL','$','スキルはobjectが必要です');return result()}
 if(skill.schemaVersion!==SUPPORTED_SCHEMA)err(errors,'UNSUPPORTED_SCHEMA','schemaVersion',`schemaVersion=${skill.schemaVersion}は未対応です`);
 if(typeof skill.id!=='string'||!skill.id.trim())err(errors,'ID_REQUIRED','id','idが必要です');
 if(typeof skill.name!=='string'||!skill.name.trim())err(errors,'NAME_REQUIRED','name','nameが必要です');
 const trigger=skill.trigger?.type;
 const triggerDef=registry.triggers?.[trigger];
 if(!triggerDef)err(errors,'UNKNOWN_TRIGGER','trigger.type',`未定義Trigger: ${trigger||'(なし)'}`);
 else if(!triggerDef.legacy_supported)err(errors,'LEGACY_TRIGGER_UNSUPPORTED','trigger.type',`R02 Legacy Adapter未対応Trigger: ${trigger}`);
 const side=registry.targets?.sides?.[skill.target?.side],range=registry.targets?.ranges?.[skill.target?.range];
 if(!side)err(errors,'UNKNOWN_TARGET_SIDE','target.side',`未定義対象: ${skill.target?.side||'(なし)'}`);else pushUnique(tags,side);
 if(!range)err(errors,'UNKNOWN_TARGET_RANGE','target.range',`未定義範囲: ${skill.target?.range||'(なし)'}`);else pushUnique(tags,range);
 if(skill.target?.range==='RANDOM')addNumeric(tags,'RANDOM_COUNT',skill.target?.randomCount,errors,'target.randomCount');
 for(const [i,c] of (Array.isArray(skill.conditions)?skill.conditions:[]).entries()){
  if(!c||typeof c!=='object'){err(errors,'INVALID_CONDITION',`conditions[${i}]`,'条件objectが必要です');continue}
  if(c.scope&&c.scope!=='SELF')err(errors,'CONDITION_SCOPE_UNSUPPORTED',`conditions[${i}].scope`,`R02ではSELF条件のみ対応です: ${c.scope}`);
  const def=registry.conditions?.[c.property];if(!def){err(errors,'UNKNOWN_CONDITION',`conditions[${i}].property`,`未定義Condition: ${c.property||'(なし)'}`);continue}
  if(!OPS.has(c.operator)){err(errors,'UNKNOWN_OPERATOR',`conditions[${i}].operator`,`未対応比較演算子: ${c.operator||'(なし)'}`);continue}
  validateConditionValue(def,c.value,errors,`conditions[${i}].value`);if(num(c.value))pushUnique(tags,`${def.legacy_tag}${c.operator}${c.value}`);
 }
 const effects=Array.isArray(skill.effects)?skill.effects:[];if(!effects.length)err(errors,'EFFECT_REQUIRED','effects','effectsが1件以上必要です');
 for(const [i,effect] of effects.entries())compileEffect(effect,i,registry,tags,errors,warnings,normalizedEffects,applyContracts);
 const seenApplyLogic=new Set();for(const c of applyContracts){if(seenApplyLogic.has(c.logic))err(errors,'LEGACY_APPLY_LOGIC_DUPLICATE','effects',`Legacy Adapterでは同一APPLY logicを複数同時実行できません: ${c.logic}`);seenApplyLogic.add(c.logic)}
 const res=skill.resource||{};
 if(own(res,'mpCost'))addNumeric(tags,'MP_COST',res.mpCost,errors,'resource.mpCost');
 if(own(res,'cooldown')){if(!Number.isInteger(res.cooldown)||res.cooldown<0)err(errors,'INVALID_COOLDOWN','resource.cooldown','cooldownは0以上の整数が必要です');else pushUnique(tags,`COOLDOWN=${res.cooldown}`)}
 if(own(res,'activationPriority')){if(!Number.isInteger(res.activationPriority))err(errors,'INVALID_ACTIVATION_PRIORITY','resource.activationPriority','activationPriorityは整数が必要です');else pushUnique(tags,`ACTIVATION_PRIORITY=${res.activationPriority}`)}
 const genericRuntime={schemaVersion:1,registryPhase:String(registry.phase||''),applyContracts:applyContracts.map(c=>({...c,lifecycle:{...c.lifecycle}}))};
 const legacySkill={id:String(skill.id||''),name:String(skill.name||''),tags,genericRuntime};
 let legacyValidation=null;
 if(!errors.length&&typeof legacyCompile==='function'){
  try{legacyValidation=legacyCompile(legacySkill);if(!legacyValidation?.ok)for(const m of legacyValidation?.errors||['legacy compile failed'])err(errors,'LEGACY_COMPILE_REJECTED','legacySkill',String(m));}
  catch(e){err(errors,'LEGACY_COMPILE_EXCEPTION','legacySkill',e?.message||String(e))}
 }
 return result();
 function result(){return{ok:errors.length===0,version:VERSION,errors,warnings,normalizedEffects:[...normalizedEffects],legacySkill:{id:String(skill?.id||''),name:String(skill?.name||''),tags:[...tags],genericRuntime:{schemaVersion:1,registryPhase:String(registry?.phase||''),applyContracts:applyContracts.map(c=>({...c,lifecycle:{...c.lifecycle}}))}},legacyValidation}}
}
function compileEffect(effect,index,registry,tags,errors,warnings,normalizedEffects,applyContracts){
 const p=`effects[${index}]`;if(!effect||typeof effect!=='object'){err(errors,'INVALID_EFFECT',p,'Effect objectが必要です');return}
 const type=String(effect.type||'').toUpperCase();
 if(!registry.runtime?.effects?.includes(type)){err(errors,'UNKNOWN_EFFECT_TYPE',`${p}.type`,`未定義Effect type: ${type||'(なし)'}`);return}
 if(!registry.runtime?.legacy_adapter_supported?.includes(type)){err(errors,'LEGACY_EFFECT_UNSUPPORTED',`${p}.type`,`R02 Legacy Adapter未対応Effect: ${type}`);return}
 if(type==='DAMAGE'){
  pushUnique(tags,'ATTACK');addNumeric(tags,'DAMAGE',effect.power,errors,`${p}.power`);if(effect.damageType){const t=registry.damage_types?.[effect.damageType];if(!t)err(errors,'UNKNOWN_DAMAGE_TYPE',`${p}.damageType`,`未定義damageType: ${effect.damageType}`);else pushUnique(tags,t)}normalizedEffects.push({type:'DAMAGE',power:effect.power,damageType:effect.damageType||null});return;
 }
 if(type==='HEAL'){pushUnique(tags,'HEAL');addNumeric(tags,'HEAL',effect.power,errors,`${p}.power`);normalizedEffects.push({type:'HEAL',power:effect.power});return}
 if(type==='REVIVE'){
  pushUnique(tags,'REVIVE');const hasHp=own(effect,'hp'),hasRate=own(effect,'hpRate');if(hasHp===hasRate){err(errors,'REVIVE_VALUE_REQUIRED',p,'REVIVEはhpまたはhpRateのどちらか1つが必要です');return}if(hasHp)addNumeric(tags,'REVIVE_HP',effect.hp,errors,`${p}.hp`);else addNumeric(tags,'REVIVE_HP_RATE',effect.hpRate,errors,`${p}.hpRate`);return;
 }
 if(type==='REMOVE'){
  if(effect.category!=='STATUS'){err(errors,'REMOVE_CATEGORY_UNSUPPORTED',`${p}.category`,'R02 REMOVEはSTATUSのみ対応です');return}pushUnique(tags,'CLEANSE');pushUnique(tags,'CLEANSE_CATEGORY=status');pushUnique(tags,'CLEANSE_ORDER=oldest');if(effect.all===true)pushUnique(tags,'CLEANSE_ALL');else{if(!Number.isInteger(effect.count)||effect.count<1)err(errors,'REMOVE_COUNT_REQUIRED',`${p}.count`,'REMOVEはcount>=1またはall=trueが必要です');else pushUnique(tags,`CLEANSE_COUNT=${effect.count}`)}return;
 }
 if(type==='APPLY')compileApply(effect,p,registry,tags,errors,warnings,normalizedEffects,applyContracts);
}
function compileApply(effect,p,registry,tags,errors,warnings,normalizedEffects,applyContracts){
 const def=registry.effects?.[effect.effectId];if(!def){err(errors,'UNKNOWN_EFFECT_ID',`${p}.effectId`,`未定義Effect ID: ${effect.effectId||'(なし)'}`);return}
 const kind=def.kind,legacy=def.legacy||{},defaults=def.defaults||{},lifecycle=resolveLifecycle(def,registry,errors,`${p}.effectId.lifecycle`);pushUnique(tags,legacy.logic);
 for(const t of legacy.generalTags||[])pushUnique(tags,t);
 const normalized={type:'APPLY',effectId:effect.effectId,kind,lifecycle,power:own(effect,'power')?effect.power:null,duration:own(effect,'duration')?effect.duration:null,interval:own(effect,'interval')?effect.interval:(own(defaults,'interval')?defaults.interval:null),stackGain:own(effect,'stackGain')?effect.stackGain:(own(defaults,'stackGain')?defaults.stackGain:null)};normalizedEffects.push(normalized);applyContracts.push({effectId:effect.effectId,kind,logic:legacy.logic,lifecycle:{...lifecycle}});
 if(kind==='STATUS'){
  pushUnique(tags,`STATUS_ID=${legacy.statusId||effect.effectId}`);if(!Number.isInteger(effect.duration)||effect.duration<=0)err(errors,'APPLY_DURATION_REQUIRED',`${p}.duration`,'STATUS付与には正の整数durationが必要です');else pushUnique(tags,`DURATION=${effect.duration}`);return;
 }
 if(kind==='DOT'){
  addNumeric(tags,'DOT_POWER',effect.power,errors,`${p}.power`);addNumeric(tags,'DOT_DURATION',effect.duration,errors,`${p}.duration`);addNumeric(tags,'DOT_INTERVAL',own(effect,'interval')?effect.interval:defaults.interval,errors,`${p}.interval`);addNumeric(tags,'STACK_GAIN',own(effect,'stackGain')?effect.stackGain:defaults.stackGain,errors,`${p}.stackGain`);return;
 }
 if(kind==='BUFF'||kind==='DEBUFF'){
  if(!legacy.modifierStat)err(errors,'MODIFIER_STAT_MISSING',`${p}.effectId`,'Effect RegistryにmodifierStatが必要です');else pushUnique(tags,legacy.modifierStat);addNumeric(tags,'POWER',effect.power,errors,`${p}.power`);addNumeric(tags,'DURATION',effect.duration,errors,`${p}.duration`);addNumeric(tags,'STACK_GAIN',own(effect,'stackGain')?effect.stackGain:defaults.stackGain,errors,`${p}.stackGain`);return;
 }
 if(kind==='SHIELD'){
  addNumeric(tags,'SHIELD',effect.power,errors,`${p}.power`);addNumeric(tags,'DURATION',effect.duration,errors,`${p}.duration`);return;
 }
 warnings.push({code:'APPLY_KIND_DEFERRED',path:`${p}.effectId`,message:`Effect kind ${kind} はRegistryに存在しますがR02 Adapter未接続です`});err(errors,'APPLY_KIND_UNSUPPORTED',`${p}.effectId`,`R02 APPLY未対応kind: ${kind}`);
}
const api={VERSION,SUPPORTED_SCHEMA,compileGenericSkill};
root.GKSGenericSkillCompiler=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
