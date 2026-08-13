/* Validation-only Tag Skill compiler. Isolated from Production Runtime in GA-B486.134. */
(function(global){
'use strict';
const TAG_LOGIC_ORDER=['COVER','COUNTER','ATTACK','DOT','FOLLOW_UP','HEAL','HOT','BUFF','DEBUFF','AURA','SHIELD','STATUS','CLEANSE','RESOURCE_CHANGE','SUMMON','DISPEL','REVIVE'];
const TAG_COMBAT_MODIFIER_PARAMS=['ATK','DEF','MAGIC_WEAPON_BONUS','STATUS_RESIST']; // 戦闘パラメータ。閾値ステータス(STR/VIT/AGI/DEX/INT/MND/LUK)とは別系統
const TAG_CONDITION_KEYS=['CONDITION_SELF_HP','CONDITION_SELF_HP_RATE','CONDITION_SELF_MP','CONDITION_SELF_MP_RATE','CONDITION_ENEMY_COUNT','CONDITION_ALLY_COUNT','CONDITION_BATTLE_TICK'];
function normalizeGeneralTag(tag){return String(tag??'').trim()}
function parseSkillTags(skill){
 const generalTags=new Set(),numericTags={},errors=[];
 for(const raw of Array.isArray(skill?.tags)?skill.tags:[]){
  if(typeof raw!=='string'){errors.push(`文字列ではないタグ: ${JSON.stringify(raw)}`);continue}
  const tag=raw.trim();
  const m=tag.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if(m){
   const key=m[1].toUpperCase();
   if(numericTags[key])errors.push(`数値タグ重複: ${key}`);
   numericTags[key]={operator:m[2],value:Number(m[3]),raw:tag};
  }else if(tag){generalTags.add(normalizeGeneralTag(tag))}
 }
 return{generalTags,numericTags,errors};
}
function hasAnyTag(set,candidates){return candidates.some(x=>set.has(x))}
function normalizeRuntimeContracts(skill,g,n,errors){
 const raw=skill?.runtimeContracts;if(raw==null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)){errors.push('runtimeContractsはobjectが必要です');return null}
 if(raw.schemaVersion!==1){errors.push(`runtimeContracts.schemaVersion=${raw.schemaVersion}は未対応です`);return null}
 if(!Array.isArray(raw.applyContracts)){errors.push('runtimeContracts.applyContractsは配列が必要です');return null}
 const conditionContracts=Array.isArray(raw.conditionContracts)?raw.conditionContracts:[];
 let triggerContract=null;
 if(raw.triggerContract!=null){
  const c=raw.triggerContract;
  if(!c||typeof c!=='object'||Array.isArray(c))errors.push('runtimeContracts.triggerContractはobjectが必要です');
  else{
   const type=String(c.type||'').toUpperCase(),scope=String(c.scope||'').toUpperCase(),engineEvent=String(c.engineEvent||''),dispatchMode=String(c.dispatchMode||'');
   if(!type)errors.push('runtimeContracts.triggerContract.typeが必要です');
   if(scope!=='SELF')errors.push('runtimeContracts.triggerContract.scopeはSELFが必要です');
   if(type==='ON_HIT_RECEIVED'){if(engineEvent!=='hit_received')errors.push('ON_HIT_RECEIVEDのengineEventはhit_receivedが必要です');if(dispatchMode!=='COUNTER')errors.push('ON_HIT_RECEIVEDのdispatchModeはCOUNTERが必要です');if(!g.has('COUNTER'))errors.push('ON_HIT_RECEIVED契約にはCOUNTERタグが必要です')}
   else if(type==='ON_ALLY_ATTACK'){if(engineEvent!=='ally_attack')errors.push('ON_ALLY_ATTACKのengineEventはally_attackが必要です');if(dispatchMode!=='FOLLOW_UP')errors.push('ON_ALLY_ATTACKのdispatchModeはFOLLOW_UPが必要です');if(!g.has('FOLLOW_UP'))errors.push('ON_ALLY_ATTACK契約にはFOLLOW_UPタグが必要です')}
   else if(type==='WHILE_SOURCE_ALIVE'){if(engineEvent!=='aura_evaluate')errors.push('WHILE_SOURCE_ALIVE engineEventはaura_evaluateが必要です');if(dispatchMode!=='AURA')errors.push('WHILE_SOURCE_ALIVE dispatchModeはAURAが必要です')}
   else if(type!=='ON_USE')errors.push(`runtimeContracts.triggerContract.typeは未対応です: ${type}`);
   triggerContract={type,scope,engineEvent,dispatchMode,priority:Number.isInteger(c.priority)?c.priority:0};
  }
 }else if(g.has('COUNTER')){
  triggerContract={type:'ON_HIT_RECEIVED',scope:'SELF',engineEvent:'hit_received',dispatchMode:'COUNTER',priority:Number.isInteger(n?.COUNTER_PRIORITY?.value)?n.COUNTER_PRIORITY.value:0,migratedFromTagSkill:true};
 }else triggerContract={type:'ON_USE',scope:'SELF',engineEvent:'use',dispatchMode:'RESOLVE_ONLY',priority:0,migratedFromTagSkill:true};
 const effectContracts=[];
 for(const [i,c] of (Array.isArray(raw.effectContracts)?raw.effectContracts:[]).entries()){
  if(!c||typeof c!=='object'||Array.isArray(c)){errors.push(`runtimeContracts.effectContracts[${i}]はobjectが必要です`);continue}
  const type=String(c.type||'').toUpperCase(),damageType=c.damageType==null?null:String(c.damageType).toUpperCase();
  if(type==='SPECIAL'){errors.push(`runtimeContracts.effectContracts[${i}].SPECIALはR05-H境界外です`);continue}
  if(!['DAMAGE','HEAL','REMOVE','RESOURCE_CHANGE','REVIVE','TARGET_CONTROL'].includes(type)){errors.push(`runtimeContracts.effectContracts[${i}].typeが未対応です: ${type||'(なし)'}`);continue}
  if(['DAMAGE','HEAL'].includes(type)&&(!Number.isFinite(c.power)||c.power<0)){errors.push(`runtimeContracts.effectContracts[${i}].powerは0以上の有限数が必要です`);continue}
  if(type==='DAMAGE'&&damageType!=null&&!['PHYSICAL','MAGICAL','FIXED'].includes(damageType)){errors.push(`runtimeContracts.effectContracts[${i}].damageTypeが無効です: ${damageType}`);continue}
  if(type==='HEAL'&&damageType!=null){errors.push(`runtimeContracts.effectContracts[${i}].damageTypeはHEALで指定できません`);continue}
  if(effectContracts.some(x=>x.type===type)){errors.push(`runtimeContracts.effectContractsで${type}を複数指定できません`);continue}
  if(type==='REVIVE'){const hasHp=c.hp!=null,hasRate=c.hpRate!=null;if(hasHp===hasRate||(hasHp&&(!Number.isFinite(c.hp)||c.hp<1))||(hasRate&&(!Number.isFinite(c.hpRate)||c.hpRate<=0||c.hpRate>1))){errors.push(`runtimeContracts.effectContracts[${i}]のREVIVE契約が無効です`);continue}effectContracts.push({type,hp:hasHp?c.hp:null,hpRate:hasRate?c.hpRate:null});}else if(type==='REMOVE'){if(String(c.category||'').toUpperCase()!=='STATUS'||typeof c.all!=='boolean'||(!c.all&&(!Number.isInteger(c.count)||c.count<1))||String(c.order||'')!=='oldest'){errors.push(`runtimeContracts.effectContracts[${i}]のREMOVE契約が無効です`);continue}effectContracts.push({type,category:'STATUS',count:c.all?null:c.count,all:c.all,order:'oldest'});}else if(type==='RESOURCE_CHANGE'){if(String(c.resource||'').toUpperCase()!=='MP'||!Number.isFinite(c.amount)||c.amount===0){errors.push(`runtimeContracts.effectContracts[${i}]のRESOURCE_CHANGE契約が無効です`);continue}effectContracts.push({type,resource:'MP',amount:c.amount});}else if(type==='TARGET_CONTROL'){const mode=String(c.mode||'').toUpperCase(),trigger=String(c.trigger||'').toUpperCase(),lifetime=String(c.lifetime||'').toUpperCase();if(mode!=='COVER'||trigger!=='DIRECT_ATTACK'||!Number.isInteger(c.priority)||typeof c.removable!=='boolean'||!['PERSISTENT','USES','DURATION'].includes(lifetime)||(lifetime==='USES'&&(!Number.isInteger(c.uses)||c.uses<1))||(lifetime==='DURATION'&&(!Number.isInteger(c.duration)||c.duration<1))){errors.push(`runtimeContracts.effectContracts[${i}]のTARGET_CONTROL契約が無効です`);continue}effectContracts.push({type,mode:'COVER',trigger:'DIRECT_ATTACK',priority:c.priority,removable:c.removable,lifetime,uses:lifetime==='USES'?c.uses:null,duration:lifetime==='DURATION'?c.duration:null});}else effectContracts.push(type==='DAMAGE'?{type,power:c.power,damageType}:{type,power:c.power});
 }
 const normalizedConditions=[];
 for(const [i,c] of conditionContracts.entries()){
  if(!c||typeof c!=='object'||Array.isArray(c)){errors.push(`runtimeContracts.conditionContracts[${i}]はobjectが必要です`);continue}
  const property=String(c.property||'').toUpperCase(),scope=String(c.scope||'').toUpperCase(),enginePredicate=String(c.enginePredicate||'');
  if(property!=='TARGET_POISONED'){errors.push(`runtimeContracts.conditionContracts[${i}].propertyは未対応です: ${property||'(なし)'}`);continue}
  if(scope!=='TARGET')errors.push(`runtimeContracts.conditionContracts[${i}].scopeはTARGETが必要です`);
  if(enginePredicate!=='target_poisoned')errors.push(`runtimeContracts.conditionContracts[${i}].enginePredicateはtarget_poisonedが必要です`);
  if(c.expected!==true)errors.push(`runtimeContracts.conditionContracts[${i}].expectedはtrueが必要です`);
  if(!g.has('CONDITION_POISONED'))errors.push('TARGET_POISONED契約にはCONDITION_POISONEDタグが必要です');
  normalizedConditions.push({property,scope,enginePredicate,expected:true});
 }
 const out=[],seen=new Set();
 for(const [i,c] of raw.applyContracts.entries()){
  if(!c||typeof c!=='object'||Array.isArray(c)){errors.push(`runtimeContracts.applyContracts[${i}]はobjectが必要です`);continue}
  const logic=String(c.logic||''),effectId=String(c.effectId||''),kind=String(c.kind||'');
  if(!['STATUS','DOT','BUFF','DEBUFF','SHIELD'].includes(logic)){errors.push(`runtimeContracts.applyContracts[${i}].logicが無効です: ${logic||'(なし)'}`);continue}
  if(!effectId){errors.push(`runtimeContracts.applyContracts[${i}].effectIdが必要です`);continue}
  if(seen.has(logic)){errors.push(`runtimeContracts.applyContractsで同一logicを複数指定できません: ${logic}`);continue}seen.add(logic);
  if(!g.has(logic)){errors.push(`runtimeContracts.applyContractsの${logic}がスキルタグに存在しません`);continue}
  if(!c.lifecycle||typeof c.lifecycle!=='object'||Array.isArray(c.lifecycle)){errors.push(`runtimeContracts.applyContracts[${i}].lifecycleが必要です`);continue}
  for(const key of ['stackRule','refreshRule','snapshotPolicy','dispelCategory','removeOnDeath','removeOnBattleEnd','removable','effectiveRule','consumeRule'])if(c.lifecycle[key]==null||c.lifecycle[key]==='')errors.push(`runtimeContracts.applyContracts[${i}].lifecycle.${key}が必要です`);
  const values=c.values&&typeof c.values==='object'&&!Array.isArray(c.values)?{...c.values,statusPayload:{...(c.values.statusPayload||{})}}:null;
  out.push({effectId,kind,logic,values,lifecycle:{...c.lifecycle}});
 }
 for(const logic of ['STATUS','DOT','BUFF','DEBUFF','SHIELD'])if(g.has(logic)&&!seen.has(logic))errors.push(`正式APPLYには${logic}のlifecycle契約が必要です`);
 let auraEffectContract=null;
 if(raw.auraEffectContract!=null){const a=raw.auraEffectContract;if(!a||typeof a!=='object'||Array.isArray(a))errors.push('runtimeContracts.auraEffectContractはobjectが必要です');else{const kind=String(a.kind||'').toUpperCase(),logic=String(a.logic||'').toUpperCase();if(!['BUFF','DEBUFF'].includes(kind))errors.push(`runtimeContracts.auraEffectContract.kindが無効です: ${kind||'(なし)'}`);if(logic!=='AURA')errors.push('runtimeContracts.auraEffectContract.logicはAURAが必要です');if(!a.effectId)errors.push('runtimeContracts.auraEffectContract.effectIdが必要です');if(!a.modifierStat)errors.push('runtimeContracts.auraEffectContract.modifierStatが必要です');if(!Number.isFinite(a.power)||a.power<=0)errors.push('runtimeContracts.auraEffectContract.powerは正の有限数が必要です');if(!['ally','enemy'].includes(a.targetSide))errors.push('runtimeContracts.auraEffectContract.targetSideが無効です');if(!['all','self_and_allies','allies_excluding_self'].includes(a.targetScope))errors.push('runtimeContracts.auraEffectContract.targetScopeが無効です');if(a.stack!=='highest')errors.push('runtimeContracts.auraEffectContract.stackはhighestが必要です');if(a.sourceDependent!==true)errors.push('runtimeContracts.auraEffectContract.sourceDependentはtrueが必要です');auraEffectContract={...a,kind,logic}}}
 if(g.has('AURA')&&!auraEffectContract&&triggerContract?.type==='WHILE_SOURCE_ALIVE')errors.push('正式AURAにはauraEffectContractが必要です');
 return{schemaVersion:1,registryPhase:String(raw.registryPhase||''),triggerContract,conditionContracts:normalizedConditions,effectContracts,applyContracts:out,auraEffectContract};
}

function compileTaggedSkill(skill){
 const parsed=parseSkillTags(skill),errors=[...parsed.errors],warnings=[];
 const g=parsed.generalTags,n=parsed.numericTags;
 const runtimeContracts=normalizeRuntimeContracts(skill,g,n,errors);
 const structuredTargetControl=runtimeContracts?.effectContracts?.find(x=>x?.type==='TARGET_CONTROL')||null;
 const structuredShieldApply=runtimeContracts?.applyContracts?.find(x=>x?.logic==='SHIELD')||null;
 for(const [key,entry] of Object.entries(n)){if(!TAG_CONDITION_KEYS.includes(key)&&entry.operator!=='=')errors.push(`${key}は効果値のため比較演算子${entry.operator}を使用できません。固定値=を使用してください`)}
 for(const key of TAG_CONDITION_KEYS){const entry=n[key];if(!entry)continue;if(!Number.isFinite(entry.value))errors.push(`${key}の比較値が無効です`);if(key.endsWith('_RATE')&&(entry.value<0||entry.value>1))errors.push(`${key}は0以上1以下で指定してください`);if(['CONDITION_ENEMY_COUNT','CONDITION_ALLY_COUNT','CONDITION_BATTLE_TICK'].includes(key)&&(!Number.isInteger(entry.value)||entry.value<0))errors.push(`${key}は0以上の整数で指定してください`)}
 const logicOrder=TAG_LOGIC_ORDER.filter(x=>g.has(x));
 if(!logicOrder.length)errors.push('効果ロジックタグがありません');
 const isAura=g.has('AURA');
 if(!isAura&&!hasAnyTag(g,['自分','味方','敵','死体','地点']))errors.push('対象タグがありません');
 if(!isAura&&!hasAnyTag(g,['単体','全体','前列','後列','ランダム','貫通']))errors.push('範囲タグがありません');
 if(g.has('ランダム')&&!n.RANDOM_COUNT)errors.push('ランダムにはRANDOM_COUNTが必要です');
 if(g.has('ATTACK')&&!n.DAMAGE)errors.push('ATTACKにはDAMAGEが必要です');
 if(n.DAMAGE&&(!Number.isFinite(n.DAMAGE.value)||n.DAMAGE.value<0))errors.push('DAMAGEは0以上の有限数が必要です');
 if(g.has('HEAL')&&!n.HEAL)errors.push('HEALにはHEAL数値タグが必要です');
 if(n.HEAL&&(!Number.isFinite(n.HEAL.value)||n.HEAL.value<=0))errors.push('HEALは0より大きい有限数が必要です');
 if(g.has('HEAL')&&!hasAnyTag(g,['自分','味方']))errors.push('HEALの対象は自分または味方が必要です');
 if(g.has('SHIELD')&&!n.SHIELD)errors.push('SHIELDにはSHIELD数値タグが必要です');
 if(n.SHIELD&&(!Number.isFinite(n.SHIELD.value)||n.SHIELD.value<=0))errors.push('SHIELDは0より大きい有限数が必要です');
 if(g.has('SHIELD')&&!n.DURATION)errors.push('SHIELDにはDURATIONが必要です');
 if(g.has('SHIELD')&&n.DURATION&&(!Number.isFinite(n.DURATION.value)||n.DURATION.value<=0))errors.push('DURATIONは0より大きい有限数が必要です');
 if(g.has('SHIELD')&&!hasAnyTag(g,['自分','味方']))errors.push('SHIELDの対象は自分または味方が必要です');
 if(g.has('DOT')){
  for(const key of ['DOT_POWER','DOT_DURATION','DOT_INTERVAL','STACK_GAIN'])if(!n[key])errors.push(`DOTには${key}が必要です`);
  for(const key of ['DOT_POWER','DOT_DURATION','DOT_INTERVAL','STACK_GAIN']){const v=n[key]?.value;if(v!=null&&(!Number.isFinite(v)||v<=0))errors.push(`${key}は0より大きい有限数が必要です`)}
 }
 if(g.has('COVER')){
  const coverTarget=[...g].find(x=>x.startsWith('COVER_TARGET='))?.slice(13)||null;
  const coverTrigger=[...g].find(x=>x.startsWith('COVER_TRIGGER='))?.slice(14)||null;
  const coverRemovable=[...g].find(x=>x.startsWith('COVER_REMOVABLE='))?.slice(16)||null;
  const coverLifetime=[...g].find(x=>x.startsWith('COVER_LIFETIME='))?.slice(15)||null;
  if(!['single_ally','all_allies'].includes(coverTarget))errors.push('COVER_TARGETはsingle_allyまたはall_alliesが必要です');
  if(coverTrigger!=='direct_attack')errors.push('現在のCOVER_TRIGGERはdirect_attackが必要です');
  if(!n.COVER_PRIORITY||!Number.isFinite(n.COVER_PRIORITY.value)||!Number.isInteger(n.COVER_PRIORITY.value))errors.push('COVER_PRIORITYは有限整数が必要です');
  if(!['true','false'].includes(coverRemovable))errors.push('COVER_REMOVABLEはtrueまたはfalseが必要です');
  if(!['uses','duration','persistent'].includes(coverLifetime))errors.push('COVER_LIFETIMEはuses、duration、persistentのいずれかが必要です');
  const coverOwnsSharedDuration=!structuredTargetControl&&!hasAnyTag(g,['SHIELD','BUFF','DEBUFF','STATUS']);
  if(coverLifetime==='uses'){
   if(!n.COVER_USES||!Number.isFinite(n.COVER_USES.value)||!Number.isInteger(n.COVER_USES.value)||n.COVER_USES.value<1)errors.push('COVER_LIFETIME=usesには1以上の有限整数COVER_USESが必要です');
   if(n.DURATION&&coverOwnsSharedDuration)errors.push('COVER_LIFETIME=usesではDURATIONを同時指定できません');
  }
  if(coverLifetime==='duration'){
   if(!n.DURATION||!Number.isFinite(n.DURATION.value)||!Number.isInteger(n.DURATION.value)||n.DURATION.value<1)errors.push('COVER_LIFETIME=durationには1以上の有限整数DURATIONが必要です');
   if(n.COVER_USES)errors.push('COVER_LIFETIME=durationではCOVER_USESを同時指定できません');
  }
  if(coverLifetime==='persistent'){
   if(n.COVER_USES)errors.push('COVER_LIFETIME=persistentではCOVER_USESを指定できません');
   // COVERのlifetimeと、同一Skill内のSHIELD/BUFF/DEBUFF/STATUSのDURATIONは別物。
   if(n.DURATION&&coverOwnsSharedDuration)errors.push('COVER_LIFETIME=persistentではDURATIONを指定できません');
  }
  if(!g.has('味方'))errors.push('COVERの保護対象は味方が必要です');
  if(g.has('自分')||g.has('敵')||g.has('死体')||g.has('地点'))errors.push('COVERは味方以外を保護対象にできません');
  if(coverTarget==='single_ally'&&!g.has('単体'))errors.push('COVER_TARGET=single_allyには単体が必要です');
  if(coverTarget==='all_allies'&&!g.has('全体'))errors.push('COVER_TARGET=all_alliesには全体が必要です');
  if(coverTarget==='single_ally'&&hasAnyTag(g,['全体','前列','後列','ランダム','貫通']))errors.push('単体COVERは範囲指定を使用できません');
  if(coverTarget==='all_allies'&&hasAnyTag(g,['単体','前列','後列','ランダム','貫通']))errors.push('全体COVERは全体以外の範囲指定を使用できません');
  // 正式仕様: COVERはSkill専用ロジックではない。COUNTERや付与系などとの複合を許可する。
  // 制約対象は「被弾が単体直接攻撃であること」と派生連鎖防止であり、Skill内の他Effect併用ではない。
 }
 if(g.has('COUNTER')){
  const counterTrigger=[...g].find(x=>x.startsWith('COUNTER_TRIGGER='))?.slice(16)||null;
  const counterTarget=[...g].find(x=>x.startsWith('COUNTER_TARGET='))?.slice(15)||null;
  const counterRequireAlive=[...g].find(x=>x.startsWith('COUNTER_REQUIRE_ALIVE='))?.slice(22)||null;
  const counterAllowZeroDamage=[...g].find(x=>x.startsWith('COUNTER_ALLOW_ZERO_DAMAGE='))?.slice(26)||null;
  if(!g.has('ATTACK'))errors.push('COUNTERにはATTACK定義が必要です');
  if(!g.has('敵'))errors.push('COUNTERの対象は攻撃者本人（敵）が必要です');
  if(!g.has('単体'))errors.push('COUNTERは単体ATTACK定義が必要です');
  if(hasAnyTag(g,['全体','前列','後列','ランダム','貫通']))errors.push('COUNTERは範囲ATTACK定義を使用できません');
  if(g.has('FOLLOW_UP'))errors.push('COUNTERとFOLLOW_UPロジックは同時指定できません');
  if(counterTrigger!=='hit')errors.push('現在のCOUNTER_TRIGGERはhitが必要です');
  if(counterTarget!=='attacker')errors.push('現在のCOUNTER_TARGETはattackerが必要です');
  if(!n.COUNTER_LIMIT||!Number.isFinite(n.COUNTER_LIMIT.value)||!Number.isInteger(n.COUNTER_LIMIT.value)||n.COUNTER_LIMIT.value!==1)errors.push('現在のCOUNTER_LIMITは1が必要です');
  if(!n.COUNTER_PRIORITY||!Number.isFinite(n.COUNTER_PRIORITY.value)||!Number.isInteger(n.COUNTER_PRIORITY.value))errors.push('COUNTER_PRIORITYは有限整数が必要です');
  if(counterRequireAlive!=='true')errors.push('現在のCOUNTER_REQUIRE_ALIVEはtrueが必要です');
  if(counterAllowZeroDamage!=='true')errors.push('現在のCOUNTER_ALLOW_ZERO_DAMAGEはtrueが必要です');
  for(const key of ['COUNTER_RATE','COUNTER_DAMAGE'])if(n[key])errors.push(`${key}は既存ATTACK定義を使用するため指定できません`);
  if([...g].some(x=>x.startsWith('COUNTER_MODE=')))errors.push('COUNTER_MODEは既存ATTACK定義を使用するため指定できません');
 }
 if(n.COOLDOWN&&(!Number.isFinite(n.COOLDOWN.value)||!Number.isInteger(n.COOLDOWN.value)||n.COOLDOWN.value<0))errors.push('COOLDOWNは0以上の有限整数が必要です');
 if(n.MP_COST&&(!Number.isFinite(n.MP_COST.value)||n.MP_COST.value<0))errors.push('MP_COSTは0以上の有限数が必要です');
 if(n.ACTIVATION_PRIORITY&&(!Number.isFinite(n.ACTIVATION_PRIORITY.value)||!Number.isInteger(n.ACTIVATION_PRIORITY.value)))errors.push('ACTIVATION_PRIORITYは有限整数が必要です');
 if(g.has('FOLLOW_UP')){
  if(!g.has('TRIGGER_ALLY_ATTACK'))errors.push('FOLLOW_UPにはTRIGGER_ALLY_ATTACKが必要です');
  if(!g.has('CONDITION_POISONED'))errors.push('FOLLOW_UPにはCONDITION_POISONEDが必要です');
  if(!n.DAMAGE)errors.push('FOLLOW_UPにはDAMAGEが必要です');
 }
 if(g.has('BUFF')||g.has('DEBUFF')){
  if(!hasAnyTag(g,TAG_COMBAT_MODIFIER_PARAMS))errors.push('BUFF/DEBUFFには戦闘パラメータタグが必要です');
  for(const key of ['POWER','DURATION','STACK_GAIN'])if(!n[key])errors.push(`BUFF/DEBUFFには${key}が必要です`);
  for(const key of ['POWER','DURATION','STACK_GAIN']){const v=n[key]?.value;if(v!=null&&(!Number.isFinite(v)||v<=0))errors.push(`${key}は0より大きい有限数が必要です`)}
 }
 if(g.has('AURA')){
  const effect=[...g].find(x=>x.startsWith('AURA_EFFECT='))?.slice(12)||null;
  const auraTarget=[...g].find(x=>x.startsWith('AURA_TARGET='))?.slice(12)||null;
  const scope=[...g].find(x=>x.startsWith('AURA_SCOPE='))?.slice(11)||null;
  const stack=[...g].find(x=>x.startsWith('AURA_STACK='))?.slice(11)||'highest';
  if(!['BUFF','DEBUFF'].includes(effect))errors.push('AURA_EFFECTは初回基盤ではBUFFまたはDEBUFFが必要です');
  if(!n.AURA_VALUE||!Number.isFinite(n.AURA_VALUE.value)||n.AURA_VALUE.value<=0)errors.push('AURA_VALUEは0より大きい有限数が必要です');
  if(!['ally','enemy'].includes(auraTarget))errors.push('AURA_TARGETはallyまたはenemyが必要です');
  if(!['all','self_and_allies','allies_excluding_self'].includes(scope))errors.push('AURA_SCOPEが無効です');
  if(auraTarget==='enemy'&&scope!=='all')errors.push('敵オーラのAURA_SCOPEはallのみ対応です');
  if(stack!=='highest')errors.push('初回AURA_STACKはhighestのみ対応です');
  if(n.AURA_PRIORITY&&(!Number.isFinite(n.AURA_PRIORITY.value)||!Number.isInteger(n.AURA_PRIORITY.value)))errors.push('AURA_PRIORITYは有限整数が必要です');
  if(!hasAnyTag(g,TAG_COMBAT_MODIFIER_PARAMS))errors.push('BUFF/DEBUFFオーラには戦闘パラメータタグが必要です');
  if(g.has('BUFF')||g.has('DEBUFF'))errors.push('AURAと通常BUFF/DEBUFFロジックは同時指定できません');
 }
 const actionDisabledTags=[...g].filter(x=>x.startsWith('ACTION_DISABLED='));
 if(n.ACTION_DISABLED)errors.push('ACTION_DISABLEDはtrueのみ指定できます');
 if(actionDisabledTags.length&&!g.has('STATUS'))errors.push('ACTION_DISABLEDはSTATUSにのみ指定できます');
 if(g.has('STATUS')){
  const statusId=[...g].find(x=>x.startsWith('STATUS_ID='))?.slice(10)||null;
  if(!statusId)errors.push('STATUSにはSTATUS_IDが必要です');
  if(!n.DURATION||!Number.isFinite(n.DURATION.value)||!Number.isInteger(n.DURATION.value)||n.DURATION.value<=0)errors.push('STATUSのDURATIONは0より大きい有限整数が必要です');
  if(actionDisabledTags.some(x=>x!=='ACTION_DISABLED=true'))errors.push('ACTION_DISABLEDはtrueのみ指定できます');
 }
 if(g.has('CLEANSE')){
  const category=[...g].find(x=>x.startsWith('CLEANSE_CATEGORY='))?.slice(17)||'status';
  const order=[...g].find(x=>x.startsWith('CLEANSE_ORDER='))?.slice(14)||'oldest';
  if(!hasAnyTag(g,['自分','味方']))errors.push('CLEANSEの対象は自分または味方が必要です');
  if(g.has('敵')||g.has('死体')||g.has('地点'))errors.push('CLEANSEは敵・死体・地点を対象にできません');
  if(g.has('CLEANSE_ALL')&&n.CLEANSE_COUNT)errors.push('CLEANSE_ALLとCLEANSE_COUNTは同時指定できません');
  if(!g.has('CLEANSE_ALL')&&!n.CLEANSE_COUNT)errors.push('CLEANSEにはCLEANSE_COUNTまたはCLEANSE_ALLが必要です');
  if(n.CLEANSE_COUNT&&(!Number.isFinite(n.CLEANSE_COUNT.value)||!Number.isInteger(n.CLEANSE_COUNT.value)||n.CLEANSE_COUNT.value<1))errors.push('CLEANSE_COUNTは1以上の有限整数が必要です');
  if(category!=='status')errors.push(`現在のCLEANSE_CATEGORYはstatusのみ対応です: ${category}`);
  if(order!=='oldest')errors.push(`現在のCLEANSE_ORDERはoldestのみ対応です: ${order}`);
 }
 if(g.has('REVIVE')){
  if(!g.has('味方'))errors.push('REVIVEの対象は味方が必要です');
  if(g.has('自分')||g.has('敵')||g.has('死体')||g.has('地点'))errors.push('REVIVEは味方以外を対象にできません');
  const hasFixed=!!n.REVIVE_HP,hasRate=!!n.REVIVE_HP_RATE;
  if(hasFixed&&hasRate)errors.push('REVIVE_HPとREVIVE_HP_RATEは同時指定できません');
  if(!hasFixed&&!hasRate)errors.push('REVIVEにはREVIVE_HPまたはREVIVE_HP_RATEが必要です');
  if(hasFixed&&(!Number.isFinite(n.REVIVE_HP.value)||!Number.isInteger(n.REVIVE_HP.value)||n.REVIVE_HP.value<1))errors.push('REVIVE_HPは1以上の有限整数が必要です');
  if(hasRate&&(!Number.isFinite(n.REVIVE_HP_RATE.value)||n.REVIVE_HP_RATE.value<=0||n.REVIVE_HP_RATE.value>1))errors.push('REVIVE_HP_RATEは0より大きく1以下の有限数が必要です');
 }
 const targetSide=isAura?'self':g.has('敵')?'enemy':g.has('味方')?'ally':g.has('自分')?'self':g.has('死体')?'corpse':g.has('地点')?'point':null;
 const range=isAura?'single':g.has('単体')?'single':g.has('全体')?'all':g.has('前列')?'front':g.has('後列')?'back':g.has('ランダム')?'random':g.has('貫通')?'pierce':null;
 const damageType=g.has('物理')?'physical':g.has('魔法')?'magical':g.has('固定')?'fixed':null;
 const mpCost=n.MP_COST?.value??0,costs=mpCost>0?[{type:'mp',amount:mpCost,payCondition:'sufficient_resource',consumeTiming:'activation_established',refundCondition:'not_consumed_before_activation',failureReason:'MP_SHORTAGE'}]:[],activationPriority=n.ACTIVATION_PRIORITY?.value??0;
 const conditions=TAG_CONDITION_KEYS.filter(key=>n[key]).map(key=>({key,operator:n[key].operator,value:n[key].value,raw:n[key].raw}));
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,costs,parameters:{damageType,mpCost,activationPriority,cooldown:n.COOLDOWN?.value??0,damage:n.DAMAGE?.value??null,heal:n.HEAL?.value??null,shield:n.SHIELD?.value??null,shieldDuration:n.DURATION?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null,modifierStat:TAG_COMBAT_MODIFIER_PARAMS.find(x=>g.has(x))||null,modifierPower:n.POWER?.value??null,modifierDuration:n.DURATION?.value??null,followUpTrigger:g.has('TRIGGER_ALLY_ATTACK')?'ALLY_ATTACK':null,followUpCondition:g.has('CONDITION_POISONED')?'POISONED':null,statusId:[...g].find(x=>x.startsWith('STATUS_ID='))?.slice(10)||null,statusDuration:g.has('STATUS')?(n.DURATION?.value??null):null,statusStackPolicy:g.has('INDEPENDENT')?'independent':g.has('STRONGEST')?'strongest':'refresh',statusPayload:{...([...g].includes('STATUS_ID=STATUS-ACCURACY-DOWN')?{accuracy_modifier:-20}:{}),...(g.has('ACTION_DISABLED=true')?{action_disabled:true}:{})},cleanseCount:n.CLEANSE_COUNT?.value??null,cleanseAll:g.has('CLEANSE_ALL'),cleanseCategory:[...g].find(x=>x.startsWith('CLEANSE_CATEGORY='))?.slice(17)||'status',cleanseOrder:[...g].find(x=>x.startsWith('CLEANSE_ORDER='))?.slice(14)||'oldest',reviveHp:n.REVIVE_HP?.value??null,reviveHpRate:n.REVIVE_HP_RATE?.value??null,auraEffect:[...g].find(x=>x.startsWith('AURA_EFFECT='))?.slice(12)||null,auraValue:n.AURA_VALUE?.value??null,auraTarget:[...g].find(x=>x.startsWith('AURA_TARGET='))?.slice(12)||null,auraScope:[...g].find(x=>x.startsWith('AURA_SCOPE='))?.slice(11)||null,auraStack:[...g].find(x=>x.startsWith('AURA_STACK='))?.slice(11)||'highest',auraPriority:n.AURA_PRIORITY?.value??0,coverTarget:[...g].find(x=>x.startsWith('COVER_TARGET='))?.slice(13)||null,coverTrigger:[...g].find(x=>x.startsWith('COVER_TRIGGER='))?.slice(14)||null,coverPriority:structuredTargetControl?structuredTargetControl.priority:(n.COVER_PRIORITY?.value??null),coverRemovable:structuredTargetControl?String(structuredTargetControl.removable):([...g].find(x=>x.startsWith('COVER_REMOVABLE='))?.slice(16)||null),coverLifetime:structuredTargetControl?String(structuredTargetControl.lifetime||'').toLowerCase():([...g].find(x=>x.startsWith('COVER_LIFETIME='))?.slice(15)||null),coverUses:structuredTargetControl?(structuredTargetControl.uses??null):(n.COVER_USES?.value??null),coverDuration:structuredTargetControl?(structuredTargetControl.duration??null):(g.has('COVER')&&([...g].find(x=>x.startsWith('COVER_LIFETIME='))?.slice(15)==='duration')?(n.DURATION?.value??null):null),coverRuntimeApplied:true,counterTrigger:[...g].find(x=>x.startsWith('COUNTER_TRIGGER='))?.slice(16)||null,counterTarget:[...g].find(x=>x.startsWith('COUNTER_TARGET='))?.slice(15)||null,counterLimit:n.COUNTER_LIMIT?.value??null,counterPriority:n.COUNTER_PRIORITY?.value??null,counterRequireAlive:[...g].find(x=>x.startsWith('COUNTER_REQUIRE_ALIVE='))?.slice(22)||null,counterAllowZeroDamage:[...g].find(x=>x.startsWith('COUNTER_ALLOW_ZERO_DAMAGE='))?.slice(26)||null,counterUsesAttack:g.has('COUNTER')&&g.has('ATTACK'),conditions,conditionMode:'all'},runtimeContracts:runtimeContracts,sourceTags:[...(skill?.tags||[])]},parsed};
}

global.GKSValidationTagCompiler=Object.freeze({compile:compileTaggedSkill});
})(globalThis);
