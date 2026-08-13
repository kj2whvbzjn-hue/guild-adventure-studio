/* GKS Formal Skill Compiler.
 * Compiles the formal Skill authoring model directly to runtimeContracts.
 * This module does not generate tag skills and has no compatibility compiler path.
 */
(function(root){
'use strict';
const VERSION='FORMAL-SKILL-1';
const SUPPORTED_SCHEMA=1;
const OPS=new Set(['=','!=','>','>=','<','<=']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const num=v=>typeof v==='number'&&Number.isFinite(v);
const error=(errors,code,path,message)=>errors.push({code,path,message});
function validateConditionValue(def,value,errors,path){
 if(!num(value)){error(errors,'INVALID_CONDITION_VALUE',path,'条件値は有限数が必要です');return}
 if(def?.value_type==='rate'&&(value<0||value>1))error(errors,'INVALID_CONDITION_RATE',path,'割合条件は0以上1以下が必要です');
 if(def?.value_type==='non_negative_integer'&&(!Number.isInteger(value)||value<0))error(errors,'INVALID_CONDITION_INTEGER',path,'0以上の整数が必要です');
}
function resolveLifecycle(def,registry,errors,path){
 const model=registry?.apply_model,lifecycle=def?.lifecycle;
 if(!model||!lifecycle||typeof lifecycle!=='object'){error(errors,'EFFECT_LIFECYCLE_REQUIRED',path,'APPLY Effectにはlifecycle定義が必要です');return null}
 const req=Array.isArray(model.required_lifecycle_fields)?model.required_lifecycle_fields:[];
 for(const key of req)if(!own(lifecycle,key)||lifecycle[key]==null||lifecycle[key]==='')error(errors,'EFFECT_LIFECYCLE_FIELD_REQUIRED',`${path}.${key}`,`lifecycle.${key}が必要です`);
 const checks=[['stackRule','stack_rules'],['refreshRule','refresh_rules'],['snapshotPolicy','snapshot_policies'],['dispelCategory','dispel_categories'],['effectiveRule','effective_rules'],['consumeRule','consume_rules']];
 for(const [key,listKey] of checks){const allowed=model[listKey];if(Array.isArray(allowed)&&own(lifecycle,key)&&!allowed.includes(lifecycle[key]))error(errors,'EFFECT_LIFECYCLE_VALUE_INVALID',`${path}.${key}`,`未定義lifecycle値: ${lifecycle[key]}`)}
 for(const key of ['removeOnDeath','removeOnBattleEnd','removable'])if(own(lifecycle,key)&&typeof lifecycle[key]!=='boolean')error(errors,'EFFECT_LIFECYCLE_BOOLEAN_INVALID',`${path}.${key}`,`lifecycle.${key}はbooleanが必要です`);
 if(own(lifecycle,'maxStacks')&&(!Number.isInteger(lifecycle.maxStacks)||lifecycle.maxStacks<1))error(errors,'EFFECT_LIFECYCLE_MAX_STACKS_INVALID',`${path}.maxStacks`,'maxStacksは1以上の整数が必要です');
 return {...lifecycle};
}
function buildTriggerContract(skill,def){
 return{
  type:String(skill?.trigger?.type||'ON_USE').toUpperCase(),
  scope:String(skill?.trigger?.scope||'SELF').toUpperCase(),
  engineEvent:String(def?.engine_event||''),
  dispatchMode:String(def?.dispatch_mode||'RESOLVE_ONLY'),
  priority:Number.isInteger(skill?.trigger?.priority)?skill.trigger.priority:0
 };
}
function validateTrigger(skill,def,errors){
 const trigger=String(skill?.trigger?.type||'').toUpperCase(),contract=def?.runtime_contract||{};
 if(!def)return;
 if(def.enabled===false)error(errors,'TRIGGER_DISABLED','trigger.type',`無効Trigger: ${trigger}`);
 const allowed=def.allowed_scopes||[];
 if(allowed.length&&!allowed.includes(String(skill?.trigger?.scope||'SELF').toUpperCase()))error(errors,'TRIGGER_SCOPE_UNSUPPORTED','trigger.scope',`${trigger}のscopeが未対応です`);
 if(trigger==='ON_HIT_RECEIVED'){
  if(skill.target?.side!==contract.target_side)error(errors,'COUNTER_TARGET_SIDE_REQUIRED','target.side',`COUNTERは${contract.target_side}対象が必要です`);
  if(skill.target?.range!==contract.target_range)error(errors,'COUNTER_TARGET_RANGE_REQUIRED','target.range',`COUNTERは${contract.target_range}範囲が必要です`);
  if(!(skill.effects||[]).some(e=>String(e?.type||'').toUpperCase()===String(contract.requires_effect||'DAMAGE').toUpperCase()))error(errors,'COUNTER_DAMAGE_EFFECT_REQUIRED','effects','ON_HIT_RECEIVEDにはDAMAGE Effectが必要です');
 }
 if(trigger==='ON_ALLY_ATTACK'){
  if(skill.target?.side!==contract.target_side)error(errors,'FOLLOW_UP_TARGET_SIDE_REQUIRED','target.side',`FOLLOW_UPは${contract.target_side}対象が必要です`);
  if(skill.target?.range!==contract.target_range)error(errors,'FOLLOW_UP_TARGET_RANGE_REQUIRED','target.range',`FOLLOW_UPは${contract.target_range}範囲が必要です`);
  if(!(skill.effects||[]).some(e=>String(e?.type||'').toUpperCase()===String(contract.requires_effect||'DAMAGE').toUpperCase()))error(errors,'FOLLOW_UP_DAMAGE_EFFECT_REQUIRED','effects','ON_ALLY_ATTACKにはDAMAGE Effectが必要です');
  if(!(skill.conditions||[]).some(c=>String(c?.property||'').toUpperCase()===String(contract.requires_condition||'TARGET_POISONED').toUpperCase()))error(errors,'FOLLOW_UP_CONDITION_REQUIRED','conditions',`ON_ALLY_ATTACKには${contract.requires_condition||'TARGET_POISONED'} Conditionが必要です`);
 }
 if(trigger==='WHILE_SOURCE_ALIVE'){
  if(Array.isArray(contract.target_sides)&&!contract.target_sides.includes(skill.target?.side))error(errors,'AURA_TARGET_SIDE_REQUIRED','target.side','AURAは許可されたsideが必要です');
  if(contract.target_range&&skill.target?.range!==contract.target_range)error(errors,'AURA_TARGET_RANGE_REQUIRED','target.range',`AURAは${contract.target_range}範囲が必要です`);
  if(skill.target?.excludeSelf===true&&skill.target?.side!=='ALLY')error(errors,'AURA_EXCLUDE_SELF_INVALID','target.excludeSelf','excludeSelfはALLY AURAのみ対応です');
  if(skill.conditions?.length)error(errors,'AURA_CONDITION_UNSUPPORTED','conditions','AURA Conditionは正式契約未定義です');
 }
}
function compileApply(effect,path,registry,errors){
 const def=registry.effects?.[effect.effectId];
 if(!def){error(errors,'UNKNOWN_EFFECT_ID',`${path}.effectId`,`未定義Effect ID: ${effect.effectId||'(なし)'}`);return null}
 const kind=String(def.kind||''),runtime=def.runtime||{},defaults=def.defaults||{},lifecycle=resolveLifecycle(def,registry,errors,`${path}.effectId.lifecycle`);
 const power=own(effect,'power')?effect.power:null,duration=own(effect,'duration')?effect.duration:null;
 const interval=own(effect,'interval')?effect.interval:(own(defaults,'interval')?defaults.interval:null);
 const stackGain=own(effect,'stackGain')?effect.stackGain:(own(defaults,'stackGain')?defaults.stackGain:null);
 if(kind==='STATUS'&&(!Number.isInteger(duration)||duration<=0))error(errors,'APPLY_DURATION_REQUIRED',`${path}.duration`,'STATUS付与には正の整数durationが必要です');
 if(kind==='DOT'){
  if(!num(power))error(errors,'APPLY_POWER_REQUIRED',`${path}.power`,'DOT powerは有限数が必要です');
  if(!num(duration))error(errors,'APPLY_DURATION_REQUIRED',`${path}.duration`,'DOT durationは有限数が必要です');
  if(!num(interval))error(errors,'APPLY_INTERVAL_REQUIRED',`${path}.interval`,'DOT intervalは有限数が必要です');
  if(!num(stackGain))error(errors,'APPLY_STACK_GAIN_REQUIRED',`${path}.stackGain`,'DOT stackGainは有限数が必要です');
 }
 if(kind==='BUFF'||kind==='DEBUFF'){
  if(!runtime.modifierStat)error(errors,'MODIFIER_STAT_MISSING',`${path}.effectId`,'Effect RegistryにmodifierStatが必要です');
  if(!num(power))error(errors,'APPLY_POWER_REQUIRED',`${path}.power`,`${kind} powerは有限数が必要です`);
  if(!num(duration))error(errors,'APPLY_DURATION_REQUIRED',`${path}.duration`,`${kind} durationは有限数が必要です`);
 }
 if(kind==='SHIELD'){
  if(!num(power))error(errors,'APPLY_POWER_REQUIRED',`${path}.power`,'SHIELD powerは有限数が必要です');
  if(!num(duration))error(errors,'APPLY_DURATION_REQUIRED',`${path}.duration`,'SHIELD durationは有限数が必要です');
 }
 return{
  effectId:String(effect.effectId),kind,logic:String(runtime.logic||kind),
  values:{power,duration,interval,stackGain,statusId:String(runtime.statusId||effect.effectId),modifierStat:runtime.modifierStat||null,statusPayload:{...(runtime.statusPayload||{})}},
  lifecycle:lifecycle?{...lifecycle}:null
 };
}

function compileAuraEffect(effect,path,skill,registry,errors){
 if(!effect||typeof effect!=='object'||String(effect.type||'').toUpperCase()!=='APPLY'){
  error(errors,'AURA_APPLY_EFFECT_REQUIRED',`${path}.type`,'WHILE_SOURCE_ALIVEにはAPPLY Effectが必要です');return null;
 }
 const def=registry.effects?.[effect.effectId];
 if(!def){error(errors,'UNKNOWN_EFFECT_ID',`${path}.effectId`,`未定義Effect ID: ${effect.effectId||'(なし)'}`);return null}
 const kind=String(def.kind||'').toUpperCase(),runtime=def.runtime||{};
 if(!['BUFF','DEBUFF'].includes(kind)){error(errors,'AURA_EFFECT_KIND_UNSUPPORTED',`${path}.effectId`,'AURAはBUFF/DEBUFF Effectのみ対応です');return null}
 if(!runtime.modifierStat){error(errors,'MODIFIER_STAT_MISSING',`${path}.effectId`,'AURA EffectにmodifierStatが必要です');return null}
 if(!num(effect.power)){error(errors,'AURA_POWER_REQUIRED',`${path}.power`,'AURA powerは有限数が必要です');return null}
 const side=String(skill?.target?.side||'').toUpperCase();
 const targetSide=side==='ALLY'?'ally':side==='ENEMY'?'enemy':'';
 if(!targetSide){error(errors,'AURA_TARGET_SIDE_REQUIRED','target.side','AURA target.sideはALLYまたはENEMYが必要です');return null}
 const excludeSelf=skill?.target?.excludeSelf===true;
 const targetScope=targetSide==='enemy'?'all':excludeSelf?'allies_excluding_self':'self_and_allies';
 return{
  effectId:String(effect.effectId),kind,logic:'AURA',modifierStat:String(runtime.modifierStat),
  power:effect.power,targetSide,targetScope,stack:'highest',
  priority:Number.isInteger(skill?.trigger?.priority)?skill.trigger.priority:0,sourceDependent:true
 };
}

function compileEffect(effect,index,skill,registry,errors){
 const path=`effects[${index}]`;
 if(!effect||typeof effect!=='object'){error(errors,'INVALID_EFFECT',path,'Effect objectが必要です');return null}
 const type=String(effect.type||'').toUpperCase();
 if(!registry.runtime?.effects?.includes(type)){error(errors,'UNKNOWN_EFFECT_TYPE',`${path}.type`,`未定義Effect type: ${type||'(なし)'}`);return null}
 if(type==='SPECIAL'){error(errors,'SPECIAL_NOT_EXECUTABLE',`${path}.type`,'SPECIALは正式Runtime契約未定義です');return null}
 if(type==='DAMAGE'){
  if(!num(effect.power))error(errors,'DAMAGE_POWER_REQUIRED',`${path}.power`,'DAMAGE powerは有限数が必要です');
  if(effect.damageType&&!registry.damage_types?.[effect.damageType])error(errors,'UNKNOWN_DAMAGE_TYPE',`${path}.damageType`,`未定義damageType: ${effect.damageType}`);
  return{type,power:effect.power,damageType:effect.damageType||null};
 }
 if(type==='HEAL'){if(!num(effect.power))error(errors,'HEAL_POWER_REQUIRED',`${path}.power`,'HEAL powerは有限数が必要です');return{type,power:effect.power}}
 if(type==='REVIVE'){
  const hasHp=own(effect,'hp'),hasRate=own(effect,'hpRate');
  if(hasHp===hasRate)error(errors,'REVIVE_VALUE_REQUIRED',path,'REVIVEはhpまたはhpRateのどちらか1つが必要です');
  return{type,hp:hasHp?effect.hp:null,hpRate:hasRate?effect.hpRate:null};
 }
 if(type==='REMOVE'){
  if(effect.category!=='STATUS')error(errors,'REMOVE_CATEGORY_UNSUPPORTED',`${path}.category`,'REMOVEはSTATUSのみ対応です');
  if(effect.all!==true&&(!Number.isInteger(effect.count)||effect.count<1))error(errors,'REMOVE_COUNT_REQUIRED',`${path}.count`,'REMOVEはcount>=1またはall=trueが必要です');
  return{type,category:'STATUS',count:effect.all===true?null:effect.count,all:effect.all===true,order:'oldest'};
 }
 if(type==='RESOURCE_CHANGE'){
  const resource=String(effect.resource||'').toUpperCase();
  if(resource!=='MP')error(errors,'RESOURCE_CHANGE_RESOURCE_UNSUPPORTED',`${path}.resource`,'RESOURCE_CHANGEはMPのみ対応です');
  if(!num(effect.amount)||effect.amount===0)error(errors,'RESOURCE_CHANGE_AMOUNT_INVALID',`${path}.amount`,'amountは0以外の有限数が必要です');
  return{type,resource,amount:effect.amount};
 }
 if(type==='TARGET_CONTROL'){
  const mode=String(effect.mode||'COVER').toUpperCase(),trigger=String(effect.trigger||'DIRECT_ATTACK').toUpperCase(),lifetime=String(effect.lifetime||'PERSISTENT').toUpperCase();
  if(mode!=='COVER')error(errors,'TARGET_CONTROL_MODE_UNSUPPORTED',`${path}.mode`,'TARGET_CONTROLはCOVERのみ対応です');
  if(trigger!=='DIRECT_ATTACK')error(errors,'TARGET_CONTROL_TRIGGER_UNSUPPORTED',`${path}.trigger`,'TARGET_CONTROLはDIRECT_ATTACKのみ対応です');
  if(skill?.target?.side!=='ALLY')error(errors,'TARGET_CONTROL_TARGET_SIDE_REQUIRED','target.side','TARGET_CONTROL COVERはALLY対象が必要です');
  if(!['SINGLE','ALL'].includes(skill?.target?.range))error(errors,'TARGET_CONTROL_TARGET_RANGE_UNSUPPORTED','target.range','TARGET_CONTROL COVERはSINGLEまたはALLが必要です');
  const uses=lifetime==='USES'?effect.uses:null,duration=lifetime==='DURATION'?effect.duration:null;
  if(lifetime==='USES'&&(!Number.isInteger(uses)||uses<1))error(errors,'TARGET_CONTROL_USES_INVALID',`${path}.uses`,'USESには1以上の整数usesが必要です');
  if(lifetime==='DURATION'&&(!Number.isInteger(duration)||duration<1))error(errors,'TARGET_CONTROL_DURATION_INVALID',`${path}.duration`,'DURATIONには1以上の整数durationが必要です');
  return{type,mode,trigger,priority:effect.priority??0,removable:effect.removable,lifetime,uses,duration};
 }
 if(type==='APPLY')return null;
 return null;
}
function compileSkill(skill,registry){
 const errors=[],warnings=[],conditionContracts=[],effectContracts=[],applyContracts=[];
 registry=registry&&typeof registry==='object'?registry:null;
 if(!registry){error(errors,'REGISTRY_REQUIRED','registry','Skill Registryが必要です');return finish()}
 if(!skill||typeof skill!=='object'||Array.isArray(skill)){error(errors,'INVALID_SKILL','$','Skill objectが必要です');return finish()}
 if(skill.schemaVersion!==SUPPORTED_SCHEMA)error(errors,'UNSUPPORTED_SCHEMA','schemaVersion',`schemaVersion=${skill.schemaVersion}は未対応です`);
 if(typeof skill.id!=='string'||!skill.id.trim())error(errors,'ID_REQUIRED','id','idが必要です');
 if(typeof skill.name!=='string'||!skill.name.trim())error(errors,'NAME_REQUIRED','name','nameが必要です');
 const trigger=String(skill.trigger?.type||'').toUpperCase(),triggerDef=registry.triggers?.[trigger];
 if(!triggerDef)error(errors,'UNKNOWN_TRIGGER','trigger.type',`未定義Trigger: ${trigger||'(なし)'}`);else validateTrigger(skill,triggerDef,errors);
 if(!registry.targets?.sides?.[skill.target?.side])error(errors,'UNKNOWN_TARGET_SIDE','target.side',`未定義対象: ${skill.target?.side||'(なし)'}`);
 if(!registry.targets?.ranges?.[skill.target?.range])error(errors,'UNKNOWN_TARGET_RANGE','target.range',`未定義範囲: ${skill.target?.range||'(なし)'}`);
 if(skill.target?.range==='RANDOM'&&(!Number.isInteger(skill.target?.randomCount)||skill.target.randomCount<1))error(errors,'RANDOM_COUNT_REQUIRED','target.randomCount','RANDOMには1以上のrandomCountが必要です');
 for(const [i,c] of (Array.isArray(skill.conditions)?skill.conditions:[]).entries()){
  const path=`conditions[${i}]`,def=registry.conditions?.[c?.property];
  if(!def){error(errors,'UNKNOWN_CONDITION',`${path}.property`,`未定義Condition: ${c?.property||'(なし)'}`);continue}
  if(def.value_type==='predicate'){
   const scope=String(c.scope||def.scope||'TARGET').toUpperCase();
   if(def.scope&&scope!==String(def.scope).toUpperCase())error(errors,'CONDITION_SCOPE_UNSUPPORTED',`${path}.scope`,`${c.property}は${def.scope} scopeが必要です`);
   if(c.value!=null&&c.value!==true)error(errors,'PREDICATE_EXPECTED_TRUE',`${path}.value`,`${c.property} predicateはtrueのみ対応です`);
   if(c.operator!=null&&c.operator!=='=')error(errors,'PREDICATE_OPERATOR_UNSUPPORTED',`${path}.operator`,`${c.property} predicateは=のみ対応です`);
   conditionContracts.push({property:String(c.property),scope,enginePredicate:String(def.engine_predicate||''),expected:true});continue;
  }
  if(c.scope&&c.scope!=='SELF')error(errors,'CONDITION_SCOPE_UNSUPPORTED',`${path}.scope`,`数値条件はSELFのみ対応です: ${c.scope}`);
  if(!OPS.has(c.operator)){error(errors,'UNKNOWN_OPERATOR',`${path}.operator`,`未対応比較演算子: ${c.operator||'(なし)'}`);continue}
  validateConditionValue(def,c.value,errors,`${path}.value`);
  conditionContracts.push({property:String(c.property),scope:String(c.scope||'SELF').toUpperCase(),operator:c.operator,value:c.value});
 }
 const effects=Array.isArray(skill.effects)?skill.effects:[];
 let auraEffectContract=null;
 if(!effects.length)error(errors,'EFFECT_REQUIRED','effects','effectsが1件以上必要です');
 if(trigger==='WHILE_SOURCE_ALIVE'){
  if(effects.length!==1)error(errors,'AURA_SINGLE_EFFECT_REQUIRED','effects','WHILE_SOURCE_ALIVEはAPPLY Effectを1件だけ指定してください');
  if(effects[0])auraEffectContract=compileAuraEffect(effects[0],'effects[0]',skill,registry,errors);
 }else for(const [i,effect] of effects.entries()){
  if(String(effect?.type||'').toUpperCase()==='APPLY'){const c=compileApply(effect,`effects[${i}]`,registry,errors);if(c)applyContracts.push(c)}
  else{const c=compileEffect(effect,i,skill,registry,errors);if(c)effectContracts.push(c)}
 }
 const res=skill.resource||{};
 if(own(res,'mpCost')&&!num(res.mpCost))error(errors,'INVALID_MP_COST','resource.mpCost','mpCostは有限数が必要です');
 if(own(res,'cooldown')&&(!Number.isInteger(res.cooldown)||res.cooldown<0))error(errors,'INVALID_COOLDOWN','resource.cooldown','cooldownは0以上の整数が必要です');
 if(own(res,'activationPriority')&&!Number.isInteger(res.activationPriority))error(errors,'INVALID_ACTIVATION_PRIORITY','resource.activationPriority','activationPriorityは整数が必要です');
 return finish();
 function finish(){
  const runtimeContracts={
   schemaVersion:1,registryPhase:String(registry?.phase||''),triggerContract:buildTriggerContract(skill,triggerDef),
   targetContract:{side:String(skill?.target?.side||''),range:String(skill?.target?.range||''),randomCount:skill?.target?.randomCount??null,excludeSelf:skill?.target?.excludeSelf===true},
   conditionContracts:[...conditionContracts],effectContracts:[...effectContracts],applyContracts:applyContracts.map(c=>({...c,lifecycle:c.lifecycle?{...c.lifecycle}:null})),auraEffectContract:auraEffectContract?{...auraEffectContract}:null,
   resourceContract:{mpCost:skill?.resource?.mpCost??0,cooldown:skill?.resource?.cooldown??0,activationPriority:skill?.resource?.activationPriority??0}
  };
  const compiledSkill={schemaVersion:SUPPORTED_SCHEMA,id:String(skill?.id||''),name:String(skill?.name||''),skillLevel:skill?.skillLevel??null,trigger:skill?.trigger?{...skill.trigger}:null,conditions:Array.isArray(skill?.conditions)?skill.conditions.map(x=>({...x})):[],target:skill?.target?{...skill.target}:null,effects:Array.isArray(skill?.effects)?skill.effects.map(x=>({...x})):[],resource:skill?.resource?{...skill.resource}:{},runtimeContracts};
  return{ok:errors.length===0,version:VERSION,errors,warnings,compiledSkill};
 }
}
const api=Object.freeze({VERSION,SUPPORTED_SCHEMA,compileSkill});
root.GKSSkillCompiler=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
