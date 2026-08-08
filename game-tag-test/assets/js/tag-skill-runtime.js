/* Validation tag skill compiler/runtime — GA-B486.57 / P01-06 AURA source-dependent runtime v1 */
const TAG_LOGIC_ORDER=['COVER','COUNTER','ATTACK','DOT','HEAL','HOT','BUFF','DEBUFF','AURA','SHIELD','STATUS','CLEANSE','SUMMON','DISPEL','REVIVE'];
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
  if(coverLifetime==='uses'){
   if(!n.COVER_USES||!Number.isFinite(n.COVER_USES.value)||!Number.isInteger(n.COVER_USES.value)||n.COVER_USES.value<1)errors.push('COVER_LIFETIME=usesには1以上の有限整数COVER_USESが必要です');
   if(n.DURATION)errors.push('COVER_LIFETIME=usesではDURATIONを同時指定できません');
  }
  if(coverLifetime==='duration'){
   if(!n.DURATION||!Number.isFinite(n.DURATION.value)||!Number.isInteger(n.DURATION.value)||n.DURATION.value<1)errors.push('COVER_LIFETIME=durationには1以上の有限整数DURATIONが必要です');
   if(n.COVER_USES)errors.push('COVER_LIFETIME=durationではCOVER_USESを同時指定できません');
  }
  if(coverLifetime==='persistent'){
   if(n.COVER_USES)errors.push('COVER_LIFETIME=persistentではCOVER_USESを指定できません');
   if(n.DURATION)errors.push('COVER_LIFETIME=persistentではDURATIONを指定できません');
  }
  if(!g.has('味方'))errors.push('COVERの保護対象は味方が必要です');
  if(g.has('自分')||g.has('敵')||g.has('死体')||g.has('地点'))errors.push('COVERは味方以外を保護対象にできません');
  if(coverTarget==='single_ally'&&!g.has('単体'))errors.push('COVER_TARGET=single_allyには単体が必要です');
  if(coverTarget==='all_allies'&&!g.has('全体'))errors.push('COVER_TARGET=all_alliesには全体が必要です');
  if(coverTarget==='single_ally'&&hasAnyTag(g,['全体','前列','後列','ランダム','貫通']))errors.push('単体COVERは範囲指定を使用できません');
  if(coverTarget==='all_allies'&&hasAnyTag(g,['単体','前列','後列','ランダム','貫通']))errors.push('全体COVERは全体以外の範囲指定を使用できません');
  const mixed=TAG_LOGIC_ORDER.filter(x=>x!=='COVER'&&g.has(x));
  if(mixed.length)errors.push(`初回COVER定義は専用関係のみです: ${mixed.join(',')}`);
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
 if(n.COOLDOWN&&(!Number.isFinite(n.COOLDOWN.value)||!Number.isInteger(n.COOLDOWN.value)||n.COOLDOWN.value<0))errors.push('COOLDOWNは0以上の有限整数が必要です');
 if(n.MP_COST&&(!Number.isFinite(n.MP_COST.value)||n.MP_COST.value<0))errors.push('MP_COSTは0以上の有限数が必要です');
 if(n.ACTIVATION_PRIORITY&&(!Number.isFinite(n.ACTIVATION_PRIORITY.value)||!Number.isInteger(n.ACTIVATION_PRIORITY.value)))errors.push('ACTIVATION_PRIORITYは有限整数が必要です');
 const targetSide=isAura?'self':g.has('敵')?'enemy':g.has('味方')?'ally':g.has('自分')?'self':g.has('死体')?'corpse':g.has('地点')?'point':null;
 const range=isAura?'single':g.has('単体')?'single':g.has('全体')?'all':g.has('前列')?'front':g.has('後列')?'back':g.has('ランダム')?'random':g.has('貫通')?'pierce':null;
 const damageType=g.has('物理')?'physical':g.has('魔法')?'magical':g.has('固定')?'fixed':null;
 const mpCost=n.MP_COST?.value??0,costs=mpCost>0?[{type:'mp',amount:mpCost,payCondition:'sufficient_resource',consumeTiming:'activation_established',refundCondition:'not_consumed_before_activation',failureReason:'MP_SHORTAGE'}]:[],activationPriority=n.ACTIVATION_PRIORITY?.value??0;
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,costs,parameters:{damageType,mpCost,activationPriority,cooldown:n.COOLDOWN?.value??0,damage:n.DAMAGE?.value??null,heal:n.HEAL?.value??null,shield:n.SHIELD?.value??null,shieldDuration:n.DURATION?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null,statusId:[...g].find(x=>x.startsWith('STATUS_ID='))?.slice(10)||null,statusDuration:g.has('STATUS')?(n.DURATION?.value??null):null,statusStackPolicy:g.has('INDEPENDENT')?'independent':g.has('STRONGEST')?'strongest':'refresh',statusPayload:{...([...g].includes('STATUS_ID=STATUS-ACCURACY-DOWN')?{accuracy_modifier:-20}:{}),...(g.has('ACTION_DISABLED=true')?{action_disabled:true}:{})},cleanseCount:n.CLEANSE_COUNT?.value??null,cleanseAll:g.has('CLEANSE_ALL'),cleanseCategory:[...g].find(x=>x.startsWith('CLEANSE_CATEGORY='))?.slice(17)||'status',cleanseOrder:[...g].find(x=>x.startsWith('CLEANSE_ORDER='))?.slice(14)||'oldest',reviveHp:n.REVIVE_HP?.value??null,reviveHpRate:n.REVIVE_HP_RATE?.value??null,auraEffect:[...g].find(x=>x.startsWith('AURA_EFFECT='))?.slice(12)||null,auraValue:n.AURA_VALUE?.value??null,auraTarget:[...g].find(x=>x.startsWith('AURA_TARGET='))?.slice(12)||null,auraScope:[...g].find(x=>x.startsWith('AURA_SCOPE='))?.slice(11)||null,auraStack:[...g].find(x=>x.startsWith('AURA_STACK='))?.slice(11)||'highest',auraPriority:n.AURA_PRIORITY?.value??0,coverTarget:[...g].find(x=>x.startsWith('COVER_TARGET='))?.slice(13)||null,coverTrigger:[...g].find(x=>x.startsWith('COVER_TRIGGER='))?.slice(14)||null,coverPriority:n.COVER_PRIORITY?.value??null,coverRemovable:[...g].find(x=>x.startsWith('COVER_REMOVABLE='))?.slice(16)||null,coverLifetime:[...g].find(x=>x.startsWith('COVER_LIFETIME='))?.slice(15)||null,coverUses:n.COVER_USES?.value??null,coverDuration:g.has('COVER')?(n.DURATION?.value??null):null,coverRuntimeApplied:true,counterTrigger:[...g].find(x=>x.startsWith('COUNTER_TRIGGER='))?.slice(16)||null,counterTarget:[...g].find(x=>x.startsWith('COUNTER_TARGET='))?.slice(15)||null,counterLimit:n.COUNTER_LIMIT?.value??null,counterPriority:n.COUNTER_PRIORITY?.value??null,counterRequireAlive:[...g].find(x=>x.startsWith('COUNTER_REQUIRE_ALIVE='))?.slice(22)||null,counterAllowZeroDamage:[...g].find(x=>x.startsWith('COUNTER_ALLOW_ZERO_DAMAGE='))?.slice(26)||null,counterUsesAttack:g.has('COUNTER')&&g.has('ATTACK')},sourceTags:[...(skill?.tags||[])]},parsed};
}
function findTagSkill(skillId){return TAG_SKILLS.find(x=>x.id===skillId)||null}
function formatCompileResult(result){
 const d=result.definition,p=result.parsed;
 return [
  `[BUILD] ${TAG_SKILL_TEST_BUILD}`,
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
 const seq=++statusEffectSequence,effect={instanceId:`STATUS-I-${seq}`,sequence:seq,statusId,sourceId:source.id,targetId:target.id,skillId:compiled.definition.id,appliedTick:battle.tick,baseDurationTick:baseDuration,effectiveDurationTick:duration,expiresTick:battle.tick+duration,targetResistance:resistance,stackPolicy:policy,payload:p.statusPayload||{},removeOnDeath:true,removeOnBattleEnd:true,removable:true,protected:false,removePriority:0};
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
 return Math.max(0,Math.floor(Math.max(0,attacker.attack)*(rate/100)));
}
function applyTaggedDamage(attacker,target,damage,skill){
 const before=target.hp,shield=consumeShieldDamage(target,damage,{sourceId:attacker.id,skillId:skill.id,damageType:'tag_attack'});target.hp=Math.max(0,target.hp-shield.hpDamage);const applied=before-target.hp;
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});
 attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${skill.name} → ${target.name}に${applied}HPダメージ（シールド吸収${shield.absorbed}、DAMAGE=${skill.parameters.damage}, 残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('attack',{source_id:attacker.id,target_id:target.id,skill_id:skill.id,raw_damage:shield.rawDamage,shield_absorbed:shield.absorbed,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){target.alive=false;target.gauge=0;target.reservedAction=null;target.shieldEffects=[];battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
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
 if(target.hp<=0){const clearedStacks=Array.isArray(target.dotStacks)?target.dotStacks.length:0;target.alive=false;target.gauge=0;target.reservedAction=null;target.dotStacks=[];target.shieldEffects=[];battle.log.push(`[Tick ${battle.tick}] ${target.name}は${stack.label}により戦闘不能`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_defeat',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,label:stack.label,hp_before:before,hp_after:target.hp,cleared_dot_stacks:clearedStacks})}finishIfNeeded();return true;
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
 const maxHp=Math.max(1,Math.floor(Number(target.maxHp)||1));
 const fixed=compiled.definition.parameters.reviveHp,rate=compiled.definition.parameters.reviveHpRate;
 const mode=rate!=null?'rate':'fixed';
 const reviveValue=mode==='rate'?Number(rate):Math.floor(Number(fixed)||0);
 if(mode==='fixed'&&reviveValue<1)return{ok:false,reason:'REVIVE_HPが無効です'};
 if(mode==='rate'&&(!Number.isFinite(reviveValue)||reviveValue<=0||reviveValue>1))return{ok:false,reason:'REVIVE_HP_RATEが無効です'};
 const before=target.hp,calculated=mode==='rate'?Math.max(1,Math.floor(maxHp*reviveValue)):reviveValue,after=Math.min(calculated,maxHp);
 target.hp=after;target.alive=true;target.gauge=0;target.reservedAction=null;
 battle.log.push(`[Tick ${battle.tick}] [TAG][REVIVE] ${actor.name}の${compiled.definition.name} → ${target.name}がHP${after}で復活`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('revive',{source_id:actor.id,target_id:target.id,skill_id:compiled.definition.id,hp_before:before,hp_after:after,max_hp:maxHp,mode,revive_value:reviveValue});
 return{ok:true,targetId:target.id,hpBefore:before,hpAfter:after,maxHp,reviveMode:mode,reviveValue,gauge:target.gauge};
}

function actionExecutionEligibility(unit,{actionKind='skill_action'}={}){
 if(!unit?.alive)return{ok:false,reason:'ACTOR_DEAD',actionKind};
 const status=ensureStatusEffects(unit).find(x=>x?.payload?.action_disabled===true);
 if(unit.actionDisabled===true||status)return{ok:false,reason:'ACTION_DISABLED',actionKind,statusInstanceId:status?.instanceId||null,statusId:status?.statusId||null};
 return{ok:true,reason:null,actionKind,statusInstanceId:null,statusId:null};
}
function counterActionBlocked(unit){
 if(unit?.counterDisabled===true)return true;
 return !actionExecutionEligibility(unit,{actionKind:'COUNTER'}).ok;
}
function dispatchCounterAfterAttack(attacker,defender,incomingCompiled,attackResult,{origin='base'}={}){
 const skip=(reason,extra={})=>{typeof recordValidationEvent==='function'&&recordValidationEvent('counter_skipped',{source_id:defender?.id||null,attacker_id:attacker?.id||null,incoming_skill_id:incomingCompiled?.definition?.id||null,origin,reason,...extra});return{ok:false,triggered:false,reason}};
 if(origin!=='base')return skip('DERIVED_ORIGIN');
 if(!attackResult?.ok)return skip('NO_HIT');
 if(incomingCompiled?.definition?.target?.range!=='single')return skip('AREA_ATTACK');
 if(battle.result||battle.pendingResult)return skip('BATTLE_END');
 if(!defender?.alive)return skip('DEFENDER_DEAD');
 if(counterActionBlocked(defender))return skip('ACTION_DISABLED');
 const skillId=defender.counterSkillId||null;if(!skillId)return skip('NO_COUNTER_SKILL');
 const skill=findTagSkill(skillId),compiled=compileTaggedSkill(skill);if(!skill||!compiled.ok||!compiled.definition.logicOrder.includes('COUNTER'))return skip('INVALID_COUNTER_SKILL');
 if(compiled.definition.parameters.counterTrigger!=='hit'||compiled.definition.parameters.counterTarget!=='attacker')return skip('COUNTER_CONDITION_MISMATCH');
 typeof recordValidationEvent==='function'&&recordValidationEvent('counter_triggered',{source_id:defender.id,attacker_id:attacker.id,incoming_skill_id:incomingCompiled.definition.id,counter_skill_id:skillId,origin,shield_absorbed:attackResult.shieldAbsorbed||0,hp_damage:attackResult.damage||0});
 battle.log.push(`[Tick ${battle.tick}] [TAG][COUNTER] ${defender.name}が${attacker.name}へ反撃 — ${skill.name}`);
 const result=executeTaggedSkill(defender,attacker,skill,{origin:'counter',suppressDerived:true});
 return{ok:!!result?.ok,triggered:true,skillId,result};
}
function executeTaggedSkill(actor,target,skillSource,{manual=false,isFollowUp=false,origin=null,suppressDerived=false,skipExecutionEligibility=false}={}){
 const compiled=compileTaggedSkill(skillSource);
 battle.log.push(`[Tick ${battle.tick}] [TAG][COMPILE] ${skillSource?.id||'unknown'} ${compiled.ok?'成功':'失敗'}`);
 if(!compiled.ok){compiled.errors.forEach(x=>battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${x}`));return{ok:false,stage:'compile',compiled}}
 const actualOrigin=origin||(isFollowUp?'follow_up':compiled.definition.logicOrder.includes('COUNTER')?'counter':'base');
 if(!skipExecutionEligibility){const eligibility=actionExecutionEligibility(actor,{actionKind:actualOrigin==='counter'?'COUNTER':actualOrigin==='follow_up'?'FOLLOW_UP':'skill_action'});if(!eligibility.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});return{ok:false,stage:'execution_eligibility',reason:eligibility.reason,eligibility,compiled}}}
 const resolved=resolveTaggedTargets(actor,target,compiled.definition);
 if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 const targetResults=[];
 for(const resolvedTarget of resolved.targets){
  let attackResult=null,healResult=null,shieldResult=null,dotResult=null,statusResult=null,cleanseResult=null,reviveResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK');
  for(const logic of compiled.definition.logicOrder){
   if(logic==='COUNTER'){continue}
   if(logic==='ATTACK'){attackResult=applyTaggedDamage(actor,resolvedTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}
   else if(logic==='HEAL'){healResult=applyTaggedHeal(actor,resolvedTarget,compiled)}
   else if(logic==='SHIELD'){shieldResult=applyTaggedShield(actor,resolvedTarget,compiled)}
   else if(logic==='CLEANSE'){cleanseResult=cleanseStatusEffects(actor,resolvedTarget,compiled)}
   else if(logic==='REVIVE'){reviveResult=reviveTarget(actor,resolvedTarget,compiled)}
   else if(logic==='STATUS'){if(compiled.definition.logicOrder.includes('ATTACK')&&!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][STATUS] ATTACK不成立のため状態異常付与をスキップ`);else if(!resolvedTarget.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][STATUS] 対象戦闘不能のため状態異常付与をスキップ`);else statusResult=applyTaggedStatus(actor,resolvedTarget,compiled)}
   else if(logic==='DOT'){if(!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ATTACK不成立のためDOT付与をスキップ`);else if(!resolvedTarget.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] 対象戦闘不能のためDOT付与をスキップ`);else dotResult=applyTaggedDot(actor,resolvedTarget,compiled)}
   else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`);
  }
  targetResults.push({targetId:resolvedTarget.id,attackResult,healResult,shieldResult,dotResult,statusResult,cleanseResult,reviveResult});
  if(attackResult?.ok&&!suppressDerived&&actualOrigin==='base')dispatchCounterAfterAttack(actor,resolvedTarget,compiled,attackResult,{origin:actualOrigin});
  else if(attackResult?.ok&&actualOrigin==='counter')typeof recordValidationEvent==='function'&&recordValidationEvent('counter_chain_blocked',{source_id:actor.id,target_id:resolvedTarget.id,skill_id:compiled.definition.id,reason:'COUNTER_CANNOT_CHAIN'});
 }
 if(manual)renderBattle();
 const first=targetResults[0]||{};
 return{ok:true,compiled,targets:resolved.targets.map(x=>x.id),targetResults,attackResult:first.attackResult,healResult:first.healResult,shieldResult:first.shieldResult,dotResult:first.dotResult,statusResult:first.statusResult,cleanseResult:first.cleanseResult,reviveResult:first.reviveResult};
}
