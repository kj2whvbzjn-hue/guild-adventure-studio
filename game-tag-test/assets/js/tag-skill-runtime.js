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
 if(g.has('DOT')){
  for(const key of ['DOT_POWER','DOT_DURATION','DOT_INTERVAL','STACK_GAIN'])if(!n[key])errors.push(`DOTには${key}が必要です`);
  for(const key of ['DOT_POWER','DOT_DURATION','DOT_INTERVAL','STACK_GAIN']){const v=n[key]?.value;if(v!=null&&(!Number.isFinite(v)||v<=0))errors.push(`${key}は0より大きい有限数が必要です`)}
 }
 const targetSide=g.has('敵')?'enemy':g.has('味方')?'ally':g.has('自分')?'self':g.has('死体')?'corpse':g.has('地点')?'point':null;
 const range=g.has('単体')?'single':g.has('全体')?'all':g.has('前列')?'front':g.has('後列')?'back':g.has('ランダム')?'random':g.has('貫通')?'pierce':null;
 const damageType=g.has('物理')?'physical':g.has('魔法')?'magical':g.has('固定')?'fixed':null;
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,parameters:{damageType,damage:n.DAMAGE?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null},sourceTags:[...(skill?.tags||[])]},parsed};
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
function resolveTaggedTarget(actor,target,definition){
 if(!actor||!actor.alive)return{ok:false,reason:'使用者が無効です'};
 if(!target||!target.alive)return{ok:false,reason:'対象が無効です'};
 if(definition.target.side==='enemy'&&target.side===actor.side)return{ok:false,reason:'敵対象タグに対して味方を選択しています'};
 if(definition.target.side==='ally'&&target.side!==actor.side)return{ok:false,reason:'味方対象タグに対して敵を選択しています'};
 if(definition.target.side==='self'&&target.id!==actor.id)return{ok:false,reason:'自分対象ですが使用者以外が選択されています'};
 if(definition.target.range!=='single')return{ok:false,reason:`Sprint 1では範囲 ${definition.target.range} は未対応です`};
 return{ok:true,target};
}
function calculateTaggedAttackDamage(attacker,definition){
 const rate=Number(definition.parameters.damage);
 if(definition.parameters.damageType==='fixed')return Math.max(0,Math.floor(rate));
 return Math.max(0,Math.floor(Math.max(0,attacker.attack)*(rate/100)));
}
function applyTaggedDamage(attacker,target,damage,skill){
 const before=target.hp;target.hp=Math.max(0,target.hp-damage);const applied=before-target.hp;
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});
 attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${skill.name} → ${target.name}に${applied}ダメージ（DAMAGE=${skill.parameters.damage}, 残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('attack',{source_id:attacker.id,target_id:target.id,skill_id:skill.id,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){target.alive=false;target.gauge=0;target.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
 finishIfNeeded();return{ok:true,damage:applied,beforeHp:before,afterHp:target.hp};
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
 if(!target.alive)return false;const source=battle.units.find(x=>x.id===stack.sourceId),before=target.hp;target.hp=Math.max(0,target.hp-stack.power);const applied=before-target.hp;
 if(source){source.damageDealt+=applied;queueSceneEvent({attackerId:source.id,targetId:target.id,attackerName:source.name,attackerSide:source.side,miss:false,damage:applied})}target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${stack.label}#${stack.id} → ${target.name}に${applied}ダメージ（残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_damage',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,damage:applied,hp_before:before,hp_after:target.hp,next_tick:stack.nextTick+stack.interval,expires_at:stack.expiresAt});
 if(target.hp<=0){const clearedStacks=Array.isArray(target.dotStacks)?target.dotStacks.length:0;target.alive=false;target.gauge=0;target.reservedAction=null;target.dotStacks=[];battle.log.push(`[Tick ${battle.tick}] ${target.name}は${stack.label}により戦闘不能`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_defeat',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,label:stack.label,hp_before:before,hp_after:target.hp,cleared_dot_stacks:clearedStacks})}finishIfNeeded();return true;
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
 const resolved=resolveTaggedTarget(actor,target,compiled.definition);
 if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 let attackResult=null,dotResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK');
 for(const logic of compiled.definition.logicOrder){
  if(logic==='ATTACK'){attackResult=applyTaggedDamage(actor,resolved.target,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}
  else if(logic==='DOT'){if(!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ATTACK不成立のためDOT付与をスキップ`);else if(!resolved.target.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] 対象戦闘不能のためDOT付与をスキップ`);else dotResult=applyTaggedDot(actor,resolved.target,compiled)}
  else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`);
 }
 if(manual)renderBattle();return{ok:true,compiled,attackResult,dotResult};
}
