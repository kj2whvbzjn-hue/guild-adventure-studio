/* Tag skill compiler/runtime — GA-B486.59 / P01-12 activation priority validation */
const TAG_LOGIC_ORDER=['COVER','COUNTER','ATTACK','DOT','FOLLOW_UP','HEAL','HOT','BUFF','DEBUFF','AURA','SHIELD','STATUS','CLEANSE','RESOURCE_CHANGE','SUMMON','DISPEL','REVIVE'];
const TAG_COMBAT_MODIFIER_PARAMS=['ATK','DEF','MAGIC_WEAPON_BONUS','STATUS_RESIST']; // 戦闘パラメータ。閾値ステータス(STR/VIT/AGI/DEX/INT/MND/LUK)とは別系統
const CURRENT_DAMAGE_ELEMENTS=Object.freeze(['FIRE','ICE','LIGHTNING','WIND']);
function normalizeRuntimeElementComponents(raw){
 if(raw==null)return{ok:true,components:null};
 if(!Array.isArray(raw)||raw.length<1)return{ok:false,reason:'SKILL_RUNTIME_DAMAGE_ELEMENTS_INVALID'};
 const seen=new Set(),components=[];let sum=0;
 for(const row of raw){const element=String(row?.element||'').toUpperCase(),share=Number(row?.share);if(!CURRENT_DAMAGE_ELEMENTS.includes(element))return{ok:false,reason:'SKILL_RUNTIME_DAMAGE_ELEMENT_UNKNOWN',element};if(seen.has(element))return{ok:false,reason:'SKILL_RUNTIME_DAMAGE_ELEMENT_DUPLICATE',element};if(!Number.isFinite(share)||share<0||share>1)return{ok:false,reason:'SKILL_RUNTIME_DAMAGE_ELEMENT_SHARE_INVALID',element,share};seen.add(element);sum+=share;components.push({element,share});}
 if(Math.abs(sum-1)>1e-9)return{ok:false,reason:'SKILL_RUNTIME_DAMAGE_ELEMENT_SHARE_TOTAL_INVALID',sum};
 return{ok:true,components};
}
function compileSkillRuntime(skill){
 const errors=[],warnings=[],runtime=skill?.runtimeContracts;
 if(!runtime||typeof runtime!=='object'||Array.isArray(runtime)){
  return{ok:false,errors:['runtimeContractsが必要です'],warnings,definition:null,parsed:null};
 }
 if(runtime.schemaVersion!==1)errors.push(`runtimeContracts.schemaVersion=${runtime.schemaVersion}は未対応です`);
 if(!runtime.triggerContract||typeof runtime.triggerContract!=='object')errors.push('runtimeContracts.triggerContractが必要です');
 if(!Array.isArray(runtime.conditionContracts))errors.push('runtimeContracts.conditionContractsは配列が必要です');
 const useRequirementContracts=runtime.useRequirementContracts==null?[]:runtime.useRequirementContracts;if(!Array.isArray(useRequirementContracts))errors.push('runtimeContracts.useRequirementContractsは配列が必要です');else for(const [i,r] of useRequirementContracts.entries()){if(String(r?.type||'').toUpperCase()!=='EQUIPMENT_TAGS')errors.push(`runtimeContracts.useRequirementContracts[${i}].typeは未対応です`);if(String(r?.scope||'SELF').toUpperCase()!=='SELF')errors.push(`runtimeContracts.useRequirementContracts[${i}].scopeはSELFが必要です`);for(const key of ['allTags','anyTags']){if(!Array.isArray(r?.[key]))errors.push(`runtimeContracts.useRequirementContracts[${i}].${key}は配列が必要です`);else for(const tag of r[key])if(!/^TAG-\d{4}$/.test(String(tag||'')))errors.push(`runtimeContracts.useRequirementContracts[${i}].${key}にFormal Tag IDが必要です: ${tag}`)}}
 if(!Array.isArray(runtime.effectContracts))errors.push('runtimeContracts.effectContractsは配列が必要です');
 if(!Array.isArray(runtime.applyContracts))errors.push('runtimeContracts.applyContractsは配列が必要です');

 const targetSource=runtime.targetContract||skill.target||{};
 const sideMap={SELF:'self',ALLY:'ally',ENEMY:'enemy',CORPSE:'corpse',POINT:'point'};
 const rangeMap={SINGLE:'single',ALL:'all',FRONT:'front',BACK:'back',RANDOM:'random',PIERCE:'pierce'};
 const targetSide=sideMap[String(targetSource.side||'').toUpperCase()]||null;
 const range=rangeMap[String(targetSource.range||'').toUpperCase()]||null;
 if(!targetSide)errors.push(`runtimeContracts target.sideが無効です: ${targetSource.side||'(なし)'}`);
 if(!range)errors.push(`runtimeContracts target.rangeが無効です: ${targetSource.range||'(なし)'}`);

 const castTime=runtime.resourceContract?.castTime??skill.resource?.castTime??0;
 if(!Number.isInteger(castTime)||castTime<0)errors.push('runtimeContracts.resourceContract.castTimeは0以上の整数Tickが必要です');
 const logicOrder=[],addLogic=logic=>{if(logic&&!logicOrder.includes(logic))logicOrder.push(logic)};
 const parameters={
  damageType:null,
  mpCost:Number(runtime.resourceContract?.mpCost??skill.resource?.mpCost??0),
  activationPriority:Number(runtime.resourceContract?.activationPriority??skill.resource?.activationPriority??0),
  cooldown:Number(runtime.resourceContract?.cooldown??skill.resource?.cooldown??0),
  castTime:Number(runtime.resourceContract?.castTime??skill.resource?.castTime??0),
  damage:null,heal:null,shield:null,shieldDuration:null,dotPower:null,dotDuration:null,dotInterval:null,stackGain:null,
  modifierStat:null,modifierPower:null,modifierDuration:null,followUpTrigger:null,followUpCondition:null,
  statusId:null,statusDuration:null,statusStackPolicy:'refresh',statusPayload:{},
  cleanseCount:null,cleanseAll:false,cleanseCategory:'status',cleanseOrder:'oldest',
  reviveHp:null,reviveHpRate:null,
  auraEffect:null,auraValue:null,auraTarget:null,auraScope:null,auraStack:'highest',auraPriority:0,
  coverTarget:null,coverTrigger:null,coverPriority:null,coverRemovable:null,coverLifetime:null,coverUses:null,coverDuration:null,coverRuntimeApplied:true,
  counterTrigger:null,counterTarget:null,counterLimit:null,counterPriority:null,counterRequireAlive:null,counterAllowZeroDamage:null,counterUsesAttack:false,
  conditions:[],conditionMode:'all'
 };

 for(const [index,c] of (runtime.effectContracts||[]).entries()){
  const type=String(c?.type||'').toUpperCase();
  if(type==='DAMAGE'){
   if(!Number.isFinite(c.power)||c.power<0)errors.push(`runtimeContracts.effectContracts[${index}].powerが無効です`);
   const elementCheck=normalizeRuntimeElementComponents(c.elementComponents);if(!elementCheck.ok)errors.push(`runtimeContracts.effectContracts[${index}].elementComponentsが無効です: ${elementCheck.reason}`);
   addLogic('ATTACK');parameters.damage=c.power;parameters.damageType=c.damageType?String(c.damageType).toLowerCase():null;
  }else if(type==='HEAL'){
   if(!Number.isFinite(c.power)||c.power<0)errors.push(`runtimeContracts.effectContracts[${index}].powerが無効です`);
   addLogic('HEAL');parameters.heal=c.power;
  }else if(type==='REMOVE'){
   addLogic('CLEANSE');parameters.cleanseCount=c.count??null;parameters.cleanseAll=c.all===true;
   parameters.cleanseCategory=String(c.category||'STATUS').toLowerCase();parameters.cleanseOrder=String(c.order||'oldest');
  }else if(type==='RESOURCE_CHANGE'){
   addLogic('RESOURCE_CHANGE');
  }else if(type==='REVIVE'){
   addLogic('REVIVE');parameters.reviveHp=c.hp??null;parameters.reviveHpRate=c.hpRate??null;
  }else if(type==='TARGET_CONTROL'){
   const mode=String(c.mode||'').toUpperCase();
   if(mode!=='COVER')errors.push(`runtimeContracts.effectContracts[${index}].modeは未対応です: ${mode}`);
   else{
    addLogic('COVER');
    parameters.coverTarget=String(targetSource.range||'').toUpperCase()==='ALL'?'all_allies':'single_ally';
    parameters.coverTrigger=String(c.trigger||'DIRECT_ATTACK').toLowerCase();
    parameters.coverPriority=c.priority??0;
    parameters.coverRemovable=String(c.removable);
    parameters.coverLifetime=String(c.lifetime||'PERSISTENT').toLowerCase();
    parameters.coverUses=c.uses??null;parameters.coverDuration=c.duration??null;
   }
  }else errors.push(`runtimeContracts.effectContracts[${index}].typeは未対応です: ${type||'(なし)'}`);
 }

 for(const [index,c] of (runtime.applyContracts||[]).entries()){
  const logic=String(c?.logic||c?.kind||'').toUpperCase(),values=c?.values||{};
  if(!['STATUS','DOT','BUFF','DEBUFF','SHIELD'].includes(logic)){
   errors.push(`runtimeContracts.applyContracts[${index}].logicは未対応です: ${logic||'(なし)'}`);
   continue;
  }
  addLogic(logic);
  if(logic==='DOT'){
   parameters.dotPower=values.power;parameters.dotDuration=values.duration;parameters.dotInterval=values.interval;parameters.stackGain=values.stackGain;
  }else if(logic==='BUFF'||logic==='DEBUFF'){
   parameters.modifierStat=values.modifierStat||null;parameters.modifierPower=values.power;parameters.modifierDuration=values.duration;parameters.stackGain=values.stackGain;
  }else if(logic==='SHIELD'){
   parameters.shield=values.power;parameters.shieldDuration=values.duration;
  }else if(logic==='STATUS'){
   parameters.statusId=values.statusId||c.effectId||null;parameters.statusDuration=values.duration;parameters.statusPayload={...(values.statusPayload||{})};
  }
 }

 const trigger=runtime.triggerContract||{};
 const triggerType=String(trigger.type||'').toUpperCase();
 if(triggerType==='ON_ALLY_ATTACK'){
  parameters.followUpTrigger='ALLY_ATTACK';parameters.followUpCondition='POISONED';addLogic('FOLLOW_UP');
 }
 if(triggerType==='ON_HIT_RECEIVED'){
  parameters.counterTrigger='hit';parameters.counterTarget='attacker';parameters.counterLimit=1;parameters.counterPriority=trigger.priority??0;
  parameters.counterRequireAlive='true';parameters.counterAllowZeroDamage='true';parameters.counterUsesAttack=logicOrder.includes('ATTACK');addLogic('COUNTER');
 }
 if(triggerType==='WHILE_SOURCE_ALIVE'){
  const aura=runtime.auraEffectContract;
  if(!aura)errors.push('runtimeContracts.auraEffectContractが必要です');
  else{
   addLogic('AURA');parameters.auraEffect=String(aura.kind||'').toUpperCase();parameters.auraValue=aura.power;
   parameters.auraTarget=aura.targetSide;parameters.auraScope=aura.targetScope;parameters.auraStack=aura.stack||'highest';parameters.auraPriority=aura.priority??0;
   if(aura.modifierStat)parameters.modifierStat=aura.modifierStat;
  }
 }

 parameters.conditions=(runtime.conditionContracts||[]).map(c=>({
  key:String(c.property||''),operator:c.operator||'=',value:c.value??c.expected,scope:c.scope||'SELF',
  enginePredicate:c.enginePredicate||null
 }));

 const ordered=TAG_LOGIC_ORDER.filter(x=>logicOrder.includes(x));
 for(const logic of logicOrder)if(!ordered.includes(logic))ordered.push(logic);
 const costs=parameters.mpCost>0?[{
  type:'mp',amount:parameters.mpCost,payCondition:'sufficient_resource',consumeTiming:'activation_established',
  refundCondition:'not_consumed_before_activation',failureReason:'MP_SHORTAGE'
 }]:[];

 return{
  ok:errors.length===0,errors,warnings,
  definition:{
   id:String(skill?.id||''),name:String(skill?.name||''),target:Object.assign({side:targetSide,range},range==='random'?{randomCount:targetSource.randomCount??null}:{}),
   logicOrder:ordered,costs,parameters,useRequirementContracts:Array.isArray(useRequirementContracts)?useRequirementContracts.map(x=>({...x,allTags:[...(x.allTags||[])],anyTags:[...(x.anyTags||[])]})):[],runtimeContracts:runtime,sourceTags:[]
  },
  parsed:{generalTags:new Set(),numericTags:{},errors:[]}
 };
}

