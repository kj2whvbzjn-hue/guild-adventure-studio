/* Validation tag skill compiler/runtime extracted without logic changes — GA-B476 */
const TAG_LOGIC_ORDER=['ATTACK','DOT','HEAL','HOT','BUFF','DEBUFF','SHIELD','SUMMON','DISPEL','REVIVE'];
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
 if(!hasAnyTag(g,['自分','味方','敵','死体','地点']))errors.push('対象タグがありません');
 if(!hasAnyTag(g,['単体','全体','前列','後列','ランダム','貫通']))errors.push('範囲タグがありません');
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
 const targetSide=g.has('敵')?'enemy':g.has('味方')?'ally':g.has('自分')?'self':g.has('死体')?'corpse':g.has('地点')?'point':null;
 const range=g.has('単体')?'single':g.has('全体')?'all':g.has('前列')?'front':g.has('後列')?'back':g.has('ランダム')?'random':g.has('貫通')?'pierce':null;
 const damageType=g.has('物理')?'physical':g.has('魔法')?'magical':g.has('固定')?'fixed':null;
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,parameters:{damageType,damage:n.DAMAGE?.value??null,heal:n.HEAL?.value??null,shield:n.SHIELD?.value??null,shieldDuration:n.DURATION?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null},sourceTags:[...(skill?.tags||[])]},parsed};
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
 const side=definition.target.side,range=definition.target.range;
 let candidates=[];
 if(side==='self')candidates=[actor];
 else if(side==='ally')candidates=battle.units.filter(x=>x.alive&&x.side===actor.side);
 else if(side==='enemy')candidates=battle.units.filter(x=>x.alive&&x.side!==actor.side);
 else return{ok:false,reason:'対象陣営タグがありません',targets:[]};
 if(range==='single'){
  if(!target||!target.alive)return{ok:false,reason:'対象が無効です',targets:[]};
  if(!candidates.some(x=>x.id===target.id))return{ok:false,reason:'対象陣営タグと選択対象が一致しません',targets:[]};
  candidates=[target];
 }else if(range!=='all')return{ok:false,reason:`範囲 ${range} は未対応です`,targets:[]};
 if(!candidates.length)return{ok:false,reason:'有効な対象がありません',targets:[]};
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
function executeTaggedSkill(actor,target,skillSource,{manual=false}={}){
 const compiled=compileTaggedSkill(skillSource);
 battle.log.push(`[Tick ${battle.tick}] [TAG][COMPILE] ${skillSource?.id||'unknown'} ${compiled.ok?'成功':'失敗'}`);
 if(!compiled.ok){compiled.errors.forEach(x=>battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${x}`));return{ok:false,stage:'compile',compiled}}
 const resolved=resolveTaggedTargets(actor,target,compiled.definition);
 if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 const targetResults=[];
 for(const resolvedTarget of resolved.targets){
  let attackResult=null,healResult=null,shieldResult=null,dotResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK');
  for(const logic of compiled.definition.logicOrder){
   if(logic==='ATTACK'){attackResult=applyTaggedDamage(actor,resolvedTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}
   else if(logic==='HEAL'){healResult=applyTaggedHeal(actor,resolvedTarget,compiled)}
   else if(logic==='SHIELD'){shieldResult=applyTaggedShield(actor,resolvedTarget,compiled)}
   else if(logic==='DOT'){if(!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ATTACK不成立のためDOT付与をスキップ`);else if(!resolvedTarget.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] 対象戦闘不能のためDOT付与をスキップ`);else dotResult=applyTaggedDot(actor,resolvedTarget,compiled)}
   else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`);
  }
  targetResults.push({targetId:resolvedTarget.id,attackResult,healResult,shieldResult,dotResult});
 }
 if(manual)renderBattle();
 const first=targetResults[0]||{};
 return{ok:true,compiled,targets:resolved.targets.map(x=>x.id),targetResults,attackResult:first.attackResult,healResult:first.healResult,shieldResult:first.shieldResult,dotResult:first.dotResult};
}
