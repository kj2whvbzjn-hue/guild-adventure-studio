/* Battle scene, reservation and tick control extracted without logic changes — GA-B477 */
let sceneSignature='', sceneBusy=false, sceneQueue=[], sceneLastActionCount=0;
const sceneIcon=name=>/スライム/.test(name)?'●':/ウルフ/.test(name)?'◆':/盗賊/.test(name)?'♠':/剣士/.test(name)?'⚔':'◆';
function sceneLayoutMode(){return 'vertical'}
function scenePosition(u,index,sideCount){
 const sideIndex=battle.units.filter(x=>x.side===u.side).indexOf(u);
 const xs=sideCount<=2?[34,66]:sideCount===3?[22,50,78]:[15,38,62,85];
 const baseY=u.side==='敵'?25:75;
 const rowOffset=(sideIndex%2)*8*(u.side==='敵'?1:-1);
 return {x:xs[sideIndex]||50,y:baseY+rowOffset};
}
function reservationView(u){
 if(!u.alive)return{icon:'❌',title:'戦闘不能'};
 const r=u.reservedAction;
 if(!r)return{icon:u.gauge>=GAUGE_MAX?'💦':'⏳',title:u.gauge>=GAUGE_MAX?'AI判断待ち':'行動ゲージ待機'};
 const target=battle.units.find(x=>x.id===r.targetId);
 if(r.status==='cancelled')return{icon:'❌',title:r.failureReason||'予約失敗'};
 if(r.type==='guard')return{icon:'🛡️',title:'防御を予約'};
 if(r.type==='heal')return{icon:'💚',title:`${target?.name||'味方'}への回復を予約`};
 return{icon:r.icon||'⚔️',title:`${target?.name||'対象'}への${r.label||'スキル'}を予約（Tick ${r.executeAt}）`};
}
function ensureSceneUnits(force=false){
 const host=$('sceneUnits');if(!host)return;const signature=battle.units.map(u=>u.id+u.name).join('|')+'|'+sceneLayoutMode();
 if(force||signature!==sceneSignature){sceneSignature=signature;host.innerHTML=battle.units.map(u=>{const pos=scenePosition(u,0,battle.units.filter(x=>x.side===u.side).length);return `<div class="scene-unit idle ${u.side==='敵'?'enemy':'ally'}" id="scene-${u.id}" style="left:${pos.x}%;top:${pos.y}%"><div class="symbol">${sceneIcon(u.name)}</div><div class="reservation-icon" aria-label="予約行動">⏳</div><div class="unit-name">${escapeHtml(u.name)}</div><div class="scene-hp"><i></i></div></div>`}).join('')}
 battle.units.forEach(u=>{const el=$(`scene-${u.id}`);if(!el)return;el.classList.toggle('defeated',!u.alive);const bar=el.querySelector('.scene-hp i');if(bar)bar.style.width=`${Math.max(0,u.hp/u.maxHp*100)}%`;const ri=el.querySelector('.reservation-icon');if(ri){const view=reservationView(u);ri.textContent=view.icon;ri.title=view.title;ri.classList.toggle('active',!!u.reservedAction)}});
 const result=$('sceneResult');if(result){result.textContent=battle.result||'';result.classList.toggle('show',!!battle.result)}
 $('sceneTitle').textContent=battle.result?`戦闘終了 — ${battle.result}`:battle.running?'戦闘進行中':'待機中';
}
function scenePoint(el){const st=$('battleStage').getBoundingClientRect(),r=el.getBoundingClientRect();return{x:r.left-st.left+r.width/2,y:r.top-st.top+r.height/2}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function playSceneEvent(evt){
 if(!$('sceneMotion').checked){ensureSceneUnits();return}
 const a=$(`scene-${evt.attackerId}`),t=$(`scene-${evt.targetId}`);if(!a||!t)return;sceneBusy=true;
 const speed=Math.max(.25,Number($('sceneSpeed').value)||1),dir=evt.attackerSide==='味方'?-1:1,stageHeight=$('battleStage').clientHeight,travel=Math.min(190,Math.max(90,stageHeight*.24))*dir;
 a.classList.remove('idle');$('sceneTitle').textContent=`${evt.attackerName}の攻撃`;
 await a.animate([{transform:'translate(-50%,-50%)'},{transform:`translate(-50%,calc(-50% + ${travel}px))`}],{duration:260*speed,easing:'ease-in-out',fill:'forwards'}).finished.catch(()=>{});
 if(evt.miss){await t.animate([{transform:'translate(-50%,-50%)'},{transform:`translate(-50%,calc(-50% + ${28*dir}px))`},{transform:'translate(-50%,-50%)'}],{duration:230*speed,easing:'ease-out'}).finished.catch(()=>{})}
 else{
  a.animate([{transform:`translate(-50%,calc(-50% + ${travel}px)) rotate(0)`},{transform:`translate(-50%,calc(-50% + ${travel+18*dir}px)) rotate(${18*dir}deg)`},{transform:`translate(-50%,calc(-50% + ${travel}px)) rotate(0)`}],{duration:190*speed,easing:'ease-out'});
  await sleep(65*speed);impactAt(t);damageAt(t,evt.damage,false);await t.animate([{transform:'translate(-50%,-50%)'},{transform:`translate(calc(-50% + ${22}px),-50%)`},{transform:'translate(-50%,-50%)'}],{duration:260*speed,easing:'ease-out'}).finished.catch(()=>{});
 }
 await a.animate([{transform:`translate(-50%,calc(-50% + ${travel}px))`},{transform:'translate(-50%,-50%)'}],{duration:290*speed,easing:'ease-in-out',fill:'forwards'}).finished.catch(()=>{});a.getAnimations().forEach(x=>x.cancel());a.classList.add('idle');ensureSceneUnits();sceneBusy=false;const next=sceneQueue.shift();if(next)playSceneEvent(next)
}
function impactAt(el){const p=scenePoint(el),slash=document.createElement('div');slash.className='flash-slash';slash.style.left=p.x+'px';slash.style.top=p.y+'px';$('battleStage').appendChild(slash);slash.animate([{transform:'translate(-50%,-50%) rotate(-28deg) scale(.25)',opacity:0},{transform:'translate(-50%,-50%) rotate(-28deg) scale(1.35)',opacity:1,offset:.3},{transform:'translate(-50%,-50%) rotate(-28deg) scale(2)',opacity:0}],{duration:420,easing:'ease-out'});setTimeout(()=>slash.remove(),450);const ring=document.createElement('div');ring.className='impact-ring';ring.style.left=p.x+'px';ring.style.top=p.y+'px';$('battleStage').appendChild(ring);ring.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:'translate(-50%,-50%) scale(3)',opacity:0}],{duration:360});setTimeout(()=>ring.remove(),400)}
function damageAt(el,value,miss=false){const p=scenePoint(el),pop=document.createElement('div');pop.className='damage-pop'+(miss?' miss':'');pop.textContent=miss?'MISS':`-${value}`;pop.style.left=p.x+'px';pop.style.top=(p.y-20)+'px';$('battleStage').appendChild(pop);pop.animate([{transform:'translate(-50%,-20%) scale(.7)',opacity:0},{transform:'translate(-50%,-70%) scale(1.15)',opacity:1,offset:.25},{transform:'translate(-50%,-135%) scale(1)',opacity:0}],{duration:760,easing:'ease-out'});setTimeout(()=>pop.remove(),800)}
function queueSceneEvent(evt){if(sceneBusy)sceneQueue.push(evt);else playSceneEvent(evt)}

