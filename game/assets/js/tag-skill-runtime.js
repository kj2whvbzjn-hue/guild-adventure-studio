/* Tag skill compiler/runtime — GA-B486.59 / P01-12 activation priority validation */
const TAG_LOGIC_ORDER=['COVER','COUNTER','ATTACK','DOT','FOLLOW_UP','HEAL','HOT','BUFF','DEBUFF','AURA','SHIELD','STATUS','CLEANSE','SUMMON','DISPEL','REVIVE'];
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
function normalizeGenericRuntimeContract(skill,g,errors){
 const raw=skill?.genericRuntime;if(raw==null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)){errors.push('genericRuntimeはobjectが必要です');return null}
 if(raw.schemaVersion!==1){errors.push(`genericRuntime.schemaVersion=${raw.schemaVersion}は未対応です`);return null}
 if(!Array.isArray(raw.applyContracts)){errors.push('genericRuntime.applyContractsは配列が必要です');return null}
 const out=[],seen=new Set();
 for(const [i,c] of raw.applyContracts.entries()){
  if(!c||typeof c!=='object'||Array.isArray(c)){errors.push(`genericRuntime.applyContracts[${i}]はobjectが必要です`);continue}
  const logic=String(c.logic||''),effectId=String(c.effectId||''),kind=String(c.kind||'');
  if(!['STATUS','DOT','BUFF','DEBUFF','SHIELD'].includes(logic)){errors.push(`genericRuntime.applyContracts[${i}].logicが無効です: ${logic||'(なし)'}`);continue}
  if(!effectId){errors.push(`genericRuntime.applyContracts[${i}].effectIdが必要です`);continue}
  if(seen.has(logic)){errors.push(`genericRuntime.applyContractsで同一logicを複数指定できません: ${logic}`);continue}seen.add(logic);
  if(!g.has(logic)){errors.push(`genericRuntime.applyContractsの${logic}がスキルタグに存在しません`);continue}
  if(!c.lifecycle||typeof c.lifecycle!=='object'||Array.isArray(c.lifecycle)){errors.push(`genericRuntime.applyContracts[${i}].lifecycleが必要です`);continue}
  for(const key of ['stackRule','refreshRule','snapshotPolicy','dispelCategory','removeOnDeath','removeOnBattleEnd','removable','effectiveRule','consumeRule'])if(c.lifecycle[key]==null||c.lifecycle[key]==='')errors.push(`genericRuntime.applyContracts[${i}].lifecycle.${key}が必要です`);
  out.push({effectId,kind,logic,lifecycle:{...c.lifecycle}});
 }
 for(const logic of ['STATUS','DOT','BUFF','DEBUFF','SHIELD'])if(g.has(logic)&&!seen.has(logic))errors.push(`Generic由来APPLYには${logic}のlifecycle契約が必要です`);
 return{schemaVersion:1,registryPhase:String(raw.registryPhase||''),applyContracts:out};
}
function compileTaggedSkill(skill){
 const parsed=parseSkillTags(skill),errors=[...parsed.errors],warnings=[];
 const g=parsed.generalTags,n=parsed.numericTags;
 const genericRuntime=normalizeGenericRuntimeContract(skill,g,errors);
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
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,costs,parameters:{damageType,mpCost,activationPriority,cooldown:n.COOLDOWN?.value??0,damage:n.DAMAGE?.value??null,heal:n.HEAL?.value??null,shield:n.SHIELD?.value??null,shieldDuration:n.DURATION?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null,modifierStat:TAG_COMBAT_MODIFIER_PARAMS.find(x=>g.has(x))||null,modifierPower:n.POWER?.value??null,modifierDuration:n.DURATION?.value??null,followUpTrigger:g.has('TRIGGER_ALLY_ATTACK')?'ALLY_ATTACK':null,followUpCondition:g.has('CONDITION_POISONED')?'POISONED':null,statusId:[...g].find(x=>x.startsWith('STATUS_ID='))?.slice(10)||null,statusDuration:g.has('STATUS')?(n.DURATION?.value??null):null,statusStackPolicy:g.has('INDEPENDENT')?'independent':g.has('STRONGEST')?'strongest':'refresh',statusPayload:{...([...g].includes('STATUS_ID=STATUS-ACCURACY-DOWN')?{accuracy_modifier:-20}:{}),...(g.has('ACTION_DISABLED=true')?{action_disabled:true}:{})},cleanseCount:n.CLEANSE_COUNT?.value??null,cleanseAll:g.has('CLEANSE_ALL'),cleanseCategory:[...g].find(x=>x.startsWith('CLEANSE_CATEGORY='))?.slice(17)||'status',cleanseOrder:[...g].find(x=>x.startsWith('CLEANSE_ORDER='))?.slice(14)||'oldest',reviveHp:n.REVIVE_HP?.value??null,reviveHpRate:n.REVIVE_HP_RATE?.value??null,auraEffect:[...g].find(x=>x.startsWith('AURA_EFFECT='))?.slice(12)||null,auraValue:n.AURA_VALUE?.value??null,auraTarget:[...g].find(x=>x.startsWith('AURA_TARGET='))?.slice(12)||null,auraScope:[...g].find(x=>x.startsWith('AURA_SCOPE='))?.slice(11)||null,auraStack:[...g].find(x=>x.startsWith('AURA_STACK='))?.slice(11)||'highest',auraPriority:n.AURA_PRIORITY?.value??0,coverTarget:[...g].find(x=>x.startsWith('COVER_TARGET='))?.slice(13)||null,coverTrigger:[...g].find(x=>x.startsWith('COVER_TRIGGER='))?.slice(14)||null,coverPriority:n.COVER_PRIORITY?.value??null,coverRemovable:[...g].find(x=>x.startsWith('COVER_REMOVABLE='))?.slice(16)||null,coverLifetime:[...g].find(x=>x.startsWith('COVER_LIFETIME='))?.slice(15)||null,coverUses:n.COVER_USES?.value??null,coverDuration:g.has('COVER')?(n.DURATION?.value??null):null,coverRuntimeApplied:true,counterTrigger:[...g].find(x=>x.startsWith('COUNTER_TRIGGER='))?.slice(16)||null,counterTarget:[...g].find(x=>x.startsWith('COUNTER_TARGET='))?.slice(15)||null,counterLimit:n.COUNTER_LIMIT?.value??null,counterPriority:n.COUNTER_PRIORITY?.value??null,counterRequireAlive:[...g].find(x=>x.startsWith('COUNTER_REQUIRE_ALIVE='))?.slice(22)||null,counterAllowZeroDamage:[...g].find(x=>x.startsWith('COUNTER_ALLOW_ZERO_DAMAGE='))?.slice(26)||null,counterUsesAttack:g.has('COUNTER')&&g.has('ATTACK'),conditions,conditionMode:'all'},genericRuntime,sourceTags:[...(skill?.tags||[])]},parsed};
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
function auraSourceSkillIds(source){return Array.isArray(source?.auraSkillIds)?source.auraSkillIds:[]}
function activeAuraEntries(target,kind,stat){
 if(!target?.alive)return[];const entries=[];
 for(const source of battle.units.filter(x=>x.alive)){
  for(const skillId of auraSourceSkillIds(source)){
   const skill=findTagSkill(skillId);if(!skill)continue;const compiled=compileTaggedSkill(skill);if(!compiled.ok||!compiled.definition.logicOrder.includes('AURA'))continue;
   const p=compiled.definition.parameters;if(p.auraEffect!==kind||p.modifierStat!==stat)continue;
   const targetSide=p.auraTarget==='ally'?source.side:(p.auraTarget==='enemy'?(source.side==='味方'?'敵':'味方'):null);if(target.side!==targetSide)continue;
   if(p.auraTarget==='ally'&&p.auraScope==='allies_excluding_self'&&target.id===source.id)continue;
   if(p.auraTarget==='ally'&&!['all','self_and_allies','allies_excluding_self'].includes(p.auraScope))continue;
   if(p.auraTarget==='enemy'&&p.auraScope!=='all')continue;
   entries.push({kind,stat,power:Math.max(0,Number(p.auraValue)||0),sourceId:source.id,sourceName:source.name,skillId:compiled.definition.id,skillName:compiled.definition.name,priority:Number(p.auraPriority)||0,stack:p.auraStack||'highest'});
  }
 }
 return entries;
}
function effectiveAuraPower(target,kind,stat){const entries=activeAuraEntries(target,kind,stat);return entries.length?Math.max(...entries.map(x=>x.power)):0}
function effectiveModifierPower(target,kind,stat){if(!target?.alive)return 0;const active=ensureModifierStackList(target).filter(x=>x.kind===kind&&x.stat===stat&&x.expiresAt>battle.tick),normal=active.length?Math.max(...active.map(x=>x.power)):0,aura=effectiveAuraPower(target,kind,stat);return Math.max(normal,aura)}
function effectiveAttackValue(unit){const buff=effectiveModifierPower(unit,'BUFF','ATK'),debuff=effectiveModifierPower(unit,'DEBUFF','ATK');return Math.max(0,Math.floor(unit.attack*(1+buff/100)*(1-debuff/100)))}
function effectiveDamageResist(unit){const base=Number(unit?.damageResist??unit?.damage_resist??0),buff=effectiveModifierPower(unit,'BUFF','DEF'),debuff=effectiveModifierPower(unit,'DEBUFF','DEF'),value=(Number.isFinite(base)?base:0)+buff-debuff;return Math.max(0,Math.min(75,value))}
function applyDefenseResistance(unit,damage){const raw=Math.max(0,Math.floor(Number(damage)||0)),resistance=effectiveDamageResist(unit),reduced=Math.max(0,Math.floor(raw*(1-resistance/100)));return{rawDamage:raw,resistance,damage:reduced}}
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
function modifierStatusText(unit){const list=ensureModifierStackList(unit),stats=TAG_COMBAT_MODIFIER_PARAMS,parts=[];const groups={};for(const x of list){const k=modifierGroupKey(x.kind,x.stat);(groups[k]||(groups[k]=[])).push(x)}for(const [k,v] of Object.entries(groups)){const [kind,stat]=k.split(':'),effective=effectiveModifierPower(unit,kind,stat);parts.push(`${k} ${v.length}stack / 実効${effective}%`)}for(const kind of ['BUFF','DEBUFF'])for(const stat of stats){const aura=effectiveAuraPower(unit,kind,stat);if(aura&&!groups[modifierGroupKey(kind,stat)])parts.push(`AURA ${kind}:${stat} 実効${aura}%`)}return parts.length?parts.join('、'):'なし'}
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
  const applied=applyStatusUniqueRefreshLifecycle(list,{statusId,newEffect:createEffect,refreshPatch},lifecyclePolicy);
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

