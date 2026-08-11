/* GKS Generic Skill Compiler — R02-A foundation. Converts Generic Skill Model to the current legacy tag skill format without executing battle effects. */
(function(root){
'use strict';
const VERSION='R05-F';
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
 const errors=[],warnings=[],tags=[],normalizedEffects=[],effectContracts=[],applyContracts=[],conditionContracts=[];let auraEffectContract=null;registry=normalizeRegistry(registry);
 if(!registry){err(errors,'REGISTRY_REQUIRED','registry','Generic Skill Registryが必要です');return result()}
 if(!skill||typeof skill!=='object'||Array.isArray(skill)){err(errors,'INVALID_SKILL','$','スキルはobjectが必要です');return result()}
 if(skill.schemaVersion!==SUPPORTED_SCHEMA)err(errors,'UNSUPPORTED_SCHEMA','schemaVersion',`schemaVersion=${skill.schemaVersion}は未対応です`);
 if(typeof skill.id!=='string'||!skill.id.trim())err(errors,'ID_REQUIRED','id','idが必要です');
 if(typeof skill.name!=='string'||!skill.name.trim())err(errors,'NAME_REQUIRED','name','nameが必要です');
 const trigger=String(skill.trigger?.type||'').toUpperCase();
 const triggerDef=registry.triggers?.[trigger];
 if(!triggerDef)err(errors,'UNKNOWN_TRIGGER','trigger.type',`未定義Trigger: ${trigger||'(なし)'}`);
 else if(!triggerDef.legacy_supported)err(errors,'LEGACY_TRIGGER_UNSUPPORTED','trigger.type',`Legacy Adapter未対応Trigger: ${trigger}`);
 else compileTriggerAdapter(skill,trigger,triggerDef,registry,tags,errors);
 const side=registry.targets?.sides?.[skill.target?.side],range=registry.targets?.ranges?.[skill.target?.range];
 if(!side)err(errors,'UNKNOWN_TARGET_SIDE','target.side',`未定義対象: ${skill.target?.side||'(なし)'}`);else pushUnique(tags,side);
 if(!range)err(errors,'UNKNOWN_TARGET_RANGE','target.range',`未定義範囲: ${skill.target?.range||'(なし)'}`);else pushUnique(tags,range);
 if(skill.target?.range==='RANDOM')addNumeric(tags,'RANDOM_COUNT',skill.target?.randomCount,errors,'target.randomCount');
 for(const [i,c] of (Array.isArray(skill.conditions)?skill.conditions:[]).entries()){
  if(!c||typeof c!=='object'){err(errors,'INVALID_CONDITION',`conditions[${i}]`,'条件objectが必要です');continue}
  const def=registry.conditions?.[c.property];if(!def){err(errors,'UNKNOWN_CONDITION',`conditions[${i}].property`,`未定義Condition: ${c.property||'(なし)'}`);continue}
  if(def.value_type==='predicate'){
   const scope=String(c.scope||def.scope||'TARGET').toUpperCase();
   if(def.scope&&scope!==String(def.scope).toUpperCase())err(errors,'CONDITION_SCOPE_UNSUPPORTED',`conditions[${i}].scope`,`${c.property}は${def.scope} scopeが必要です`);
   if(c.value!=null&&c.value!==true)err(errors,'PREDICATE_EXPECTED_TRUE',`conditions[${i}].value`,`${c.property} predicateはtrueのみ対応です`);
   if(c.operator!=null&&c.operator!=='=' )err(errors,'PREDICATE_OPERATOR_UNSUPPORTED',`conditions[${i}].operator`,`${c.property} predicateは=のみ対応です`);
   pushUnique(tags,def.legacy_tag);
   conditionContracts.push({property:String(c.property),scope,enginePredicate:String(def.engine_predicate||''),expected:true});
   continue;
  }
  if(c.scope&&c.scope!=='SELF')err(errors,'CONDITION_SCOPE_UNSUPPORTED',`conditions[${i}].scope`,`数値条件はSELFのみ対応です: ${c.scope}`);
  if(!OPS.has(c.operator)){err(errors,'UNKNOWN_OPERATOR',`conditions[${i}].operator`,`未対応比較演算子: ${c.operator||'(なし)'}`);continue}
  validateConditionValue(def,c.value,errors,`conditions[${i}].value`);if(num(c.value))pushUnique(tags,`${def.legacy_tag}${c.operator}${c.value}`);
 }
 const effects=Array.isArray(skill.effects)?skill.effects:[];if(!effects.length)err(errors,'EFFECT_REQUIRED','effects','effectsが1件以上必要です');
 if(trigger==='WHILE_SOURCE_ALIVE')auraEffectContract=compileAuraEffectAdapter(skill,registry,tags,errors,normalizedEffects);
 else for(const [i,effect] of effects.entries())compileEffect(effect,i,registry,tags,errors,warnings,normalizedEffects,effectContracts,applyContracts);
 if(trigger==='ON_ALLY_ATTACK'){const idx=tags.indexOf('ATTACK');if(idx>=0)tags.splice(idx,1);}
 const seenApplyLogic=new Set();for(const c of applyContracts){if(seenApplyLogic.has(c.logic))err(errors,'LEGACY_APPLY_LOGIC_DUPLICATE','effects',`Legacy Adapterでは同一APPLY logicを複数同時実行できません: ${c.logic}`);seenApplyLogic.add(c.logic)}
 const res=skill.resource||{};
 if(own(res,'mpCost'))addNumeric(tags,'MP_COST',res.mpCost,errors,'resource.mpCost');
 if(own(res,'cooldown')){if(!Number.isInteger(res.cooldown)||res.cooldown<0)err(errors,'INVALID_COOLDOWN','resource.cooldown','cooldownは0以上の整数が必要です');else pushUnique(tags,`COOLDOWN=${res.cooldown}`)}
 if(own(res,'activationPriority')){if(!Number.isInteger(res.activationPriority))err(errors,'INVALID_ACTIVATION_PRIORITY','resource.activationPriority','activationPriorityは整数が必要です');else pushUnique(tags,`ACTIVATION_PRIORITY=${res.activationPriority}`)}
 const genericRuntime={schemaVersion:1,registryPhase:String(registry.phase||''),triggerContract:buildTriggerContract(skill,triggerDef),conditionContracts:conditionContracts.map(c=>({...c})),effectContracts:effectContracts.map(c=>({...c})),applyContracts:applyContracts.map(c=>({...c,lifecycle:{...c.lifecycle}})),auraEffectContract:auraEffectContract?{...auraEffectContract}:null};
 const legacySkill={id:String(skill.id||''),name:String(skill.name||''),tags,genericRuntime};
 let legacyValidation=null;
 if(!errors.length&&typeof legacyCompile==='function'){
  try{legacyValidation=legacyCompile(legacySkill);if(!legacyValidation?.ok)for(const m of legacyValidation?.errors||['legacy compile failed'])err(errors,'LEGACY_COMPILE_REJECTED','legacySkill',String(m));}
  catch(e){err(errors,'LEGACY_COMPILE_EXCEPTION','legacySkill',e?.message||String(e))}
 }
 return result();
 function result(){return{ok:errors.length===0,version:VERSION,errors,warnings,normalizedEffects:[...normalizedEffects],legacySkill:{id:String(skill?.id||''),name:String(skill?.name||''),tags:[...tags],genericRuntime:{schemaVersion:1,registryPhase:String(registry?.phase||''),triggerContract:buildTriggerContract(skill,triggerDef),conditionContracts:conditionContracts.map(c=>({...c})),effectContracts:effectContracts.map(c=>({...c})),applyContracts:applyContracts.map(c=>({...c,lifecycle:{...c.lifecycle}})),auraEffectContract:auraEffectContract?{...auraEffectContract}:null}},legacyValidation}}
}

function buildTriggerContract(skill,def){
 const type=String(skill?.trigger?.type||'ON_USE').toUpperCase();
 return{
  type,
  scope:String(skill?.trigger?.scope||'SELF').toUpperCase(),
  engineEvent:String(def?.engine_event||''),
  dispatchMode:String(def?.dispatch_mode||'RESOLVE_ONLY'),
  priority:Number.isInteger(skill?.trigger?.priority)?skill.trigger.priority:0
 };
}

function compileTriggerAdapter(skill,trigger,def,registry,tags,errors){
 if(trigger==='ON_USE')return;
 const adapter=def?.legacy_adapter;
 if(!adapter||typeof adapter!=='object'){err(errors,'TRIGGER_LEGACY_ADAPTER_REQUIRED','trigger.type',`${trigger}のLegacy Adapter定義が必要です`);return}
 if(trigger==='ON_HIT_RECEIVED'){
  if(adapter.logic!=='COUNTER'){err(errors,'COUNTER_ADAPTER_LOGIC_INVALID','trigger.type','ON_HIT_RECEIVEDはCOUNTER Adapterが必要です');return}
  if(skill.target?.side!==adapter.target_side)err(errors,'COUNTER_TARGET_SIDE_REQUIRED','target.side',`COUNTERは${adapter.target_side}対象が必要です`);
  if(skill.target?.range!==adapter.target_range)err(errors,'COUNTER_TARGET_RANGE_REQUIRED','target.range',`COUNTERは${adapter.target_range}範囲が必要です`);
  const effects=Array.isArray(skill.effects)?skill.effects:[];
  if(!effects.some(e=>String(e?.type||'').toUpperCase()===String(adapter.requires_effect||'DAMAGE').toUpperCase()))err(errors,'COUNTER_DAMAGE_EFFECT_REQUIRED','effects','ON_HIT_RECEIVED CounterにはDAMAGE Effectが必要です');
  pushUnique(tags,adapter.logic);
  for(const t of adapter.general_tags||[])pushUnique(tags,t);
  const defaults=adapter.numeric_defaults||{};
  const limit=own(skill.trigger,'limit')?skill.trigger.limit:defaults.COUNTER_LIMIT;
  const priority=own(skill.trigger,'priority')?skill.trigger.priority:defaults.COUNTER_PRIORITY;
  if(!Number.isInteger(limit)||limit!==1)err(errors,'COUNTER_LIMIT_INVALID','trigger.limit','現在のCOUNTER limitは1が必要です');else pushUnique(tags,`COUNTER_LIMIT=${limit}`);
  if(!Number.isInteger(priority))err(errors,'COUNTER_PRIORITY_INVALID','trigger.priority','COUNTER priorityは整数が必要です');else pushUnique(tags,`COUNTER_PRIORITY=${priority}`);
  return;
 }
 if(trigger==='WHILE_SOURCE_ALIVE'){
  if(adapter.logic!=='AURA'){err(errors,'AURA_ADAPTER_LOGIC_INVALID','trigger.type','WHILE_SOURCE_ALIVEはAURA Adapterが必要です');return}
  if(!Array.isArray(adapter.target_sides)||!adapter.target_sides.includes(skill.target?.side))err(errors,'AURA_TARGET_SIDE_REQUIRED','target.side','AURAはALLYまたはENEMY対象が必要です');
  if(skill.target?.range!==adapter.target_range)err(errors,'AURA_TARGET_RANGE_REQUIRED','target.range','AURAはALL範囲が必要です');
  if(skill.target?.excludeSelf===true&&skill.target?.side!=='ALLY')err(errors,'AURA_EXCLUDE_SELF_INVALID','target.excludeSelf','excludeSelfはALLY AURAのみ対応です');
  if(skill.target?.excludeSelf!=null&&typeof skill.target.excludeSelf!=='boolean')err(errors,'AURA_EXCLUDE_SELF_BOOLEAN_REQUIRED','target.excludeSelf','excludeSelfはbooleanが必要です');
  if(skill.conditions?.length)err(errors,'AURA_CONDITION_DEFERRED','conditions','R04-D1 AURAはCondition未対応です');
  pushUnique(tags,'AURA');
  return;
 }
 if(trigger==='ON_ALLY_ATTACK'){
  if(adapter.logic!=='FOLLOW_UP'){err(errors,'FOLLOW_UP_ADAPTER_LOGIC_INVALID','trigger.type','ON_ALLY_ATTACKはFOLLOW_UP Adapterが必要です');return}
  if(skill.target?.side!==adapter.target_side)err(errors,'FOLLOW_UP_TARGET_SIDE_REQUIRED','target.side',`FOLLOW_UPは${adapter.target_side}対象が必要です`);
  if(skill.target?.range!==adapter.target_range)err(errors,'FOLLOW_UP_TARGET_RANGE_REQUIRED','target.range',`FOLLOW_UPは${adapter.target_range}範囲が必要です`);
  const effects=Array.isArray(skill.effects)?skill.effects:[];
  if(!effects.some(e=>String(e?.type||'').toUpperCase()===String(adapter.requires_effect||'DAMAGE').toUpperCase()))err(errors,'FOLLOW_UP_DAMAGE_EFFECT_REQUIRED','effects','ON_ALLY_ATTACK Follow-upにはDAMAGE Effectが必要です');
  const conditions=Array.isArray(skill.conditions)?skill.conditions:[];
  if(!conditions.some(c=>String(c?.property||'').toUpperCase()===String(adapter.requires_condition||'TARGET_POISONED').toUpperCase()))err(errors,'FOLLOW_UP_CONDITION_REQUIRED','conditions',`ON_ALLY_ATTACK Follow-upには${adapter.requires_condition||'TARGET_POISONED'} Conditionが必要です`);
  pushUnique(tags,adapter.logic);
  for(const t of adapter.general_tags||[])pushUnique(tags,t);
  return;
 }
 err(errors,'TRIGGER_LEGACY_ADAPTER_UNIMPLEMENTED','trigger.type',`Trigger Adapter未実装: ${trigger}`);
}

function compileAuraEffectAdapter(skill,registry,tags,errors,normalizedEffects){
 const effects=Array.isArray(skill.effects)?skill.effects:[];
 if(effects.length!==1){err(errors,'AURA_SINGLE_EFFECT_REQUIRED','effects','R04-D1 AURAはAPPLY Effectを1件だけ指定してください');return null}
 const effect=effects[0],p='effects[0]';
 if(String(effect?.type||'').toUpperCase()!=='APPLY'){err(errors,'AURA_APPLY_EFFECT_REQUIRED',`${p}.type`,'R04-D1 AURAはAPPLY Effectが必要です');return null}
 const def=registry.effects?.[effect.effectId];if(!def){err(errors,'UNKNOWN_EFFECT_ID',`${p}.effectId`,`未定義Effect ID: ${effect.effectId||'(なし)'}`);return null}
 if(!['BUFF','DEBUFF'].includes(def.kind)){err(errors,'AURA_EFFECT_KIND_UNSUPPORTED',`${p}.effectId`,'R04-D1 AURAはBUFF/DEBUFF Effectのみ対応です');return null}
 const stat=def.legacy?.modifierStat;if(!stat){err(errors,'MODIFIER_STAT_MISSING',`${p}.effectId`,'Aura Effect RegistryにmodifierStatが必要です');return null}
 if(!num(effect.power)||effect.power<=0)err(errors,'AURA_POWER_REQUIRED',`${p}.power`,'AURA powerは0より大きい有限数が必要です');
 if(own(effect,'duration'))err(errors,'AURA_DURATION_FORBIDDEN',`${p}.duration`,'source-dependent AURAにdurationは指定できません');
 if(own(effect,'stackGain'))err(errors,'AURA_STACK_GAIN_FORBIDDEN',`${p}.stackGain`,'R04-D1 AURAはhighest固定のためstackGainを指定できません');
 const targetSide=skill.target?.side==='ALLY'?'ally':skill.target?.side==='ENEMY'?'enemy':null;
 const targetScope=targetSide==='enemy'?'all':(skill.target?.excludeSelf===true?'allies_excluding_self':'self_and_allies');
 pushUnique(tags,`AURA_EFFECT=${def.kind}`);if(num(effect.power))pushUnique(tags,`AURA_VALUE=${effect.power}`);pushUnique(tags,`AURA_TARGET=${targetSide||''}`);pushUnique(tags,`AURA_SCOPE=${targetScope}`);pushUnique(tags,'AURA_STACK=highest');
 const priority=Number.isInteger(skill.trigger?.priority)?skill.trigger.priority:0;pushUnique(tags,`AURA_PRIORITY=${priority}`);pushUnique(tags,stat);
 const normalized={type:'APPLY',effectId:effect.effectId,kind:def.kind,power:effect.power,duration:null,sourceDependent:true,stack:'highest'};normalizedEffects.push(normalized);
 return{effectId:effect.effectId,kind:def.kind,logic:'AURA',modifierStat:stat,power:effect.power,targetSide,targetScope,stack:'highest',sourceDependent:true};
}

function compileEffect(effect,index,registry,tags,errors,warnings,normalizedEffects,effectContracts,applyContracts){
 const p=`effects[${index}]`;if(!effect||typeof effect!=='object'){err(errors,'INVALID_EFFECT',p,'Effect objectが必要です');return}
 const type=String(effect.type||'').toUpperCase();
 if(!registry.runtime?.effects?.includes(type)){err(errors,'UNKNOWN_EFFECT_TYPE',`${p}.type`,`未定義Effect type: ${type||'(なし)'}`);return}
 if(!registry.runtime?.legacy_adapter_supported?.includes(type)){err(errors,'LEGACY_EFFECT_UNSUPPORTED',`${p}.type`,`R02 Legacy Adapter未対応Effect: ${type}`);return}
 if(type==='DAMAGE'){
  pushUnique(tags,'ATTACK');addNumeric(tags,'DAMAGE',effect.power,errors,`${p}.power`);if(effect.damageType){const t=registry.damage_types?.[effect.damageType];if(!t)err(errors,'UNKNOWN_DAMAGE_TYPE',`${p}.damageType`,`未定義damageType: ${effect.damageType}`);else pushUnique(tags,t)}const normalized={type:'DAMAGE',power:effect.power,damageType:effect.damageType||null};normalizedEffects.push(normalized);effectContracts.push({...normalized});return;
 }
 if(type==='HEAL'){pushUnique(tags,'HEAL');addNumeric(tags,'HEAL',effect.power,errors,`${p}.power`);const normalized={type:'HEAL',power:effect.power};normalizedEffects.push(normalized);effectContracts.push({...normalized});return}
 if(type==='REVIVE'){
  pushUnique(tags,'REVIVE');const hasHp=own(effect,'hp'),hasRate=own(effect,'hpRate');if(hasHp===hasRate){err(errors,'REVIVE_VALUE_REQUIRED',p,'REVIVEはhpまたはhpRateのどちらか1つが必要です');return}if(hasHp)addNumeric(tags,'REVIVE_HP',effect.hp,errors,`${p}.hp`);else addNumeric(tags,'REVIVE_HP_RATE',effect.hpRate,errors,`${p}.hpRate`);const normalized={type:'REVIVE',hp:hasHp?effect.hp:null,hpRate:hasRate?effect.hpRate:null};normalizedEffects.push(normalized);effectContracts.push({...normalized});return;
 }
 if(type==='REMOVE'){
  if(effect.category!=='STATUS'){err(errors,'REMOVE_CATEGORY_UNSUPPORTED',`${p}.category`,'R02 REMOVEはSTATUSのみ対応です');return}pushUnique(tags,'CLEANSE');pushUnique(tags,'CLEANSE_CATEGORY=status');pushUnique(tags,'CLEANSE_ORDER=oldest');if(effect.all===true)pushUnique(tags,'CLEANSE_ALL');else{if(!Number.isInteger(effect.count)||effect.count<1)err(errors,'REMOVE_COUNT_REQUIRED',`${p}.count`,'REMOVEはcount>=1またはall=trueが必要です');else pushUnique(tags,`CLEANSE_COUNT=${effect.count}`)}const normalized={type:'REMOVE',category:'STATUS',count:effect.all===true?null:effect.count,all:effect.all===true,order:'oldest'};normalizedEffects.push(normalized);effectContracts.push({...normalized});return;
 }
 if(type==='RESOURCE_CHANGE'){
  const resource=String(effect.resource||'').toUpperCase();if(resource!=='MP'){err(errors,'RESOURCE_CHANGE_RESOURCE_UNSUPPORTED',`${p}.resource`,'R05-E RESOURCE_CHANGEはMPのみ対応です');return}if(!Number.isFinite(effect.amount)||effect.amount===0){err(errors,'RESOURCE_CHANGE_AMOUNT_INVALID',`${p}.amount`,'amountは0以外の有限数が必要です');return}pushUnique(tags,'RESOURCE_CHANGE');const normalized={type:'RESOURCE_CHANGE',resource:'MP',amount:effect.amount};normalizedEffects.push(normalized);effectContracts.push({...normalized});return;
 }
 if(type==='APPLY')compileApply(effect,p,registry,tags,errors,warnings,normalizedEffects,applyContracts);
}
function compileApply(effect,p,registry,tags,errors,warnings,normalizedEffects,applyContracts){
 const def=registry.effects?.[effect.effectId];if(!def){err(errors,'UNKNOWN_EFFECT_ID',`${p}.effectId`,`未定義Effect ID: ${effect.effectId||'(なし)'}`);return}
 const kind=def.kind,legacy=def.legacy||{},defaults=def.defaults||{},lifecycle=resolveLifecycle(def,registry,errors,`${p}.effectId.lifecycle`);pushUnique(tags,legacy.logic);
 for(const t of legacy.generalTags||[])pushUnique(tags,t);
 const normalized={type:'APPLY',effectId:effect.effectId,kind,lifecycle,power:own(effect,'power')?effect.power:null,duration:own(effect,'duration')?effect.duration:null,interval:own(effect,'interval')?effect.interval:(own(defaults,'interval')?defaults.interval:null),stackGain:own(effect,'stackGain')?effect.stackGain:(own(defaults,'stackGain')?defaults.stackGain:null)};
 const statusId=legacy.statusId||effect.effectId,statusPayload={...((legacy.generalTags||[]).includes('ACTION_DISABLED=true')?{action_disabled:true}:{}),...(statusId==='STATUS-ACCURACY-DOWN'?{accuracy_modifier:-20}:{})};
 const values={power:normalized.power,duration:normalized.duration,interval:normalized.interval,stackGain:normalized.stackGain,statusId,modifierStat:legacy.modifierStat||null,statusPayload};
 normalizedEffects.push(normalized);applyContracts.push({effectId:effect.effectId,kind,logic:legacy.logic,values,lifecycle:{...lifecycle}});
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