const GKS_SKILL_RUNTIME_MODE=Object.freeze({production:'runtimeContracts_only'});
globalThis.GKSSkillRuntimeMode=GKS_SKILL_RUNTIME_MODE;
function runtimeSkillStore(){
 if(typeof SKILLS!=='undefined'&&Array.isArray(SKILLS))return SKILLS;
 return[];
}
function findSkill(skillId){return runtimeSkillStore().find(x=>x.id===skillId)||null}
function skillRuntimeDiagnostics(){
 const skills=runtimeSkillStore(),production=skills.filter(x=>String(x?.environment||'production').toLowerCase()==='production');
 const formal=production.filter(x=>x?.runtimeContracts&&x?.schemaVersion===1),invalid=production.filter(x=>!x?.runtimeContracts||x?.schemaVersion!==1);
 return{mode:GKS_SKILL_RUNTIME_MODE.production,totalSkills:skills.length,productionSkills:production.length,formalProductionSkills:formal.length,invalidProductionSkillIds:invalid.map(x=>x?.id||'(unknown)'),studioProductionSkills:formal.filter(x=>x?.source==='studio_export').length};
}
globalThis.GKSSkillRuntimeDiagnostics=skillRuntimeDiagnostics;
function compileSkillForRuntime(skill){
 if(skill?.runtimeContracts)return compileSkillRuntime(skill);
 return{ok:false,errors:['Skillは正式runtimeContractsが必要です'],warnings:[],definition:null,parsed:null};
}
function formatCompileResult(result){
 const d=result.definition,p=result.parsed;
 return [
  `[BUILD] ${TAG_SKILL_BUILD}`,
  `[SKILL] ${d.id} / ${d.name}`,
  `[GENERAL] ${[...p.generalTags].join(', ')||'(なし)'}`,
  `[NUMERIC] ${Object.values(p.numericTags).map(x=>x.raw).join(', ')||'(なし)'}`,
  `[LOGIC] ${d.logicOrder.join(' -> ')||'(なし)'}`,
  `[TARGET] ${d.target.side||'?'} / ${d.target.range||'?'}`,
  `[PARAM] ${JSON.stringify(d.parameters)}`,
  ...(result.errors.map(x=>`[ERROR] ${x}`)),
  ...(result.warnings.map(x=>`[WARN] ${x}`)),
  `[RESULT] ${result.ok?'VALID':'INVALID'}`
 ].join('\n');
}
function resolveTaggedTargets(actor,target,definition){
 if(!actor||!actor.alive)return{ok:false,reason:'使用者が無効です',targets:[]};
 if(typeof ensureBattleFormationSafePoint==='function')ensureBattleFormationSafePoint('before_skill_target_resolution');
 const side=definition.target.side,range=definition.target.range,isRevive=definition.logicOrder.includes('REVIVE');
 let candidates=[];
 if(isRevive){
  if(!['ally','corpse'].includes(side))return{ok:false,reason:'REVIVEの対象陣営が無効です',targets:[]};
  candidates=battle.units.filter(x=>!x.alive&&x.hp<=0&&x.side===actor.side);
 }else if(side==='self')candidates=[actor];
 else if(side==='ally')candidates=battle.units.filter(x=>x.alive&&x.side===actor.side);
 else if(side==='enemy')candidates=battle.units.filter(x=>x.alive&&x.side!==actor.side);
 else return{ok:false,reason:'対象陣営タグがありません',targets:[]};
 const isEnemy=side==='enemy',isAlly=side==='ally';
 const frontCandidates=()=>candidates.filter(x=>String(x.formationPosition||'FRONTLINE')==='FRONTLINE');
 if(range==='single'){
  if(!target)return{ok:false,reason:'対象が無効です',targets:[]};
  if(isRevive&&target.alive)return{ok:false,reason:'INVALID_TARGET: 生存対象は蘇生できません',targets:[]};
  if(isRevive&&target.hp>0)return{ok:false,reason:'INVALID_TARGET: HPが残っている対象は蘇生できません',targets:[]};
  if(!isRevive&&!target.alive)return{ok:false,reason:'対象が無効です',targets:[]};
  if(!candidates.some(x=>x.id===target.id))return{ok:false,reason:'対象陣営タグと選択対象が一致しません',targets:[]};
  if(isEnemy&&String(target.formationPosition||'FRONTLINE')!=='FRONTLINE')return{ok:false,reason:'SINGLEは敵後衛を対象にできません',targets:[]};
  candidates=[target];
 }else if(range==='front'){
  candidates=frontCandidates();
 }else if(range==='back'){
  if(!target)return{ok:false,reason:'対象が無効です',targets:[]};
  if(!target.alive&&!isRevive)return{ok:false,reason:'対象が無効です',targets:[]};
  if(!candidates.some(x=>x.id===target.id))return{ok:false,reason:'対象陣営タグと選択対象が一致しません',targets:[]};
  candidates=[target];
 }else if(range==='random'){
  if(isRevive)return{ok:false,reason:'REVIVEでRANDOMは未採用です',targets:[]};
  const count=Number(definition.target.randomCount);if(!Number.isInteger(count)||count<1)return{ok:false,reason:'RANDOMには1以上のrandomCountが必要です',targets:[]};
  if(!candidates.length)return{ok:false,reason:'有効な対象がありません',targets:[]};
  const pool=[...candidates],draws=[];
  for(let i=0;i<count;i++){
   const anchor=pool[0]||null,roll=currentBattleRoll(actor,anchor,definition.id||'RANDOM_TARGET','random_target',i),index=Math.min(pool.length-1,Math.floor(roll*pool.length));draws.push(pool[index]);
  }
  candidates=draws;
 }else if(range==='all'){
  // all valid targets; formation does not restrict target inclusion.
 }else return{ok:false,reason:`範囲 ${range} は未対応です`,targets:[]};
 if(!candidates.length&&!isRevive)return{ok:false,reason:'有効な対象がありません',targets:[]};
 return{ok:true,targets:candidates};
}
let modifierStackSequence=0;
function ensureModifierStackList(target){if(!Array.isArray(target.modifierStacks))target.modifierStacks=[];return target.modifierStacks}
function modifierGroupKey(kind,stat){return `${kind}:${stat}`}
function auraSourceSkillIds(source){return Array.isArray(source?.auraSkillIds)?source.auraSkillIds:[]}
function activeAuraEntries(target,kind,stat){
 if(!target?.alive)return[];const entries=[];
 for(const source of battle.units.filter(x=>x.alive)){
  for(const skillId of auraSourceSkillIds(source)){
   const skill=findSkill(skillId);if(!skill)continue;const compiled=compileSkillForRuntime(skill);if(!compiled.ok||!compiled.definition.logicOrder.includes('AURA'))continue;
   const p=compiled.definition.parameters;if(p.auraEffect!==kind||p.modifierStat!==stat)continue;
   const triggerContract=compiled.definition.runtimeContracts?.triggerContract||null;
   const collectAuraEntry=()=>{
    const targetSide=p.auraTarget==='ally'?source.side:(p.auraTarget==='enemy'?(source.side==='味方'?'敵':'味方'):null);if(target.side!==targetSide)return false;
    if(p.auraTarget==='ally'&&p.auraScope==='allies_excluding_self'&&target.id===source.id)return false;
    if(p.auraTarget==='ally'&&!['all','self_and_allies','allies_excluding_self'].includes(p.auraScope))return false;
    if(p.auraTarget==='enemy'&&p.auraScope!=='all')return false;
    entries.push({kind,stat,power:Math.max(0,Number(p.auraValue)||0),sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,priority:Number(p.auraPriority)||0,stack:p.auraStack||'highest',formalTrigger:!!triggerContract});return true;
   };
   if(triggerContract?.type==='WHILE_SOURCE_ALIVE'){
    const engine=globalThis.GKSTriggerEngine;if(!engine?.dispatchCompiled)continue;
    const dispatched=engine.dispatchCompiled(triggerContract,'aura_evaluate',{sourceId:source.id,targetId:target.id,skillId:compiled.definition.id,kind,stat},collectAuraEntry);
    if(!dispatched.ok)continue;
   }else collectAuraEntry();
  }
 }
 return entries;
}
function resolveEffectiveAuraEntry(entries){
 const list=(Array.isArray(entries)?entries:[]).map((entry,index)=>({entry,index}));
 list.sort((a,b)=>(Number(b.entry?.power)||0)-(Number(a.entry?.power)||0)||(Number(b.entry?.priority)||0)-(Number(a.entry?.priority)||0)||a.index-b.index);
 return list.length?list[0].entry:null;
}
function effectiveAuraPower(target,kind,stat){const winner=resolveEffectiveAuraEntry(activeAuraEntries(target,kind,stat));return winner?Math.max(0,Number(winner.power)||0):0}
function resolveModifierStackLifecyclePolicy(policy){
 if(!policy)return{ok:true,defaulted:true,stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'HIGHEST',consumeRule:'NONE'};
 const expected={stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'HIGHEST',consumeRule:'NONE'};
 for(const [field,value] of Object.entries(expected))if(policy[field]!==value)return{ok:false,defaulted:false,field,value:policy[field],expected:value};
 return{ok:true,defaulted:false,...expected};
}
function resolveModifierEffectiveValue(stacks,policy=null){
 const checked=resolveModifierStackLifecyclePolicy(policy);if(!checked.ok)return{ok:false,reason:'MODIFIER_LIFECYCLE_POLICY_MISMATCH',...checked,power:0};
 const values=(Array.isArray(stacks)?stacks:[]).map(x=>Math.max(0,Number(x?.power)||0));
 return{ok:true,power:values.length?Math.max(...values):0,policy:checked};
}
function applyModifierStackLifecycle(source,target,compiled,logic,policy){
 const checked=resolveModifierStackLifecyclePolicy(policy);if(!checked.ok)return{ok:false,reason:'MODIFIER_LIFECYCLE_POLICY_MISMATCH',policyError:checked};
 const stat=compiled.definition.parameters.modifierStat,power=Math.max(0,Number(compiled.definition.parameters.modifierPower)||0),duration=Math.max(1,Math.floor(compiled.definition.parameters.modifierDuration)),gain=Math.max(1,Math.floor(compiled.definition.parameters.stackGain));
 const list=ensureModifierStackList(target),added=[];
 for(let i=0;i<gain;i++){const stack={id:`MOD-${++modifierStackSequence}`,kind:logic,stat,power,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,appliedAt:battle.tick,expiresAt:battle.tick+duration,duration};list.push(stack);added.push(stack)}
 return{ok:true,added,power,duration,stat,policy:checked};
}
function effectiveModifierPower(target,kind,stat){if(!target?.alive)return 0;const active=ensureModifierStackList(target).filter(x=>x.kind===kind&&x.stat===stat&&x.expiresAt>battle.tick),normalResult=resolveModifierEffectiveValue(active),normal=normalResult.ok?normalResult.power:0,aura=effectiveAuraPower(target,kind,stat);return Math.max(normal,aura)}
function effectiveAttackValue(unit){const base=Math.max(0,Number(unit?.attack)||0),buff=effectiveModifierPower(unit,'BUFF','ATK'),debuff=effectiveModifierPower(unit,'DEBUFF','ATK'),buffContribution=base*(buff/100),debuffContribution=-base*(debuff/100);return Math.max(0,Math.floor(base+buffContribution+debuffContribution))}
function effectiveDamageResist(unit){const base=Number(unit?.damageResist??unit?.damage_resist??0),buff=effectiveModifierPower(unit,'BUFF','DEF'),debuff=effectiveModifierPower(unit,'DEBUFF','DEF'),value=(Number.isFinite(base)?base:0)+buff-debuff;return Math.max(0,Math.min(75,value))}
function applyDefenseResistance(unit,damage){const raw=Math.max(0,Math.floor(Number(damage)||0)),resistance=effectiveDamageResist(unit),reduced=Math.max(0,Math.floor(raw*(1-resistance/100)));return{rawDamage:raw,resistance,damage:reduced}}
function recordEffectiveModifierChange(target,kind,stat,before,after,reason){if(before===after)return;battle.log.push(`[Tick ${battle.tick}] [TAG][${kind}] ${target.name}の${stat}実効値 ${before}% → ${after}%（${reason}）`);recordValidationEvent('modifier_effective_changed',{target_id:target.id,kind,stat,before,after,reason})}
function applyTaggedModifier(source,target,compiled,logic,lifecyclePolicy=null){
 if(!target?.alive)return{ok:false,reason:'効果対象が無効です'};
 const stat=compiled.definition.parameters.modifierStat,power=Math.max(0,Number(compiled.definition.parameters.modifierPower)||0),duration=Math.max(1,Math.floor(compiled.definition.parameters.modifierDuration)),gain=Math.max(1,Math.floor(compiled.definition.parameters.stackGain));
 const before=effectiveModifierPower(target,logic,stat),added=[];
 if(lifecyclePolicy){
  const lifecycleResult=getTaggedApplyLifecycleEngine().apply(logic,{source,target,compiled,logic,lifecycle:lifecyclePolicy});
  if(!lifecycleResult.ok)return lifecycleResult;
  added.push(...lifecycleResult.added);
 }else{
  const list=ensureModifierStackList(target);
  for(let i=0;i<gain;i++){const stack={id:`MOD-${++modifierStackSequence}`,kind:logic,stat,power,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,appliedAt:battle.tick,expiresAt:battle.tick+duration,duration};list.push(stack);added.push(stack)}
 }
 const after=effectiveModifierPower(target,logic,stat);
 battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] ${source.name}の${compiled.definition.name} → ${target.name}へ${stat} ${power}%を${added.length}スタック付与（実効${after}%、終了Tick ${battle.tick+duration}）`);
 recordValidationEvent('modifier_stack_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,kind:logic,stat,power,count:added.length,stack_ids:added.map(x=>x.id),expires_at:battle.tick+duration,effective_before:before,effective_after:after,lifecycle_policy:lifecyclePolicy||null});
 recordEffectiveModifierChange(target,logic,stat,before,after,'stack_added');
 return{ok:true,added:added.length,power,effective:after,stacks:added,lifecyclePolicy:lifecyclePolicy||null};
}
function processModifierStacks(){
 for(const target of battle.units){const list=ensureModifierStackList(target);if(!list.length)continue;if(!target.alive){target.modifierStacks=[];continue}
  const groups=new Set(list.map(x=>modifierGroupKey(x.kind,x.stat))),before={};for(const key of groups){const [kind,stat]=key.split(':');before[key]=Math.max(0,...list.filter(x=>x.kind===kind&&x.stat===stat).map(x=>x.power))}
  const expired=list.filter(x=>x.expiresAt<=battle.tick),keep=list.filter(x=>x.expiresAt>battle.tick);target.modifierStacks=keep;
  for(const x of expired){battle.log.push(`[Tick ${battle.tick}] [TAG][${x.kind}] ${target.name}の${x.stat} ${x.power}% #${x.id}が終了`);recordValidationEvent('modifier_expired',{target_id:target.id,stack_id:x.id,kind:x.kind,stat:x.stat,power:x.power})}
  for(const key of groups){const [kind,stat]=key.split(':'),after=effectiveModifierPower(target,kind,stat);recordEffectiveModifierChange(target,kind,stat,before[key],after,'stack_expired')}
 }
}
function clearAllModifierStacks(reason='battle_end'){for(const target of battle.units){const list=ensureModifierStackList(target);if(!list.length)continue;const count=list.length;target.modifierStacks=[];typeof recordValidationEvent==='function'&&recordValidationEvent('modifier_stacks_cleared',{target_id:target.id,count,reason})}}
function clearModifierStacksOnDeath(target,{cause='death',sourceId=null}={}){
 const list=ensureModifierStackList(target);if(!list.length)return 0;
 const cleared=[...list],groups=new Map();for(const x of cleared){const key=modifierGroupKey(x.kind,x.stat);groups.set(key,Math.max(groups.get(key)||0,x.power))}
 target.modifierStacks=[];
 for(const x of cleared)recordValidationEvent('modifier_cleared_on_death',{target_id:target.id,stack_id:x.id,kind:x.kind,stat:x.stat,power:x.power,source_id:x.sourceId,cause});
 for(const [key,before] of groups){const [kind,stat]=key.split(':');recordEffectiveModifierChange(target,kind,stat,before,0,'target_defeated')}
 battle.log.push(`[Tick ${battle.tick}] [TAG][MODIFIER] ${target.name}の効果${cleared.length}件を戦闘不能により解除`);
 recordValidationEvent('modifier_death_cleanup',{target_id:target.id,source_id:sourceId,cleared_count:cleared.length,cause});
 return cleared.length;
}
function recordModifierSourceDefeated(source){
 const dependent=battle.units.flatMap(t=>ensureModifierStackList(t).filter(x=>x.sourceId===source.id).map(x=>({target_id:t.id,stack_id:x.id,kind:x.kind,stat:x.stat,power:x.power,expires_at:x.expiresAt})));
 recordValidationEvent('modifier_source_defeated',{source_id:source.id,persistent_stack_count:dependent.length,persistent_stacks:dependent});
 battle.log.push(`[Tick ${battle.tick}] [TAG][MODIFIER] 付与者${source.name}が戦闘不能。付与型効果${dependent.length}件は自然終了まで継続`);
 return dependent.length;
}
function modifierStatusText(unit){const list=ensureModifierStackList(unit),stats=TAG_COMBAT_MODIFIER_PARAMS,parts=[];const groups={};for(const x of list){const k=modifierGroupKey(x.kind,x.stat);(groups[k]||(groups[k]=[])).push(x)}for(const [k,v] of Object.entries(groups)){const [kind,stat]=k.split(':'),effective=effectiveModifierPower(unit,kind,stat);parts.push(`${k} ${v.length}stack / 実効${effective}%`)}for(const kind of ['BUFF','DEBUFF'])for(const stat of stats){const aura=effectiveAuraPower(unit,kind,stat);if(aura&&!groups[modifierGroupKey(kind,stat)])parts.push(`AURA ${kind}:${stat} 実効${aura}%`)}return parts.length?parts.join('、'):'なし'}
let shieldEffectSequence=0;
function ensureShieldEffects(target){if(!Array.isArray(target.shieldEffects))target.shieldEffects=[];return target.shieldEffects}
function shieldTotal(target){return ensureShieldEffects(target).reduce((sum,x)=>sum+Math.max(0,Number(x.remaining)||0),0)}
function shieldStatusText(unit){const effects=ensureShieldEffects(unit);if(!effects.length)return'なし';return `${shieldTotal(unit)}（${effects.length}枚 / ${effects.map(x=>`${x.remaining}@${x.expiresAt}`).join(', ')}）`}
function resolveShieldStackLifecyclePolicy(lifecycle){
 const policy=lifecycle&&typeof lifecycle==='object'?lifecycle:{};const expected={stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'SUM',consumeRule:'FIFO'};
 for(const [field,value] of Object.entries(expected))if(String(policy[field]||'')!==value)return{ok:false,reason:'SHIELD_LIFECYCLE_POLICY_MISMATCH',field,expected:value,actual:String(policy[field]||'')};
 return{ok:true,stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'SUM',consumeRule:'FIFO',maxStacks:Number.isInteger(policy.maxStacks)?policy.maxStacks:null};
}
function applyShieldStackLifecycle(target,{source,compiled,amount,duration}={},lifecycle){
 const resolved=resolveShieldStackLifecyclePolicy(lifecycle);if(!resolved.ok)return{ok:false,reason:resolved.reason,field:resolved.field,expected:resolved.expected,actual:resolved.actual};
 if(!target?.alive)return{ok:false,reason:'シールド対象が無効です'};amount=Math.max(0,Math.floor(Number(amount)||0));duration=Math.max(0,Math.floor(Number(duration)||0));if(amount<=0||duration<=0)return{ok:false,reason:'シールド値または持続時間が無効です'};
 const sequence=++shieldEffectSequence,effect={id:`SHIELD-${sequence}`,sequence,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,amount,remaining:amount,appliedAt:battle.tick,expiresAt:battle.tick+duration,duration,lifecyclePolicy:{...resolved}};
 ensureShieldEffects(target).push(effect);return{ok:true,shieldId:effect.id,amount,duration,expiresAt:effect.expiresAt,totalShield:shieldTotal(target),effect,policy:resolved};
}
function resolveShieldConsumeLifecyclePolicy(lifecycle){
 const policy=lifecycle&&typeof lifecycle==='object'?lifecycle:{consumeRule:'FIFO'},consumeRule=String(policy.consumeRule||'FIFO').toUpperCase();
 if(consumeRule!=='FIFO')return{ok:false,reason:'SHIELD_CONSUME_POLICY_UNSUPPORTED',field:'consumeRule',expected:'FIFO',actual:consumeRule};
 return{ok:true,consumeRule:'FIFO'};
}
function resolveShieldConsumePolicyForTarget(target){
 const policies=ensureShieldEffects(target).map(x=>x?.lifecyclePolicy).filter(x=>x&&typeof x==='object');
 if(!policies.length)return{ok:true,consumeRule:'FIFO',source:'runtime_default'};
 for(const policy of policies){const resolved=resolveShieldConsumeLifecyclePolicy(policy);if(!resolved.ok)return resolved}
 return{ok:true,consumeRule:'FIFO',source:'registry_contract'};
}
function consumeShieldLayersLifecycle(target,rawDamage,lifecycle=null){
 const policy=resolveShieldConsumeLifecyclePolicy(lifecycle);if(!policy.ok)return{ok:false,reason:policy.reason,field:policy.field,expected:policy.expected,actual:policy.actual};
 const raw=Math.max(0,Math.floor(Number(rawDamage)||0)),sequenceOf=x=>Number.isFinite(Number(x.sequence))?Number(x.sequence):(Number(String(x.id||'').match(/(\d+)$/)?.[1])||0),effects=ensureShieldEffects(target).sort((a,b)=>a.appliedAt-b.appliedAt||sequenceOf(a)-sequenceOf(b)||String(a.id).localeCompare(String(b.id)));
 let remaining=raw,absorbed=0;const consumed=[];
 for(const effect of effects){if(remaining<=0)break;const use=Math.min(Math.max(0,effect.remaining),remaining);if(use<=0)continue;effect.remaining-=use;remaining-=use;absorbed+=use;consumed.push({shield_id:effect.id,absorbed:use,remaining:effect.remaining})}
 target.shieldEffects=effects.filter(x=>x.remaining>0);
 return{ok:true,rawDamage:raw,absorbed,hpDamage:remaining,totalShield:shieldTotal(target),consumed,policy};
}
function applyTaggedShield(source,target,compiled,lifecyclePolicy=null){
 if(!target?.alive)return{ok:false,reason:'シールド対象が無効です'};
 const powerPercent=Math.max(0,Number(compiled.definition.parameters.shield)||0),amount=Math.max(0,Math.floor(Math.max(0,Number(target?.maxHp)||0)*(powerPercent/100))),duration=Math.max(0,Math.floor(Number(compiled.definition.parameters.shieldDuration)||0));
 if(amount<=0||duration<=0)return{ok:false,reason:'シールド値または持続時間が無効です'};
 let result;if(lifecyclePolicy){result=getTaggedApplyLifecycleEngine().apply('SHIELD',{target,input:{source,compiled,amount,duration},lifecycle:lifecyclePolicy});if(!result.ok)return result}else{const sequence=++shieldEffectSequence,effect={id:`SHIELD-${sequence}`,sequence,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,amount,remaining:amount,appliedAt:battle.tick,expiresAt:battle.tick+duration,duration};ensureShieldEffects(target).push(effect);result={ok:true,shieldId:effect.id,amount,duration,expiresAt:effect.expiresAt,totalShield:shieldTotal(target),effect}}
 battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${source.name}の${compiled.definition.name} → ${target.name}へシールド${amount}付与（持続${duration}、総残量${shieldTotal(target)}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('shield_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,shield_id:result.effect.id,amount,duration,expires_at:result.effect.expiresAt,total_shield:shieldTotal(target),lifecycle_policy:lifecyclePolicy?result.policy:null});
 return result;
}
function consumeShieldDamage(target,rawDamage,{sourceId=null,skillId=null,damageType='damage'}={}){
 const raw=Math.max(0,Math.floor(Number(rawDamage)||0)),lifecycle=resolveShieldConsumePolicyForTarget(target);
 if(!lifecycle.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] consume policyが不正です: ${lifecycle.reason}`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_consume_policy_rejected',{source_id:sourceId,target_id:target?.id||null,skill_id:skillId,damage_type:damageType,raw_damage:raw,reason:lifecycle.reason,field:lifecycle.field||null,expected:lifecycle.expected||null,actual:lifecycle.actual||null});return{rawDamage:raw,absorbed:0,hpDamage:raw,totalShield:shieldTotal(target),consumed:[],policy:null,error:lifecycle.reason}}
 const result=getTaggedApplyLifecycleEngine().consume('SHIELD',{target,rawDamage:raw,lifecycle});if(!result.ok)return{rawDamage:raw,absorbed:0,hpDamage:raw,totalShield:shieldTotal(target),consumed:[],policy:null,error:result.reason};
 const {absorbed,hpDamage,consumed}=result;
 if(absorbed>0){battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${target.name}のシールドが${absorbed}吸収（受けるHPダメージ${hpDamage}、総残量${shieldTotal(target)}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_absorbed',{source_id:sourceId,target_id:target.id,skill_id:skillId,damage_type:damageType,raw_damage:raw,absorbed,hp_damage:hpDamage,consumed,total_shield:shieldTotal(target),consume_rule:result.policy.consumeRule,policy_source:lifecycle.source})}
 return{rawDamage:raw,absorbed,hpDamage,totalShield:shieldTotal(target),consumed,policy:result.policy};
}
function processShieldEffects(){for(const target of battle.units){const effects=ensureShieldEffects(target),expired=effects.filter(x=>x.expiresAt<=battle.tick);if(expired.length){target.shieldEffects=effects.filter(x=>x.expiresAt>battle.tick&&x.remaining>0);for(const x of expired){battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${target.name}の${x.skillName}#${x.id}が終了（残量${x.remaining}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_expired',{target_id:target.id,shield_id:x.id,remaining:x.remaining,expired_at:battle.tick})}}}}
function clearAllShields(reason='battle_end'){for(const target of battle.units){const count=ensureShieldEffects(target).length,total=shieldTotal(target);if(count){target.shieldEffects=[];battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${target.name}のシールドを消去（${reason}、${count}枚、残量${total}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_cleared',{target_id:target.id,reason,count,total})}}}

let statusEffectSequence=0;
function ensureStatusEffects(target){if(!Array.isArray(target.statusEffects))target.statusEffects=[];return target.statusEffects}
function statusSnapshot(target){return ensureStatusEffects(target).map(x=>({instance_id:x.instanceId,status_id:x.statusId,source_id:x.sourceId,target_id:x.targetId,skill_id:x.skillId,applied_tick:x.appliedTick,base_duration_tick:x.baseDurationTick,effective_duration_tick:x.effectiveDurationTick,expires_tick:x.expiresTick,target_resistance:x.targetResistance,stack_policy:x.stackPolicy,payload:x.payload}))}
function statusResistance(target,statusId){const raw=Number(target?.statusResistance?.[statusId]??target?.statusResistance??0),base=Math.max(0,Number.isFinite(raw)?raw:0),resolved=currentBattleResolveDirectModifierTarget(base,`STATUS_RESISTANCE:${String(statusId||'').toUpperCase()}`,target);return Math.max(0,Math.min(75,resolved.final_value))}
function effectiveStatusDuration(baseDuration,resistance){return Math.max(1,Math.ceil(Math.max(1,Number(baseDuration)||1)*(1-Math.max(0,Math.min(75,Number(resistance)||0))/100)))}
function resolveStatusUniqueRefreshLifecyclePolicy(lifecycle){
 const policy=lifecycle&&typeof lifecycle==='object'?lifecycle:null;if(!policy)return{ok:false,reason:'STATUS lifecycle契約がありません'};
 const stackRule=String(policy.stackRule||'').toUpperCase(),refreshRule=String(policy.refreshRule||'').toUpperCase();
 if(stackRule!=='UNIQUE')return{ok:false,reason:`STATUS lifecycle stackRule=${stackRule||'(empty)'} は未対応です`,field:'stackRule',value:stackRule};
 if(refreshRule!=='REFRESH')return{ok:false,reason:`STATUS lifecycle refreshRule=${refreshRule||'(empty)'} は未対応です`,field:'refreshRule',value:refreshRule};
 return{ok:true,stackRule,refreshRule};
}
function applyStatusUniqueRefreshLifecycle(list,{statusId,newEffect,refreshPatch}={},lifecycle){
 if(!Array.isArray(list))return{ok:false,reason:'STATUS lifecycle対象listが配列ではありません'};
 const policy=resolveStatusUniqueRefreshLifecyclePolicy(lifecycle);if(!policy.ok)return{...policy,refreshed:false,effect:null};
 if(!statusId)return{ok:false,reason:'STATUS lifecycleにはstatusIdが必要です',refreshed:false,effect:null};
 const existing=list.find(x=>x&&x.statusId===statusId);
 if(existing){Object.assign(existing,refreshPatch||{});return{ok:true,refreshed:true,effect:existing,policy}}
 const created=typeof newEffect==='function'?newEffect():newEffect;
 if(!created||typeof created!=='object')return{ok:false,reason:'STATUS lifecycle新規付与にはnewEffectが必要です',refreshed:false,effect:null,policy};
 list.push(created);return{ok:true,refreshed:false,effect:created,policy};
}
function applyTaggedStatus(source,target,compiled,lifecyclePolicy=null){
 if(!target?.alive)return{ok:false,reason:'状態異常対象が無効です'};
 const p=compiled.definition.parameters,statusId=p.statusId,baseDuration=Math.floor(Number(p.statusDuration)||0),resistance=statusResistance(target,statusId),duration=effectiveStatusDuration(baseDuration,resistance);
 const list=ensureStatusEffects(target),policy=p.statusStackPolicy||'refresh';
 if(lifecyclePolicy){
  const refreshPatch={sourceId:source.id,skillId:compiled.definition.id,appliedTick:battle.tick,baseDurationTick:baseDuration,effectiveDurationTick:duration,expiresTick:battle.tick+duration,targetResistance:resistance,payload:p.statusPayload||{}};
  const createEffect=()=>{const seq=++statusEffectSequence;return{instanceId:`STATUS-I-${seq}`,sequence:seq,statusId,sourceId:source.id,targetId:target.id,skillId:compiled.definition.id,appliedTick:battle.tick,baseDurationTick:baseDuration,effectiveDurationTick:duration,expiresTick:battle.tick+duration,targetResistance:resistance,stackPolicy:policy,payload:p.statusPayload||{},removeOnDeath:true,removeOnBattleEnd:true}};
  const applied=getTaggedApplyLifecycleEngine().apply('STATUS',{list,input:{statusId,newEffect:createEffect,refreshPatch},lifecycle:lifecyclePolicy});
  if(!applied.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('status_lifecycle_rejected',{status_id:statusId,source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,reason:applied.reason||'STATUS_LIFECYCLE_REJECTED',field:applied.field||null,value:applied.value||null});return{ok:false,reason:applied.reason||'STATUS_LIFECYCLE_REJECTED',lifecyclePolicy}}
  const effect=applied.effect;
  if(applied.refreshed){typeof recordValidationEvent==='function'&&recordValidationEvent('status_refreshed',{instance_id:effect.instanceId,status_id:statusId,source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,base_duration_tick:baseDuration,effective_duration_tick:duration,target_resistance:resistance,expires_tick:effect.expiresTick});return{ok:true,refreshed:true,effect,lifecyclePolicy}}
  typeof recordValidationEvent==='function'&&recordValidationEvent('status_applied',{instance_id:effect.instanceId,status_id:statusId,source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,base_duration_tick:baseDuration,effective_duration_tick:duration,target_resistance:resistance,expires_tick:effect.expiresTick});return{ok:true,refreshed:false,effect,lifecyclePolicy};
 }
 const existing=list.find(x=>x.statusId===statusId);
 if(policy==='refresh'&&existing){existing.sourceId=source.id;existing.skillId=compiled.definition.id;existing.appliedTick=battle.tick;existing.baseDurationTick=baseDuration;existing.effectiveDurationTick=duration;existing.expiresTick=battle.tick+duration;existing.targetResistance=resistance;existing.payload=p.statusPayload||{};typeof recordValidationEvent==='function'&&recordValidationEvent('status_refreshed',{instance_id:existing.instanceId,status_id:statusId,source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,base_duration_tick:baseDuration,effective_duration_tick:duration,target_resistance:resistance,expires_tick:existing.expiresTick});return{ok:true,refreshed:true,effect:existing}}
 const seq=++statusEffectSequence,effect={instanceId:`STATUS-I-${seq}`,sequence:seq,statusId,sourceId:source.id,targetId:target.id,skillId:compiled.definition.id,appliedTick:battle.tick,baseDurationTick:baseDuration,effectiveDurationTick:duration,expiresTick:battle.tick+duration,targetResistance:resistance,stackPolicy:policy,payload:p.statusPayload||{},removeOnDeath:true,removeOnBattleEnd:true};
 list.push(effect);typeof recordValidationEvent==='function'&&recordValidationEvent('status_applied',{instance_id:effect.instanceId,status_id:statusId,source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,base_duration_tick:baseDuration,effective_duration_tick:duration,target_resistance:resistance,expires_tick:effect.expiresTick});return{ok:true,refreshed:false,effect};
}
function removeStatus(target,selector={},reason='scripted',tick=battle.tick){
 const list=ensureStatusEffects(target),match=x=>(selector.instance_id&&x.instanceId===selector.instance_id)||(selector.status_id&&x.statusId===selector.status_id)||(selector.category==='status');
 const removed=list.filter(match);target.statusEffects=list.filter(x=>!match(x));
 for(const x of removed)typeof recordValidationEvent==='function'&&recordValidationEvent('status_removed',{instance_id:x.instanceId,status_id:x.statusId,target_id:target.id,reason,removed_at:tick});
 return removed.length;
}
function processStatusEffects(){for(const target of battle.units){const list=ensureStatusEffects(target);for(const x of list.filter(x=>x.expiresTick<=battle.tick))removeStatus(target,{instance_id:x.instanceId},'expired',battle.tick)}}
function clearAllStatuses(reason='battle_end'){for(const target of battle.units)removeStatus(target,{category:'status'},reason,battle.tick)}

function cleanseStatusEffects(source,target,compiled){
 if(!target?.alive)return{ok:false,reason:'解除対象が無効です'};
 const p=compiled.definition.parameters,list=ensureStatusEffects(target),eligible=list.filter(x=>x.removable!==false&&x.protected!==true);
 const skippedProtected=list.filter(x=>x.protected===true||x.removable===false);
 eligible.sort((a,b)=>(a.appliedTick-b.appliedTick)||((a.sequence||0)-(b.sequence||0))||String(a.instanceId).localeCompare(String(b.instanceId)));
 const selected=p.cleanseAll?eligible:eligible.slice(0,Math.max(0,Math.floor(Number(p.cleanseCount)||0))),removed=[];
 for(const x of selected){const summary={instance_id:x.instanceId,status_id:x.statusId,applied_tick:x.appliedTick,expires_tick:x.expiresTick};if(removeStatus(target,{instance_id:x.instanceId},'manual_dispel',battle.tick)){removed.push(summary);typeof recordValidationEvent==='function'&&recordValidationEvent('cleanse_removed',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,effect_instance_id:x.instanceId,effect_id:x.statusId,effect_category:'status',reason:'manual_dispel'})}}
 for(const x of skippedProtected)typeof recordValidationEvent==='function'&&recordValidationEvent('cleanse_skipped',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,effect_instance_id:x.instanceId,effect_id:x.statusId,reason:x.protected===true?'protected':'not_removable'});
 const result={ok:true,targetId:target.id,requestedCount:p.cleanseAll?null:p.cleanseCount,removedCount:removed.length,removed,skippedProtectedCount:skippedProtected.length,remainingNegativeCount:ensureStatusEffects(target).length};
 typeof recordValidationEvent==='function'&&recordValidationEvent('cleanse_summary',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,requested_count:result.requestedCount,removed_count:result.removedCount,skipped_protected_count:result.skippedProtectedCount,remaining_negative_count:result.remainingNegativeCount});
 return result;
}
function executeRuntimeRemoveRuntime(source,target,compiled){
 const contract=compiled?.definition?.runtimeContracts?.effectContracts?.find(x=>x?.type==='REMOVE')||null;if(!contract)return null;
 if(contract.category!=='STATUS'||typeof contract.all!=='boolean'||(!contract.all&&(!Number.isInteger(contract.count)||contract.count<1))||contract.order!=='oldest')return{ok:false,error:true,reason:'SKILL_RUNTIME_REMOVE_CONTRACT_INVALID'};
 const p={...compiled.definition.parameters,cleanseCategory:'status',cleanseOrder:'oldest',cleanseAll:contract.all,cleanseCount:contract.count},result=cleanseStatusEffects(source,target,{...compiled,definition:{...compiled.definition,parameters:p}});
 typeof recordValidationEvent==='function'&&recordValidationEvent('skill_remove_executed',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,all:contract.all,count:contract.count,removed_count:result.removedCount});return{...result,runtimeContracts:true,effectContract:{...contract}};
}

function executeRuntimeResourceChangeRuntime(source,target,compiled){
 const contract=compiled?.definition?.runtimeContracts?.effectContracts?.find(x=>x?.type==='RESOURCE_CHANGE')||null;if(!contract)return null;
 if(contract.resource!=='MP'||!Number.isFinite(contract.amount)||contract.amount===0)return{ok:false,error:true,reason:'SKILL_RUNTIME_RESOURCE_CHANGE_CONTRACT_INVALID'};if(!target?.alive)return{ok:false,reason:'RESOURCE_TARGET_INVALID'};
 const before=Math.max(0,Number(target.mp)||0),max=Math.max(0,Number(target.maxMp)||before),after=Math.max(0,Math.min(max,before+contract.amount));target.mp=after;const applied=after-before;
 typeof recordValidationEvent==='function'&&recordValidationEvent('skill_resource_change_executed',{source_id:source?.id||null,target_id:target.id,skill_id:compiled?.definition?.id||null,resource:'MP',requested:contract.amount,applied,before,after,max});return{ok:true,resource:'MP',requested:contract.amount,applied,before,after,runtimeContracts:true,effectContract:{...contract}};
}
function calculateTaggedAttackDamage(attacker,definition){
 const rate=Number(definition.parameters.damage);
 if(definition.parameters.damageType==='fixed')return Math.max(0,Math.floor(rate));
 return Math.max(0,Math.floor(effectiveAttackValue(attacker)*(rate/100)));
}
function currentBattleFinite(value,fallback=0){return typeof value==='number'&&Number.isFinite(value)?value:fallback}
const CURRENT_BATTLE_CONTRIBUTION_TARGETS=Object.freeze(['CRITICAL_RATE']);
function currentBattleActiveModifierContributionEntries(unit){const now=Number(battle?.tick||0),rows=[];for(const stack of ensureModifierStackList(unit).filter(x=>x&&x.expiresAt>now)){const target=String(stack.stat||'').toUpperCase();if(!['ACCURACY','ACTION_GAUGE_GAIN','CRITICAL_RATE','CRITICAL_DAMAGE'].includes(target))continue;const sign=String(stack.kind||'').toUpperCase()==='DEBUFF'?-1:1,power=Math.max(0,currentBattleFinite(Number(stack.power),0));let mode='RELATIVE_PERCENT',raw=sign*(power/100);if(target==='CRITICAL_RATE')mode='ADDITIVE_POINT';rows.push({source_type:'ACTIVE_SKILL',source_id:String(stack.skillId||stack.id||'ACTIVE'),modifier_id:String(stack.id||stack.skillId||target),target_stat:target,mode,raw_modifier_value:raw});}return rows}
function currentBattleModifierEntries(unit){const base=unit?.formalModifierContributions;if(base!=null&&!Array.isArray(base))throw Object.assign(new Error('Game Battle formalModifierContributionsは配列が必要です。'),{code:'GAME_BATTLE_MODIFIER_CONTRIBUTIONS_INVALID'});const now=(typeof battle!=='undefined'&&Number.isFinite(Number(battle?.tick)))?Number(battle.tick):0,active=[];for(const stack of (Array.isArray(unit?.modifierStacks)?unit.modifierStacks:[]).filter(x=>x&&Number(x.expiresAt)>now)){const target=String(stack.stat||'').toUpperCase();if(!['ACCURACY','ACTION_GAUGE_GAIN','CRITICAL_RATE','CRITICAL_DAMAGE'].includes(target))continue;const sign=String(stack.kind||'').toUpperCase()==='DEBUFF'?-1:1,power=Math.max(0,Number.isFinite(Number(stack.power))?Number(stack.power):0);let mode='RELATIVE_PERCENT',raw=sign*(power/100);if(target==='CRITICAL_RATE')mode='ADDITIVE_POINT';active.push({source_type:'ACTIVE_SKILL',source_id:String(stack.skillId||stack.id||'ACTIVE'),modifier_id:String(stack.id||stack.skillId||target),target_stat:target,mode,raw_modifier_value:raw})}return[...(base||[]),...active]}
function currentBattleResolveModifierTarget(base,target,unitOrEntries){const baseValue=currentBattleFinite(base,0),targetStat=String(target||'').toUpperCase();if(!CURRENT_BATTLE_CONTRIBUTION_TARGETS.includes(targetStat))throw Object.assign(new Error(`Game Battle modifier target ${targetStat||'(empty)'}は未接続です。`),{code:'GAME_BATTLE_MODIFIER_TARGET_UNCONNECTED',target_stat:targetStat});const rows=(Array.isArray(unitOrEntries)?unitOrEntries:currentBattleModifierEntries(unitOrEntries)).filter(row=>String(row?.target_stat||'').toUpperCase()===targetStat),contributions=[];for(const row of rows){const sourceType=String(row?.source_type||'').toUpperCase(),sourceId=String(row?.source_id||''),modifierId=String(row?.modifier_id||''),mode=String(row?.mode||'').toUpperCase(),raw=currentBattleFinite(row?.raw_modifier_value,NaN);if(!sourceType||!sourceId||!Number.isFinite(raw))throw Object.assign(new Error(`Game Battle ${targetStat} Contribution provenanceが不正です。`),{code:'GAME_BATTLE_MODIFIER_PROVENANCE_INVALID',target_stat:targetStat});let resolved=0;if(mode==='RELATIVE_PERCENT')resolved=baseValue*raw;else if(mode==='FLAT_ADD'||mode==='ADDITIVE_POINT')resolved=raw;else if(mode==='SUBTRACTIVE_POINT')resolved=-raw;else throw Object.assign(new Error(`Game Battle modifier operation ${mode||'(empty)'}は未対応です。`),{code:'GAME_BATTLE_MODIFIER_OPERATION_UNSUPPORTED',target_stat:targetStat,operation:mode});contributions.push({source_type:sourceType,source_id:sourceId,modifier_id:modifierId,target_stat:targetStat,mode,raw_modifier_value:raw,base_value_used:baseValue,resolved_contribution:resolved})}return{base_value:baseValue,final_value:baseValue+contributions.reduce((sum,row)=>sum+row.resolved_contribution,0),contributions}}
function currentBattleDirectModifierEntries(unit){return currentBattleModifierEntries(unit)}
const CURRENT_BATTLE_DIRECT_MODIFIER_TARGETS=Object.freeze(['BLOCK_RATE','BLOCK_PERFORMANCE','CRITICAL_DAMAGE','CRITICAL_BONUS_DAMAGE_REDUCTION','MP_COST_REDUCTION','COOLDOWN_REDUCTION','CAST_TIME_REDUCTION','MAGIC_ACCURACY','MAGIC_RESISTANCE','PHYSICAL_DAMAGE','MAGIC_DAMAGE','ACCURACY','EVASION','ACTION_GAUGE_GAIN']);
function currentBattleDirectModifierTargetConnected(target){const key=String(target||'').toUpperCase();return CURRENT_BATTLE_DIRECT_MODIFIER_TARGETS.includes(key)||key.startsWith('STATUS_RESISTANCE:')||key.startsWith('ELEMENT_RESISTANCE:')}
function currentBattleResolveDirectModifierTarget(base,target,unitOrEntries){const baseValue=currentBattleFinite(base,0),targetStat=String(target||'').toUpperCase();if(!currentBattleDirectModifierTargetConnected(targetStat))throw Object.assign(new Error(`Game Battle direct modifier target ${targetStat||'(empty)'}は未接続です。`),{code:'GAME_BATTLE_DIRECT_MODIFIER_TARGET_UNCONNECTED',target_stat:targetStat});const rows=(Array.isArray(unitOrEntries)?unitOrEntries:currentBattleDirectModifierEntries(unitOrEntries)).filter(row=>String(row?.target_stat||'').toUpperCase()===targetStat),contributions=[];for(const row of rows){const sourceType=String(row?.source_type||'').toUpperCase(),sourceId=String(row?.source_id||''),modifierId=String(row?.modifier_id||''),mode=String(row?.mode||'').toUpperCase(),raw=currentBattleFinite(row?.raw_modifier_value,NaN);if(!sourceType||!sourceId||!Number.isFinite(raw))throw Object.assign(new Error(`Game Battle ${targetStat} Contribution provenanceが不正です。`),{code:'GAME_BATTLE_MODIFIER_PROVENANCE_INVALID',target_stat:targetStat});let resolved=0;if(mode==='RELATIVE_PERCENT')resolved=baseValue*raw;else if(mode==='FLAT_ADD'||mode==='ADDITIVE_POINT')resolved=raw;else if(mode==='SUBTRACTIVE_POINT')resolved=-raw;else throw Object.assign(new Error(`Game Battle modifier operation ${mode||'(empty)'}は未対応です。`),{code:'GAME_BATTLE_MODIFIER_OPERATION_UNSUPPORTED',target_stat:targetStat,operation:mode});contributions.push({source_type:sourceType,source_id:sourceId,modifier_id:modifierId,target_stat:targetStat,mode,raw_modifier_value:raw,base_value_used:baseValue,resolved_contribution:resolved})}return{base_value:baseValue,final_value:baseValue+contributions.reduce((sum,row)=>sum+row.resolved_contribution,0),contributions}}
function currentBattleAccuracy(unit){const base=Math.max(0,currentBattleFinite(unit?.accuracy,0)),resolved=currentBattleResolveDirectModifierTarget(base,'ACCURACY',unit);return Math.max(0,resolved.final_value)}
function currentBattleEvasion(unit){const base=Math.max(0,currentBattleFinite(unit?.evasion,0)),resolved=currentBattleResolveDirectModifierTarget(base,'EVASION',unit);return Math.max(0,resolved.final_value)}
function currentBattleActionGaugeGain(unit,baseGain){const base=Math.max(0,currentBattleFinite(baseGain,0)),resolved=currentBattleResolveDirectModifierTarget(base,'ACTION_GAUGE_GAIN',unit);return Math.max(0,resolved.final_value)}
function currentBattleHitRatePercent(attacker,target){const accuracy=currentBattleAccuracy(attacker),evasion=currentBattleEvasion(target);if(evasion<=0)return 100;return Math.max(0,(accuracy/evasion)*100)}
function currentBattleMagicAccuracy(unit){const base=Math.max(0,currentBattleFinite(unit?.magicAccuracy??unit?.magic_accuracy,0)),resolved=currentBattleResolveDirectModifierTarget(base,'MAGIC_ACCURACY',unit);return Math.max(0,resolved.final_value)}
function currentBattleMagicResistance(unit){const base=Math.max(0,currentBattleFinite(unit?.magicResistance??unit?.magic_resistance,0)),resolved=currentBattleResolveDirectModifierTarget(base,'MAGIC_RESISTANCE',unit);return Math.max(0,resolved.final_value)}
function currentBattleMagicHitRatePercent(attacker,target){const accuracy=currentBattleMagicAccuracy(attacker),resistance=currentBattleMagicResistance(target);if(resistance<=0)return 100;return Math.max(0,Math.min(100,(accuracy/resistance)*100))}
function currentBattleCriticalResolution(unit){const explicit=currentBattleFinite(unit?.criticalRate??unit?.critical_rate,NaN),weaponRate=Math.max(0,currentBattleFinite(unit?.weaponCriticalRate??unit?.weapon_critical_rate,0)),luck=Math.max(0,currentBattleFinite(unit?.luk??unit?.LUK,0)),baseRate=Number.isFinite(explicit)?Math.max(0,explicit)/100:weaponRate*(1+luck/100),resolved=currentBattleResolveModifierTarget(baseRate,'CRITICAL_RATE',unit),finalRate=Math.max(0,resolved.final_value);return{weapon_critical_rate:weaponRate,LUK:luck,base_critical_rate:baseRate,final_critical_rate:finalRate,contributions:resolved.contributions}}
function currentBattleCriticalRatePercent(unit){return Math.max(0,Math.min(100,currentBattleCriticalResolution(unit).final_critical_rate*100))}
function currentBattleCriticalDamagePercent(unit){const base=Math.max(0,currentBattleFinite(unit?.criticalDamage??unit?.critical_damage,0)),resolved=currentBattleResolveDirectModifierTarget(base,'CRITICAL_DAMAGE',unit);return Math.max(0,Math.min(700,resolved.final_value))}
function currentBattleReduction(unit,target){return Math.max(0,Math.min(1,currentBattleResolveDirectModifierTarget(0,target,unit).final_value))}
function currentBattleCriticalBonusDamageReduction(unit){return currentBattleReduction(unit,'CRITICAL_BONUS_DAMAGE_REDUCTION')}
function currentBattleElementResistance(unit,element){const key=String(element||'').toUpperCase();if(!CURRENT_DAMAGE_ELEMENTS.includes(key))throw Object.assign(new Error(`未定義Damage Element: ${key||'(empty)'}`),{code:'GAME_BATTLE_DAMAGE_ELEMENT_UNKNOWN',element:key});const map=unit?.elementResistance??unit?.element_resistance,raw=map&&typeof map==='object'&&!Array.isArray(map)?Number(map[key]??0):0,base=Math.max(0,Number.isFinite(raw)?raw:0),resolved=currentBattleResolveDirectModifierTarget(base,`ELEMENT_RESISTANCE:${key}`,unit);return Math.max(0,Math.min(75,resolved.final_value))}
function currentBattleResolveElementDamage(unit,totalDamage,components){const normalized=normalizeRuntimeElementComponents(components);if(!normalized.ok)throw Object.assign(new Error(`Formal Damage elementComponentsが不正です: ${normalized.reason}`),{code:normalized.reason,detail:normalized});if(!normalized.components)return{elemental:false,totalDamage:Math.max(0,Number(totalDamage)||0),components:[]};const total=Math.max(0,Number(totalDamage)||0),rows=normalized.components.map(row=>{const before=total*row.share,resistance=currentBattleElementResistance(unit,row.element),after=before*(1-resistance/100);return{element:row.element,share:row.share,damage_before_resistance:before,resistance,damage_after_resistance:after}});return{elemental:true,totalDamage:rows.reduce((sum,row)=>sum+row.damage_after_resistance,0),components:rows}}
function currentBattlePassiveRuntimeEntries(unit){
 const rows=unit?.formalPassiveRuntimeContracts;if(rows==null)return[];if(!Array.isArray(rows))throw Object.assign(new Error('Game Battle formalPassiveRuntimeContractsは配列が必要です。'),{code:'GAME_BATTLE_PASSIVE_RUNTIME_CONTRACTS_INVALID'});
 return rows.map((row,index)=>{const passiveId=String(row?.passiveId||'').trim(),runtime=row?.runtimeContracts;if(!passiveId||!runtime||typeof runtime!=='object'||Array.isArray(runtime)||Number(runtime.schemaVersion)!==1)throw Object.assign(new Error(`Game Battle Formal Passive Runtime Contractが不正です: index=${index}`),{code:'GAME_BATTLE_PASSIVE_RUNTIME_CONTRACT_INVALID',index,passive_id:passiveId||null});return{passiveId,runtimeContracts:runtime};});
}
function currentBattlePeriodicPassiveEntries(unit){
 const rows=[];
 for(const row of currentBattlePassiveRuntimeEntries(unit)){const contract=row.runtimeContracts?.periodicContract;if(contract==null)continue;if(!contract||typeof contract!=='object'||Array.isArray(contract))throw Object.assign(new Error(`Periodic Passive ${row.passiveId}のperiodicContractが不正です。`),{code:'PERIODIC_PASSIVE_CONTRACT_INVALID',passive_id:row.passiveId});const resource=String(contract.resource||'').toUpperCase(),intervalTicks=Number(contract.intervalTicks),initialDelayTicks=Number(contract.initialDelayTicks),recoveryRate=Number(contract.recoveryRate);if(!['HP','MP'].includes(resource)||!Number.isInteger(intervalTicks)||intervalTicks<1||!Number.isInteger(initialDelayTicks)||initialDelayTicks<1||!Number.isFinite(recoveryRate)||recoveryRate<=0||recoveryRate>1)throw Object.assign(new Error(`Periodic Passive ${row.passiveId}のperiodicContract値が不正です。`),{code:'PERIODIC_PASSIVE_CONTRACT_VALUE_INVALID',passive_id:row.passiveId});rows.push({passiveId:row.passiveId,contract:{resource,intervalTicks,initialDelayTicks,recoveryRate}})}
 return rows;
}
function periodicPassiveDueAtTick(contract,tick){const t=Math.max(0,Math.floor(Number(tick)||0)),first=contract.initialDelayTicks;if(t<first)return false;return(t-first)%contract.intervalTicks===0}
function processPeriodicPassives(){
 for(const unit of battle.units){for(const row of currentBattlePeriodicPassiveEntries(unit)){const {passiveId,contract}=row;if(!periodicPassiveDueAtTick(contract,battle.tick))continue;if(!unit.alive){typeof recordValidationEvent==='function'&&recordValidationEvent('periodic_passive_skipped',{source_id:unit.id,passive_id:passiveId,resource:contract.resource,reason:'SOURCE_DEAD',tick:battle.tick});continue}
   const max=contract.resource==='HP'?Math.max(1,Number(unit.maxHp)||1):Math.max(0,Number(unit.maxMp)||0),before=contract.resource==='HP'?Math.max(0,Number(unit.hp)||0):Math.max(0,Number(unit.mp)||0),requested=Math.max(1,Math.floor(max*contract.recoveryRate)),after=Math.min(max,before+requested),applied=Math.max(0,after-before);
   if(contract.resource==='HP'){unit.hp=after;typeof evaluateLowHpPassivesAfterHpCommit==='function'&&evaluateLowHpPassivesAfterHpCommit(unit,{reason:'PERIODIC_HP_RECOVERY',sourceId:unit.id,skillId:null})}else unit.mp=after;
   typeof recordValidationEvent==='function'&&recordValidationEvent('periodic_passive_recovered',{source_id:unit.id,passive_id:passiveId,resource:contract.resource,interval_ticks:contract.intervalTicks,initial_delay_ticks:contract.initialDelayTicks,recovery_rate:contract.recoveryRate,requested,applied,before,after,max,tick:battle.tick});
   if(applied>0)battle.log.push(`[Tick ${battle.tick}] [PASSIVE][PERIODIC] ${unit.name} ${passiveId} → ${contract.resource} ${applied}回復（${before}→${after}/${max}）`);
  }}
}
function passiveCooldownKey(passiveId){return `PASSIVE:${String(passiveId||'').trim()}`}
function passiveCooldownRemaining(unit,passiveId){const key=passiveCooldownKey(passiveId);if(!unit||key==='PASSIVE:')return 0;const state=ensureCooldownState(unit),entry=state[key];if(!entry)return 0;const remaining=Math.max(0,Number(entry.expiresAt||0)-Number(battle.tick||0));if(remaining<=0)delete state[key];return remaining}
function startPassiveCooldown(unit,passiveId,duration){const ticks=Math.max(0,Math.floor(Number(duration)||0)),key=passiveCooldownKey(passiveId);if(!unit||key==='PASSIVE:'||ticks<=0)return{started:false,passiveId:String(passiveId||''),duration:ticks,expiresAt:null};const state=ensureCooldownState(unit),entry={passiveId:String(passiveId),duration:ticks,startedAt:battle.tick,expiresAt:battle.tick+ticks};state[key]=entry;typeof recordValidationEvent==='function'&&recordValidationEvent('passive_cooldown_started',{source_id:unit.id,passive_id:String(passiveId),duration:ticks,started_at:entry.startedAt,expires_at:entry.expiresAt});return{started:true,...entry}}

const CURRENT_BATTLE_LOWHP_TARGETS=Object.freeze(['PHYSICAL_DAMAGE','MAGIC_DAMAGE','ACCURACY','MAGIC_ACCURACY','EVASION','BLOCK_RATE','BLOCK_PERFORMANCE','CRITICAL_RATE','CRITICAL_DAMAGE','ACTION_GAUGE_GAIN']);
function currentBattleLowHpPassiveEntries(unit){
 const rows=[];
 for(const row of currentBattlePassiveRuntimeEntries(unit)){const contract=row.runtimeContracts?.lowHpContract;if(contract==null)continue;
  const threshold=Number(contract.hpThresholdRate),duration=Number(contract.durationTicks),cooldown=Number(contract.cooldownTicks),relativeBonus=Number(contract.relativeBonus),targets=Array.isArray(contract.contributionTargets)?contract.contributionTargets.map(x=>String(x||'').toUpperCase()):[];
  if(!Number.isFinite(threshold)||threshold<=0||threshold>1||!Number.isInteger(duration)||duration<1||!Number.isInteger(cooldown)||cooldown<0||!Number.isFinite(relativeBonus)||relativeBonus<=0||targets.length!==CURRENT_BATTLE_LOWHP_TARGETS.length||targets.some((x,i)=>x!==CURRENT_BATTLE_LOWHP_TARGETS[i]))throw Object.assign(new Error(`LowHP Passive ${row.passiveId} runtime contractが不正です。`),{code:'LOWHP_PASSIVE_RUNTIME_CONTRACT_INVALID',passive_id:row.passiveId});
  rows.push({...row,contract:{hpThresholdRate:threshold,durationTicks:duration,cooldownTicks:cooldown,relativeBonus,contributionTargets:targets}});
 }
 return rows;
}
function ensureLowHpPassiveState(unit){if(!unit.lowHpPassiveStates||typeof unit.lowHpPassiveStates!=='object'||Array.isArray(unit.lowHpPassiveStates))unit.lowHpPassiveStates={};return unit.lowHpPassiveStates}
function lowHpContributionModifierId(passiveId,target){return `LOWHP:${String(passiveId)}:${String(target)}`}
function addLowHpPassiveContributions(unit,passiveId,contract){
 const entries=currentBattleModifierEntries(unit),ids=[];
 for(const target of contract.contributionTargets){const modifierId=lowHpContributionModifierId(passiveId,target);if(entries.some(row=>String(row?.modifier_id||'')===modifierId))throw Object.assign(new Error(`LowHP Contributionが重複しています: ${modifierId}`),{code:'LOWHP_PASSIVE_CONTRIBUTION_DUPLICATE',passive_id:passiveId,target_stat:target});entries.push({source_type:'PASSIVE',source_id:String(passiveId),modifier_id:modifierId,target_stat:target,mode:'RELATIVE_PERCENT',raw_modifier_value:contract.relativeBonus});ids.push(modifierId)}
 unit.formalModifierContributions=entries;return ids;
}
function removeLowHpPassiveContributions(unit,state){
 const ids=new Set(Array.isArray(state?.modifierIds)?state.modifierIds.map(String):[]);if(!ids.size)return 0;
 const before=currentBattleModifierEntries(unit),after=before.filter(row=>!ids.has(String(row?.modifier_id||'')));unit.formalModifierContributions=after;return before.length-after.length;
}
function evaluateLowHpPassivesAfterHpCommit(unit,{reason='HP_CHANGE',sourceId=null,skillId=null}={}){
 if(!unit||!unit.alive||Number(unit.hp)<=0)return[];
 const maxHp=Math.max(1,Number(unit.maxHp)||1),hp=Math.max(0,Number(unit.hp)||0),rate=hp/maxHp,activated=[],states=ensureLowHpPassiveState(unit);
 for(const row of currentBattleLowHpPassiveEntries(unit)){const {passiveId,contract}=row;if(rate>contract.hpThresholdRate)continue;if(states[passiveId]&&Number(states[passiveId].expiresAt)>Number(battle.tick||0))continue;const remaining=passiveCooldownRemaining(unit,passiveId);if(remaining>0){typeof recordValidationEvent==='function'&&recordValidationEvent('lowhp_passive_skipped',{source_id:unit.id,passive_id:passiveId,reason:'COOLDOWN',cooldown_remaining:remaining,hp,hp_max:maxHp,hp_rate:rate,threshold_rate:contract.hpThresholdRate});continue}
  const modifierIds=addLowHpPassiveContributions(unit,passiveId,contract),cooldown=startPassiveCooldown(unit,passiveId,contract.cooldownTicks),state={passiveId,startedAt:Number(battle.tick||0),expiresAt:Number(battle.tick||0)+contract.durationTicks,modifierIds};states[passiveId]=state;activated.push(state);
  typeof recordValidationEvent==='function'&&recordValidationEvent('lowhp_passive_activated',{source_id:unit.id,passive_id:passiveId,reason,action_source_id:sourceId,skill_id:skillId,hp,hp_max:maxHp,hp_rate:rate,threshold_rate:contract.hpThresholdRate,duration_ticks:contract.durationTicks,expires_at:state.expiresAt,cooldown_ticks:contract.cooldownTicks,contribution_targets:contract.contributionTargets,relative_bonus:contract.relativeBonus});
  battle.log.push(`[Tick ${battle.tick}] [PASSIVE][LOWHP] ${unit.name} ${passiveId} 発動（HP ${hp}/${maxHp}、${contract.durationTicks} Tick）`);
 }
 return activated;
}
function processLowHpPassiveExpirations(){
 for(const unit of battle.units||[]){const states=ensureLowHpPassiveState(unit);for(const [passiveId,state] of Object.entries(states)){if(Number(state?.expiresAt)>Number(battle.tick||0))continue;const removed=removeLowHpPassiveContributions(unit,state);delete states[passiveId];typeof recordValidationEvent==='function'&&recordValidationEvent('lowhp_passive_expired',{source_id:unit.id,passive_id:passiveId,started_at:state?.startedAt??null,expired_at:battle.tick,removed_contributions:removed});battle.log.push(`[Tick ${battle.tick}] [PASSIVE][LOWHP] ${unit.name} ${passiveId} 効果終了`)}}
}

function ensurePendingReactiveContext(actionContext){
 if(!actionContext||typeof actionContext!=='object')throw Object.assign(new Error('Passive ReactiveにはactionContextが必要です。'),{code:'PASSIVE_REACTIVE_ACTION_CONTEXT_REQUIRED'});
 if(!Array.isArray(actionContext.pendingReactive))actionContext.pendingReactive=[];
 if(!Number.isInteger(actionContext.reactiveEventSequence)||actionContext.reactiveEventSequence<0)actionContext.reactiveEventSequence=0;
 if(!Number.isInteger(actionContext.reactiveSequence)||actionContext.reactiveSequence<0)actionContext.reactiveSequence=0;
 return actionContext;
}
function currentBattleReactivePassiveEntries(owner,eventType){
 const event=String(eventType||'').trim();if(!event)return[];
 return currentBattlePassiveRuntimeEntries(owner).map((row,index)=>{const contract=row.runtimeContracts?.triggerContract||null;return{...row,contract,priority:Number.isInteger(Number(contract?.priority))?Number(contract.priority):0,index};}).filter(row=>String(row.contract?.engineEvent||'')===event&&String(row.contract?.phase||'').toUpperCase()==='REACTIVE'&&String(row.contract?.dispatchMode||'').toUpperCase()==='ACTION');
}
function queueCurrentBattlePassiveReactive(owner,eventType,eventContext){
 const actionContext=ensurePendingReactiveContext(eventContext?.actionContext),eventSequence=++actionContext.reactiveEventSequence,candidates=currentBattleReactivePassiveEntries(owner,eventType);
 for(const row of candidates)actionContext.pendingReactive.push({eventType:String(eventType),eventSequence,priority:row.priority,sequence:++actionContext.reactiveSequence,passiveId:row.passiveId,runtimeContracts:row.runtimeContracts,triggerContract:row.contract,eventContext:{sourceId:owner?.id||null,actionSourceId:eventContext?.actionSourceId??null,targetId:eventContext?.targetId??null,skillId:eventContext?.skillId??null,hitIndex:Number.isInteger(Number(eventContext?.hitIndex))?Number(eventContext.hitIndex):0,actionContext}});
 if(candidates.length&&typeof recordValidationEvent==='function')recordValidationEvent('passive_reactive_queued',{source_id:owner?.id||null,event_type:String(eventType),event_sequence:eventSequence,hit_index:eventContext?.hitIndex??0,candidates:candidates.map(x=>({passive_id:x.passiveId,priority:x.priority}))});
 return candidates.length;
}
function currentBattlePassiveEventTargets(targetContract,eventContext,owner){
 const eventTarget=String(targetContract?.eventTarget||'').toUpperCase();let id=null;
 if(eventTarget==='SELF')id=owner?.id??eventContext?.sourceId??null;
 else if(eventTarget==='ATTACKER')id=eventContext?.actionSourceId??null;
 else if(eventTarget==='HIT_TARGET')id=eventContext?.targetId??null;
 else throw Object.assign(new Error(`Passive EVENT_CONTEXT targetが未対応です: ${eventTarget||'(empty)'}`),{code:'PASSIVE_REACTIVE_EVENT_TARGET_UNSUPPORTED',event_target:eventTarget});
 const target=battle.units.find(x=>String(x.id)===String(id));return target?[target]:[];
}
function currentBattlePassiveActionTargets(owner,runtimeContracts,eventContext){
 const tc=runtimeContracts?.targetContract;if(!tc||typeof tc!=='object'||Array.isArray(tc))throw Object.assign(new Error('Reactive Passive targetContractがありません。'),{code:'PASSIVE_REACTIVE_TARGET_CONTRACT_REQUIRED'});
 const mode=String(tc.mode||'').toUpperCase();if(mode==='EVENT_CONTEXT')return currentBattlePassiveEventTargets(tc,eventContext,owner);
 if(mode!=='FORMAL_TARGET')throw Object.assign(new Error(`Reactive Passive target.modeは未対応です: ${mode||'(empty)'}`),{code:'PASSIVE_REACTIVE_TARGET_MODE_UNSUPPORTED',mode});
 const definition={target:{side:String(tc.side||'').toLowerCase(),range:String(tc.range||'').toLowerCase(),randomCount:tc.randomCount??null},logicOrder:[]},hint=battle.units.find(x=>String(x.id)===String(eventContext?.targetId??''))||null,resolved=resolveTaggedTargets(owner,hint,definition);
 if(!resolved.ok)throw Object.assign(new Error(`Reactive Passive FORMAL_TARGETを解決できません: ${resolved.reason}`),{code:'PASSIVE_REACTIVE_FORMAL_TARGET_RESOLUTION_FAILED',reason:resolved.reason});return resolved.targets;
}
function currentBattlePassiveExecutionView(entry){
 const execution=entry?.runtimeContracts?.executionContract;if(!execution||typeof execution!=='object'||Array.isArray(execution))throw Object.assign(new Error(`Reactive Passive ${entry?.passiveId||''}にexecutionContractがありません。`),{code:'PASSIVE_REACTIVE_EXECUTION_CONTRACT_REQUIRED',passive_id:entry?.passiveId||null});
 const referencedSkillId=String(execution.referencedSkillId||'').trim(),effectContracts=Array.isArray(execution.effectContracts)?execution.effectContracts:[],applyContracts=Array.isArray(execution.applyContracts)?execution.applyContracts:[];if(!referencedSkillId)throw Object.assign(new Error(`Reactive Passive ${entry?.passiveId||''}のreferencedSkillIdがありません。`),{code:'PASSIVE_REACTIVE_REFERENCED_SKILL_REQUIRED',passive_id:entry?.passiveId||null});
 const logicOrder=[];if(effectContracts.some(x=>String(x?.type||'').toUpperCase()==='DAMAGE'))logicOrder.push('ATTACK');for(const row of applyContracts){const logic=String(row?.logic||row?.kind||'').toUpperCase();if(logic&&!logicOrder.includes(logic))logicOrder.push(logic)}for(const type of ['HEAL','REMOVE','RESOURCE_CHANGE','REVIVE'])if(effectContracts.some(x=>String(x?.type||'').toUpperCase()===type)&&!logicOrder.includes(type))logicOrder.push(type);
 return{ok:true,definition:{id:referencedSkillId,name:`Passive ${entry.passiveId} -> ${referencedSkillId}`,parameters:{},logicOrder,target:{side:'self',range:'single'},runtimeContracts:{schemaVersion:1,effectContracts:JSON.parse(JSON.stringify(effectContracts)),applyContracts:JSON.parse(JSON.stringify(applyContracts)),auraEffectContract:execution.auraEffectContract?JSON.parse(JSON.stringify(execution.auraEffectContract)):null}}};
}
function executeCurrentBattlePassiveAction(entry,eventContext,actionContext){
 const owner=battle.units.find(x=>String(x.id)===String(eventContext?.sourceId??''));if(!owner?.alive)return{ok:false,reason:'PASSIVE_OWNER_DEAD'};
 const compiled=currentBattlePassiveExecutionView(entry),targets=currentBattlePassiveActionTargets(owner,entry.runtimeContracts,eventContext),effects=compiled.definition.runtimeContracts.effectContracts||[],apply=compiled.definition.runtimeContracts.applyContracts||[],hasDamage=effects.some(x=>String(x?.type||'').toUpperCase()==='DAMAGE'),hitApply=apply.filter(x=>['STATUS','DOT','BUFF','DEBUFF'].includes(String(x?.logic||x?.kind||'').toUpperCase())),results=[];
 for(const target of targets){let damageResult=null;if(hasDamage&&target.alive)damageResult=executeRuntimeDamageRuntime(owner,target,compiled,{triggerActionContext:actionContext,onHitSafePoint:({result,hitIndex})=>runCurrentBattleHitSafePoint(owner,target,compiled,result,{origin:'passive',triggerActionContext:actionContext,hitIndex})});if(!hasDamage&&target.alive)for(const c of hitApply){const logic=String(c?.logic||c?.kind||'').toUpperCase();applyTaggedApplyRuntime(owner,target,compiled,logic,{attackSucceeded:true,applyContract:c})}for(const contract of effects){const type=String(contract?.type||'').toUpperCase();if(type==='DAMAGE')continue;if(type==='HEAL')executeRuntimeHealRuntime(owner,target,compiled);else if(type==='REMOVE')executeRuntimeRemoveRuntime(owner,target,compiled);else if(type==='RESOURCE_CHANGE')executeRuntimeResourceChangeRuntime(owner,target,compiled);else if(type==='REVIVE')executeRuntimeReviveRuntime(owner,target,compiled)}if(target.alive)for(const c of apply.filter(x=>String(x?.logic||x?.kind||'').toUpperCase()==='SHIELD'))applyTaggedApplyRuntime(owner,target,compiled,'SHIELD',{attackSucceeded:!hasDamage||!!damageResult?.ok,applyContract:c});results.push({targetId:target.id,damageResult})}
 return{ok:true,targets:results};
}
function currentBattleCounterPassiveEntries(owner){
 const rows=[];for(const row of currentBattlePassiveRuntimeEntries(owner)){const contract=row.runtimeContracts?.triggerContract||null;if(String(contract?.engineEvent||'')!=='hit_received'||String(contract?.dispatchMode||'').toUpperCase()!=='COUNTER')continue;rows.push({...row,contract,priority:Number.isInteger(Number(contract?.priority))?Number(contract.priority):0});}return rows.sort((a,b)=>b.priority-a.priority||String(a.passiveId).localeCompare(String(b.passiveId)));
}
function dispatchCurrentBattlePassiveCounters(attacker,defender,incomingCompiled,attackResult,{triggerActionContext=null,hitIndex=0}={}){
 if(!attackResult?.ok||!defender?.alive||!triggerActionContext)return{ok:true,processed:0,results:[]};const context=ensurePendingReactiveContext(triggerActionContext),engine=globalThis.GKSTriggerEngine,eventContext={sourceId:defender.id,actionSourceId:attacker?.id||null,targetId:defender.id,skillId:incomingCompiled?.definition?.id||null,hitIndex:Number.isInteger(Number(hitIndex))?Number(hitIndex):0,actionContext:context},results=[];
 for(const row of currentBattleCounterPassiveEntries(defender)){const remaining=passiveCooldownRemaining(defender,row.passiveId);if(remaining>0){results.push({passiveId:row.passiveId,ok:false,reason:'COOLDOWN'});continue}const key=`PASSIVE:${row.passiveId}:${String(row.contract?.type||'ON_HIT_RECEIVED')}:COUNTER`,guard=engine?.canActivate?engine.canActivate(context,key):{ok:true,key};if(!guard.ok){results.push({passiveId:row.passiveId,ok:false,reason:guard.reason});continue}const chance=Object.prototype.hasOwnProperty.call(row.contract||{},'activationChance')?Number(row.contract.activationChance):1;if(!Number.isFinite(chance)||chance<0||chance>1)throw Object.assign(new Error(`Counter Passive ${row.passiveId}のactivationChanceが不正です。`),{code:'PASSIVE_COUNTER_ACTIVATION_CHANCE_INVALID',passive_id:row.passiveId});if(chance<=0){results.push({passiveId:row.passiveId,ok:false,reason:'ACTIVATION_CHANCE_ZERO'});continue}let roll=null;if(chance<1){roll=currentBattleRoll(defender,attacker||{id:''},row.passiveId,'activation:counter',Number(hitIndex)||0);if(roll>=chance){results.push({passiveId:row.passiveId,ok:false,reason:'ACTIVATION_CHANCE_FAILED',activationChance:chance,activationRoll:roll});continue}}const activation=engine?.commitActivation?engine.commitActivation(context,key,{kind:'COUNTER',passiveId:row.passiveId,event:'hit_received'}):acquireTaggedTriggerActivation(context,key,{kind:'COUNTER',passiveId:row.passiveId,event:'hit_received'});if(!activation?.ok){results.push({passiveId:row.passiveId,ok:false,reason:activation?.reason||'TRIGGER_COMMIT_FAILED'});continue}try{const cooldownTicks=Number.isInteger(row.contract?.cooldownTicks)?row.contract.cooldownTicks:0;if(cooldownTicks>0)startPassiveCooldown(defender,row.passiveId,cooldownTicks);const executed=executeCurrentBattlePassiveAction(row,eventContext,context);if(typeof recordValidationEvent==='function')recordValidationEvent('passive_counter_executed',{source_id:defender.id,action_source_id:attacker?.id||null,passive_id:row.passiveId,trigger_type:row.contract?.type||'ON_HIT_RECEIVED',hit_index:eventContext.hitIndex,activation_chance:chance,activation_roll:roll,referenced_skill_id:row.runtimeContracts?.executionContract?.referencedSkillId||null,ok:executed.ok===true});results.push({passiveId:row.passiveId,ok:executed.ok===true,result:executed})}finally{activation.release?.()}}
 return{ok:true,processed:results.length,results};
}
function flushCurrentBattlePassiveReactive(actionContext,{hitIndex=null}={}){
 const context=ensurePendingReactiveContext(actionContext),selected=[],keep=[];for(const row of context.pendingReactive){if(hitIndex==null||Number(row?.eventContext?.hitIndex)===Number(hitIndex))selected.push(row);else keep.push(row)}context.pendingReactive=keep;selected.sort((a,b)=>a.eventSequence-b.eventSequence||b.priority-a.priority||a.sequence-b.sequence);const results=[],engine=globalThis.GKSTriggerEngine;
 for(const row of selected){const owner=battle.units.find(x=>String(x.id)===String(row.eventContext?.sourceId??''));if(!owner?.alive){results.push({passiveId:row.passiveId,ok:false,reason:'PASSIVE_OWNER_DEAD'});continue}const remaining=passiveCooldownRemaining(owner,row.passiveId);if(remaining>0){results.push({passiveId:row.passiveId,ok:false,reason:'COOLDOWN'});continue}const key=`PASSIVE:${row.passiveId}:${String(row.triggerContract?.type||row.eventType)}`,guard=engine?.canActivate?engine.canActivate(context,key):{ok:true,key};if(!guard.ok){results.push({passiveId:row.passiveId,ok:false,reason:guard.reason});continue}const chance=Object.prototype.hasOwnProperty.call(row.triggerContract||{},'activationChance')?Number(row.triggerContract.activationChance):1;if(!Number.isFinite(chance)||chance<0||chance>1)throw Object.assign(new Error(`Reactive Passive ${row.passiveId}のactivationChanceが不正です。`),{code:'PASSIVE_REACTIVE_ACTIVATION_CHANCE_INVALID',passive_id:row.passiveId});if(chance<=0){results.push({passiveId:row.passiveId,ok:false,reason:'ACTIVATION_CHANCE_ZERO'});continue}let roll=null;if(chance<1){const target=battle.units.find(x=>String(x.id)===String(row.eventContext?.targetId??''))||{id:row.eventContext?.targetId||''};roll=currentBattleRoll(owner,target,row.passiveId,`activation:${row.eventType}`,row.sequence);if(roll>=chance){results.push({passiveId:row.passiveId,ok:false,reason:'ACTIVATION_CHANCE_FAILED',activationChance:chance,activationRoll:roll});continue}}const activation=engine?.commitActivation?engine.commitActivation(context,key,{kind:String(row.triggerContract?.type||''),passiveId:row.passiveId,event:row.eventType}):acquireTaggedTriggerActivation(context,key,{kind:String(row.triggerContract?.type||''),passiveId:row.passiveId,event:row.eventType});if(!activation?.ok){results.push({passiveId:row.passiveId,ok:false,reason:activation?.reason||'TRIGGER_COMMIT_FAILED'});continue}try{const cooldownTicks=Number.isInteger(row.triggerContract?.cooldownTicks)?row.triggerContract.cooldownTicks:0;if(cooldownTicks>0)startPassiveCooldown(owner,row.passiveId,cooldownTicks);const executed=executeCurrentBattlePassiveAction(row,row.eventContext,context);if(typeof recordValidationEvent==='function')recordValidationEvent('passive_reactive_executed',{source_id:owner.id,passive_id:row.passiveId,trigger_type:row.triggerContract?.type||null,event_type:row.eventType,event_sequence:row.eventSequence,priority:row.priority,sequence:row.sequence,hit_index:row.eventContext?.hitIndex??0,activation_chance:chance,activation_roll:roll,referenced_skill_id:row.runtimeContracts?.executionContract?.referencedSkillId||null,ok:executed.ok===true});results.push({passiveId:row.passiveId,ok:executed.ok===true,result:executed})}finally{activation.release?.()}}
 return{ok:true,processed:selected.length,results};
}
function dispatchCurrentBattleStartPassiveReactives(){
 const engine=globalThis.GKSTriggerEngine,context=engine?.createActionContext?engine.createActionContext({actionId:`battle_start:${battle?.p0113TieSeed??battle?.tick??0}`}):{actionId:`battle_start:${battle?.tick??0}`,maxActivations:16,activationCount:0,activeKeys:new Set(),history:[],pendingReactive:[],reactiveEventSequence:0,reactiveSequence:0};
 for(const unit of battle.units||[]){if(!unit?.alive)continue;queueCurrentBattlePassiveReactive(unit,'battle_start',{actionSourceId:null,targetId:null,skillId:null,hitIndex:0,actionContext:context})}
 return flushCurrentBattlePassiveReactive(context);
}
function resolveFatalDamageInterrupt(target,{actionSourceId=null,skillId=null,hitIndex=0,projectedHp=null,actionContext=null,damageKind='DAMAGE'}={}){
 const projected=Number(projectedHp);if(!target?.alive||!Number.isFinite(projected)||projected>0)return{triggered:false,projectedHp:projected};
 const engine=globalThis.GKSTriggerEngine,candidates=currentBattlePassiveRuntimeEntries(target).map((row,sequence)=>{const contract=row.runtimeContracts?.triggerContract||null;return{...row,contract,priority:Number.isInteger(Number(contract?.priority))?Number(contract.priority):0,sequence};}).filter(row=>String(row.contract?.type||'').toUpperCase()==='ON_FATAL_DAMAGE'&&String(row.contract?.engineEvent||'')==='fatal_damage'&&String(row.contract?.phase||'').toUpperCase()==='INTERRUPT'&&String(row.contract?.dispatchMode||'').toUpperCase()==='ACTION').sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);
 for(const candidate of candidates){const {passiveId,contract}=candidate,cooldownTicks=contract.cooldownTicks,surviveHp=contract.surviveHp;if(!Number.isInteger(cooldownTicks)||cooldownTicks<0)throw Object.assign(new Error(`ON_FATAL_DAMAGE Passive ${passiveId}に有効なcooldownTicksがありません。`),{code:'FATAL_DAMAGE_PASSIVE_COOLDOWN_REQUIRED',passive_id:passiveId});const remaining=passiveCooldownRemaining(target,passiveId);if(remaining>0){typeof recordValidationEvent==='function'&&recordValidationEvent('fatal_damage_passive_skipped',{source_id:target.id,passive_id:passiveId,reason:'COOLDOWN',cooldown_remaining:remaining});continue}
  const key=`PASSIVE:${passiveId}:ON_FATAL_DAMAGE`,context=actionContext||(engine?.createActionContext?engine.createActionContext({actionId:`${battle.tick}:${target.id}:${passiveId}:fatal_damage`}):createTaggedTriggerActionContext(target,{definition:{id:passiveId}},null)),guard=engine?.canActivate?engine.canActivate(context,key):{ok:true,key};if(!guard.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('fatal_damage_passive_skipped',{source_id:target.id,passive_id:passiveId,reason:guard.reason||'TRIGGER_GUARD_REJECTED'});continue}
  const chance=Object.prototype.hasOwnProperty.call(contract,'activationChance')?Number(contract.activationChance):1;if(!Number.isFinite(chance)||chance<0||chance>1)throw Object.assign(new Error(`ON_FATAL_DAMAGE Passive ${passiveId}のactivationChanceが不正です。`),{code:'FATAL_DAMAGE_PASSIVE_ACTIVATION_CHANCE_INVALID',passive_id:passiveId});if(chance<=0){typeof recordValidationEvent==='function'&&recordValidationEvent('fatal_damage_passive_skipped',{source_id:target.id,passive_id:passiveId,reason:'ACTIVATION_CHANCE_ZERO'});continue}let roll=null;if(chance<1){roll=currentBattleRoll(target,{id:actionSourceId||''},passiveId,'activation:fatal_damage',hitIndex);if(roll>=chance){typeof recordValidationEvent==='function'&&recordValidationEvent('fatal_damage_passive_skipped',{source_id:target.id,passive_id:passiveId,reason:'ACTIVATION_CHANCE_FAILED',activation_chance:chance,activation_roll:roll});continue}}
  const activation=engine?.commitActivation?engine.commitActivation(context,key,{kind:'ON_FATAL_DAMAGE',passiveId,event:'fatal_damage'}):acquireTaggedTriggerActivation(context,key,{kind:'ON_FATAL_DAMAGE',passiveId,event:'fatal_damage'});if(!activation?.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('fatal_damage_passive_skipped',{source_id:target.id,passive_id:passiveId,reason:activation?.reason||'TRIGGER_COMMIT_FAILED'});continue}try{if(!Number.isInteger(surviveHp)||surviveHp<1)throw Object.assign(new Error(`ON_FATAL_DAMAGE Passive ${passiveId}に有効なsurviveHpがありません。`),{code:'FATAL_DAMAGE_PASSIVE_SURVIVE_HP_REQUIRED',passive_id:passiveId});const cooldown=startPassiveCooldown(target,passiveId,cooldownTicks),resolvedHp=surviveHp;typeof recordValidationEvent==='function'&&recordValidationEvent('fatal_damage_interrupted',{source_id:target.id,action_source_id:actionSourceId,skill_id:skillId,hit_index:hitIndex,passive_id:passiveId,damage_kind:damageKind,projected_hp:projected,resolved_hp:resolvedHp,cooldown_duration:cooldown.duration,activation_chance:chance,activation_roll:roll});return{triggered:true,passiveId,projectedHp:projected,resolvedHp,cooldown,activationChance:chance,activationRoll:roll}}finally{activation.release?.()}
 }
 return{triggered:false,projectedHp:projected};
}
function currentBattleMagicIncreaseRate(unit){const rate=currentBattleFinite(unit?.magicIncreaseRate??unit?.magic_increase_rate,1);return Math.max(0,rate)}
function currentBattleMagicWeaponBonus(unit){return Math.max(0,currentBattleFinite(unit?.magicWeaponBonus??unit?.magic_weapon_bonus,0))}
function currentBattleRoll(source,target,skillId,purpose,index=0){const sequence=Math.max(0,Math.floor(Number(battle.formalRandomSequence)||0));battle.formalRandomSequence=sequence+1;const seed=String(battle.p0113TieSeed??'FORMAL-BATTLE');const text=`${seed}|${battle.tick}|${source?.id||''}|${target?.id||''}|${skillId||''}|${purpose}|${index}|${sequence}`;let hash;if(typeof p0113Hash32==='function')hash=p0113Hash32(text);else{hash=2166136261>>>0;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0}}return(hash>>>0)/4294967296}
function resolveRuntimeDamageContracts(compiled){
 const contracts=(compiled?.definition?.runtimeContracts?.effectContracts||[]).filter(x=>x?.type==='DAMAGE');
 if(!contracts.length)return{formal:false,ok:true,contracts:[]};
 const checked=[];
 for(const contract of contracts){const damageType=contract.damageType==null?null:String(contract.damageType).toUpperCase();if(!Number.isFinite(contract.power)||contract.power<0)return{formal:true,ok:false,reason:'SKILL_RUNTIME_DAMAGE_POWER_INVALID',contract};if(damageType!=null&&!['PHYSICAL','MAGICAL','FIXED'].includes(damageType))return{formal:true,ok:false,reason:'SKILL_RUNTIME_DAMAGE_TYPE_INVALID',contract};const elementCheck=normalizeRuntimeElementComponents(contract.elementComponents);if(!elementCheck.ok)return{formal:true,ok:false,reason:elementCheck.reason,contract};checked.push({type:'DAMAGE',power:contract.power,damageType:damageType||'PHYSICAL',...(elementCheck.components?{elementComponents:elementCheck.components}:{})});}
 return{formal:true,ok:true,contracts:checked};
}
function currentBattleFormationDamageMultiplier(attacker,range){
 const normalized=String(range||'').toLowerCase();
 if(['back','all'].includes(normalized))return 1;
 if(String(attacker?.formationPosition||'FRONTLINE')==='BACKLINE'&&['single','front','random'].includes(normalized))return 0.5;
 return 1;
}
function calculateCurrentSkillBaseDamage(attacker,contract){
 if(contract.damageType==='FIXED')return Math.max(0,contract.power);
 if(contract.damageType==='MAGICAL'){const base=Math.max(0,currentBattleMagicIncreaseRate(attacker)*contract.power*(1+currentBattleMagicWeaponBonus(attacker)/100));return Math.max(0,currentBattleResolveDirectModifierTarget(base,'MAGIC_DAMAGE',attacker).final_value)}
 const base=Math.max(0,effectiveAttackValue(attacker)*(contract.power/100));return Math.max(0,currentBattleResolveDirectModifierTarget(base,'PHYSICAL_DAMAGE',attacker).final_value);
}
function applyCurrentFormalDamage(attacker,target,baseDamage,compiled,contract,{hitIndex=0,actionContext=null}={}){
 if(!target?.alive)return{ok:false,miss:false,reason:'TARGET_DEAD',hitIndex};
 const criticalResolution=currentBattleCriticalResolution(attacker),criticalRate=Math.max(0,Math.min(100,criticalResolution.final_critical_rate*100)),criticalRoll=currentBattleRoll(attacker,target,compiled?.definition?.id,'critical',hitIndex)*100,critical=criticalRoll<criticalRate,hitBypass=critical?'CRITICAL_GUARANTEED_HIT':null,magical=contract.damageType==='MAGICAL',hitRate=critical?null:(magical?currentBattleMagicHitRatePercent(attacker,target):currentBattleHitRatePercent(attacker,target)),hitRoll=critical?null:currentBattleRoll(attacker,target,compiled?.definition?.id,'hit',hitIndex)*100;
 const reactiveEventContext={actionSourceId:attacker.id,targetId:target.id,skillId:compiled?.definition?.id||null,hitIndex,actionContext};if(actionContext&&critical)queueCurrentBattlePassiveReactive(attacker,'critical',reactiveEventContext);
 if(!critical&&hitRoll>=hitRate){if(actionContext)queueCurrentBattlePassiveReactive(target,'evade',reactiveEventContext);queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:true,damage:0});typeof recordValidationEvent==='function'&&recordValidationEvent('attack_missed',{source_id:attacker.id,target_id:target.id,skill_id:compiled?.definition?.id||null,hit_index:hitIndex,accuracy:currentBattleAccuracy(attacker),evasion:currentBattleEvasion(target),magic_accuracy:magical?currentBattleMagicAccuracy(attacker):null,magic_resistance:magical?currentBattleMagicResistance(target):null,critical_rate:criticalRate,critical_roll:criticalRoll,critical:false,hit_bypass:null,hit_rate:hitRate,hit_roll:hitRoll});battle.log.push(`[Tick ${battle.tick}] [TAG][MISS] ${attacker.name}の${compiled.definition.name} → ${target.name}（命中率${hitRate.toFixed(2)}%）`);return{ok:false,miss:true,damage:0,baseDamage,hitIndex,critical:false,criticalRate,criticalRoll,hitBypass:null,hitRate,hitRoll}}
 if(actionContext)queueCurrentBattlePassiveReactive(attacker,'hit_dealt',reactiveEventContext);
 const resistance=effectiveDamageResist(target),postResistance=Math.max(0,baseDamage*(1-resistance/100)),criticalDamage=currentBattleCriticalDamagePercent(attacker),criticalBonusReduction=typeof currentBattleCriticalBonusDamageReduction==='function'?currentBattleCriticalBonusDamageReduction(target):0,criticalBonus=critical?(criticalDamage/100)*(1-criticalBonusReduction):0,criticalMultiplier=1+criticalBonus,preElementDamage=Math.max(0,postResistance*criticalMultiplier),elementDamage=Array.isArray(contract.elementComponents)&&contract.elementComponents.length?currentBattleResolveElementDamage(target,preElementDamage,contract.elementComponents):{elemental:false,totalDamage:preElementDamage,components:[]},formationMultiplier=(()=>{const r=String(compiled?.definition?.target?.range||'').toLowerCase(),pos=String(attacker?.formationPosition||attacker?.formation_position||'FRONTLINE').toUpperCase();return pos==='BACKLINE'&&!['back','all'].includes(r)?0.5:1})(),finalDamage=Math.max(0,Math.floor(elementDamage.totalDamage*formationMultiplier));
 const blockRate=Math.max(0,Math.min(1,typeof currentBattleResolveDirectModifierTarget==='function'?currentBattleResolveDirectModifierTarget(Number(target?.blockRate??target?.block_rate)||0,'BLOCK_RATE',target).final_value:(Number(target?.blockRate??target?.block_rate)||0))),blockRoll=blockRate>0?currentBattleRoll(attacker,target,compiled?.definition?.id,'block',hitIndex):null,block=resolveCurrentBlockDamage(target,finalDamage,blockRoll);if(actionContext&&block.blocked)queueCurrentBattlePassiveReactive(target,'block',reactiveEventContext);const before=target.hp,shield=consumeShieldDamage(target,block.damage,{sourceId:attacker.id,skillId:compiled.definition.id,damageType:'formal_skill'}),projectedHp=before-shield.hpDamage,fatalInterrupt=projectedHp<=0?resolveFatalDamageInterrupt(target,{actionSourceId:attacker.id,skillId:compiled.definition.id,hitIndex,projectedHp,actionContext,damageKind:'FORMAL_SKILL_DAMAGE'}):{triggered:false,projectedHp};target.hp=fatalInterrupt.triggered?fatalInterrupt.resolvedHp:Math.max(0,projectedHp);typeof evaluateLowHpPassivesAfterHpCommit==='function'&&evaluateLowHpPassivesAfterHpCommit(target,{reason:'FORMAL_SKILL_DAMAGE',sourceId:attacker.id,skillId:compiled.definition.id});const applied=before-target.hp;if(actionContext)queueCurrentBattlePassiveReactive(target,'hit_received',reactiveEventContext);queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${compiled.definition.name} Hit${hitIndex+1} → ${target.name}に${applied}HPダメージ（基礎${baseDamage}、耐性${resistance}%、Crit${critical?'ON':'OFF'}、シールド吸収${shield.absorbed}、残HP ${target.hp}/${target.maxHp}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('formal_attack',{source_id:attacker.id,target_id:target.id,skill_id:compiled.definition.id,hit_index:hitIndex,damage_type:contract.damageType,power:contract.power,element_components:contract.elementComponents||null,element_damage:elementDamage.components,accuracy:currentBattleAccuracy(attacker),evasion:currentBattleEvasion(target),magic_accuracy:magical?currentBattleMagicAccuracy(attacker):null,magic_resistance:magical?currentBattleMagicResistance(target):null,hit_bypass:hitBypass,hit_rate:hitRate,hit_roll:hitRoll,base_damage:baseDamage,resistance,post_resistance_damage:postResistance,weapon_critical_rate:criticalResolution.weapon_critical_rate,LUK:criticalResolution.LUK,base_critical_rate:criticalResolution.base_critical_rate,final_critical_rate:criticalResolution.final_critical_rate,critical_rate:criticalRate,critical_roll:criticalRoll,result:critical,critical,critical_contributions:criticalResolution.contributions,critical_damage:criticalDamage,critical_multiplier:criticalMultiplier,formation_position:String(attacker?.formationPosition||'FRONTLINE'),formation_multiplier:formationMultiplier,final_damage:finalDamage,block_rate:block.blockRate,block_roll:block.blockRoll,blocked:block.blocked,block_damage_cut_rate:block.blockDamageCutRate,blocked_damage:block.damage,shield_absorbed:shield.absorbed,fatal_interrupt:!!fatalInterrupt.triggered,fatal_passive_id:fatalInterrupt.passiveId||null,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){resetCombatantOnDeath(target,{reason:'formal_skill_damage',sourceId:attacker.id});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}finishIfNeeded();return{ok:true,miss:false,damage:applied,baseDamage,resistance,postResistanceDamage:postResistance,critical,criticalRate,criticalRoll,criticalDamage,formationMultiplier,finalDamage,elementDamage,blocked:block.blocked,blockRate:block.blockRate,blockRoll:block.blockRoll,blockDamageCutRate:block.blockDamageCutRate,blockedDamage:block.damage,shieldAbsorbed:shield.absorbed,beforeHp:before,afterHp:target.hp,hitIndex,hitBypass,hitRate,hitRoll};
}
function executeRuntimeDamageRuntime(attacker,target,compiled,{triggerActionContext=null,onHitSafePoint=null}={}){
 const resolved=resolveRuntimeDamageContracts(compiled);if(!resolved.formal)return null;
 if(!resolved.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('skill_damage_rejected',{source_id:attacker?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,reason:resolved.reason});return{ok:false,error:true,reason:resolved.reason}}
 const hitApplyContracts=(compiled?.definition?.runtimeContracts?.applyContracts||[]).filter(contract=>['STATUS','DOT','BUFF','DEBUFF'].includes(String(contract?.logic||contract?.kind||'').toUpperCase()));
 const hits=[],hitApplyResults=[];let totalDamage=0,anyHit=false;
 for(let i=0;i<resolved.contracts.length;i++){
  if(!target?.alive)break;
  const contract=resolved.contracts[i],baseDamage=calculateCurrentSkillBaseDamage(attacker,contract),result=applyCurrentFormalDamage(attacker,target,baseDamage,compiled,contract,{hitIndex:i,actionContext:triggerActionContext});
  const perHitApply=[];
  if(result.ok&&target?.alive){for(const applyContract of hitApplyContracts){const logic=String(applyContract?.logic||applyContract?.kind||'').toUpperCase(),applied=applyTaggedApplyRuntime(attacker,target,compiled,logic,{attackSucceeded:true,applyContract});perHitApply.push({logic,effectId:applyContract?.effectId||null,contract:applyContract,result:applied});}}
  hits.push({...result,effectContract:{...contract},applyResults:perHitApply});
  if(perHitApply.length)hitApplyResults.push({hitIndex:i,results:perHitApply});
  if(result.ok)anyHit=true;
  totalDamage+=Number(result.damage)||0;
  if(typeof onHitSafePoint==='function')onHitSafePoint({result,hitIndex:i,contract,perHitApply});
  typeof recordValidationEvent==='function'&&recordValidationEvent('skill_damage_executed',{source_id:attacker.id,target_id:target.id,skill_id:compiled.definition.id,hit_index:i,power:contract.power,damage_type:contract.damageType,base_damage:baseDamage,applied_damage:result.damage,miss:result.miss===true,critical:result.critical===true});
 }
 const first=hits[0]||{};return{...first,ok:anyHit,miss:!anyHit&&hits.some(x=>x.miss),runtimeContracts:true,effectContracts:resolved.contracts.map(x=>({...x})),hits,hitApplyHandled:hitApplyContracts.length>0,hitApplyResults,totalDamage,damage:totalDamage};
}
function resolveRuntimeHealContract(compiled){
 const contract=compiled?.definition?.runtimeContracts?.effectContracts?.find(x=>x?.type==='HEAL')||null;
 if(!contract)return{formal:false,ok:true,contract:null};
 if(!Number.isFinite(contract.power)||contract.power<0)return{formal:true,ok:false,reason:'SKILL_RUNTIME_HEAL_POWER_INVALID',contract};
 return{formal:true,ok:true,contract:{type:'HEAL',power:contract.power}};
}
function executeRuntimeHealRuntime(source,target,compiled){
 const resolved=resolveRuntimeHealContract(compiled);if(!resolved.formal)return null;
 if(!resolved.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('skill_heal_rejected',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,reason:resolved.reason});return{ok:false,error:true,reason:resolved.reason}}
 const magicIncreaseRate=currentBattleMagicIncreaseRate(source),baseRequested=Math.max(0,Math.floor(Math.max(0,Number(target?.maxHp)||0)*(resolved.contract.power/100))),requested=Math.max(0,Math.ceil(magicIncreaseRate*baseRequested)),result=applyTaggedHeal(source,target,compiled,requested);
 typeof recordValidationEvent==='function'&&recordValidationEvent('skill_heal_executed',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,power:resolved.contract.power,magic_increase_rate:magicIncreaseRate,requested_heal:requested,applied_heal:result.healed,overheal:result.overheal});
 return{...result,runtimeContracts:true,effectContract:{...resolved.contract},magicIncreaseRate};
}
function applyTaggedDamage(attacker,target,damage,skill){
 const before=target.hp,defense=applyDefenseResistance(target,damage),shield=consumeShieldDamage(target,defense.damage,{sourceId:attacker.id,skillId:skill.id,damageType:'tag_attack'});target.hp=Math.max(0,target.hp-shield.hpDamage);typeof evaluateLowHpPassivesAfterHpCommit==='function'&&evaluateLowHpPassivesAfterHpCommit(target,{reason:'TAG_ATTACK_DAMAGE',sourceId:attacker.id,skillId:skill.id});const applied=before-target.hp;
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});
 attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${skill.name} → ${target.name}に${applied}HPダメージ（防御耐性${defense.resistance}%、耐性前${defense.rawDamage}、シールド吸収${shield.absorbed}、DAMAGE=${skill.parameters.damage}, 残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('attack',{source_id:attacker.id,target_id:target.id,skill_id:skill.id,raw_damage:defense.rawDamage,defense_resistance:defense.resistance,post_resistance_damage:defense.damage,shield_absorbed:shield.absorbed,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){resetCombatantOnDeath(target,{reason:'tag_attack',sourceId:attacker.id});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
 finishIfNeeded();return{ok:true,damage:applied,rawDamage:defense.rawDamage,defenseResistance:defense.resistance,postResistanceDamage:defense.damage,shieldAbsorbed:shield.absorbed,beforeHp:before,afterHp:target.hp};
}
function applyTaggedHeal(source,target,compiled,requestedOverride=null){
 if(!target?.alive)return{ok:false,reason:'回復対象が無効です'};
 const requested=requestedOverride==null?Math.max(0,Math.floor(Number(compiled.definition.parameters.heal)||0)):requestedOverride,before=target.hp;
 target.hp=Math.min(target.maxHp,target.hp+requested);typeof evaluateLowHpPassivesAfterHpCommit==='function'&&evaluateLowHpPassivesAfterHpCommit(target,{reason:'HEAL',sourceId:source.id,skillId:compiled.definition.id});
 const applied=target.hp-before,overheal=Math.max(0,requested-applied);
 battle.log.push(`[Tick ${battle.tick}] [TAG][HEAL] ${source.name}の${compiled.definition.name} → ${target.name}を${applied}回復（HEAL=${requested}, HP ${before}→${target.hp}/${target.maxHp}${overheal?`, 超過${overheal}`:''}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('heal',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,requested,applied,overheal,hp_before:before,hp_after:target.hp,max_hp:target.maxHp});
 return{ok:true,requested,healed:applied,overheal,beforeHp:before,afterHp:target.hp};
}
const DOT_STACK_TYPES={poison:{id:'poison',label:'毒',maxStack:5}};
let dotStackSequence=0;
function resolveDotType(compiled){if(compiled.parsed?.generalTags?.has('毒属性'))return DOT_STACK_TYPES.poison;return{id:'generic-dot',label:'DOT',maxStack:5}}
function ensureDotStackList(target){if(!Array.isArray(target.dotStacks))target.dotStacks=[];return target.dotStacks}
function resolveDotStackLifecyclePolicy(lifecycle){
 const policy=lifecycle&&typeof lifecycle==='object'?lifecycle:null;if(!policy)return{ok:false,reason:'DOT lifecycle契約がありません'};
 const stackRule=String(policy.stackRule||'').toUpperCase(),refreshRule=String(policy.refreshRule||'').toUpperCase(),snapshotPolicy=String(policy.snapshotPolicy||'').toUpperCase(),effectiveRule=String(policy.effectiveRule||'').toUpperCase(),consumeRule=String(policy.consumeRule||'').toUpperCase(),maxStacks=Number(policy.maxStacks);
 if(stackRule!=='STACK')return{ok:false,reason:`DOT lifecycle stackRule=${stackRule||'(empty)'} は未対応です`,field:'stackRule',value:stackRule};
 if(refreshRule!=='KEEP')return{ok:false,reason:`DOT lifecycle refreshRule=${refreshRule||'(empty)'} は未対応です`,field:'refreshRule',value:refreshRule};
 if(snapshotPolicy!=='SNAPSHOT')return{ok:false,reason:`DOT lifecycle snapshotPolicy=${snapshotPolicy||'(empty)'} は未対応です`,field:'snapshotPolicy',value:snapshotPolicy};
 if(effectiveRule!=='SUM')return{ok:false,reason:`DOT lifecycle effectiveRule=${effectiveRule||'(empty)'} は未対応です`,field:'effectiveRule',value:effectiveRule};
 if(consumeRule!=='NONE')return{ok:false,reason:`DOT lifecycle consumeRule=${consumeRule||'(empty)'} は未対応です`,field:'consumeRule',value:consumeRule};
 if(!Number.isInteger(maxStacks)||maxStacks<1)return{ok:false,reason:'DOT lifecycle maxStacksは1以上の整数が必要です',field:'maxStacks',value:policy.maxStacks};
 return{ok:true,stackRule,refreshRule,snapshotPolicy,effectiveRule,consumeRule,maxStacks};
}
function applyDotStackLifecycle(list,{identityKey,gain,newStack}={},lifecycle){
 if(!Array.isArray(list))return{ok:false,reason:'DOT lifecycle対象listが配列ではありません',added:0,current:0,maxStack:null,stacks:[]};
 const policy=resolveDotStackLifecyclePolicy(lifecycle);if(!policy.ok)return{...policy,added:0,current:0,maxStack:policy.maxStacks||null,stacks:[]};
 if(!identityKey)return{ok:false,reason:'DOT lifecycleにはidentityKeyが必要です',added:0,current:0,maxStack:policy.maxStacks,stacks:[],policy};
 const requested=Math.max(1,Math.floor(Number(gain)||1)),current=list.filter(x=>x&&x.typeId===identityKey).length,available=Math.max(0,policy.maxStacks-current),addCount=Math.min(requested,available);
 if(addCount<=0)return{ok:false,reason:'MAX_STACK',added:0,current,maxStack:policy.maxStacks,stacks:[],policy};
 const added=[];for(let i=0;i<addCount;i++){const stack=typeof newStack==='function'?newStack(i):null;if(!stack||typeof stack!=='object')return{ok:false,reason:'DOT lifecycle新規付与にはnewStackが必要です',added:added.length,current:current+added.length,maxStack:policy.maxStacks,stacks:added,policy};list.push(stack);added.push(stack)}
 return{ok:true,added:added.length,current:current+added.length,maxStack:policy.maxStacks,stacks:added,policy};
}
function applyTaggedDot(source,target,compiled,lifecyclePolicy=null){
 if(!target?.alive)return{ok:false,reason:'DOT付与対象が無効です'};
 const type=resolveDotType(compiled),list=ensureDotStackList(target),gain=Math.max(1,Math.floor(compiled.definition.parameters.stackGain));
 const power=Math.max(0,Math.floor(compiled.definition.parameters.dotPower)),duration=Math.max(1,Math.floor(compiled.definition.parameters.dotDuration)),interval=Math.max(1,Math.floor(compiled.definition.parameters.dotInterval));
 const createStack=()=>({id:`DOT-${++dotStackSequence}`,typeId:type.id,label:type.label,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,power,appliedAt:battle.tick,expiresAt:battle.tick+duration,nextTick:battle.tick+interval,interval,duration});
 if(lifecyclePolicy){
  const applied=getTaggedApplyLifecycleEngine().apply('DOT',{list,input:{identityKey:type.id,gain,newStack:createStack},lifecycle:lifecyclePolicy});
  if(!applied.ok){if(applied.reason==='MAX_STACK'){battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${target.name}の${type.label}は最大${applied.maxStack}スタックのため付与失敗`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stack_rejected',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,reason:'MAX_STACK',current:applied.current,max_stack:applied.maxStack});return{ok:false,reason:'MAX_STACK',added:0,current:applied.current,maxStack:applied.maxStack,lifecyclePolicy}}typeof recordValidationEvent==='function'&&recordValidationEvent('dot_lifecycle_rejected',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,reason:applied.reason||'DOT_LIFECYCLE_REJECTED',field:applied.field||null,value:applied.value||null});return{ok:false,reason:applied.reason||'DOT_LIFECYCLE_REJECTED',lifecyclePolicy}}
  const added=applied.stacks;battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${source.name}の${compiled.definition.name} → ${target.name}へ${type.label} ${added.length}スタック付与（${applied.current}/${applied.maxStack}、威力${power}、間隔${interval}、持続${duration}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stack_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,stack_ids:added.map(x=>x.id),count:added.length,power,duration,interval,expires_at:battle.tick+duration});
  return{ok:true,added:added.length,current:applied.current,maxStack:applied.maxStack,stacks:added,lifecyclePolicy};
 }
 const current=list.filter(x=>x.typeId===type.id).length,available=Math.max(0,type.maxStack-current),addCount=Math.min(gain,available);
 if(addCount<=0){battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${target.name}の${type.label}は最大${type.maxStack}スタックのため付与失敗`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stack_rejected',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,reason:'MAX_STACK',current,max_stack:type.maxStack});return{ok:false,reason:'MAX_STACK',added:0,current,maxStack:type.maxStack}}
 const added=[];for(let i=0;i<addCount;i++){const stack=createStack();list.push(stack);added.push(stack)}
 battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${source.name}の${compiled.definition.name} → ${target.name}へ${type.label} ${added.length}スタック付与（${current+added.length}/${type.maxStack}、威力${power}、間隔${interval}、持続${duration}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stack_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,stack_ids:added.map(x=>x.id),count:added.length,power,duration,interval,expires_at:battle.tick+duration});
 return{ok:true,added:added.length,current:current+added.length,maxStack:type.maxStack,stacks:added};
}
function applyDotTick(target,stack){
 if(!target.alive)return false;const source=battle.units.find(x=>x.id===stack.sourceId),before=target.hp,shield=consumeShieldDamage(target,stack.power,{sourceId:stack.sourceId,skillId:stack.skillId,damageType:'dot'}),projectedHp=before-shield.hpDamage,fatalInterrupt=projectedHp<=0?resolveFatalDamageInterrupt(target,{actionSourceId:stack.sourceId,skillId:stack.skillId,hitIndex:0,projectedHp,damageKind:'DOT_DAMAGE'}):{triggered:false,projectedHp};target.hp=fatalInterrupt.triggered?fatalInterrupt.resolvedHp:Math.max(0,projectedHp);typeof evaluateLowHpPassivesAfterHpCommit==='function'&&evaluateLowHpPassivesAfterHpCommit(target,{reason:'DOT_DAMAGE',sourceId:stack.sourceId,skillId:stack.skillId});const applied=before-target.hp;
 if(source){source.damageDealt+=applied;queueSceneEvent({attackerId:source.id,targetId:target.id,attackerName:source.name,attackerSide:source.side,miss:false,damage:applied})}target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${stack.label}#${stack.id} → ${target.name}に${applied}ダメージ（残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_damage',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,raw_damage:stack.power,shield_absorbed:shield.absorbed,fatal_interrupt:!!fatalInterrupt.triggered,fatal_passive_id:fatalInterrupt.passiveId||null,damage:applied,hp_before:before,hp_after:target.hp,next_tick:stack.nextTick+stack.interval,expires_at:stack.expiresAt});
 if(target.hp<=0){const clearedStacks=Array.isArray(target.dotStacks)?target.dotStacks.length:0;resetCombatantOnDeath(target,{reason:'dot',sourceId:stack.sourceId});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は${stack.label}により戦闘不能`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_defeat',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,label:stack.label,hp_before:before,hp_after:target.hp,cleared_dot_stacks:clearedStacks})}finishIfNeeded();return true;
}
function clearAllDotStacks(reason='battle_end'){for(const target of battle.units){const list=ensureDotStackList(target);if(!list.length)continue;const count=list.length;target.dotStacks=[];typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stacks_cleared',{target_id:target.id,count,reason})}}
function processDotStacks(){
 for(const target of battle.units){const list=ensureDotStackList(target);if(!list.length)continue;if(!target.alive){target.dotStacks=[];continue}const keep=[];
  for(const stack of list){while(target.alive&&stack.nextTick<=battle.tick&&stack.nextTick<=stack.expiresAt){applyDotTick(target,stack);stack.nextTick+=stack.interval;if(battle.result||battle.pendingResult)break}if(target.alive&&stack.nextTick<=stack.expiresAt)keep.push(stack);else if(target.alive){battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${target.name}の${stack.label}#${stack.id}が終了`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_expired',{target_id:target.id,stack_id:stack.id,label:stack.label})}}
  target.dotStacks=keep;if(battle.result||battle.pendingResult)break}
}
function dotStatusText(unit){const stacks=ensureDotStackList(unit);if(!stacks.length)return'なし';const groups={};for(const x of stacks)(groups[x.label]||(groups[x.label]=[])).push(x);return Object.entries(groups).map(([label,items])=>`${label}×${items.length}（次:${Math.min(...items.map(x=>x.nextTick))} / 最長:${Math.max(...items.map(x=>x.expiresAt))}）`).join('、')}
function resetCombatantOnDeath(target,{reason='death',sourceId=null}={}){
 if(!target)return{ok:false,reason:'対象がありません'};
 const beforeCleared={statuses:Array.isArray(target.statusEffects)?target.statusEffects.length:0,dots:Array.isArray(target.dotStacks)?target.dotStacks.length:0,modifiers:Array.isArray(target.modifierStacks)?target.modifierStacks.length:0,shields:Array.isArray(target.shieldEffects)?target.shieldEffects.length:0};
 target.hp=0;target.alive=false;target.gauge=0;target.reservedAction=null;target.castingAction=null;target.lastAiEvaluationGauge=null;target.nextAiEvaluationGauge=typeof battleAiReevaluationStep==='function'?battleAiReevaluationStep():target.nextAiEvaluationGauge;
 const lifecycleCleanup=processApplyLifecycleDeathCleanup(target,{reason,sourceId});
 const cleared=lifecycleCleanup?.ok?lifecycleCleanup.cleared:beforeCleared;
 if(!lifecycleCleanup?.ok){target.statusEffects=[];target.dotStacks=[];target.modifierStacks=[];target.shieldEffects=[];typeof recordValidationEvent==='function'&&recordValidationEvent('runtime_apply_lifecycle_death_cleanup_fallback',{target_id:target.id,source_id:sourceId,reason,error:lifecycleCleanup?.reason||'UNKNOWN'})}
 removeCoverEffects(target,{reason:'TARGET_DEAD'});for(const protectedTarget of battle.units)for(const effect of [...ensureCoverEffects(protectedTarget)])if(effect.sourceId===target.id)removeCoverEffect(protectedTarget,effect,'SOURCE_DEAD');
 if('followUpQueue' in target)target.followUpQueue=[];
 if('followUpReservations' in target)target.followUpReservations=[];
 if('temporaryResources' in target)target.temporaryResources={};
 typeof recordValidationEvent==='function'&&recordValidationEvent('unit_death_reset',{target_id:target.id,source_id:sourceId,reason,cleared});
 return{ok:true,targetId:target.id,cleared};
}
function executeRuntimeReviveRuntime(actor,target,compiled){
 const contract=compiled?.definition?.runtimeContracts?.effectContracts?.find(x=>x?.type==='REVIVE')||null;if(!contract)return null;const hasHp=contract.hp!=null,hasRate=contract.hpRate!=null;
 if(hasHp===hasRate)return{ok:false,error:true,reason:'SKILL_RUNTIME_REVIVE_CONTRACT_INVALID'};const p={...compiled.definition.parameters,reviveHp:hasHp?contract.hp:null,reviveHpRate:hasRate?contract.hpRate:null},result=reviveTarget(actor,target,{...compiled,definition:{...compiled.definition,parameters:p}});
 typeof recordValidationEvent==='function'&&recordValidationEvent('skill_revive_executed',{source_id:actor?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,hp:contract.hp,hp_rate:contract.hpRate,revived:result.ok===true});return{...result,runtimeContracts:true,effectContract:{...contract}};
}
function reviveTarget(actor,target,compiled){
 if(!actor?.alive)return{ok:false,reason:'使用者が無効です'};
 if(!target||target.side!==actor.side||target.alive||target.hp>0)return{ok:false,reason:'INVALID_TARGET'};
 const fixed=compiled.definition.parameters.reviveHp,rate=compiled.definition.parameters.reviveHpRate;
 const mode=rate!=null&&rate!==''?'rate':'fixed',reviveValue=mode==='rate'?Number(rate):Math.floor(Number(fixed)||0);
 if(mode==='fixed'&&reviveValue<1)return{ok:false,reason:'REVIVE_HPが無効です'};
 if(mode==='rate'&&(!Number.isFinite(reviveValue)||reviveValue<=0||reviveValue>1))return{ok:false,reason:'REVIVE_HP_RATEが無効です'};
 const before=target.hp,maxHp=Math.max(1,Math.floor(Number(target.maxHp)||1));
 const after=mode==='rate'?Math.max(1,Math.floor(maxHp*reviveValue)):Math.min(reviveValue,maxHp);
 const clearedOnRevive={statuses:ensureStatusEffects(target).length,modifiers:ensureModifierStackList(target).length};target.statusEffects=[];target.modifierStacks=[];target.hp=after;target.alive=true;typeof evaluateLowHpPassivesAfterHpCommit==='function'&&evaluateLowHpPassivesAfterHpCommit(target,{reason:'REVIVE',sourceId:actor.id,skillId:compiled?.definition?.id||null});target.gauge=0;target.reservedAction=null;target.castingAction=null;target.lastAiEvaluationGauge=null;target.nextAiEvaluationGauge=typeof battleAiReevaluationStep==='function'?battleAiReevaluationStep():target.nextAiEvaluationGauge;
 battle.log.push(`[Tick ${battle.tick}] [TAG][REVIVE] ${actor.name}の${compiled.definition.name} → ${target.name}がHP${after}で復活（${mode==='rate'?`割合${reviveValue}`:`固定${reviveValue}`}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('revive',{source_id:actor.id,target_id:target.id,skill_id:compiled.definition.id,hp_before:before,hp_after:after,max_hp:maxHp,mode,revive_value:reviveValue,cleared_statuses:clearedOnRevive.statuses,cleared_modifiers:clearedOnRevive.modifiers});
 return{ok:true,targetId:target.id,hpBefore:before,hpAfter:after,maxHp,reviveMode:mode,reviveValue,gauge:target.gauge};
}

let coverEffectSequence=0;
function ensureCoverEffects(target){if(!Array.isArray(target.coverEffects))target.coverEffects=[];return target.coverEffects}
function coverSnapshot(target){return ensureCoverEffects(target).map(x=>({id:x.id,source_id:x.sourceId,target_id:x.targetId,skill_id:x.skillId,priority:x.priority,removable:x.removable,lifetime:x.lifetime,remaining_uses:x.remainingUses,applied_at:x.appliedAt,expires_at:x.expiresAt}))}
function removeCoverEffect(target,effect,reason='scripted'){
 const list=ensureCoverEffects(target),idx=list.findIndex(x=>x.id===effect.id);if(idx<0)return false;list.splice(idx,1);
 typeof recordValidationEvent==='function'&&recordValidationEvent('cover_removed',{cover_id:effect.id,source_id:effect.sourceId,target_id:target.id,skill_id:effect.skillId,reason,remaining_uses:effect.remainingUses,expires_at:effect.expiresAt});
 battle.log.push(`[Tick ${battle.tick}] [TAG][COVER] ${target.name}のかばう関係#${effect.id}を解除（${reason}）`);return true;
}
function removeCoverEffects(target,{sourceId=null,reason='manual_dispel',removableOnly=false}={}){const list=[...ensureCoverEffects(target)],selected=list.filter(x=>(!sourceId||x.sourceId===sourceId)&&(!removableOnly||x.removable));let count=0;for(const x of selected)if(removeCoverEffect(target,x,reason))count++;return count}
function applyCoverControl(source,target,compiled,control=null){
 if(!source?.alive||!target?.alive||source.side!==target.side||source.id===target.id)return{ok:false,reason:'COVER対象が無効です'};
 const p=compiled.definition.parameters,lifetime=control?String(control.lifetime||'').toLowerCase():p.coverLifetime,uses=lifetime==='uses'?Number(control?control.uses:p.coverUses):null,duration=lifetime==='duration'?Number(control?control.duration:p.coverDuration):null,priority=control?Number(control.priority):Number(p.coverPriority)||0,removable=control?control.removable===true:p.coverRemovable==='true';
 const effect={id:`COVER-${++coverEffectSequence}`,sequence:coverEffectSequence,sourceId:source.id,sourceName:source.name,targetId:target.id,skillId:compiled.definition.id,skillName:compiled.definition.name,priority,removable,lifetime,remainingUses:lifetime==='uses'?uses:null,appliedAt:battle.tick,expiresAt:lifetime==='duration'?battle.tick+duration:null};
 ensureCoverEffects(target).push(effect);battle.log.push(`[Tick ${battle.tick}] [TAG][COVER] ${source.name}が${target.name}をかばう（${lifetime}${lifetime==='uses'?` / 残${uses}回`:lifetime==='duration'?` / Tick ${effect.expiresAt}まで`:''}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('cover_added',{cover_id:effect.id,source_id:source.id,target_id:target.id,skill_id:effect.skillId,priority:effect.priority,removable:effect.removable,lifetime,remaining_uses:effect.remainingUses,expires_at:effect.expiresAt});return{ok:true,effect};
}
function applyTaggedCover(source,target,compiled){return applyCoverControl(source,target,compiled,null)}
function executeRuntimeTargetControlRuntime(source,target,compiled){
 const contract=compiled?.definition?.runtimeContracts?.effectContracts?.find(x=>x?.type==='TARGET_CONTROL')||null;if(!contract)return null;
 if(contract.mode!=='COVER'||contract.trigger!=='DIRECT_ATTACK'||!Number.isInteger(contract.priority)||typeof contract.removable!=='boolean'||!['PERSISTENT','USES','DURATION'].includes(contract.lifetime)||(contract.lifetime==='USES'&&(!Number.isInteger(contract.uses)||contract.uses<1))||(contract.lifetime==='DURATION'&&(!Number.isInteger(contract.duration)||contract.duration<1)))return{ok:false,error:true,reason:'SKILL_RUNTIME_TARGET_CONTROL_CONTRACT_INVALID'};
 const result=applyCoverControl(source,target,compiled,contract);typeof recordValidationEvent==='function'&&recordValidationEvent('skill_target_control_executed',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,mode:contract.mode,trigger:contract.trigger,priority:contract.priority,removable:contract.removable,lifetime:contract.lifetime,uses:contract.uses,duration:contract.duration,applied:result.ok===true});return{...result,runtimeContracts:true,effectContract:{...contract}};
}
function processCoverEffects(){for(const target of battle.units){for(const effect of [...ensureCoverEffects(target)]){const source=battle.units.find(x=>x.id===effect.sourceId);if(!target.alive)removeCoverEffect(target,effect,'TARGET_DEAD');else if(!source?.alive)removeCoverEffect(target,effect,'SOURCE_DEAD');else if(effect.lifetime==='duration'&&effect.expiresAt<=battle.tick)removeCoverEffect(target,effect,'EXPIRED')}}}
function clearAllCoverEffects(reason='battle_end'){for(const target of battle.units)for(const effect of [...ensureCoverEffects(target)])removeCoverEffect(target,effect,reason)}
function resolveCoverIntervention(attacker,originalTarget,incomingCompiled,context={}){
 const origin=context.origin||'base',direct=!!incomingCompiled?.definition?.logicOrder?.some(x=>x==='ATTACK'||x==='FOLLOW_UP');
 if(!direct||!['base','counter','follow_up'].includes(origin))return{target:originalTarget,covered:false,effect:null};
 // 正式仕様: COVERは解決済み単体Target eventに反応する。SINGLE/BACK/RANDOM各抽選は対象、FRONT/ALLは対象外。
 if(!['single','back','random'].includes(incomingCompiled?.definition?.target?.range)){
  typeof recordValidationEvent==='function'&&recordValidationEvent('cover_skipped',{original_target_id:originalTarget?.id||null,incoming_source_id:attacker?.id||null,incoming_skill_id:incomingCompiled?.definition?.id||null,origin,derived_generation:Number(context.derivedGeneration)||0,reason:'AREA_ATTACK'});
  return{target:originalTarget,covered:false,effect:null};
 }
 const candidates=ensureCoverEffects(originalTarget).filter(e=>{const source=battle.units.find(x=>x.id===e.sourceId);return source?.alive&&source.id!==originalTarget.id});if(!candidates.length)return{target:originalTarget,covered:false,effect:null};
 candidates.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);const effect=candidates[0],coverSource=battle.units.find(x=>x.id===effect.sourceId);if(!coverSource)return{target:originalTarget,covered:false,effect:null};
 if(effect.lifetime==='uses'){effect.remainingUses=Math.max(0,Number(effect.remainingUses||0)-1);if(effect.remainingUses<=0)removeCoverEffect(originalTarget,effect,'USES_EXHAUSTED')}
 typeof recordValidationEvent==='function'&&recordValidationEvent('cover_triggered',{cover_id:effect.id,source_id:coverSource.id,original_target_id:originalTarget.id,final_target_id:coverSource.id,incoming_source_id:attacker?.id||null,incoming_skill_id:incomingCompiled.definition.id,origin,derived_generation:Number(context.derivedGeneration)||0,lifetime:effect.lifetime,remaining_uses:effect.remainingUses});
 battle.log.push(`[Tick ${battle.tick}] [TAG][COVER] ${coverSource.name}が${originalTarget.name}をかばう → ${incomingCompiled.definition.name}の対象を差し替え`);return{target:coverSource,covered:true,effect};
}

function normalizedSkillCosts(compiled,unit=null){const reduction=unit?currentBattleReduction(unit,'MP_COST_REDUCTION'):0;return Array.isArray(compiled?.definition?.costs)?compiled.definition.costs.filter(x=>x&&Number(x.amount)>0).map(x=>x.type==='mp'?{...x,amount:Math.ceil(Math.max(0,Number(x.amount)||0)*(1-reduction)),calculatedAmount:Number(x.amount)||0,passiveReduction:reduction}:{...x}):[]}
function checkSkillCosts(unit,compiled){
 const costs=normalizedSkillCosts(compiled,unit),failures=[];
 for(const cost of costs){if(cost.type==='mp'){const available=Math.max(0,Number(unit?.mp)||0),required=Math.max(0,Number(cost.amount)||0);if(available<required)failures.push({type:'mp',required,available,shortage:required-available,reason:cost.failureReason||'MP_SHORTAGE'})}else failures.push({type:cost.type||'unknown',required:Number(cost.amount)||0,available:null,shortage:null,reason:'UNSUPPORTED_COST_TYPE'})}
 return{ok:failures.length===0,costs,failures,reason:failures[0]?.reason||null};
}
function consumeSkillCosts(unit,compiled){
 const checked=checkSkillCosts(unit,compiled);if(!checked.ok)return{ok:false,consumed:[],...checked};const consumed=[];
 for(const cost of checked.costs){if(cost.type==='mp'){const before=Math.max(0,Number(unit.mp)||0),amount=Math.max(0,Number(cost.amount)||0);unit.mp=Math.max(0,before-amount);const row={type:'mp',amount,before,after:unit.mp};consumed.push(row);typeof recordValidationEvent==='function'&&recordValidationEvent('cost_consumed',{source_id:unit.id,skill_id:compiled?.definition?.id||null,cost_type:'mp',amount,before,after:unit.mp,consume_timing:cost.consumeTiming||'activation_established'})}}
 return{ok:true,consumed,costs:checked.costs,failures:[]};
}
function consumePrecheckedSkillCosts(unit,compiled,executionSnapshot){
 const costs=Array.isArray(executionSnapshot?.costs)?executionSnapshot.costs:normalizedSkillCosts(compiled,unit),failures=[];
 for(const cost of costs){if(cost?.type==='mp'){const available=Math.max(0,Number(unit?.mp)||0),required=Math.max(0,Number(cost.amount)||0);if(available<required)failures.push({type:'mp',required,available,shortage:required-available,reason:cost.failureReason||'MP_SHORTAGE'});}else failures.push({type:cost?.type||'unknown',required:Number(cost?.amount)||0,available:null,shortage:null,reason:'UNSUPPORTED_COST_TYPE'});}
 if(failures.length)return{ok:false,consumed:[],costs,failures,reason:failures[0].reason,prechecked:true};
 const consumed=[];for(const cost of costs){if(cost?.type==='mp'){const before=Math.max(0,Number(unit?.mp)||0),amount=Math.max(0,Number(cost.amount)||0);unit.mp=before-amount;const row={type:'mp',amount,before,after:unit.mp,prechecked:true};consumed.push(row);typeof recordValidationEvent==='function'&&recordValidationEvent('cost_consumed',{source_id:unit.id,skill_id:compiled?.definition?.id||null,cost_type:'mp',amount,before,after:unit.mp,consume_timing:cost.consumeTiming||'activation_established',prechecked_at:executionSnapshot?.checkedAt??null,activation_rechecked:true});}}
 return{ok:true,consumed,costs,failures:[],prechecked:true};
}
function ensureCooldownState(unit){if(!unit||typeof unit!=='object')return{};if(!unit.cooldowns||typeof unit.cooldowns!=='object'||Array.isArray(unit.cooldowns))unit.cooldowns={};return unit.cooldowns}
function skillCooldownRemaining(unit,skillId){if(!unit||!skillId)return 0;const state=ensureCooldownState(unit),entry=state[skillId];if(!entry)return 0;const remaining=Math.max(0,Number(entry.expiresAt||0)-Number(battle.tick||0));if(remaining<=0)delete state[skillId];return remaining}
function startSkillCooldown(unit,compiled){const skillId=compiled?.definition?.id||null,baseDuration=Math.max(0,Number(compiled?.definition?.parameters?.cooldown)||0),reduction=currentBattleReduction(unit,'COOLDOWN_REDUCTION'),duration=Math.max(0,Math.ceil(baseDuration*(1-reduction)));if(!unit||!skillId||duration<=0)return{started:false,skillId,duration,expiresAt:null};const state=ensureCooldownState(unit),entry={skillId,duration,startedAt:battle.tick,expiresAt:battle.tick+duration};state[skillId]=entry;typeof recordValidationEvent==='function'&&recordValidationEvent('cooldown_started',{source_id:unit.id,skill_id:skillId,duration,started_at:entry.startedAt,expires_at:entry.expiresAt});return{started:true,...entry}}
function finalSkillCastTime(unit,compiled){const baseDuration=Math.max(0,Number(compiled?.definition?.parameters?.castTime)||0),reduction=currentBattleReduction(unit,'CAST_TIME_REDUCTION');return Math.max(0,Math.ceil(baseDuration*(1-reduction)))}
function processCooldowns(){for(const unit of battle.units){const state=ensureCooldownState(unit);for(const [skillId,entry] of Object.entries({...state})){if(Number(entry?.expiresAt||0)>battle.tick)continue;delete state[skillId];typeof recordValidationEvent==='function'&&recordValidationEvent('cooldown_expired',{source_id:unit.id,skill_id:skillId,duration:Number(entry?.duration)||0,started_at:Number(entry?.startedAt)||0,expired_at:battle.tick})}}}
function evaluateSkillUseRequirements(unit,compiled){const contracts=Array.isArray(compiled?.definition?.useRequirementContracts)?compiled.definition.useRequirementContracts:[],owned=new Set((Array.isArray(unit?.equipmentTagIds)?unit.equipmentTagIds:[]).map(String));for(const [i,r] of contracts.entries()){const allTags=Array.isArray(r?.allTags)?r.allTags:[],anyTags=Array.isArray(r?.anyTags)?r.anyTags:[];const missingAll=allTags.filter(tag=>!owned.has(String(tag))),anyOk=!anyTags.length||anyTags.some(tag=>owned.has(String(tag)));if(missingAll.length||!anyOk)return{ok:false,reason:'USE_REQUIREMENT_FAILED',requirement_index:i,type:'EQUIPMENT_TAGS',missingAllTags:missingAll,anyTags:[...anyTags],ownedTags:[...owned]}}return{ok:true,ownedTags:[...owned]}}
function resolveCurrentBlockDamage(target,finalDamage,blockRoll=null){const baseBlockRate=Number(target?.blockRate??target?.block_rate)||0,baseBlockPerformance=Number(target?.blockDamageCutRate??target?.block_damage_cut_rate)||0,blockRate=Math.max(0,Math.min(1,currentBattleResolveDirectModifierTarget(baseBlockRate,'BLOCK_RATE',target).final_value)),blockDamageCutRate=Math.max(0,Math.min(1,currentBattleResolveDirectModifierTarget(baseBlockPerformance,'BLOCK_PERFORMANCE',target).final_value)),blocked=blockRate>0&&blockRoll!=null&&blockRoll<blockRate,damage=blocked?Math.floor(finalDamage*(1-blockDamageCutRate)):finalDamage;return{blocked,blockRate,blockRoll,blockDamageCutRate,damage}}
globalThis.GKSBlockRuntime=Object.freeze({resolve:resolveCurrentBlockDamage});
function actionExecutionEligibility(unit,{actionKind='skill_action',skillId=null,cooldown=null,compiled=null}={}){
 if(!unit?.alive)return{ok:false,reason:'ACTOR_DEAD',actionKind,skillId};
 const status=ensureStatusEffects(unit).find(x=>x?.payload?.actionDisabled===true||x?.payload?.action_disabled===true);
 if(unit.actionDisabled===true||status)return{ok:false,reason:'ACTION_DISABLED',actionKind,skillId,statusInstanceId:status?.instanceId||null,statusId:status?.statusId||null,cooldownRemaining:0};
 if(compiled){const requirement=evaluateSkillUseRequirements(unit,compiled);if(!requirement.ok)return{ok:false,reason:'USE_REQUIREMENT_FAILED',actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:0,useRequirement:requirement};}
 const remaining=skillId?skillCooldownRemaining(unit,skillId):0;
 if(remaining>0)return{ok:false,reason:'COOLDOWN',actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:remaining,cooldownDuration:Number(cooldown)||Number(ensureCooldownState(unit)[skillId]?.duration)||0};
 const costCheck=compiled?checkSkillCosts(unit,compiled):{ok:true,costs:[],failures:[]};if(!costCheck.ok)return{ok:false,reason:'COST_SHORTAGE',actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:0,costCheck};
 return{ok:true,reason:null,actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:0,costCheck};
}
function counterActionBlocked(unit){
 if(unit?.counterDisabled===true)return true;
 return !actionExecutionEligibility(unit,{actionKind:'COUNTER'}).ok;
}
function createTaggedTriggerActionContext(actor,compiled,existing=null){
 if(existing)return existing;
 const engine=globalThis.GKSTriggerEngine;
 if(engine?.createActionContext)return engine.createActionContext({actionId:`${battle.tick}:${actor?.id||'unknown'}:${compiled?.definition?.id||'unknown'}`});
 return{actionId:`${battle.tick}:${actor?.id||'unknown'}:${compiled?.definition?.id||'unknown'}`,maxActivations:16,activationCount:0,activeKeys:new Set(),history:[]};
}
function acquireTaggedTriggerActivation(context,key,meta={}){
 const engine=globalThis.GKSTriggerEngine;
 if(engine?.tryActivate)return engine.tryActivate(context,key,meta);
 if(!context)return{ok:false,reason:'TRIGGER_ACTION_CONTEXT_REQUIRED'};
 const count=Math.max(0,Number(context.activationCount)||0),max=Math.max(1,Number(context.maxActivations)||16);
 if(count>=max)return{ok:false,reason:'TRIGGER_ACTION_LIMIT_REACHED',activation_count:count,max_activations:max};
 context.activationCount=count+1;return{ok:true,index:context.activationCount,max_activations:max,release(){return true}};
}
function orderTaggedSimultaneousTriggers(candidates){
 const engine=globalThis.GKSTriggerEngine;
 if(engine?.orderSimultaneousCandidates)return engine.orderSimultaneousCandidates(candidates);
 const family={COUNTER:0,FOLLOW_UP:1};return (Array.isArray(candidates)?candidates:[]).map((x,index)=>({...x,kind:String(x?.kind||'').toUpperCase(),priority:Number.isInteger(Number(x?.priority))?Number(x.priority):0,sequence:Number.isInteger(Number(x?.sequence))?Number(x.sequence):index})).sort((a,b)=>(family[a.kind]??99)-(family[b.kind]??99)||b.priority-a.priority||a.sequence-b.sequence);
}
function dispatchCounterAfterAttack(attacker,defender,incomingCompiled,attackResult,{origin='base',derivedGeneration=0,wasCovered=false,triggerActionContext=null}={}){
 const skip=(reason,extra={})=>{typeof recordValidationEvent==='function'&&recordValidationEvent('counter_skipped',{source_id:defender?.id||null,attacker_id:attacker?.id||null,incoming_skill_id:incomingCompiled?.definition?.id||null,origin,derived_generation:derivedGeneration,was_covered:wasCovered,reason,...extra});return{ok:false,triggered:false,reason}};
 triggerActionContext=createTaggedTriggerActionContext(attacker,incomingCompiled,triggerActionContext);
 if(origin!=='base'&&!wasCovered)return skip('DERIVED_ORIGIN');
 if(Number(derivedGeneration)>=2)return skip('DERIVED_GENERATION_LIMIT');
 if(!attackResult?.ok)return skip('NO_HIT');if(incomingCompiled?.definition?.target?.range!=='single')return skip('AREA_ATTACK');if(battle.result||battle.pendingResult)return skip('BATTLE_END');if(!defender?.alive)return skip('DEFENDER_DEAD');if(counterActionBlocked(defender))return skip('ACTION_DISABLED');
 const skillId=defender.counterSkillId||null;if(!skillId)return skip('NO_COUNTER_SKILL');const skill=findSkill(skillId),compiled=compileSkillForRuntime(skill);if(!skill||!compiled.ok||!compiled.definition.logicOrder.includes('COUNTER'))return skip('INVALID_COUNTER_SKILL');if(compiled.definition.parameters.counterTrigger!=='hit'||compiled.definition.parameters.counterTarget!=='attacker')return skip('COUNTER_CONDITION_MISMATCH');
const activation=acquireTaggedTriggerActivation(triggerActionContext,`COUNTER:${defender.id}:${skillId}`,{kind:'COUNTER',sourceId:defender.id,targetId:attacker.id,skillId});
 if(!activation?.ok)return skip(activation?.reason||'TRIGGER_GUARD_REJECTED',{activation_count:activation?.activation_count??triggerActionContext?.activationCount??0,max_activations:activation?.max_activations??triggerActionContext?.maxActivations??null});
 typeof recordValidationEvent==='function'&&recordValidationEvent('trigger_action_activation',{kind:'COUNTER',source_id:defender.id,target_id:attacker.id,skill_id:skillId,index:activation.index,max_activations:activation.max_activations});
 typeof recordValidationEvent==='function'&&recordValidationEvent('counter_triggered',{source_id:defender.id,attacker_id:attacker.id,incoming_skill_id:incomingCompiled.definition.id,counter_skill_id:skillId,origin,derived_generation:derivedGeneration,was_covered:wasCovered,shield_absorbed:attackResult.shieldAbsorbed||0,hp_damage:attackResult.damage||0});battle.log.push(`[Tick ${battle.tick}] [TAG][COUNTER] ${defender.name}が${attacker.name}へ反撃 — ${skill.name}`);
 const triggerContract=compiled.definition.runtimeContracts?.triggerContract||null;
 if(triggerContract?.type==='ON_HIT_RECEIVED'){
  const engine=globalThis.GKSTriggerEngine;if(!engine?.dispatchCompiled){activation.release?.();return skip('SKILL_RUNTIME_TRIGGER_ENGINE_UNAVAILABLE');}
  const dispatched=engine.dispatchCompiled(triggerContract,'hit_received',{sourceId:defender.id,attackerId:attacker.id,incomingSkillId:incomingCompiled.definition.id,counterSkillId:skillId},()=>executeSkillRuntime(defender,attacker,skill,{origin:'counter',derivedGeneration:Number(derivedGeneration)+1,triggerActionContext}));
  if(!dispatched?.ok){activation.release?.();return skip('SKILL_RUNTIME_TRIGGER_REJECTED',{trigger_reason:dispatched?.reason||'UNKNOWN'});}
  typeof recordValidationEvent==='function'&&recordValidationEvent('skill_trigger_dispatched',{trigger_type:'ON_HIT_RECEIVED',engine_event:'hit_received',source_id:defender.id,attacker_id:attacker.id,counter_skill_id:skillId});
  const result=dispatched.result;activation.release?.();return{ok:!!result?.ok,triggered:true,skillId,result,formalTrigger:true};
 }
 const result=executeSkillRuntime(defender,attacker,skill,{origin:'counter',derivedGeneration:Number(derivedGeneration)+1,triggerActionContext});activation.release?.();return{ok:!!result?.ok,triggered:true,skillId,result,formalTrigger:false};}

let taggedApplyLifecycleEngine=null;
function createFallbackApplyLifecycleEngine(handlers){
 const allowed=['STATUS','DOT','BUFF','DEBUFF','SHIELD'],table={};for(const [kind,handler] of Object.entries(handlers||{})){const key=String(kind||'').toUpperCase();if(allowed.includes(key)&&handler&&typeof handler==='object')table[key]=handler}
 const invoke=(operation,kind,payload={})=>{const key=String(kind||'').toUpperCase(),handler=table[key];if(!handler)return{ok:false,reason:'LIFECYCLE_ENGINE_KIND_UNREGISTERED',kind:key,operation};const fn=handler[operation];if(typeof fn!=='function')return{ok:false,reason:'LIFECYCLE_ENGINE_OPERATION_UNAVAILABLE',kind:key,operation};try{return fn(payload)}catch(error){return{ok:false,reason:'LIFECYCLE_ENGINE_HANDLER_ERROR',kind:key,operation,message:String(error&&error.message||error)}}};
 return{version:'R03-F4-fallback',boundary:{scope:'APPLY_LIFECYCLE_ONLY',owns:['resolve','apply','expire','cleanup','consume','effective'],kinds:allowed},kinds:Object.keys(table),resolve:(kind,payload)=>invoke('resolve',kind,payload),apply:(kind,payload)=>invoke('apply',kind,payload),expire:(kind,payload)=>invoke('expire',kind,payload),cleanup:(kind,payload)=>invoke('cleanup',kind,payload),consume:(kind,payload)=>invoke('consume',kind,payload),effective:(kind,payload)=>invoke('effective',kind,payload)};
}
function getTaggedApplyLifecycleEngine(){
 if(taggedApplyLifecycleEngine)return taggedApplyLifecycleEngine;
 const handlers={
  STATUS:{resolve:({lifecycle})=>resolveStatusUniqueRefreshLifecyclePolicy(lifecycle),apply:({list,input,lifecycle})=>applyStatusUniqueRefreshLifecycle(list,input,lifecycle),expire:()=>{processStatusEffects();return{ok:true}},cleanup:({reason='battle_end',target=null}={})=>{if(target){const count=ensureStatusEffects(target).length;target.statusEffects=[];return{ok:true,reason,count,targetId:target.id}}clearAllStatuses(reason);return{ok:true,reason}}},
  DOT:{resolve:({lifecycle})=>resolveDotStackLifecyclePolicy(lifecycle),apply:({list,input,lifecycle})=>applyDotStackLifecycle(list,input,lifecycle),expire:()=>{processDotStacks();return{ok:true}},cleanup:({reason='battle_end',target=null}={})=>{if(target){const count=ensureDotStackList(target).length;target.dotStacks=[];return{ok:true,reason,count,targetId:target.id}}clearAllDotStacks(reason);return{ok:true,reason}}},
  BUFF:{resolve:({lifecycle})=>resolveModifierStackLifecyclePolicy(lifecycle),apply:({source,target,compiled,logic,lifecycle})=>applyModifierStackLifecycle(source,target,compiled,logic,lifecycle),expire:()=>{processModifierStacks();return{ok:true}},cleanup:({reason='battle_end',target=null}={})=>{if(target){const count=ensureModifierStackList(target).length;target.modifierStacks=[];return{ok:true,reason,count,targetId:target.id}}clearAllModifierStacks(reason);return{ok:true,reason}},effective:({stacks,lifecycle})=>resolveModifierEffectiveValue(stacks,lifecycle)},
  DEBUFF:{resolve:({lifecycle})=>resolveModifierStackLifecyclePolicy(lifecycle),apply:({source,target,compiled,logic,lifecycle})=>applyModifierStackLifecycle(source,target,compiled,logic,lifecycle),expire:()=>{processModifierStacks();return{ok:true}},cleanup:({reason='battle_end',target=null}={})=>{if(target){const count=ensureModifierStackList(target).length;target.modifierStacks=[];return{ok:true,reason,count,targetId:target.id}}clearAllModifierStacks(reason);return{ok:true,reason}},effective:({stacks,lifecycle})=>resolveModifierEffectiveValue(stacks,lifecycle)},
  SHIELD:{resolve:({lifecycle})=>resolveShieldStackLifecyclePolicy(lifecycle),apply:({target,input,lifecycle})=>applyShieldStackLifecycle(target,input,lifecycle),expire:()=>{processShieldEffects();return{ok:true}},cleanup:({reason='battle_end',target=null}={})=>{if(target){const count=ensureShieldEffects(target).length,total=shieldTotal(target);target.shieldEffects=[];return{ok:true,reason,count,total,targetId:target.id}}clearAllShields(reason);return{ok:true,reason}},consume:({target,rawDamage,lifecycle})=>consumeShieldLayersLifecycle(target,rawDamage,lifecycle)}
 };
 const shared=typeof globalThis!=='undefined'?globalThis.GKSApplyLifecycleEngine:null;
 taggedApplyLifecycleEngine=shared&&typeof shared.create==='function'?shared.create(handlers):createFallbackApplyLifecycleEngine(handlers);
 return taggedApplyLifecycleEngine;
}


function processApplyLifecycleExpirations(){
 const engine=getTaggedApplyLifecycleEngine(),steps=['BUFF','SHIELD','STATUS','DOT'],results=[];
 for(const kind of steps){const result=engine.expire(kind,{tick:battle.tick});results.push({kind,result});if(!result?.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('apply_lifecycle_expire_failed',{kind,tick:battle.tick,reason:result?.reason||'UNKNOWN'});return{ok:false,kind,reason:result?.reason||'UNKNOWN',results}}}
 return{ok:true,results};
}
function processApplyLifecycleCleanup(reason='battle_end'){
 const engine=getTaggedApplyLifecycleEngine(),steps=['STATUS','DOT','BUFF','DEBUFF','SHIELD'],results=[];
 for(const kind of steps){const result=engine.cleanup(kind,{reason});if(!result.ok)return{ok:false,kind,reason:result.reason,results};results.push({kind,result})}
 typeof recordValidationEvent==='function'&&recordValidationEvent('runtime_apply_lifecycle_cleanup',{reason,kinds:steps});
 return{ok:true,reason,results};
}

function processApplyLifecycleDeathCleanup(target,{reason='death',sourceId=null}={}){
 if(!target)return{ok:false,reason:'DEATH_CLEANUP_TARGET_MISSING',results:[]};
 const engine=getTaggedApplyLifecycleEngine(),steps=['STATUS','DOT','BUFF','SHIELD'],results=[],cleared={statuses:0,dots:0,modifiers:0,shields:0};
 const countKey={STATUS:'statuses',DOT:'dots',BUFF:'modifiers',SHIELD:'shields'};
 for(const kind of steps){
  const result=engine.cleanup(kind,{reason:'target_dead',target,sourceId,deathReason:reason});
  if(!result?.ok)return{ok:false,kind,reason:result?.reason||'UNKNOWN',results,cleared};
  results.push({kind,result});cleared[countKey[kind]]=Math.max(0,Number(result.count)||0);
 }
 typeof recordValidationEvent==='function'&&recordValidationEvent('runtime_apply_lifecycle_death_cleanup',{target_id:target.id,source_id:sourceId,reason,cleared,kinds:steps});
 return{ok:true,reason,targetId:target.id,cleared,results};
}

function resolveRuntimeApplyLifecycle(compiled,logic,applyContract=null){
 const runtime=compiled?.definition?.runtimeContracts;if(!runtime)return{formal:false,ok:true,contract:null,lifecycle:null};
 const contract=applyContract||runtime.applyContracts?.find(x=>x.logic===logic)||null;
 if(!contract||!contract.lifecycle)return{formal:true,ok:false,reason:'SKILL_RUNTIME_APPLY_CONTRACT_MISSING',contract:null,lifecycle:null};
 return{formal:true,ok:true,contract,lifecycle:contract.lifecycle};
}
function resolveRuntimeApplyPolicy(compiled,logic,applyContract=null){
 const lifecycleRef=resolveRuntimeApplyLifecycle(compiled,logic,applyContract);if(!lifecycleRef.ok||!lifecycleRef.formal)return{...lifecycleRef,policy:null};
 const lc=lifecycleRef.lifecycle||{},contract=lifecycleRef.contract||{};
 const allowed={stackRule:new Set(['UNIQUE','STACK','REPLACE','IGNORE']),refreshRule:new Set(['REFRESH','EXTEND','KEEP','REPLACE']),snapshotPolicy:new Set(['SNAPSHOT','DYNAMIC']),effectiveRule:new Set(['HIGHEST','SUM','LATEST','NONE']),consumeRule:new Set(['FIFO','LIFO','NONE']),dispelCategory:new Set(['STATUS','DOT','BUFF','DEBUFF','SHIELD','NONE'])};
 for(const [key,set] of Object.entries(allowed)){const value=String(lc[key]??'');if(!set.has(value))return{...lifecycleRef,ok:false,reason:'SKILL_RUNTIME_APPLY_POLICY_UNKNOWN',policy:null,policyField:key,policyValue:value}}
 if(String(contract.kind||'')!==logic)return{...lifecycleRef,ok:false,reason:'SKILL_RUNTIME_APPLY_POLICY_KIND_MISMATCH',policy:null,policyField:'kind',policyValue:String(contract.kind||'')};
 if(String(lc.dispelCategory||'')!==logic)return{...lifecycleRef,ok:false,reason:'SKILL_RUNTIME_APPLY_POLICY_CATEGORY_MISMATCH',policy:null,policyField:'dispelCategory',policyValue:String(lc.dispelCategory||'')};
 const policy={stackRule:lc.stackRule,refreshRule:lc.refreshRule,snapshotPolicy:lc.snapshotPolicy,effectiveRule:lc.effectiveRule,consumeRule:lc.consumeRule,dispelCategory:lc.dispelCategory,removeOnDeath:lc.removeOnDeath===true,removeOnBattleEnd:lc.removeOnBattleEnd===true,removable:lc.removable===true,maxStacks:Number.isInteger(lc.maxStacks)?lc.maxStacks:null,resistancePolicy:lc.resistancePolicy||null,identityPolicy:lc.identityPolicy||null};
 return{...lifecycleRef,policy};
}
function resolveRuntimeApplyDefinition(compiled,contract){
 const values=contract?.values;if(!values)return{ok:true,formalValues:false,compiled};
 const p={...(compiled?.definition?.parameters||{})},logic=String(contract.logic||'');
 if(logic==='STATUS'){p.statusId=values.statusId;p.statusDuration=values.duration;p.statusPayload={...(values.statusPayload||{})}}
 else if(logic==='DOT'){p.dotPower=values.power;p.dotDuration=values.duration;p.dotInterval=values.interval;p.stackGain=values.stackGain}
 else if(logic==='BUFF'||logic==='DEBUFF'){p.modifierStat=values.modifierStat;p.modifierPower=values.power;p.modifierDuration=values.duration;p.stackGain=values.stackGain}
 else if(logic==='SHIELD'){p.shield=values.power;p.shieldDuration=values.duration}
 else return{ok:false,formalValues:true,reason:'SKILL_RUNTIME_APPLY_VALUES_LOGIC_INVALID',compiled:null};
 const numeric=logic==='STATUS'?[p.statusDuration]:logic==='DOT'?[p.dotPower,p.dotDuration,p.dotInterval,p.stackGain]:logic==='SHIELD'?[p.shield,p.shieldDuration]:[p.modifierPower,p.modifierDuration,p.stackGain];
 if(numeric.some(x=>!Number.isFinite(x)||x<0))return{ok:false,formalValues:true,reason:'SKILL_RUNTIME_APPLY_VALUES_INVALID',compiled:null};
 return{ok:true,formalValues:true,compiled:{...compiled,definition:{...compiled.definition,parameters:p}}};
}
function applyTaggedApplyRuntime(source,target,compiled,logic,{attackSucceeded=true,applyContract=null}={}){
 const lifecycleRef=resolveRuntimeApplyPolicy(compiled,logic,applyContract);
 if(!lifecycleRef.ok){const policyError=String(lifecycleRef.reason||'').startsWith('SKILL_RUNTIME_APPLY_POLICY_');battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] 正式Runtime APPLY ${policyError?'policy':'lifecycle契約'}が不正です`);typeof recordValidationEvent==='function'&&recordValidationEvent(policyError?'runtime_apply_policy_rejected':'runtime_apply_contract_rejected',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,reason:lifecycleRef.reason,field:lifecycleRef.policyField||null,value:lifecycleRef.policyValue||null});return{handled:true,skipped:true,error:true,reason:lifecycleRef.reason,result:null,lifecycle:lifecycleRef.lifecycle||null,policy:null}}
 if(lifecycleRef.formal&&typeof recordValidationEvent==='function'){recordValidationEvent('runtime_apply_contract_resolved',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,effect_id:lifecycleRef.contract?.effectId||null,registry_phase:(compiled?.definition?.runtimeContracts)?.registryPhase||null,lifecycle:lifecycleRef.lifecycle});recordValidationEvent('runtime_apply_policy_resolved',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,effect_id:lifecycleRef.contract?.effectId||null,registry_phase:(compiled?.definition?.runtimeContracts)?.registryPhase||null,policy:lifecycleRef.policy})}
 const direct=resolveRuntimeApplyDefinition(compiled,lifecycleRef.contract);if(!direct.ok)return{handled:true,skipped:true,error:true,reason:direct.reason,result:null,contract:lifecycleRef.contract};
 const runtimeCompiled=direct.compiled;
 if(direct.formalValues&&typeof recordValidationEvent==='function')recordValidationEvent('runtime_apply_executed',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,effect_id:lifecycleRef.contract?.effectId||null,values:lifecycleRef.contract.values});
 const requiresAttack=compiled.definition.logicOrder.includes('ATTACK');
 if((logic==='STATUS'||logic==='DOT')&&requiresAttack&&!attackSucceeded){battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] ATTACK不成立のため${logic==='STATUS'?'状態異常':'DOT'}付与をスキップ`);return{handled:true,skipped:true,reason:'ATTACK_FAILED',result:null}}
 if(!target?.alive){battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] 対象戦闘不能のため${logic==='STATUS'?'状態異常':logic==='DOT'?'DOT':'付与効果'}付与をスキップ`);return{handled:true,skipped:true,reason:'TARGET_DEAD',result:null}}
 if(logic==='STATUS')return{handled:true,skipped:false,result:applyTaggedStatus(source,target,runtimeCompiled,lifecycleRef.formal?lifecycleRef.policy:null),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 if(logic==='DOT')return{handled:true,skipped:false,result:applyTaggedDot(source,target,runtimeCompiled,lifecycleRef.formal?lifecycleRef.policy:null),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 if(logic==='BUFF'||logic==='DEBUFF')return{handled:true,skipped:false,result:applyTaggedModifier(source,target,runtimeCompiled,logic,lifecycleRef.formal?lifecycleRef.policy:null),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 if(logic==='SHIELD')return{handled:true,skipped:false,result:applyTaggedShield(source,target,runtimeCompiled,lifecycleRef.formal?lifecycleRef.policy:null),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 return{handled:false,skipped:false,result:null};
}
function compareTaggedCondition(actual,operator,expected){if(!Number.isFinite(actual)||!Number.isFinite(expected))return false;switch(operator){case '=':return actual===expected;case '!=':return actual!==expected;case '>':return actual>expected;case '>=':return actual>=expected;case '<':return actual<expected;case '<=':return actual<=expected;default:return false}}
function taggedConditionActual(actor,key,target=null){if(!actor)return NaN;switch(key){case 'SELF_HP':return Number(actor.hp);case 'SELF_HP_RATE':return Number(actor.maxHp)>0?Number(actor.hp)/Number(actor.maxHp):0;case 'SELF_MP':return Number(actor.mp);case 'SELF_MP_RATE':return Number(actor.maxMp)>0?Number(actor.mp)/Number(actor.maxMp):0;case 'ENEMY_COUNT':return battle.units.filter(x=>x.alive&&x.side!==actor.side).length;case 'ALLY_COUNT':return battle.units.filter(x=>x.alive&&x.side===actor.side).length;case 'BATTLE_TICK':return Number(battle.tick||0);case 'TARGET_POISONED':return target?ensureDotStackList(target).length>0:false;default:return NaN}}
function evaluateTaggedSkillConditions(actor,compiled,target=null){const conditions=compiled?.definition?.parameters?.conditions||[];if(!conditions.length)return{ok:true,mode:'all',results:[]};const results=conditions.map(c=>{const actual=taggedConditionActual(actor,c.key,target),expected=typeof c.value==='boolean'?c.value:Number(c.value),passed=typeof expected==='boolean'?actual===expected:compareTaggedCondition(actual,c.operator,expected);return{...c,actual,passed}});return{ok:results.every(x=>x.passed),mode:'all',results}}
function runCurrentBattleHitSafePoint(actor,target,compiled,attackResult,{origin='base',derivedGeneration=0,wasCovered=false,triggerActionContext=null,hitIndex=0}={}){
 const results={counter:null,followUps:[],passiveCounters:null,passiveReactive:null};
 if(attackResult?.ok&&origin==='base'){const slots=orderTaggedSimultaneousTriggers([{kind:'COUNTER',priority:0,sequence:0},{kind:'FOLLOW_UP',priority:0,sequence:1}]);if(typeof recordValidationEvent==='function')recordValidationEvent('trigger_simultaneous_order_fixed',{source_id:actor?.id||null,target_id:target?.id||null,origin_skill_id:compiled?.definition?.id||null,hit_index:hitIndex,order:slots.map(x=>({kind:x.kind,priority:x.priority,sequence:x.sequence}))});for(const slot of slots){if(slot.kind==='COUNTER')results.counter=dispatchCounterAfterAttack(actor,target,compiled,attackResult,{origin:'base',derivedGeneration,wasCovered,triggerActionContext});else if(slot.kind==='FOLLOW_UP'&&!battle.result&&!battle.pendingResult)results.followUps=dispatchConditionalFollowUps(actor,target,{trigger:'ALLY_ATTACK',originSkillId:compiled.definition.id,derivedGeneration,triggerActionContext})}}
 if(triggerActionContext&&attackResult?.ok)results.passiveCounters=dispatchCurrentBattlePassiveCounters(actor,target,compiled,attackResult,{triggerActionContext,hitIndex});
 if(triggerActionContext)results.passiveReactive=flushCurrentBattlePassiveReactive(triggerActionContext,{hitIndex});return results;
}
function dispatchTaggedBaseReactiveTriggers(actor,target,compiled,attackResult,{derivedGeneration=0,wasCovered=false,triggerActionContext=null,hitIndex=0}={}){return runCurrentBattleHitSafePoint(actor,target,compiled,attackResult,{origin:'base',derivedGeneration,wasCovered,triggerActionContext,hitIndex})}
function executeSkillRuntime(actor,target,skillSource,{manual=false,isFollowUp=false,origin=null,suppressDerived=false,derivedGeneration=0,skipExecutionEligibility=false,triggerActionContext=null,executionSnapshot=null}={}){
 const compiled=compileSkillForRuntime(skillSource);battle.log.push(`[Tick ${battle.tick}] [TAG][COMPILE] ${skillSource?.id||'unknown'} ${compiled.ok?'成功':'失敗'}`);if(!compiled.ok){compiled.errors.forEach(x=>battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${x}`));return{ok:false,stage:'compile',compiled}}
 const actualOrigin=origin||(isFollowUp?'follow_up':compiled.definition.logicOrder.includes('COUNTER')?'counter':'base'),prechecked=!!(executionSnapshot&&executionSnapshot.skillId===compiled.definition.id);
 const actionTriggerContext=createTaggedTriggerActionContext(actor,compiled,triggerActionContext);
 const conditionResult=prechecked?(executionSnapshot.conditionResult||{ok:true,mode:'prechecked',results:[]}):evaluateTaggedSkillConditions(actor,compiled,target);if(!conditionResult.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('skill_condition_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,conditions:conditionResult.results});battle.log.push(`[Tick ${battle.tick}] [TAG][CONDITION] ${actor?.name||'unknown'}の${compiled.definition.name}は発動条件不成立`);return{ok:false,stage:'condition',reason:'CONDITION_FAILED',conditionResult,compiled}}
 if(!prechecked&&!skipExecutionEligibility){const eligibility=actionExecutionEligibility(actor,{actionKind:actualOrigin==='counter'?'COUNTER':actualOrigin==='follow_up'?'FOLLOW_UP':'skill_action',skillId:compiled.definition.id,cooldown:compiled.definition.parameters.cooldown,compiled});if(!eligibility.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});battle.log.push(`[Tick ${battle.tick}] [TAG][ACTION_DISABLED] ${actor?.name||'unknown'}の${compiled.definition.name}は実行不能`);return{ok:false,stage:'execution_eligibility',reason:eligibility.reason,eligibility,compiled}}}
 let resolved;if(prechecked){const ids=Array.isArray(executionSnapshot.targetIds)?executionSnapshot.targetIds:[],targets=ids.map(id=>battle.units.find(x=>x.id===id)).filter(Boolean);resolved={ok:true,targets,prechecked:true};}else resolved=resolveTaggedTargets(actor,target,compiled.definition);
 if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 const costResult=prechecked?consumePrecheckedSkillCosts(actor,compiled,executionSnapshot):consumeSkillCosts(actor,compiled);if(!costResult.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,reason:'COST_SHORTAGE',cost_failures:costResult.failures});battle.log.push(`[Tick ${battle.tick}] [TAG][COST] ${actor?.name||'unknown'}の${compiled.definition.name}はコスト不足`);return{ok:false,stage:'cost',reason:'COST_SHORTAGE',costResult,compiled}}
 const cooldownStart=startSkillCooldown(actor,compiled),targetResults=[],executionContext={areaCoverUsed:false},preStates=new Map((executionSnapshot?.targetStates||[]).map(row=>[String(row.id),row]));
 for(const originalTarget of resolved.targets){
  const preState=preStates.get(String(originalTarget.id))||null,wasAliveAtCheck=preState?preState.alive!==false:originalTarget.alive!==false;
  if(originalTarget.exited===true||originalTarget.untargetable===true||(wasAliveAtCheck&&!originalTarget.alive)){typeof recordValidationEvent==='function'&&recordValidationEvent('skill_target_effects_skipped',{source_id:actor?.id||null,target_id:originalTarget.id,skill_id:compiled.definition.id,reason:'TARGET_INVALID_AT_EFFECT_START',prechecked_at:executionSnapshot?.checkedAt??null});targetResults.push({targetId:originalTarget.id,originalTargetId:originalTarget.id,skipped:true,skipReason:'TARGET_INVALID_AT_EFFECT_START'});continue;}
  let actionTarget=originalTarget,coverResult={target:originalTarget,covered:false,effect:null};const directAttack=compiled.definition.logicOrder.some(x=>x==='ATTACK'||x==='FOLLOW_UP');if(directAttack){coverResult=resolveCoverIntervention(actor,originalTarget,compiled,{origin:actualOrigin,derivedGeneration,areaCoverUsed:executionContext.areaCoverUsed});actionTarget=coverResult.target;if(coverResult.covered&&compiled.definition.target.range==='all')executionContext.areaCoverUsed=true}
  let attackResult=null,healResult=null,shieldResult=null,dotResult=null,modifierResult=null,followUpResult=null,statusResult=null,cleanseResult=null,reviveResult=null,coverApplyResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK'),targetInvalidated=false;
  const actionTargetWasAlive=actionTarget.alive!==false;
  for(const logic of compiled.definition.logicOrder){
   if(targetInvalidated){typeof recordValidationEvent==='function'&&recordValidationEvent('skill_effect_skipped_target_invalid',{source_id:actor?.id||null,target_id:actionTarget.id,skill_id:compiled.definition.id,logic,reason:'TARGET_BECAME_INVALID'});continue;}
   if(logic==='COUNTER')continue;
   if(logic==='COVER')coverApplyResult=executeRuntimeTargetControlRuntime(actor,originalTarget,compiled)||applyTaggedCover(actor,originalTarget,compiled);
   else if(logic==='ATTACK'){attackResult=executeRuntimeDamageRuntime(actor,actionTarget,compiled,{triggerActionContext:actionTriggerContext,onHitSafePoint:({result,hitIndex})=>{const effectiveAttackResult=result;return actualOrigin==='base'&&!suppressDerived?dispatchTaggedBaseReactiveTriggers(actor,actionTarget,compiled,effectiveAttackResult,{derivedGeneration,wasCovered:coverResult.covered,triggerActionContext:actionTriggerContext,hitIndex}):actionTriggerContext?flushCurrentBattlePassiveReactive(actionTriggerContext,{hitIndex}):null}})||applyTaggedDamage(actor,actionTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}
   else if(logic==='HEAL')healResult=executeRuntimeHealRuntime(actor,actionTarget,compiled)||applyTaggedHeal(actor,actionTarget,compiled);
   else if(['SHIELD','STATUS','DOT','BUFF','DEBUFF'].includes(logic)){
    const damageResult=attackResult||followUpResult,handledPerHit=damageResult?.hitApplyHandled===true&&logic!=='SHIELD';
    if(handledPerHit){const rows=(damageResult.hitApplyResults||[]).flatMap(x=>x.results||[]).filter(x=>x.logic===logic),last=rows.length?rows[rows.length-1].result:null;if(logic==='STATUS')statusResult=last?.result||null;else if(logic==='DOT')dotResult=last?.result||null;else modifierResult=last?.result||null;}
    else{const applyResult=applyTaggedApplyRuntime(actor,actionTarget,compiled,logic,{attackSucceeded});if(logic==='SHIELD')shieldResult=applyResult.result;else if(logic==='STATUS')statusResult=applyResult.result;else if(logic==='DOT')dotResult=applyResult.result;else modifierResult=applyResult.result}
   }
   else if(logic==='CLEANSE')cleanseResult=executeRuntimeRemoveRuntime(actor,actionTarget,compiled)||cleanseStatusEffects(actor,actionTarget,compiled);
   else if(logic==='RESOURCE_CHANGE')executeRuntimeResourceChangeRuntime(actor,actionTarget,compiled);
   else if(logic==='REVIVE')reviveResult=executeRuntimeReviveRuntime(actor,actionTarget,compiled)||reviveTarget(actor,actionTarget,compiled);
   else if(logic==='FOLLOW_UP'){followUpResult=executeRuntimeDamageRuntime(actor,actionTarget,compiled,{triggerActionContext:actionTriggerContext,onHitSafePoint:({hitIndex})=>actionTriggerContext?flushCurrentBattlePassiveReactive(actionTriggerContext,{hitIndex}):null})||applyTaggedDamage(actor,actionTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!followUpResult?.ok}
   else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`);
   if(actionTarget.exited===true||actionTarget.untargetable===true||(actionTargetWasAlive&&!actionTarget.alive)){targetInvalidated=true;typeof recordValidationEvent==='function'&&recordValidationEvent('skill_target_invalidated',{source_id:actor?.id||null,target_id:actionTarget.id,skill_id:compiled.definition.id,after_logic:logic});}
  }
  const effectiveAttackResult=attackResult||followUpResult;targetResults.push({targetId:actionTarget.id,originalTargetId:originalTarget.id,covered:coverResult.covered,coverId:coverResult.effect?.id||null,attackResult,healResult,shieldResult,dotResult,modifierResult,followUpResult,statusResult,cleanseResult,reviveResult,coverApplyResult,targetInvalidated});
  if(effectiveAttackResult?.ok&&!suppressDerived){if(actualOrigin==='base'){}else if(coverResult.covered){dispatchCounterAfterAttack(actor,actionTarget,compiled,effectiveAttackResult,{origin:actualOrigin,derivedGeneration,wasCovered:true,triggerActionContext:actionTriggerContext})}else if(actualOrigin==='counter')recordValidationEvent('counter_chain_blocked',{source_id:actor.id,target_id:actionTarget.id,skill_id:compiled.definition.id,reason:'COUNTER_CANNOT_CHAIN',derived_generation:derivedGeneration});else if(actualOrigin==='follow_up')recordValidationEvent('follow_up_chain_blocked',{source_id:actor.id,target_id:actionTarget.id,skill_id:compiled.definition.id,reason:'FOLLOW_UP_CANNOT_CHAIN',derived_generation:derivedGeneration})}
 }
 if(manual)renderBattle();const first=targetResults[0]||{};return{ok:true,compiled,costResult,cooldownStart,prechecked,targets:targetResults.map(x=>x.targetId),originalTargets:resolved.targets.map(x=>x.id),targetResults,attackResult:first.attackResult,healResult:first.healResult,shieldResult:first.shieldResult,dotResult:first.dotResult,modifierResult:first.modifierResult,followUpResult:first.followUpResult,statusResult:first.statusResult,cleanseResult:first.cleanseResult,reviveResult:first.reviveResult,coverApplyResult:first.coverApplyResult};
}
function dispatchConditionalFollowUps(initiator,target,event){
 if(!initiator?.alive||!target?.alive||event?.trigger!=='ALLY_ATTACK')return[];
 const triggerActionContext=createTaggedTriggerActionContext(initiator,{definition:{id:event?.originSkillId||'follow_up_event'}},event?.triggerActionContext||null);event={...(event||{}),triggerActionContext};
 const results=[],candidates=[];let sequence=0;
 for(const follower of battle.units.filter(x=>x.alive&&x.side===initiator.side&&x.id!==initiator.id)){
  const ids=Array.isArray(follower.followUpSkillIds)?follower.followUpSkillIds:[];
  for(const skillId of ids){
   const skill=findSkill(skillId),compiled=compileSkillForRuntime(skill);
   if(!compiled.ok||!compiled.definition.logicOrder.includes('FOLLOW_UP'))continue;
   const triggerContract=compiled.definition.runtimeContracts?.triggerContract||null;
   candidates.push({follower,skillId,skill,compiled,triggerContract,priority:Number.isInteger(triggerContract?.priority)?triggerContract.priority:0,sequence:sequence++});
  }
 }
 candidates.splice(0,candidates.length,...orderTaggedSimultaneousTriggers(candidates));
 if(candidates.length)recordValidationEvent('follow_up_order_fixed',{initiator_id:initiator.id,target_id:target.id,origin_skill_id:event?.originSkillId||null,order:candidates.map(x=>({source_id:x.follower.id,skill_id:x.skillId,priority:x.priority,sequence:x.sequence}))});
 for(const candidate of candidates){
  const {follower,skillId,skill,compiled,triggerContract}=candidate;
  if(!target.alive){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'TARGET_DEAD'});continue}
  const eligibility=actionExecutionEligibility(follower,{actionKind:'FOLLOW_UP'});if(!eligibility.ok){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});continue}
  const conditionContract=compiled.definition.runtimeContracts?.conditionContracts?.find(c=>c.property==='TARGET_POISONED')||null;
  const runFollowUp=()=>{
   if(!target.alive){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'TARGET_DEAD'});return{ok:false,reason:'TARGET_DEAD'}}
   let poisoned=false;
   if(conditionContract){
    const conditionEngine=globalThis.GKSConditionEngine;
    if(!conditionEngine?.evaluateCompiled){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'CONDITION_ENGINE_UNAVAILABLE'});return{ok:false,reason:'CONDITION_ENGINE_UNAVAILABLE'}}
    const checked=conditionEngine.evaluateCompiled(conditionContract,{sourceId:follower.id,initiatorId:initiator.id,targetId:target.id,skillId},()=>ensureDotStackList(target).length>0);
    if(!checked.ok||!checked.passed){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:checked.ok?'CONDITION_POISONED_FALSE':checked.reason,formalCondition:true});return{ok:false,reason:checked.ok?'CONDITION_POISONED_FALSE':checked.reason}}
    recordValidationEvent('skill_condition_resolved',{source_id:follower.id,target_id:target.id,skill_id:skillId,property:conditionContract.property,passed:true});
    poisoned=true;
   }else poisoned=ensureDotStackList(target).length>0;
   if(!poisoned){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'CONDITION_POISONED_FALSE'});return{ok:false,reason:'CONDITION_POISONED_FALSE'}}
   const activation=acquireTaggedTriggerActivation(event?.triggerActionContext,`FOLLOW_UP:${follower.id}:${skillId}`,{kind:'FOLLOW_UP',sourceId:follower.id,targetId:target.id,skillId});
   if(!activation?.ok){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:activation?.reason||'TRIGGER_GUARD_REJECTED',activation_count:activation?.activation_count??event?.triggerActionContext?.activationCount??0,max_activations:activation?.max_activations??event?.triggerActionContext?.maxActivations??null});return{ok:false,reason:activation?.reason||'TRIGGER_GUARD_REJECTED'}}
   recordValidationEvent('trigger_action_activation',{kind:'FOLLOW_UP',source_id:follower.id,target_id:target.id,skill_id:skillId,index:activation.index,max_activations:activation.max_activations});
   recordValidationEvent('follow_up_triggered',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,trigger:'ALLY_ATTACK',condition:'POISONED',formalTrigger:!!triggerContract,priority:candidate.priority});
   battle.log.push(`[Tick ${battle.tick}] [TAG][FOLLOW_UP] ${follower.name}が${initiator.name}の攻撃に連携 → ${target.name}`);
   const result=executeSkillRuntime(follower,target,skill,{isFollowUp:true,derivedGeneration:Number(event?.derivedGeneration||0)+1,triggerActionContext:event?.triggerActionContext});activation.release?.();return result;
  };
  if(triggerContract?.type==='ON_ALLY_ATTACK'){
   const engine=globalThis.GKSTriggerEngine;
   if(!engine?.dispatchCompiled){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'TRIGGER_ENGINE_UNAVAILABLE'});continue}
   const dispatched=engine.dispatchCompiled(triggerContract,'ally_attack',{sourceId:follower.id,initiatorId:initiator.id,targetId:target.id,skillId,originSkillId:event?.originSkillId||null},runFollowUp);
   recordValidationEvent('skill_trigger_dispatched',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,trigger_type:'ON_ALLY_ATTACK',engine_event:'ally_attack',ok:dispatched.ok,priority:candidate.priority});
   if(dispatched.ok&&dispatched.result?.ok)results.push(dispatched.result);
  }else{
   const result=runFollowUp();if(result?.ok)results.push(result);
  }
 }
 return results;
}