function calculateTaggedAttackDamage(attacker,definition){
 const rate=Number(definition.parameters.damage);
 if(definition.parameters.damageType==='fixed')return Math.max(0,Math.floor(rate));
 return Math.max(0,Math.floor(effectiveAttackValue(attacker)*(rate/100)));
}
function applyTaggedDamage(attacker,target,damage,skill){
 const before=target.hp,defense=applyDefenseResistance(target,damage),shield=consumeShieldDamage(target,defense.damage,{sourceId:attacker.id,skillId:skill.id,damageType:'tag_attack'});target.hp=Math.max(0,target.hp-shield.hpDamage);const applied=before-target.hp;
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});
 attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${skill.name} → ${target.name}に${applied}HPダメージ（防御耐性${defense.resistance}%、耐性前${defense.rawDamage}、シールド吸収${shield.absorbed}、DAMAGE=${skill.parameters.damage}, 残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('attack',{source_id:attacker.id,target_id:target.id,skill_id:skill.id,raw_damage:defense.rawDamage,defense_resistance:defense.resistance,post_resistance_damage:defense.damage,shield_absorbed:shield.absorbed,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){resetCombatantOnDeath(target,{reason:'tag_attack',sourceId:attacker.id});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
 finishIfNeeded();return{ok:true,damage:applied,rawDamage:defense.rawDamage,defenseResistance:defense.resistance,postResistanceDamage:defense.damage,shieldAbsorbed:shield.absorbed,beforeHp:before,afterHp:target.hp};
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
  const applied=applyDotStackLifecycle(list,{identityKey:type.id,gain,newStack:createStack},lifecyclePolicy);
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
 target.hp=0;target.alive=false;target.gauge=0;target.reservedAction=null;target.statusEffects=[];target.dotStacks=[];target.modifierStacks=[];target.shieldEffects=[];removeCoverEffects(target,{reason:'TARGET_DEAD'});for(const protectedTarget of battle.units)for(const effect of [...ensureCoverEffects(protectedTarget)])if(effect.sourceId===target.id)removeCoverEffect(protectedTarget,effect,'SOURCE_DEAD');
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
 const mode=rate!=null&&rate!==''?'rate':'fixed',reviveValue=mode==='rate'?Number(rate):Math.floor(Number(fixed)||0);
 if(mode==='fixed'&&reviveValue<1)return{ok:false,reason:'REVIVE_HPが無効です'};
 if(mode==='rate'&&(!Number.isFinite(reviveValue)||reviveValue<=0||reviveValue>1))return{ok:false,reason:'REVIVE_HP_RATEが無効です'};
 const before=target.hp,maxHp=Math.max(1,Math.floor(Number(target.maxHp)||1));
 const after=mode==='rate'?Math.max(1,Math.floor(maxHp*reviveValue)):Math.min(reviveValue,maxHp);
 target.hp=after;target.alive=true;target.gauge=0;target.reservedAction=null;
 battle.log.push(`[Tick ${battle.tick}] [TAG][REVIVE] ${actor.name}の${compiled.definition.name} → ${target.name}がHP${after}で復活（${mode==='rate'?`割合${reviveValue}`:`固定${reviveValue}`}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('revive',{source_id:actor.id,target_id:target.id,skill_id:compiled.definition.id,hp_before:before,hp_after:after,max_hp:maxHp,mode,revive_value:reviveValue});
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
function applyTaggedCover(source,target,compiled){
 if(!source?.alive||!target?.alive||source.side!==target.side||source.id===target.id)return{ok:false,reason:'COVER対象が無効です'};
 const p=compiled.definition.parameters,lifetime=p.coverLifetime,uses=lifetime==='uses'?Number(p.coverUses):null,duration=lifetime==='duration'?Number(p.coverDuration):null;
 const effect={id:`COVER-${++coverEffectSequence}`,sequence:coverEffectSequence,sourceId:source.id,sourceName:source.name,targetId:target.id,skillId:compiled.definition.id,skillName:compiled.definition.name,priority:Number(p.coverPriority)||0,removable:p.coverRemovable==='true',lifetime,remainingUses:lifetime==='uses'?uses:null,appliedAt:battle.tick,expiresAt:lifetime==='duration'?battle.tick+duration:null};
 ensureCoverEffects(target).push(effect);battle.log.push(`[Tick ${battle.tick}] [TAG][COVER] ${source.name}が${target.name}をかばう（${lifetime}${lifetime==='uses'?` / 残${uses}回`:lifetime==='duration'?` / Tick ${effect.expiresAt}まで`:''}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('cover_added',{cover_id:effect.id,source_id:source.id,target_id:target.id,skill_id:effect.skillId,priority:effect.priority,removable:effect.removable,lifetime,remaining_uses:effect.remainingUses,expires_at:effect.expiresAt});return{ok:true,effect};
}
function processCoverEffects(){for(const target of battle.units){for(const effect of [...ensureCoverEffects(target)]){const source=battle.units.find(x=>x.id===effect.sourceId);if(!target.alive)removeCoverEffect(target,effect,'TARGET_DEAD');else if(!source?.alive)removeCoverEffect(target,effect,'SOURCE_DEAD');else if(effect.lifetime==='duration'&&effect.expiresAt<=battle.tick)removeCoverEffect(target,effect,'EXPIRED')}}}
function clearAllCoverEffects(reason='battle_end'){for(const target of battle.units)for(const effect of [...ensureCoverEffects(target)])removeCoverEffect(target,effect,reason)}
function resolveCoverIntervention(attacker,originalTarget,incomingCompiled,context={}){
 const origin=context.origin||'base',direct=!!incomingCompiled?.definition?.logicOrder?.some(x=>x==='ATTACK'||x==='FOLLOW_UP');if(!direct||!['base','counter','follow_up'].includes(origin))return{target:originalTarget,covered:false,effect:null};
 if(context.areaCoverUsed&&incomingCompiled?.definition?.target?.range==='all')return{target:originalTarget,covered:false,effect:null};
 const candidates=ensureCoverEffects(originalTarget).filter(e=>{const source=battle.units.find(x=>x.id===e.sourceId);return source?.alive&&source.id!==originalTarget.id});if(!candidates.length)return{target:originalTarget,covered:false,effect:null};
 candidates.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);const effect=candidates[0],coverSource=battle.units.find(x=>x.id===effect.sourceId);if(!coverSource)return{target:originalTarget,covered:false,effect:null};
 if(effect.lifetime==='uses'){effect.remainingUses=Math.max(0,Number(effect.remainingUses||0)-1);if(effect.remainingUses<=0)removeCoverEffect(originalTarget,effect,'USES_EXHAUSTED')}
 typeof recordValidationEvent==='function'&&recordValidationEvent('cover_triggered',{cover_id:effect.id,source_id:coverSource.id,original_target_id:originalTarget.id,final_target_id:coverSource.id,incoming_source_id:attacker?.id||null,incoming_skill_id:incomingCompiled.definition.id,origin,derived_generation:Number(context.derivedGeneration)||0,lifetime:effect.lifetime,remaining_uses:effect.remainingUses});
 battle.log.push(`[Tick ${battle.tick}] [TAG][COVER] ${coverSource.name}が${originalTarget.name}をかばう → ${incomingCompiled.definition.name}の対象を差し替え`);return{target:coverSource,covered:true,effect};
}

function normalizedSkillCosts(compiled){return Array.isArray(compiled?.definition?.costs)?compiled.definition.costs.filter(x=>x&&Number(x.amount)>0):[]}
function checkSkillCosts(unit,compiled){
 const costs=normalizedSkillCosts(compiled),failures=[];
 for(const cost of costs){if(cost.type==='mp'){const available=Math.max(0,Number(unit?.mp)||0),required=Math.max(0,Number(cost.amount)||0);if(available<required)failures.push({type:'mp',required,available,shortage:required-available,reason:cost.failureReason||'MP_SHORTAGE'})}else failures.push({type:cost.type||'unknown',required:Number(cost.amount)||0,available:null,shortage:null,reason:'UNSUPPORTED_COST_TYPE'})}
 return{ok:failures.length===0,costs,failures,reason:failures[0]?.reason||null};
}
function consumeSkillCosts(unit,compiled){
 const checked=checkSkillCosts(unit,compiled);if(!checked.ok)return{ok:false,consumed:[],...checked};const consumed=[];
 for(const cost of checked.costs){if(cost.type==='mp'){const before=Math.max(0,Number(unit.mp)||0),amount=Math.max(0,Number(cost.amount)||0);unit.mp=Math.max(0,before-amount);const row={type:'mp',amount,before,after:unit.mp};consumed.push(row);typeof recordValidationEvent==='function'&&recordValidationEvent('cost_consumed',{source_id:unit.id,skill_id:compiled?.definition?.id||null,cost_type:'mp',amount,before,after:unit.mp,consume_timing:cost.consumeTiming||'activation_established'})}}
 return{ok:true,consumed,costs:checked.costs,failures:[]};
}
function ensureCooldownState(unit){if(!unit||typeof unit!=='object')return{};if(!unit.cooldowns||typeof unit.cooldowns!=='object'||Array.isArray(unit.cooldowns))unit.cooldowns={};return unit.cooldowns}
function skillCooldownRemaining(unit,skillId){if(!unit||!skillId)return 0;const state=ensureCooldownState(unit),entry=state[skillId];if(!entry)return 0;const remaining=Math.max(0,Number(entry.expiresAt||0)-Number(battle.tick||0));if(remaining<=0)delete state[skillId];return remaining}
function startSkillCooldown(unit,compiled){const skillId=compiled?.definition?.id||null,duration=Math.max(0,Number(compiled?.definition?.parameters?.cooldown)||0);if(!unit||!skillId||duration<=0)return{started:false,skillId,duration,expiresAt:null};const state=ensureCooldownState(unit),entry={skillId,duration,startedAt:battle.tick,expiresAt:battle.tick+duration};state[skillId]=entry;typeof recordValidationEvent==='function'&&recordValidationEvent('cooldown_started',{source_id:unit.id,skill_id:skillId,duration,started_at:entry.startedAt,expires_at:entry.expiresAt});return{started:true,...entry}}
function processCooldowns(){for(const unit of battle.units){const state=ensureCooldownState(unit);for(const [skillId,entry] of Object.entries({...state})){if(Number(entry?.expiresAt||0)>battle.tick)continue;delete state[skillId];typeof recordValidationEvent==='function'&&recordValidationEvent('cooldown_expired',{source_id:unit.id,skill_id:skillId,duration:Number(entry?.duration)||0,started_at:Number(entry?.startedAt)||0,expired_at:battle.tick})}}}
function actionExecutionEligibility(unit,{actionKind='skill_action',skillId=null,cooldown=null,compiled=null}={}){
 if(!unit?.alive)return{ok:false,reason:'ACTOR_DEAD',actionKind,skillId};
 const status=ensureStatusEffects(unit).find(x=>x?.payload?.action_disabled===true);
 if(unit.actionDisabled===true||status)return{ok:false,reason:'ACTION_DISABLED',actionKind,skillId,statusInstanceId:status?.instanceId||null,statusId:status?.statusId||null,cooldownRemaining:0};
 const remaining=skillId?skillCooldownRemaining(unit,skillId):0;
 if(remaining>0)return{ok:false,reason:'COOLDOWN',actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:remaining,cooldownDuration:Number(cooldown)||Number(ensureCooldownState(unit)[skillId]?.duration)||0};
 const costCheck=compiled?checkSkillCosts(unit,compiled):{ok:true,costs:[],failures:[]};if(!costCheck.ok)return{ok:false,reason:'COST_SHORTAGE',actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:0,costCheck};
 return{ok:true,reason:null,actionKind,skillId,statusInstanceId:null,statusId:null,cooldownRemaining:0,costCheck};
}
function counterActionBlocked(unit){
 if(unit?.counterDisabled===true)return true;
 return !actionExecutionEligibility(unit,{actionKind:'COUNTER'}).ok;
}
function dispatchCounterAfterAttack(attacker,defender,incomingCompiled,attackResult,{origin='base',derivedGeneration=0,wasCovered=false}={}){
 const skip=(reason,extra={})=>{typeof recordValidationEvent==='function'&&recordValidationEvent('counter_skipped',{source_id:defender?.id||null,attacker_id:attacker?.id||null,incoming_skill_id:incomingCompiled?.definition?.id||null,origin,derived_generation:derivedGeneration,was_covered:wasCovered,reason,...extra});return{ok:false,triggered:false,reason}};
 if(origin!=='base'&&!wasCovered)return skip('DERIVED_ORIGIN');
 if(Number(derivedGeneration)>=2)return skip('DERIVED_GENERATION_LIMIT');
 if(!attackResult?.ok)return skip('NO_HIT');if(incomingCompiled?.definition?.target?.range!=='single')return skip('AREA_ATTACK');if(battle.result||battle.pendingResult)return skip('BATTLE_END');if(!defender?.alive)return skip('DEFENDER_DEAD');if(counterActionBlocked(defender))return skip('ACTION_DISABLED');
 const skillId=defender.counterSkillId||null;if(!skillId)return skip('NO_COUNTER_SKILL');const skill=findTagSkill(skillId),compiled=compileTaggedSkill(skill);if(!skill||!compiled.ok||!compiled.definition.logicOrder.includes('COUNTER'))return skip('INVALID_COUNTER_SKILL');if(compiled.definition.parameters.counterTrigger!=='hit'||compiled.definition.parameters.counterTarget!=='attacker')return skip('COUNTER_CONDITION_MISMATCH');
 typeof recordValidationEvent==='function'&&recordValidationEvent('counter_triggered',{source_id:defender.id,attacker_id:attacker.id,incoming_skill_id:incomingCompiled.definition.id,counter_skill_id:skillId,origin,derived_generation:derivedGeneration,was_covered:wasCovered,shield_absorbed:attackResult.shieldAbsorbed||0,hp_damage:attackResult.damage||0});battle.log.push(`[Tick ${battle.tick}] [TAG][COUNTER] ${defender.name}が${attacker.name}へ反撃 — ${skill.name}`);
 const result=executeTaggedSkill(defender,attacker,skill,{origin:'counter',derivedGeneration:Number(derivedGeneration)+1});return{ok:!!result?.ok,triggered:true,skillId,result};
}
function resolveGenericApplyLifecycle(compiled,logic){
 const runtime=compiled?.definition?.genericRuntime;if(!runtime)return{generic:false,ok:true,contract:null,lifecycle:null};
 const contract=runtime.applyContracts?.find(x=>x.logic===logic)||null;
 if(!contract||!contract.lifecycle)return{generic:true,ok:false,reason:'GENERIC_APPLY_CONTRACT_MISSING',contract:null,lifecycle:null};
 return{generic:true,ok:true,contract,lifecycle:contract.lifecycle};
}
function resolveGenericApplyPolicy(compiled,logic){
 const lifecycleRef=resolveGenericApplyLifecycle(compiled,logic);if(!lifecycleRef.ok||!lifecycleRef.generic)return{...lifecycleRef,policy:null};
 const lc=lifecycleRef.lifecycle||{},contract=lifecycleRef.contract||{};
 const allowed={stackRule:new Set(['UNIQUE','STACK','REPLACE','IGNORE']),refreshRule:new Set(['REFRESH','EXTEND','KEEP','REPLACE']),snapshotPolicy:new Set(['SNAPSHOT','DYNAMIC']),effectiveRule:new Set(['HIGHEST','SUM','LATEST','NONE']),consumeRule:new Set(['FIFO','LIFO','NONE']),dispelCategory:new Set(['STATUS','DOT','BUFF','DEBUFF','SHIELD','NONE'])};
 for(const [key,set] of Object.entries(allowed)){const value=String(lc[key]??'');if(!set.has(value))return{...lifecycleRef,ok:false,reason:'GENERIC_APPLY_POLICY_UNKNOWN',policy:null,policyField:key,policyValue:value}}
 if(String(contract.kind||'')!==logic)return{...lifecycleRef,ok:false,reason:'GENERIC_APPLY_POLICY_KIND_MISMATCH',policy:null,policyField:'kind',policyValue:String(contract.kind||'')};
 if(String(lc.dispelCategory||'')!==logic)return{...lifecycleRef,ok:false,reason:'GENERIC_APPLY_POLICY_CATEGORY_MISMATCH',policy:null,policyField:'dispelCategory',policyValue:String(lc.dispelCategory||'')};
 const policy={stackRule:lc.stackRule,refreshRule:lc.refreshRule,snapshotPolicy:lc.snapshotPolicy,effectiveRule:lc.effectiveRule,consumeRule:lc.consumeRule,dispelCategory:lc.dispelCategory,removeOnDeath:lc.removeOnDeath===true,removeOnBattleEnd:lc.removeOnBattleEnd===true,removable:lc.removable===true,maxStacks:Number.isInteger(lc.maxStacks)?lc.maxStacks:null,resistancePolicy:lc.resistancePolicy||null,identityPolicy:lc.identityPolicy||null};
 return{...lifecycleRef,policy};
}
function applyTaggedApplyRuntime(source,target,compiled,logic,{attackSucceeded=true}={}){
 const lifecycleRef=resolveGenericApplyPolicy(compiled,logic);
 if(!lifecycleRef.ok){const policyError=String(lifecycleRef.reason||'').startsWith('GENERIC_APPLY_POLICY_');battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] Generic APPLY ${policyError?'policy':'lifecycle契約'}が不正です`);typeof recordValidationEvent==='function'&&recordValidationEvent(policyError?'generic_apply_policy_rejected':'generic_apply_contract_rejected',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,reason:lifecycleRef.reason,field:lifecycleRef.policyField||null,value:lifecycleRef.policyValue||null});return{handled:true,skipped:true,error:true,reason:lifecycleRef.reason,result:null,lifecycle:lifecycleRef.lifecycle||null,policy:null}}
 if(lifecycleRef.generic&&typeof recordValidationEvent==='function'){recordValidationEvent('generic_apply_contract_resolved',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,effect_id:lifecycleRef.contract?.effectId||null,registry_phase:compiled?.definition?.genericRuntime?.registryPhase||null,lifecycle:lifecycleRef.lifecycle});recordValidationEvent('generic_apply_policy_resolved',{source_id:source?.id||null,target_id:target?.id||null,skill_id:compiled?.definition?.id||null,logic,effect_id:lifecycleRef.contract?.effectId||null,registry_phase:compiled?.definition?.genericRuntime?.registryPhase||null,policy:lifecycleRef.policy})}
 const requiresAttack=compiled.definition.logicOrder.includes('ATTACK');
 if((logic==='STATUS'||logic==='DOT')&&requiresAttack&&!attackSucceeded){battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] ATTACK不成立のため${logic==='STATUS'?'状態異常':'DOT'}付与をスキップ`);return{handled:true,skipped:true,reason:'ATTACK_FAILED',result:null}}
 if(!target?.alive){battle.log.push(`[Tick ${battle.tick}] [TAG][${logic}] 対象戦闘不能のため${logic==='STATUS'?'状態異常':logic==='DOT'?'DOT':'付与効果'}付与をスキップ`);return{handled:true,skipped:true,reason:'TARGET_DEAD',result:null}}
 if(logic==='STATUS')return{handled:true,skipped:false,result:applyTaggedStatus(source,target,compiled,lifecycleRef.generic?lifecycleRef.policy:null),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 if(logic==='DOT')return{handled:true,skipped:false,result:applyTaggedDot(source,target,compiled,lifecycleRef.generic?lifecycleRef.policy:null),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 if(logic==='BUFF'||logic==='DEBUFF')return{handled:true,skipped:false,result:applyTaggedModifier(source,target,compiled,logic),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 if(logic==='SHIELD')return{handled:true,skipped:false,result:applyTaggedShield(source,target,compiled),lifecycle:lifecycleRef.lifecycle,policy:lifecycleRef.policy,contract:lifecycleRef.contract};
 return{handled:false,skipped:false,result:null};
}
function compareTaggedCondition(actual,operator,expected){if(!Number.isFinite(actual)||!Number.isFinite(expected))return false;switch(operator){case '=':return actual===expected;case '!=':return actual!==expected;case '>':return actual>expected;case '>=':return actual>=expected;case '<':return actual<expected;case '<=':return actual<=expected;default:return false}}
function taggedConditionActual(actor,key){if(!actor)return NaN;switch(key){case 'CONDITION_SELF_HP':return Number(actor.hp);case 'CONDITION_SELF_HP_RATE':return Number(actor.maxHp)>0?Number(actor.hp)/Number(actor.maxHp):0;case 'CONDITION_SELF_MP':return Number(actor.mp);case 'CONDITION_SELF_MP_RATE':return Number(actor.maxMp)>0?Number(actor.mp)/Number(actor.maxMp):0;case 'CONDITION_ENEMY_COUNT':return battle.units.filter(x=>x.alive&&x.side!==actor.side).length;case 'CONDITION_ALLY_COUNT':return battle.units.filter(x=>x.alive&&x.side===actor.side).length;case 'CONDITION_BATTLE_TICK':return Number(battle.tick||0);default:return NaN}}
function evaluateTaggedSkillConditions(actor,compiled){const conditions=compiled?.definition?.parameters?.conditions||[];if(!conditions.length)return{ok:true,mode:'all',results:[]};const results=conditions.map(c=>{const actual=taggedConditionActual(actor,c.key),passed=compareTaggedCondition(actual,c.operator,Number(c.value));return{...c,actual,passed}});return{ok:results.every(x=>x.passed),mode:'all',results}}
function executeTaggedSkill(actor,target,skillSource,{manual=false,isFollowUp=false,origin=null,suppressDerived=false,derivedGeneration=0,skipExecutionEligibility=false}={}){
 const compiled=compileTaggedSkill(skillSource);battle.log.push(`[Tick ${battle.tick}] [TAG][COMPILE] ${skillSource?.id||'unknown'} ${compiled.ok?'成功':'失敗'}`);if(!compiled.ok){compiled.errors.forEach(x=>battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${x}`));return{ok:false,stage:'compile',compiled}}
 const actualOrigin=origin||(isFollowUp?'follow_up':compiled.definition.logicOrder.includes('COUNTER')?'counter':'base');
 const conditionResult=evaluateTaggedSkillConditions(actor,compiled);if(!conditionResult.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('skill_condition_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,conditions:conditionResult.results});battle.log.push(`[Tick ${battle.tick}] [TAG][CONDITION] ${actor?.name||'unknown'}の${compiled.definition.name}は発動条件不成立`);return{ok:false,stage:'condition',reason:'CONDITION_FAILED',conditionResult,compiled}}
 if(!skipExecutionEligibility){const eligibility=actionExecutionEligibility(actor,{actionKind:actualOrigin==='counter'?'COUNTER':actualOrigin==='follow_up'?'FOLLOW_UP':'skill_action',skillId:compiled.definition.id,cooldown:compiled.definition.parameters.cooldown,compiled});if(!eligibility.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});battle.log.push(`[Tick ${battle.tick}] [TAG][ACTION_DISABLED] ${actor?.name||'unknown'}の${compiled.definition.name}は実行不能`);return{ok:false,stage:'execution_eligibility',reason:eligibility.reason,eligibility,compiled}}}
 const resolved=resolveTaggedTargets(actor,target,compiled.definition);if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 const costResult=consumeSkillCosts(actor,compiled);if(!costResult.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor?.id||null,skill_id:compiled.definition.id,origin:actualOrigin,reason:'COST_SHORTAGE',cost_failures:costResult.failures});battle.log.push(`[Tick ${battle.tick}] [TAG][COST] ${actor?.name||'unknown'}の${compiled.definition.name}はコスト不足`);return{ok:false,stage:'cost',reason:'COST_SHORTAGE',costResult,compiled}}
 const cooldownStart=startSkillCooldown(actor,compiled);
 const targetResults=[],executionContext={areaCoverUsed:false};
 for(const originalTarget of resolved.targets){
  let actionTarget=originalTarget,coverResult={target:originalTarget,covered:false,effect:null};const directAttack=compiled.definition.logicOrder.some(x=>x==='ATTACK'||x==='FOLLOW_UP');if(directAttack){coverResult=resolveCoverIntervention(actor,originalTarget,compiled,{origin:actualOrigin,derivedGeneration,areaCoverUsed:executionContext.areaCoverUsed});actionTarget=coverResult.target;if(coverResult.covered&&compiled.definition.target.range==='all')executionContext.areaCoverUsed=true}
  let attackResult=null,healResult=null,shieldResult=null,dotResult=null,modifierResult=null,followUpResult=null,statusResult=null,cleanseResult=null,reviveResult=null,coverApplyResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK');
  for(const logic of compiled.definition.logicOrder){if(logic==='COUNTER')continue;if(logic==='COVER'){coverApplyResult=applyTaggedCover(actor,originalTarget,compiled);continue}if(logic==='ATTACK'){attackResult=applyTaggedDamage(actor,actionTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}else if(logic==='HEAL')healResult=applyTaggedHeal(actor,actionTarget,compiled);else if(['SHIELD','STATUS','DOT','BUFF','DEBUFF'].includes(logic)){const applyResult=applyTaggedApplyRuntime(actor,actionTarget,compiled,logic,{attackSucceeded});if(logic==='SHIELD')shieldResult=applyResult.result;else if(logic==='STATUS')statusResult=applyResult.result;else if(logic==='DOT')dotResult=applyResult.result;else modifierResult=applyResult.result}else if(logic==='CLEANSE')cleanseResult=cleanseStatusEffects(actor,actionTarget,compiled);else if(logic==='REVIVE')reviveResult=reviveTarget(actor,actionTarget,compiled);else if(logic==='FOLLOW_UP'){followUpResult=applyTaggedDamage(actor,actionTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!followUpResult?.ok}else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`)}
  const effectiveAttackResult=attackResult||followUpResult;targetResults.push({targetId:actionTarget.id,originalTargetId:originalTarget.id,covered:coverResult.covered,coverId:coverResult.effect?.id||null,attackResult,healResult,shieldResult,dotResult,modifierResult,followUpResult,statusResult,cleanseResult,reviveResult,coverApplyResult});
  if(effectiveAttackResult?.ok&&!suppressDerived){if(actualOrigin==='base'){dispatchCounterAfterAttack(actor,actionTarget,compiled,effectiveAttackResult,{origin:actualOrigin,derivedGeneration,wasCovered:coverResult.covered});if(!battle.result&&!battle.pendingResult)dispatchConditionalFollowUps(actor,actionTarget,{trigger:'ALLY_ATTACK',originSkillId:compiled.definition.id,derivedGeneration})}else if(coverResult.covered){dispatchCounterAfterAttack(actor,actionTarget,compiled,effectiveAttackResult,{origin:actualOrigin,derivedGeneration,wasCovered:true})}else if(actualOrigin==='counter')recordValidationEvent('counter_chain_blocked',{source_id:actor.id,target_id:actionTarget.id,skill_id:compiled.definition.id,reason:'COUNTER_CANNOT_CHAIN',derived_generation:derivedGeneration});else if(actualOrigin==='follow_up')recordValidationEvent('follow_up_chain_blocked',{source_id:actor.id,target_id:actionTarget.id,skill_id:compiled.definition.id,reason:'FOLLOW_UP_CANNOT_CHAIN',derived_generation:derivedGeneration})}
 }
 if(manual)renderBattle();const first=targetResults[0]||{};return{ok:true,compiled,costResult,cooldownStart,targets:targetResults.map(x=>x.targetId),originalTargets:resolved.targets.map(x=>x.id),targetResults,attackResult:first.attackResult,healResult:first.healResult,shieldResult:first.shieldResult,dotResult:first.dotResult,modifierResult:first.modifierResult,followUpResult:first.followUpResult,statusResult:first.statusResult,cleanseResult:first.cleanseResult,reviveResult:first.reviveResult,coverApplyResult:first.coverApplyResult};
}
function dispatchConditionalFollowUps(initiator,target,event){
 if(!initiator?.alive||!target?.alive||event?.trigger!=='ALLY_ATTACK')return[];
 const results=[];
 for(const follower of battle.units.filter(x=>x.alive&&x.side===initiator.side&&x.id!==initiator.id)){
  const ids=Array.isArray(follower.followUpSkillIds)?follower.followUpSkillIds:[];
  for(const skillId of ids){
   const eligibility=actionExecutionEligibility(follower,{actionKind:'FOLLOW_UP'});if(!eligibility.ok){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});continue}
   const skill=findTagSkill(skillId),compiled=compileTaggedSkill(skill);
   if(!compiled.ok||!compiled.definition.logicOrder.includes('FOLLOW_UP'))continue;
   const poisoned=ensureDotStackList(target).length>0;
   if(!poisoned){recordValidationEvent('follow_up_skipped',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,reason:'CONDITION_POISONED_FALSE'});continue}
   recordValidationEvent('follow_up_triggered',{source_id:follower.id,initiator_id:initiator.id,target_id:target.id,skill_id:skillId,trigger:'ALLY_ATTACK',condition:'POISONED'});
   battle.log.push(`[Tick ${battle.tick}] [TAG][FOLLOW_UP] ${follower.name}が${initiator.name}の攻撃に連携 → ${target.name}`);
   const result=executeTaggedSkill(follower,target,skill,{isFollowUp:true,derivedGeneration:Number(event?.derivedGeneration||0)+1});results.push(result);
  }
 }
 return results;
}