function resetBattle(){pauseBattle();sceneQueue=[];sceneBusy=false;battle={tick:0,actions:0,units:makeBattleUnits(),log:[],timer:null,running:false,runToken:battle.runToken,lastFrameAt:0,tickAccumulator:0,result:null,pendingResult:null,ending:false,reward:null,rewardApplied:false,validationMode:false,validationEvents:[],validationMeta:null};initializeBattleTieRolls();renderBattle();ensureSceneUnits(true);setupTagSkillTestUI();populateTagSkillTestUI()}
function renderBattle(){
 $('battleTick').textContent=`Tick: ${battle.tick}`;$('battleActions').textContent=`行動回数: ${battle.actions}`;$('battleStatus').textContent=`状態: ${battle.result?'戦闘終了':battle.pendingResult?'最終演出待機':battle.running?'オート進行中':'待機'}`;$('battleResult').textContent=`勝敗: ${battle.result||'未決着'}`;
 $('battleUnits').innerHTML=battle.units.map(u=>{const until=u.alive?(u.reservedAction?Math.max(0,u.reservedAction.executeAt-battle.tick):(u.gauge===0?Math.ceil(GAUGE_MAX/u.agi):Math.ceil(Math.max(0,GAUGE_MAX-u.gauge)/u.agi))):'—';const last=u.lastActionTick==null?'未行動':`Tick ${u.lastActionTick}`;const hpPct=Math.max(0,Math.min(100,u.hp/u.maxHp*100));const rv=reservationView(u);const target=u.reservedAction?battle.units.find(x=>x.id===u.reservedAction.targetId):null;const reservationText=u.reservedAction?`${rv.icon} ${u.reservedAction.label} → ${target?.name||'対象なし'}（Tick ${u.reservedAction.executeAt}実行予定）`:`${rv.icon} ${rv.title}`;return `<div class="battle-unit"><div class="name">${escapeHtml(u.name)}${u.alive?'':'（戦闘不能）'}</div><span class="tag">${u.side}</span><span class="tag">AGI ${u.agi}</span><span class="tag">攻撃 ${effectiveAttackValue(u)}（基礎${u.attack}）</span><span class="tag">行動 ${u.actions}回</span><div class="small">HP ${u.hp} / ${u.maxHp}</div><div class="bar"><i style="width:${hpPct}%;background:var(--good)"></i></div><div class="small">Gauge ${u.gauge} / ${GAUGE_MAX}（毎Tick +${u.alive?u.agi:0}）</div><div class="bar"><i style="width:${Math.min(100,u.gauge)}%"></i></div><div class="small"><b>予約:</b> ${escapeHtml(reservationText)}</div><div class="small"><b>DOT:</b> ${escapeHtml(dotStatusText(u))}</div><div class="small"><b>シールド:</b> ${escapeHtml(shieldStatusText(u))}</div><div class="small"><b>BUFF/DEBUFF:</b> ${escapeHtml(modifierStatusText(u))}</div><div class="small">次の処理まで約 ${until} Tick ／ 最終行動 ${last} ／ 与ダメージ ${u.damageDealt}</div></div>`}).join('');
 $('battleLog').textContent=battle.log.length?battle.log.slice(-100).join('\n'):'まだ行動はありません。';$('battleLog').scrollTop=$('battleLog').scrollHeight;const publicLog=$('battlePublicLogBody');if(publicLog){const rows=battle.log.filter(x=>/ダメージ|戦闘不能|戦闘終了|TAG\]\[ERROR|TAG\]\[DOT/.test(x)).slice(-5).map(x=>x.replace(/^\[Tick \d+\] /,''));publicLog.textContent=rows.length?rows.join('\n'):'まだ行動はありません。'}ensureSceneUnits();populateTagSkillTestUI();
}
function chooseTarget(attacker){const opponents=battle.units.filter(u=>u.alive&&u.side!==attacker.side);if(!opponents.length)return null;if(attacker.aiPolicy==='random')return opponents[Math.floor(Math.random()*opponents.length)];if(attacker.aiPolicy==='weakest')return opponents.sort((a,b)=>a.maxHp-b.maxHp||a.order-b.order)[0];return opponents.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp)||a.order-b.order)[0]}
function reserveAction(actor){
 if(!actor.alive||actor.reservedAction||actor.gauge<GAUGE_MAX||battle.result||battle.pendingResult)return false;
 const target=chooseTarget(actor);if(!target)return false;
 const skill=findTagSkill(actor.defaultSkillId)||TAG_SKILLS[0];actor.reservedAction={id:`R-${battle.tick}-${actor.id}-${battle.actions}`,type:'skill',skillId:skill.id,label:skill.name,icon:'⚔️',targetId:target.id,reason:`Gauge ${actor.gauge} が ${GAUGE_MAX} 以上`,reservedAt:battle.tick,executeAt:battle.tick+RESERVATION_DELAY_TICKS,status:'reserved',revision:0};
 actor.lastReservation={...actor.reservedAction};
 battle.log.push(`[Tick ${battle.tick}] ${actor.name}は「${skill.name}」を予約 → 対象 ${target.name}（実行予定 Tick ${actor.reservedAction.executeAt}）`);
 return true;
}
function cancelReservation(actor,reason,consumeGauge=true){
 const r=actor.reservedAction;if(!r)return;
 r.status='cancelled';r.failureReason=reason;actor.lastReservation={...r};
 battle.log.push(`[Tick ${battle.tick}] ${actor.name}の予約は失敗 — ${reason}`);
 actor.reservedAction=null;if(consumeGauge)actor.gauge=Math.max(0,actor.gauge-50);
}
function evaluateActionExecution(actor){
 if(!actor?.alive)return{ok:false,reason:'行動者が戦闘不能',code:'ACTOR_DEAD'};
 if(actor.gauge<GAUGE_MAX)return{ok:false,reason:`Gauge不足 (${actor.gauge}/${GAUGE_MAX})`,code:'GAUGE_SHORTAGE'};
 const target=chooseTarget(actor);if(!target)return{ok:false,reason:'実行時点で有効対象がありません',code:'NO_VALID_TARGET'};
 const skill=findTagSkill(actor.defaultSkillId)||TAG_SKILLS[0];if(!skill)return{ok:false,reason:'実行可能スキルがありません',code:'NO_VALID_SKILL'};
 const compiled=compileTaggedSkill(skill);if(!compiled.ok)return{ok:false,reason:`スキル定義エラー: ${compiled.errors.join(' / ')}`,code:'INVALID_SKILL',skill,compiled};
 const eligibility=typeof actionExecutionEligibility==='function'?actionExecutionEligibility(actor,{actionKind:'skill_action',skillId:compiled.definition.id,cooldown:compiled.definition.parameters.cooldown,compiled}):{ok:true};
 if(!eligibility.ok){const reason=eligibility.reason==='COOLDOWN'?`クールダウン中（残り${eligibility.cooldownRemaining} Tick）`:eligibility.reason==='COST_SHORTAGE'?`MP不足（必要${eligibility.costCheck?.failures?.[0]?.required??'?'} / 現在${eligibility.costCheck?.failures?.[0]?.available??'?'}）`:'行動不能';return{ok:false,reason,code:eligibility.reason||'ACTION_DISABLED',eligibility,skill,compiled}};
 return{ok:true,target,skill,compiled};
}
function revalidateReservation(actor){
 if(!actor?.reservedAction)return{ok:false,reason:'予約なし',code:'NO_PRESENTATION_RESERVATION'};
 return evaluateActionExecution(actor);
}
function waitForSceneIdle(timeout=5000){return new Promise(resolve=>{const started=performance.now();const check=()=>{if((!sceneBusy&&sceneQueue.length===0)||performance.now()-started>=timeout)return resolve();setTimeout(check,25)};check()})}
async function completeBattleEnding(){
 if(battle.ending||!battle.pendingResult)return;
 battle.ending=true;
 await waitForSceneIdle();
 if(currentPhase!=='battle'||!battle.pendingResult){battle.ending=false;return}
 battle.result=battle.pendingResult;battle.pendingResult=null;
 battle.log.push(`[Tick ${battle.tick}] 戦闘終了 — ${battle.result}`);
 renderBattle();ensureSceneUnits();
 await sleep(800);
 if(currentPhase==='battle'&&battle.result){renderBattleResult();setPhase('result',{keepBattle:true})}
 battle.ending=false;
}
function clearBattleEndDotStacks(){for(const u of battle.units){if(Array.isArray(u.dotStacks)&&u.dotStacks.length){const count=u.dotStacks.length;u.dotStacks=[];typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stacks_cleared',{target_id:u.id,count,reason:'battle_end'})}}}
function clearBattleEndModifierStacks(){for(const u of battle.units){if(Array.isArray(u.modifierStacks)&&u.modifierStacks.length){const count=u.modifierStacks.length;u.modifierStacks=[];typeof recordValidationEvent==='function'&&recordValidationEvent('modifier_stacks_cleared',{target_id:u.id,count,reason:'battle_end'})}}}
function clearBattleEndCooldowns(){for(const u of battle.units){const count=u.cooldowns&&typeof u.cooldowns==='object'&&!Array.isArray(u.cooldowns)?Object.keys(u.cooldowns).length:0;if(count){u.cooldowns={};typeof recordValidationEvent==='function'&&recordValidationEvent('cooldowns_cleared',{target_id:u.id,count,reason:'battle_end'})}}}
function finishIfNeeded(){
 const allyAlive=battle.units.some(u=>u.alive&&u.side==='味方'),enemyAlive=battle.units.some(u=>u.alive&&u.side==='敵');
 if(allyAlive&&enemyAlive)return false;
 if(battle.pendingResult||battle.result)return true;
 battle.pendingResult=allyAlive?'味方勝利':enemyAlive?'敵勝利':'引き分け';
 battle.units.forEach(u=>u.reservedAction=null);processApplyLifecycleCleanup('battle_end');clearAllCoverEffects('battle_end');clearBattleEndCooldowns();
 battle.log.push(`[Tick ${battle.tick}] 決着条件を検出 — 最終演出を待機`);
 battle.running=false;battle.runToken++;
 if(battle.timer)cancelAnimationFrame(battle.timer);battle.timer=null;
 renderBattle();completeBattleEnding();return true;
}
function performBasicAttack(attacker,target){
 if(!target)return false;
 const eligibility=typeof actionExecutionEligibility==='function'?actionExecutionEligibility(attacker,{actionKind:'normal_action'}):{ok:true};if(!eligibility.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:attacker?.id||null,target_id:target?.id||null,action_kind:'normal_action',reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});return false}
 const rawDamage=Math.max(1,attacker.attack),shield=consumeShieldDamage(target,rawDamage,{sourceId:attacker.id,damageType:'basic_attack'}),damage=shield.hpDamage;target.hp=Math.max(0,target.hp-damage);
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage});
 attacker.damageDealt+=damage;target.damageTaken+=damage;
 battle.log.push(`[Tick ${battle.tick}] ${attacker.name}の通常攻撃 → ${target.name}に${damage}HPダメージ（シールド吸収${shield.absorbed}、残HP ${target.hp}/${target.maxHp}）`);
 if(target.hp<=0){target.alive=false;target.gauge=0;target.reservedAction=null;target.shieldEffects=[];battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
 finishIfNeeded();return true;
}
function executeReservation(actor){
 const r=actor.reservedAction;if(!r||r.executeAt>battle.tick)return false;
 r.status='revalidating';
 const checked=revalidateReservation(actor);
 if(!checked.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor.id,presentation_skill_id:r.skillId||null,presentation_target_id:r.targetId||null,reason:checked.code||checked.reason,status_instance_id:checked.eligibility?.statusInstanceId||null,status_id:checked.eligibility?.statusId||null});cancelReservation(actor,checked.reason);return false}
 const target=checked.target,skill=checked.skill;
 r.status='executing';actor.gauge=Math.max(0,actor.gauge-GAUGE_MAX);actor.actions++;actor.lastActionTick=battle.tick;battle.actions++;
 battle.log.push(`[Tick ${battle.tick}] ${actor.name}は実行時判定で「${skill.name}」を確定 → ${target.name}`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_committed',{source_id:actor.id,skill_id:skill.id,target_id:target.id,presentation_skill_id:r.skillId||null,presentation_target_id:r.targetId||null});
 actor.lastReservation={...r,status:'completed',completedAt:battle.tick,executedSkillId:skill.id,executedTargetId:target.id};actor.reservedAction=null;
 return executeTaggedSkill(actor,target,skill,{skipExecutionEligibility:true}).ok;
}
function activationPriorityFeatureEnabled(){return true}
function p0113Hash32(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
function createBattleTieSeed(){
 if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==='function'){const a=new Uint32Array(4);globalThis.crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(8,'0')).join('')}
 return `${Date.now().toString(36)}-${Math.floor((globalThis.performance?.now?.()||0)*1000).toString(36)}-${battle.runToken||0}`
}
function initializeBattleTieRolls(seed=createBattleTieSeed()){return assignBattleTieRolls(seed,battle.units)}

