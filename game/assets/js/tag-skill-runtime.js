/* Tag skill compiler/runtime — GA-B486.26 / P01-06 AURA tag validation */
const TAG_LOGIC_ORDER=['ATTACK','DOT','FOLLOW_UP','HEAL','HOT','BUFF','DEBUFF','AURA','SHIELD','STATUS','CLEANSE','SUMMON','DISPEL','REVIVE'];
function normalizeGeneralTag(tag){return String(tag??'').trim()}
function parseSkillTags(skill){
 const generalTags=new Set(),numericTags={},errors=[];
 for(const raw of Array.isArray(skill?.tags)?skill.tags:[]){
  if(typeof raw!=='string'){errors.push(`文字列ではないタグ: ${JSON.stringify(raw)}`);continue}
  const tag=raw.trim();
  const m=tag.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if(m){
   const key=m[1].toUpperCase();
   if(numericTags[key])errors.push(`数値タグ重複: ${key}`);
   numericTags[key]={operator:m[2],value:Number(m[3]),raw:tag};
  }else if(tag){generalTags.add(normalizeGeneralTag(tag))}
 }
 return{generalTags,numericTags,errors};
}
function hasAnyTag(set,candidates){return candidates.some(x=>set.has(x))}
function compileTaggedSkill(skill){
 const parsed=parseSkillTags(skill),errors=[...parsed.errors],warnings=[];
 const g=parsed.generalTags,n=parsed.numericTags;
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
 if(g.has('FOLLOW_UP')){
  if(!g.has('TRIGGER_ALLY_ATTACK'))errors.push('FOLLOW_UPにはTRIGGER_ALLY_ATTACKが必要です');
  if(!g.has('CONDITION_POISONED'))errors.push('FOLLOW_UPにはCONDITION_POISONEDが必要です');
  if(!n.DAMAGE)errors.push('FOLLOW_UPにはDAMAGEが必要です');
 }
 if(g.has('BUFF')||g.has('DEBUFF')){
  if(!hasAnyTag(g,['ATK','DEF','AGI','VIT','INT','DEX','LUK']))errors.push('BUFF/DEBUFFには能力値タグが必要です');
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
  if(!hasAnyTag(g,['ATK','DEF','AGI','VIT','INT','DEX','LUK']))errors.push('BUFF/DEBUFFオーラには能力値タグが必要です');
  if(g.has('BUFF')||g.has('DEBUFF'))errors.push('AURAと通常BUFF/DEBUFFロジックは同時指定できません');
 }
 if(g.has('STATUS')){
  const statusId=[...g].find(x=>x.startsWith('STATUS_ID='))?.slice(10)||null;
  if(!statusId)errors.push('STATUSにはSTATUS_IDが必要です');
  if(!n.DURATION||!Number.isFinite(n.DURATION.value)||!Number.isInteger(n.DURATION.value)||n.DURATION.value<=0)errors.push('STATUSのDURATIONは0より大きい有限整数が必要です');
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
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,parameters:{damageType,damage:n.DAMAGE?.value??null,heal:n.HEAL?.value??null,shield:n.SHIELD?.value??null,shieldDuration:n.DURATION?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null,modifierStat:['ATK','DEF','AGI','VIT','INT','DEX','LUK'].find(x=>g.has(x))||null,modifierPower:n.POWER?.value??null,modifierDuration:n.DURATION?.value??null,followUpTrigger:g.has('TRIGGER_ALLY_ATTACK')?'ALLY_ATTACK':null,followUpCondition:g.has('CONDITION_POISONED')?'POISONED':null,statusId:[...g].find(x=>x.startsWith('STATUS_ID='))?.slice(10)||null,statusDuration:g.has('STATUS')?(n.DURATION?.value??null):null,statusStackPolicy:g.has('INDEPENDENT')?'independent':g.has('STRONGEST')?'strongest':'refresh',statusPayload:[...g].includes('STATUS_ID=STATUS-ACCURACY-DOWN')?{accuracy_modifier:-20}:{},cleanseCount:n.CLEANSE_COUNT?.value??null,cleanseAll:g.has('CLEANSE_ALL'),cleanseCategory:[...g].find(x=>x.startsWith('CLEANSE_CATEGORY='))?.slice(17)||'status',cleanseOrder:[...g].find(x=>x.startsWith('CLEANSE_ORDER='))?.slice(14)||'oldest',reviveHp:n.REVIVE_HP?.value??null,reviveHpRate:n.REVIVE_HP_RATE?.value??null,auraEffect:[...g].find(x=>x.startsWith('AURA_EFFECT='))?.slice(12)||null,auraValue:n.AURA_VALUE?.value??null,auraTarget:[...g].find(x=>x.startsWith('AURA_TARGET='))?.slice(12)||null,auraScope:[...g].find(x=>x.startsWith('AURA_SCOPE='))?.slice(11)||null,auraStack:[...g].find(x=>x.startsWith('AURA_STACK='))?.slice(11)||'highest',auraPriority:n.AURA_PRIORITY?.value??0},sourceTags:[...(skill?.tags||[])]},parsed};
}
function findTagSkill(skillId){return TAG_SKILLS.find(x=>x.id===skillId)||null}
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
 const side=definition.target.side,range=definition.target.range,isRevive=definition.logicOrder.includes('REVIVE');
 let candidates=[];
 if(isRevive){
  if(side!=='ally')return{ok:false,reason:'REVIVEの対象陣営が無効です',targets:[]};
  candidates=battle.units.filter(x=>!x.alive&&x.hp<=0&&x.side===actor.side);
 }else if(side==='self')candidates=[actor];
 else if(side==='ally')candidates=battle.units.filter(x=>x.alive&&x.side===actor.side);
 else if(side==='enemy')candidates=battle.units.filter(x=>x.alive&&x.side!==actor.side);
 else return{ok:false,reason:'対象陣営タグがありません',targets:[]};
 if(range==='single'){
  if(!target)return{ok:false,reason:'対象が無効です',targets:[]};
  if(isRevive&&target.alive)return{ok:false,reason:'INVALID_TARGET: 生存対象は蘇生できません',targets:[]};
  if(isRevive&&target.hp>0)return{ok:false,reason:'INVALID_TARGET: HPが残っている対象は蘇生できません',targets:[]};
  if(!isRevive&&!target.alive)return{ok:false,reason:'対象が無効です',targets:[]};
  if(!candidates.some(x=>x.id===target.id))return{ok:false,reason:'対象陣営タグと選択対象が一致しません',targets:[]};
  candidates=[target];
 }else if(range!=='all')return{ok:false,reason:`範囲 ${range} は未対応です`,targets:[]};
 if(!candidates.length&&!isRevive)return{ok:false,reason:'有効な対象がありません',targets:[]};
 return{ok:true,targets:candidates};
}
let modifierStackSequence=0;
function ensureModifierStackList(target){if(!Array.isArray(target.modifierStacks))target.modifierStacks=[];return target.modifierStacks}
function modifierGroupKey(kind,stat){return `${kind}:${stat}`}
function effectiveModifierPower(target,kind,stat){const active=ensureModifierStackList(target).filter(x=>x.kind===kind&&x.stat===stat&&x.expiresAt>battle.tick);return active.length?Math.max(...active.map(x=>x.power)):0}
function effectiveAttackValue(unit){const buff=effectiveModifierPower(unit,'BUFF','ATK'),debuff=effectiveModifierPower(unit,'DEBUFF','ATK');return Math.max(0,Math.floor(unit.attack*(1+buff/100)*(1-debuff/100)))}
function recordEffectiveModifierChange(target,kind,stat,before,after,reason){if(before===after)return;battle.log.push(`[Tick ${battle.tick}] [TAG][${kind}] ${target.name}の${stat}実効値 ${before}% → ${after}%（${reason}）`);recordValidationEvent('modifier_effective_changed',{target_id:target.id,kind,stat,before,after,reason})}
function applyTaggedModifier(source,target,compiled,logic){
 if(!target?.alive)return{ok:false,reason:'効果対象が無効です'};
 const stat=compiled.definition.parameters.modifierStat,power=Math.max(0,Number(compiled.definition.parameters.modifierPower)||0),duration=Math.max(1,Math.floor(compiled.definition.parameters.modifierDuration)),gain=Math.max(1,Math.floor(compiled.definition.parameters.stackGain));
 const before=effectiveModifierPower(target,logic,stat),list=ensureModifierStackList(target),added=[];
 for(let i=0;i<gain;i++){const stack={id:`MOD-${++modifierStackSequence}`,kind:logic,stat,power,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,appliedAt:battle.tick,expiresAt:battle.tick+duration,duration};list.push(stack);added.push(stack)}
 const after=effectiveModifierPower(target,logic,stat);
 battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] ${source.name}の${compiled.definition.name} → ${target.name}へ${stat} ${power}%を${added.length}スタック付与（実効${after}%、終了Tick ${battle.tick+duration}）`);
 recordValidationEvent('modifier_stack_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,kind:logic,stat,power,count:added.length,stack_ids:added.map(x=>x.id),expires_at:battle.tick+duration,effective_before:before,effective_after:after});
 recordEffectiveModifierChange(target,logic,stat,before,after,'stack_added');
 return{ok:true,added:added.length,power,effective:after,stacks:added};
}
function processModifierStacks(){
 for(const target of battle.units){const list=ensureModifierStackList(target);if(!list.length)continue;if(!target.alive){target.modifierStacks=[];continue}
  const groups=new Set(list.map(x=>modifierGroupKey(x.kind,x.stat))),before={};for(const key of groups){const [kind,stat]=key.split(':');before[key]=Math.max(0,...list.filter(x=>x.kind===kind&&x.stat===stat).map(x=>x.power))}
  const expired=list.filter(x=>x.expiresAt<=battle.tick),keep=list.filter(x=>x.expiresAt>battle.tick);target.modifierStacks=keep;
  for(const x of expired){battle.log.push(`[Tick ${battle.tick}] [TAG][${x.kind}] ${target.name}の${x.stat} ${x.power}% #${x.id}が終了`);recordValidationEvent('modifier_expired',{target_id:target.id,stack_id:x.id,kind:x.kind,stat:x.stat,power:x.power})}
  for(const key of groups){const [kind,stat]=key.split(':'),after=effectiveModifierPower(target,kind,stat);recordEffectiveModifierChange(target,kind,stat,before[key],after,'stack_expired')}
 }
}
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
function modifierStatusText(unit){const list=ensureModifierStackList(unit);if(!list.length)return'なし';const groups={};for(const x of list){const k=modifierGroupKey(x.kind,x.stat);(groups[k]||(groups[k]=[])).push(x)}return Object.entries(groups).map(([k,v])=>`${k} ${v.length}stack / 実効${Math.max(...v.map(x=>x.power))}%`).join('、')}
let shieldEffectSequence=0;
function ensureShieldEffects(target){if(!Array.isArray(target.shieldEffects))target.shieldEffects=[];return target.shieldEffects}
function shieldTotal(target){return ensureShieldEffects(target).reduce((sum,x)=>sum+Math.max(0,Number(x.remaining)||0),0)}
function shieldStatusText(unit){const effects=ensureShieldEffects(unit);if(!effects.length)return'なし';return `${shieldTotal(unit)}（${effects.length}枚 / ${effects.map(x=>`${x.remaining}@${x.expiresAt}`).join(', ')}）`}
function applyTaggedShield(source,target,compiled){
 if(!target?.alive)return{ok:false,reason:'シールド対象が無効です'};
 const amount=Math.max(0,Math.floor(Number(compiled.definition.parameters.shield)||0)),duration=Math.max(0,Math.floor(Number(compiled.definition.parameters.shieldDuration)||0));
 if(amount<=0||duration<=0)return{ok:false,reason:'シールド値または持続時間が無効です'};
 const sequence=++shieldEffectSequence,effect={id:`SHIELD-${sequence}`,sequence,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,amount,remaining:amount,appliedAt:battle.tick,expiresAt:battle.tick+duration,duration};
 ensureShieldEffects(target).push(effect);
 battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${source.name}の${compiled.definition.name} → ${target.name}へシールド${amount}付与（持続${duration}、総残量${shieldTotal(target)}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('shield_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,shield_id:effect.id,amount,duration,expires_at:effect.expiresAt,total_shield:shieldTotal(target)});
 return{ok:true,shieldId:effect.id,amount,duration,expiresAt:effect.expiresAt,totalShield:shieldTotal(target),effect};
}
function consumeShieldDamage(target,rawDamage,{sourceId=null,skillId=null,damageType='damage'}={}){
 const raw=Math.max(0,Math.floor(Number(rawDamage)||0)),sequenceOf=x=>Number.isFinite(Number(x.sequence))?Number(x.sequence):(Number(String(x.id||'').match(/(\d+)$/)?.[1])||0),effects=ensureShieldEffects(target).sort((a,b)=>a.appliedAt-b.appliedAt||sequenceOf(a)-sequenceOf(b)||String(a.id).localeCompare(String(b.id)));
 let remaining=raw,absorbed=0;const consumed=[];
 for(const effect of effects){if(remaining<=0)break;const use=Math.min(Math.max(0,effect.remaining),remaining);if(use<=0)continue;effect.remaining-=use;remaining-=use;absorbed+=use;consumed.push({shield_id:effect.id,absorbed:use,remaining:effect.remaining})}
 target.shieldEffects=effects.filter(x=>x.remaining>0);
 if(absorbed>0){battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${target.name}のシールドが${absorbed}吸収（受けるHPダメージ${remaining}、総残量${shieldTotal(target)}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_absorbed',{source_id:sourceId,target_id:target.id,skill_id:skillId,damage_type:damageType,raw_damage:raw,absorbed,hp_damage:remaining,consumed,total_shield:shieldTotal(target)})}
 return{rawDamage:raw,absorbed,hpDamage:remaining,totalShield:shieldTotal(target),consumed};
}
function processShieldEffects(){for(const target of battle.units){const effects=ensureShieldEffects(target),expired=effects.filter(x=>x.expiresAt<=battle.tick);if(expired.length){target.shieldEffects=effects.filter(x=>x.expiresAt>battle.tick&&x.remaining>0);for(const x of expired){battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${target.name}の${x.skillName}#${x.id}が終了（残量${x.remaining}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_expired',{target_id:target.id,shield_id:x.id,remaining:x.remaining,expired_at:battle.tick})}}}}
function clearAllShields(reason='battle_end'){for(const target of battle.units){const count=ensureShieldEffects(target).length,total=shieldTotal(target);if(count){target.shieldEffects=[];battle.log.push(`[Tick ${battle.tick}] [TAG][SHIELD] ${target.name}のシールドを消去（${reason}、${count}枚、残量${total}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('shield_cleared',{target_id:target.id,reason,count,total})}}}

let statusEffectSequence=0;
function ensureStatusEffects(target){if(!Array.isArray(target.statusEffects))target.statusEffects=[];return target.statusEffects}
function statusSnapshot(target){return ensureStatusEffects(target).map(x=>({instance_id:x.instanceId,status_id:x.statusId,source_id:x.sourceId,target_id:x.targetId,skill_id:x.skillId,applied_tick:x.appliedTick,base_duration_tick:x.baseDurationTick,effective_duration_tick:x.effectiveDurationTick,expires_tick:x.expiresTick,target_resistance:x.targetResistance,stack_policy:x.stackPolicy,payload:x.payload}))}
function statusResistance(target,statusId){const raw=Number(target?.statusResistance?.[statusId]??target?.statusResistance??0);return Math.max(0,Math.min(75,Number.isFinite(raw)?raw:0))}
function effectiveStatusDuration(baseDuration,resistance){return Math.max(1,Math.floor(Math.max(1,Number(baseDuration)||1)*(1-Math.max(0,Math.min(75,Number(resistance)||0))/100)))}
function applyTaggedStatus(source,target,compiled){
 if(!target?.alive)return{ok:false,reason:'状態異常対象が無効です'};
 const p=compiled.definition.parameters,statusId=p.statusId,baseDuration=Math.floor(Number(p.statusDuration)||0),resistance=statusResistance(target,statusId),duration=effectiveStatusDuration(baseDuration,resistance);
 const list=ensureStatusEffects(target),policy=p.statusStackPolicy||'refresh',existing=list.find(x=>x.statusId===statusId);
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

function calculateTaggedAttackDamage(attacker,definition){
 const rate=Number(definition.parameters.damage);
 if(definition.parameters.damageType==='fixed')return Math.max(0,Math.floor(rate));
 return Math.max(0,Math.floor(effectiveAttackValue(attacker)*(rate/100)));
}
function applyTaggedDamage(attacker,target,damage,skill){
 const before=target.hp,shield=consumeShieldDamage(target,damage,{sourceId:attacker.id,skillId:skill.id,damageType:'tag_attack'});target.hp=Math.max(0,target.hp-shield.hpDamage);const applied=before-target.hp;
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});
 attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${skill.name} → ${target.name}に${applied}HPダメージ（シールド吸収${shield.absorbed}、DAMAGE=${skill.parameters.damage}, 残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('attack',{source_id:attacker.id,target_id:target.id,skill_id:skill.id,raw_damage:shield.rawDamage,shield_absorbed:shield.absorbed,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){resetCombatantOnDeath(target,{reason:'tag_attack',sourceId:attacker.id});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
 finishIfNeeded();return{ok:true,damage:applied,rawDamage:shield.rawDamage,shieldAbsorbed:shield.absorbed,beforeHp:before,afterHp:target.hp};
}
function applyTaggedHeal(source,target,compiled){
 if(!target?.alive)return{ok:false,reason:'回復対象が無効です'};
 const requested=Math.max(0,Math.floor(Number(compiled.definition.parameters.heal)||0)),before=target.hp;
 target.hp=Math.min(target.maxHp,target.hp+requested);
 const applied=target.hp-before,overheal=Math.max(0,requested-applied);
 battle.log.push(`[Tick ${battle.tick}] [TAG][HEAL] ${source.name}の${compiled.definition.name} → ${target.name}を${applied}回復（HEAL=${requested}, HP ${before}→${target.hp}/${target.maxHp}${overheal?`, 超過${overheal}`:''}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('heal',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,requested,applied,overheal,hp_before:before,hp_after:target.hp,max_hp:target.maxHp});
 return{ok:true,requested,healed:applied,overheal,beforeHp:before,afterHp:target.hp};
}
const DOT_STACK_TYPES={poison:{id:'poison',label:'毒',maxStack:5}};
let dotStackSequence=0;
function resolveDotType(compiled){if(compiled.parsed?.generalTags?.has('毒属性'))return DOT_STACK_TYPES.poison;return{id:'generic-dot',label:'DOT',maxStack:5}}
function ensureDotStackList(target){if(!Array.isArray(target.dotStacks))target.dotStacks=[];return target.dotStacks}
function applyTaggedDot(source,target,compiled){
 if(!target?.alive)return{ok:false,reason:'DOT付与対象が無効です'};
 const type=resolveDotType(compiled),list=ensureDotStackList(target),gain=Math.max(1,Math.floor(compiled.definition.parameters.stackGain));
 const current=list.filter(x=>x.typeId===type.id).length,available=Math.max(0,type.maxStack-current),addCount=Math.min(gain,available);
 if(addCount<=0){battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${target.name}の${type.label}は最大${type.maxStack}スタックのため付与失敗`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stack_rejected',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,reason:'MAX_STACK',current,max_stack:type.maxStack});return{ok:false,reason:'MAX_STACK',added:0,current,maxStack:type.maxStack}}
 const power=Math.max(0,Math.floor(compiled.definition.parameters.dotPower)),duration=Math.max(1,Math.floor(compiled.definition.parameters.dotDuration)),interval=Math.max(1,Math.floor(compiled.definition.parameters.dotInterval)),added=[];
 for(let i=0;i<addCount;i++){const stack={id:`DOT-${++dotStackSequence}`,typeId:type.id,label:type.label,sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,power,appliedAt:battle.tick,expiresAt:battle.tick+duration,nextTick:battle.tick+interval,interval,duration};list.push(stack);added.push(stack)}
 battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${source.name}の${compiled.definition.name} → ${target.name}へ${type.label} ${added.length}スタック付与（${current+added.length}/${type.maxStack}、威力${power}、間隔${interval}、持続${duration}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stack_added',{source_id:source.id,target_id:target.id,skill_id:compiled.definition.id,stack_ids:added.map(x=>x.id),count:added.length,power,duration,interval,expires_at:battle.tick+duration});
 return{ok:true,added:added.length,current:current+added.length,maxStack:type.maxStack,stacks:added};
}
function applyDotTick(target,stack){
 if(!target.alive)return false;const source=battle.units.find(x=>x.id===stack.sourceId),before=target.hp,shield=consumeShieldDamage(target,stack.power,{sourceId:stack.sourceId,skillId:stack.skillId,damageType:'dot'});target.hp=Math.max(0,target.hp-shield.hpDamage);const applied=before-target.hp;
 if(source){source.damageDealt+=applied;queueSceneEvent({attackerId:source.id,targetId:target.id,attackerName:source.name,attackerSide:source.side,miss:false,damage:applied})}target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${stack.label}#${stack.id} → ${target.name}に${applied}ダメージ（残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_damage',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,raw_damage:stack.power,shield_absorbed:shield.absorbed,damage:applied,hp_before:before,hp_after:target.hp,next_tick:stack.nextTick+stack.interval,expires_at:stack.expiresAt});
 if(target.hp<=0){const clearedStacks=Array.isArray(target.dotStacks)?target.dotStacks.length:0;resetCombatantOnDeath(target,{reason:'dot',sourceId:stack.sourceId});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は${stack.label}により戦闘不能`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_defeat',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,label:stack.label,hp_before:before,hp_after:target.hp,cleared_dot_stacks:clearedStacks})}finishIfNeeded();return true;
}
function processDotStacks(){
 for(const target of battle.units){const list=ensureDotStackList(target);if(!list.length)continue;if(!target.alive){target.dotStacks=[];continue}const keep=[];
  for(const stack of list){while(target.alive&&stack.nextTick<=battle.tick&&stack.nextTick<=stack.expiresAt){applyDotTick(target,stack);stack.nextTick+=stack.interval;if(battle.result||battle.pendingResult)break}if(target.alive&&stack.nextTick<=stack.expiresAt)keep.push(stack);else if(target.alive){battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${target.name}の${stack.label}#${stack.id}が終了`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_expired',{target_id:target.id,stack_id:stack.id,label:stack.label})}}
  target.dotStacks=keep;if(battle.result||battle.pendingResult)break}
}
function dotStatusText(unit){const stacks=ensureDotStackList(unit);if(!stacks.length)return'なし';const groups={};for(const x of stacks)(groups[x.label]||(groups[x.label]=[])).push(x);return Object.entries(groups).map(([label,items])=>`${label}×${items.length}（次:${Math.min(...items.map(x=>x.nextTick))} / 最長:${Math.max(...items.map(x=>x.expiresAt))}）`).join('、')}
function resetCombatantOnDeath(target,{reason='death',sourceId=null}={}){
 if(!target)return{ok:false,reason:'対象がありません'};
 const cleared={statuses:Array.isArray(target.statusEffects)?target.statusEffects.length:0,dots:Array.isArray(target.dotStacks)?target.dotStacks.length:0,modifiers:Array.isArray(target.modifierStacks)?target.modifierStacks.length:0,shields:Array.isArray(target.shieldEffects)?target.shieldEffects.length:0};
 target.hp=0;target.alive=false;target.gauge=0;target.reservedAction=null;target.statusEffects=[];target.dotStacks=[];target.modifierStacks=[];target.shieldEffects=[];
 if('followUpQueue' in target)target.followUpQueue=[];
 if('followUpReservations' in target)target.followUpReservations=[];
 if('temporaryResources' in target)target.temporaryResources={};
 typeof recordValidationEvent==='function'&&recordValidationEvent('unit_death_reset',{target_id:target.id,source_id:sourceId,reason,cleared});
 return{ok:true,targetId:target.id,cleared};
}
function reviveTarget(actor,target,compiled){
 if(!actor?.alive)return{ok:false,reason:'使用者が無効です'};
 if(!target||target.side!==actor.side||target.alive||target.hp>0)return{ok:false,reason:'INVALID_TARGET'};
 const fixed=compiled.definition.parameters.reviveHp,rate=compiled.definition.parameters.reviveHpRate;
 const mode=Number.isFinite(Number(rate))?'rate':'fixed',reviveValue=mode==='rate'?Number(rate):Math.floor(Number(fixed)||0);
 if(mode==='fixed'&&reviveValue<1)return{ok:false,reason:'REVIVE_HPが無効です'};
 if(mode==='rate'&&(!Number.isFinite(reviveValue)||reviveValue<=0||reviveValue>1))return{ok:false,reason:'REVIVE_HP_RATEが無効です'};
 const before=target.hp,maxHp=Math.max(1,Math.floor(Number(target.maxHp)||1));
 const after=mode==='rate'?Math.max(1,Math.floor(maxHp*reviveValue)):Math.min(reviveValue,maxHp);
 target.hp=after;target.alive=true;target.gauge=0;target.reservedAction=null;
 battle.log.push(`[Tick ${battle.tick}] [TAG][REVIVE] ${actor.name}の${compiled.definition.name} → ${target.name}がHP${after}で復活（${mode==='rate'?`割合${reviveValue}`:`固定${reviveValue}`}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('revive',{source_id:actor.id,target_id:target.id,skill_id:compiled.definition.id,hp_before:before,hp_after:after,max_hp:maxHp,mode,revive_value:reviveValue});
 return{ok:true,targetId:target.id,hpBefore:before,hpAfter:after,maxHp,reviveMode:mode,reviveValue,gauge:target.gauge};
}
function executeTaggedSkill(actor,target,skillSource,{manual=false,isFollowUp=false}={}){
 const compiled=compileTaggedSkill(skillSource);
 battle.log.push(`[Tick ${battle.tick}] [TAG][COMPILE] ${skillSource?.id||'unknown'} ${compiled.ok?'成功':'失敗'}`);
 if(!compiled.ok){compiled.errors.forEach(x=>battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${x}`));return{ok:false,stage:'compile',compiled}}
 const resolved=resolveTaggedTargets(actor,target,compiled.definition);
 if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 const targetResults=[];
 for(const resolvedTarget of resolved.targets){
  let attackResult=null,healResult=null,shieldResult=null,dotResult=null,modifierResult=null,followUpResult=null,statusResult=null,cleanseResult=null,reviveResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK');
  for(const logic of compiled.definition.logicOrder){
   if(logic==='ATTACK'){attackResult=applyTaggedDamage(actor,resolvedTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}
   else if(logic==='HEAL'){healResult=applyTaggedHeal(actor,resolvedTarget,compiled)}
   else if(logic==='SHIELD'){shieldResult=applyTaggedShield(actor,resolvedTarget,compiled)}
   else if(logic==='CLEANSE'){cleanseResult=cleanseStatusEffects(actor,resolvedTarget,compiled)}
   else if(logic==='REVIVE'){reviveResult=reviveTarget(actor,resolvedTarget,compiled)}
   else if(logic==='STATUS'){if(compiled.definition.logicOrder.includes('ATTACK')&&!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][STATUS] ATTACK不成立のため状態異常付与をスキップ`);else if(!resolvedTarget.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][STATUS] 対象戦闘不能のため状態異常付与をスキップ`);else statusResult=applyTaggedStatus(actor,resolvedTarget,compiled)}
   else if(logic==='DOT'){if(!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ATTACK不成立のためDOT付与をスキップ`);else if(!resolvedTarget.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] 対象戦闘不能のためDOT付与をスキップ`);else dotResult=applyTaggedDot(actor,resolvedTarget,compiled)}
   else if(logic==='FOLLOW_UP'){followUpResult=applyTaggedDamage(actor,resolvedTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!followUpResult?.ok}
   else if(logic==='BUFF'||logic==='DEBUFF'){modifierResult=applyTaggedModifier(actor,resolvedTarget,compiled,logic)}
   else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`);
  }
  targetResults.push({targetId:resolvedTarget.id,attackResult,healResult,shieldResult,dotResult,modifierResult,followUpResult,statusResult,cleanseResult,reviveResult});
  if(attackResult?.ok&&!isFollowUp)dispatchConditionalFollowUps(actor,resolvedTarget,{trigger:'ALLY_ATTACK',originSkillId:compiled.definition.id});
  else if(followUpResult?.ok&&isFollowUp)recordValidationEvent('follow_up_chain_blocked',{source_id:actor.id,target_id:resolvedTarget.id,skill_id:compiled.definition.id,reason:'FOLLOW_UP_CANNOT_CHAIN'});
 }
 if(manual)renderBattle();
 const first=targetResults[0]||{};
 return{ok:true,compiled,targets:resolved.targets.map(x=>x.id),targetResults,attackResult:first.attackResult,healResult:first.healResult,shieldResult:first.shieldResult,dotResult:first.dotResult,modifierResult:first.modifierResult,followUpResult:first.followUpResult,statusResult:first.statusResult,cleanseResult:first.cleanseResult,reviveResult:first.reviveResult};
}
function dispatchConditionalFollowUps(initiator,target,event){
 if(!initiator?.alive||!target?.alive||event?.trigger!=='ALLY_ATTACK')return[];
 const results=[];
 for(const follower of battle.units.filter(x=>x.alive&&x.side===initiator.side&&x.id!==initiator.id)){
  const ids=Array.isArray(follower.followUpSkillIds)?follower.followUpSkillIds:[];
  for(const skillId of ids){
   const skill=findTagSkill(skillId),compiled=compileTaggedSkill(skill);
   if(!compiled.ok||!compiled.definition.logicOrder.includes('FOLLOW_UP'))continue;
   const poisoned=ensureDotStackList(target).length>0;
   if(!poisoned){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'CONDITION_POISONED_FALSE'});continue}
   recordValidationEvent('follow_up_triggered',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,trigger:'ALLY_ATTACK',condition:'POISONED'});
   battle.log.push(`[Tick ${battle.tick}] [TAG][FOLLOW_UP] ${follower.name}が${initiator.name}の攻撃に連携 → ${target.name}`);
   const result=executeTaggedSkill(follower,target,skill,{isFollowUp:true});results.push(result);
  }
 }
 return results;
}