function assignBattleTieRolls(seed,units=battle.units,hashFn=p0113Hash32){
 const used=new Set(),history=[];const ordered=[...units].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 for(const u of ordered){let round=0,roll;do{roll=(hashFn(`${seed}|${u.id}|${round}`,u.id,round)%1000000)+1;round++}while(used.has(roll));used.add(roll);u.battleTieRoll=roll;history.push({actor_id:u.id,tie_roll:roll,reroll_round:round-1})}
 battle.p0113TieSeed=String(seed);battle.p0113TieRollHistory=history;return history
}
function activationPriorityOf(unit){
 if(!activationPriorityFeatureEnabled()||!unit?.alive)return 0;
 const skill=findTagSkill(unit.defaultSkillId)||TAG_SKILLS[0],compiled=skill?compileTaggedSkill(skill):null;
 return compiled?.ok?Number(compiled.definition.parameters.activationPriority)||0:0;
}
function fixDueActionOrder(due){
 const rows=due.map((unit,index)=>({unit,index,priority:activationPriorityOf(unit),tieRoll:Number(unit.battleTieRoll)||0}));
 rows.sort((a,b)=>b.priority-a.priority||b.tieRoll-a.tieRoll);
 if(activationPriorityFeatureEnabled()&&typeof recordValidationEvent==='function')recordValidationEvent('activation_order_fixed',{tick:battle.tick,order:rows.map((x,i)=>({rank:i+1,source_id:x.unit.id,skill_id:x.unit.defaultSkillId||null,priority:x.priority,battle_tie_roll:x.tieRoll||null}))});
 return rows.map(x=>x.unit);
}
function processTicks(count){
 for(let n=0;n<count&&!battle.result&&!battle.pendingResult;n++){
  battle.tick++;
  processApplyLifecycleExpirations();
  processCooldowns();
  processCoverEffects();
  if(battle.result||battle.pendingResult)break;
  if(battle.validationMode)continue;
  battle.units.filter(u=>u.alive).forEach(u=>u.gauge+=u.agi);
  const reservable=battle.units.filter(u=>u.alive&&!u.reservedAction&&u.gauge>=GAUGE_MAX).sort((a,b)=>(b.gauge-GAUGE_MAX)-(a.gauge-GAUGE_MAX)||b.agi-a.agi||a.order-b.order);
  reservable.forEach(reserveAction);
  const dueBase=battle.units.filter(u=>u.alive&&u.reservedAction&&u.reservedAction.executeAt<=battle.tick).sort((a,b)=>a.reservedAction.executeAt-b.reservedAction.executeAt||(b.gauge-GAUGE_MAX)-(a.gauge-GAUGE_MAX)||b.agi-a.agi||a.order-b.order);
  const due=fixDueActionOrder(dueBase);
  for(const u of due){if(battle.result||battle.pendingResult)break;executeReservation(u)}
 }
}
function advanceTicks(count){if(battle.result||battle.pendingResult)return;processTicks(Math.max(0,Number(count)||0));renderBattle()}
function pauseBattle(){
 battle.runToken++;
 if(battle.timer)cancelAnimationFrame(battle.timer);
 battle.timer=null;battle.running=false;battle.lastFrameAt=0;battle.tickAccumulator=0;renderBattle();
}
function startBattle(){
 pauseBattle();
 if(battle.result||battle.pendingResult)return;
 battle.running=true;
 const token=++battle.runToken;
 battle.lastFrameAt=performance.now();
 battle.tickAccumulator=0;
 const frame=(now)=>{
  if(!battle.running||token!==battle.runToken)return;
  const interval=Math.max(1,Number($('battleInterval').value));
  const step=Math.max(1,Number($('battleStep').value));
  const elapsed=Math.min(250,Math.max(0,now-battle.lastFrameAt));
  battle.lastFrameAt=now;
  battle.tickAccumulator+=elapsed*(step/interval);
  const due=Math.floor(battle.tickAccumulator);
  if(due>0){battle.tickAccumulator-=due;processTicks(due)}
  renderBattle();
  battle.timer=requestAnimationFrame(frame);
 };
 renderBattle();
 battle.timer=requestAnimationFrame(frame);
}
$('tick1').onclick=()=>advanceTicks(1);$('tick10').onclick=()=>advanceTicks(10);$('tick100').onclick=()=>advanceTicks(100);$('tick1000').onclick=()=>advanceTicks(1000);$('battleAuto').onclick=startBattle;$('battlePause').onclick=pauseBattle;$('battleReset').onclick=resetBattle;$('battleInterval').onchange=()=>{if(battle.running)startBattle()};$('battleStep').onchange=()=>{};


$('sceneAuto').onclick=startBattle;$('scenePause').onclick=pauseBattle;$('sceneReset').onclick=resetBattle;
$('sceneStep').onclick=()=>{if(battle.result||battle.pendingResult)return;const before=battle.actions;let guard=0;while(battle.actions===before&&!battle.result&&!battle.pendingResult&&guard++<100)processTicks(1);renderBattle()};
$('sceneMotion').onchange=ensureSceneUnits;$('sceneLayout').value=localStorage.getItem('ga_scene_layout')||'jp';$('sceneLayout').onchange=()=>{localStorage.setItem('ga_scene_layout',$('sceneLayout').value);sceneSignature='';ensureSceneUnits(true)};addEventListener('resize',()=>{sceneSignature='';ensureSceneUnits(true)});
