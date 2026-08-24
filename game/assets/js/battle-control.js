/* Battle scene, reservation and tick control extracted without logic changes — GA-B477 */
let sceneSignature='', sceneBusy=false, sceneQueue=[], sceneLastActionCount=0;
let formalAdventureSimulationDepth=0;
function battleAgGainPerTick(agi){return Math.max(0,(100+Math.max(0,Number(agi)||0))/10)}
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
 if(u.castingAction){const c=u.castingAction,remain=Math.max(0,Number(c.completeAt||battle.tick)-battle.tick);return{icon:'✨',title:`${c.label||'スキル'}を詠唱中（残り${remain} Tick）`};}
 const r=u.reservedAction,max=battleGaugeMax();
 if(!r)return{icon:u.gauge>=max?'💦':'⏳',title:u.gauge>=max?'AI判断待ち':'行動ゲージ待機'};
 const target=battle.units.find(x=>x.id===r.targetId);
 if(r.status==='cancelled')return{icon:'❌',title:r.failureReason||'候補失敗'};
 if(r.type==='guard')return{icon:'🛡️',title:'防御候補'};
 if(r.type==='wait')return{icon:'💤',title:'待機候補'};
 if(r.type==='heal')return{icon:'💚',title:`${target?.name||'味方'}への回復候補`};
 return{icon:r.icon||'⚔️',title:`${target?.name||'対象'}への${r.label||'スキル'}（現在のAI候補）`};
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
function queueSceneEvent(evt){if(formalAdventureSimulationDepth>0)return;if(sceneBusy)sceneQueue.push(evt);else playSceneEvent(evt)}

function resetBattle(context=null){pauseBattle();setBattleLaunchContext(context||standaloneBattleContext());sceneQueue=[];sceneBusy=false;battle={tick:0,actions:0,units:makeBattleUnits(),log:[],timer:null,running:false,runToken:battle.runToken,lastFrameAt:0,tickAccumulator:0,result:null,pendingResult:null,ending:false,reward:null,rewardApplied:false,validationMode:false,validationCaptureEvents:true,validationEvents:[],validationMeta:null};initializeBattleTieRolls();renderBattle();recordValidationEvent('battle_started',{seed:battleLaunchContext?.seed??battle.p0113TieSeed??null,source:battleLaunchContext?.source||'standalone_fixture'});ensureSceneUnits(true);setupTagSkillTestUI();populateTagSkillTestUI()}
function updateSceneControls(){
 const auto=$('sceneAuto'),pause=$('scenePause'),step=$('sceneStep');
 if(auto){auto.textContent=battle.result?'結果を見る':battle.running?'進行中':(battle.actions>0||battle.tick>0?'再開':'戦闘開始');auto.disabled=!!battle.running||!!battle.pendingResult}
 if(pause)pause.disabled=!battle.running;
 if(step)step.disabled=!!battle.running||!!battle.result||!!battle.pendingResult;
}
function renderBattle(){
 const max=battleGaugeMax();GAUGE_MAX=max;
 $('battleTick').textContent=`Tick: ${battle.tick}`;$('battleActions').textContent=`行動回数: ${battle.actions}`;$('battleStatus').textContent=`状態: ${battle.result?'戦闘終了':battle.pendingResult?'最終演出待機':battle.running?'オート進行中':'待機'}`;$('battleResult').textContent=`勝敗: ${battle.result||'未決着'}`;
 $('battleUnits').innerHTML=battle.units.map(u=>{const until=u.alive?(u.castingAction?Math.max(0,Number(u.castingAction.completeAt||battle.tick)-battle.tick):Math.ceil(Math.max(0,max-u.gauge)/Math.max(0.01,battleAgGainPerTick(u.agi)))):'—';const last=u.lastActionTick==null?'未行動':`Tick ${u.lastActionTick}`;const hpPct=Math.max(0,Math.min(100,u.hp/u.maxHp*100));const gaugePct=Math.max(0,Math.min(100,(Number(u.gauge)||0)/max*100));const rv=reservationView(u);const target=u.reservedAction?battle.units.find(x=>x.id===u.reservedAction.targetId):null;const reservationText=u.castingAction?`${rv.icon} ${rv.title}`:u.reservedAction?(u.reservedAction.type==='wait'?`${rv.icon} ${u.reservedAction.label}（現在候補）`:`${rv.icon} ${u.reservedAction.label} → ${target?.name||'対象なし'}（現在候補）`):`${rv.icon} ${rv.title}`;return `<div class="battle-unit"><div class="name">${escapeHtml(u.name)}${u.alive?'':'（戦闘不能）'}</div><span class="tag">${u.side}</span><span class="tag">AGI ${u.agi}</span><span class="tag">攻撃 ${effectiveAttackValue(u)}（基礎${u.attack}）</span><span class="tag">行動 ${u.actions}回</span><div class="small">HP ${u.hp} / ${u.maxHp}</div><div class="bar"><i style="width:${hpPct}%;background:var(--good)"></i></div><div class="small">Gauge ${Number(u.gauge).toFixed(1).replace(/\.0$/,'')} / ${max}（毎Tick +${u.alive&&!u.castingAction?battleAgGainPerTick(u.agi).toFixed(1).replace(/\.0$/,''):0}）</div><div class="bar"><i style="width:${gaugePct}%"></i></div><div class="small"><b>AI候補/詠唱:</b> ${escapeHtml(reservationText)}</div><div class="small"><b>DOT:</b> ${escapeHtml(dotStatusText(u))}</div><div class="small"><b>シールド:</b> ${escapeHtml(shieldStatusText(u))}</div><div class="small"><b>BUFF/DEBUFF:</b> ${escapeHtml(modifierStatusText(u))}</div><div class="small">次の処理まで約 ${until} Tick ／ 最終行動 ${last} ／ 与ダメージ ${u.damageDealt}</div></div>`}).join('');
 $('battleLog').textContent=battle.log.length?battle.log.slice(-100).join('\n'):'まだ行動はありません。';$('battleLog').scrollTop=$('battleLog').scrollHeight;const publicLog=$('battlePublicLogBody');if(publicLog){const rows=battle.log.filter(x=>/ダメージ|戦闘不能|戦闘終了|TAG\]\[ERROR|TAG\]\[DOT/.test(x)).slice(-5).map(x=>x.replace(/^\[Tick \d+\] /,''));publicLog.textContent=rows.length?rows.join('\n'):'まだ行動はありません。'}ensureSceneUnits();updateSceneControls();populateTagSkillTestUI();
}
function chooseTarget(attacker){const opponents=battle.units.filter(u=>u.alive&&u.side!==attacker.side);if(!opponents.length)return null;if(attacker.aiPolicy==='random')return opponents[Math.floor(Math.random()*opponents.length)];if(attacker.aiPolicy==='weakest')return opponents.sort((a,b)=>a.maxHp-b.maxHp||a.order-b.order)[0];return opponents.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp)||a.order-b.order)[0]}
function formalBattleSkill(skillId){
 const id=String(skillId||'');
 const e2e=(typeof findDeveloperE2ESkill==='function')?findDeveloperE2ESkill(id):null;
 if(e2e?.runtimeContracts&&e2e?.e2e_test_only===true&&String(e2e?.environment||'production').toLowerCase()==='production')return e2e;
 const preferred=findSkill(id);
 if(preferred?.runtimeContracts&&String(preferred?.environment||'production').toLowerCase()==='production')return preferred;
 if(window.GKGameSkillLoadout?.FORMAL_SKILL_ID?.test(id))return null;
 return SKILLS.find(x=>x?.runtimeContracts&&String(x?.environment||'production').toLowerCase()==='production')||null;
}
function formalBattleSkillExact(skillId){
 const id=String(skillId||'');if(!id)return null;
 const e2e=(typeof findDeveloperE2ESkill==='function')?findDeveloperE2ESkill(id):null;
 if(e2e?.id===id&&e2e?.runtimeContracts&&String(e2e?.environment||'production').toLowerCase()==='production')return e2e;
 const skill=findSkill(id);return skill?.id===id&&skill?.runtimeContracts&&String(skill?.environment||'production').toLowerCase()==='production'?skill:null;
}
function formalAiRuntimeForActor(actor){
 if(!actor?.characterId||!window.GKGameAISaveBridge||!window.GKGameAIBattleBridge)return null;
 return GKGameAISaveBridge.runtimeForCharacter(data,actor.characterId);
}
function resetAiEvaluationCursor(actor){
 const max=battleGaugeMax(),step=battleAiReevaluationStep(),g=Math.max(0,Math.min(max,Number(actor?.gauge)||0));
 if(!actor)return;
 if(g>=max){actor.nextAiEvaluationGauge=max;actor.lastAiEvaluationGauge=null;return;}
 const completed=Math.floor((g+1e-9)/step);actor.nextAiEvaluationGauge=Math.min(max,(completed+1)*step);actor.lastAiEvaluationGauge=null;
}
function markAiEvaluation(actor,threshold){actor.lastAiEvaluationGauge=Math.min(battleGaugeMax(),Number(threshold)||0);actor.nextAiEvaluationGauge=Math.min(battleGaugeMax(),actor.lastAiEvaluationGauge+battleAiReevaluationStep());}
function reserveFormalAiAction(actor,runtime,{threshold=actor.gauge,phase='rethink'}={}){
 let decision;
 try{const evalSeed=`${battle.p0113TieSeed||battleLaunchContext?.seed||0}|ag:${Number(threshold)}|actor:${actor.id}`;decision=GKGameAIBattleBridge.decide(runtime,{battle_id:String(battleLaunchContext?.source||'battle'),tick:battle.tick,phase,seed:evalSeed,actor_id:actor.id,units:battle.units});}
 catch(error){actor.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}のFormal AI判断に失敗 — ${String(error?.message||error)}`);return false;}
 actor.lastAiDecision=decision;
 const proposal=decision?.proposal||{},base={id:`C-${battle.tick}-${actor.id}-${Number(threshold)}`,formalAi:true,aiProgramId:String(runtime.program_id||''),reason:'Formal AI再評価',reservedAt:battle.tick,evaluatedGauge:Number(threshold),executeAt:battle.tick,status:'candidate',revision:0};
 if(proposal.status==='wait'){
  actor.reservedAction={...base,type:'wait',actionId:'wait',targetId:null,label:'待機',icon:'💤'};actor.lastReservation={...actor.reservedAction};
  battle.log.push(`[Tick ${battle.tick}] ${actor.name}はFormal AI再評価で「待機」を候補化（Gauge ${Number(threshold)}）`);
  typeof recordValidationEvent==='function'&&recordValidationEvent('formal_ai_reserved',{source_id:actor.id,program_id:runtime.program_id,action_id:'wait',target_id:null,evaluated_gauge:Number(threshold),candidate_only:true});return true;
 }
 if(proposal.status!=='selected'||!proposal.action_id){actor.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}のFormal AI再評価は候補なし — ${proposal.reason||'action_not_selected'}`);return false;}
 const target=battle.units.find(unit=>unit.alive&&unit.id===String(proposal.target_id||''));
 if(!target){actor.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}のFormal AI対象が見つかりません`);return false;}
 const actionId=String(proposal.action_id),targetedBase={...base,actionId,targetId:target.id};
 if(actionId==='attack')actor.reservedAction={...targetedBase,type:'attack',label:'通常攻撃',icon:'⚔️'};
 else if(actionId.startsWith('skill:')){
  const skillId=actionId.slice(6),access=window.GKGameSkillLoadout?.skillUseCheck?GKGameSkillLoadout.skillUseCheck({skills:actor.ownedSkillIds||[],equippedSkillId:actor.equippedSkillId||''},skillId,{requireEquipped:true}):{ok:false,reason:'LOADOUT_RUNTIME_UNAVAILABLE'};
  if(!access.ok){actor.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}のFormal AI指定Skillは現在使用できません — ${skillId} (${access.reason})`);typeof recordValidationEvent==='function'&&recordValidationEvent('formal_ai_skill_blocked',{source_id:actor.id,program_id:runtime.program_id,skill_id:skillId,reason:access.reason,equipped_skill_id:actor.equippedSkillId||null,owned_skill_ids:[...(actor.ownedSkillIds||[])]});return false;}
  const skill=formalBattleSkillExact(skillId);if(!skill){actor.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}のFormal AI指定Skillが見つかりません — ${skillId}`);return false;}
  actor.reservedAction={...targetedBase,type:'skill',skillId:skill.id,label:skill.name,icon:'⚔️'};
 }else{actor.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}のFormal AI行動が未対応です — ${actionId}`);return false;}
 actor.lastReservation={...actor.reservedAction};
 battle.log.push(`[Tick ${battle.tick}] ${actor.name}はFormal AI再評価で「${actor.reservedAction.label}」を候補化 → ${target.name}（Gauge ${Number(threshold)}）`);
 typeof recordValidationEvent==='function'&&recordValidationEvent('formal_ai_reserved',{source_id:actor.id,program_id:runtime.program_id,action_id:actionId,target_id:target.id,evaluated_gauge:Number(threshold),candidate_only:true});
 return true;
}
function reserveAction(actor,{threshold=actor?.gauge,phase=null}={}){
 const max=battleGaugeMax();GAUGE_MAX=max;if(!actor?.alive||actor.castingAction||battle.result||battle.pendingResult)return false;
 const evaluationPhase=phase||((actor.lastAiEvaluationGauge==null||Number(threshold)<=battleAiReevaluationStep())?'reservation':'rethink');
 actor.reservedAction=null;
 if(formalAdventureSimulationDepth>0&&!actor.characterId){
  const target=chooseTarget(actor);if(!target)return false;
  actor.reservedAction={id:`C-${battle.tick}-${actor.id}-${Number(threshold)}`,type:'attack',actionId:'attack',targetId:target.id,label:'通常攻撃',icon:'⚔️',headlessAdventureBasic:true,reason:'Adventure enemy basic attack',reservedAt:battle.tick,evaluatedGauge:Number(threshold),executeAt:battle.tick,status:'candidate',revision:0};actor.lastReservation={...actor.reservedAction};return true;
 }
 if(actor.characterId){
  const formalRuntime=formalAiRuntimeForActor(actor);
  if(!formalRuntime){if(actor.formalAiUnavailableLogged!==true){battle.log.push(`[Tick ${battle.tick}] ${actor.name}はFormal AI未設定のため候補を作成しません`);actor.formalAiUnavailableLogged=true;}return false;}
  actor.formalAiUnavailableLogged=false;return reserveFormalAiAction(actor,formalRuntime,{threshold,phase:evaluationPhase});
 }
 const target=chooseTarget(actor);if(!target)return false;
 const skill=formalBattleSkill(actor.defaultSkillId);if(!skill){battle.log.push(`[Tick ${battle.tick}] [FORMAL-RUNTIME][BLOCK] 正式Production Skillがありません`);return false;}
 actor.reservedAction={id:`C-${battle.tick}-${actor.id}-${Number(threshold)}`,type:'skill',skillId:skill.id,label:skill.name,icon:'⚔️',targetId:target.id,reason:`AI再評価 Gauge ${Number(threshold)} / ${max}`,reservedAt:battle.tick,evaluatedGauge:Number(threshold),executeAt:battle.tick,status:'candidate',revision:0};
 actor.lastReservation={...actor.reservedAction};battle.log.push(`[Tick ${battle.tick}] ${actor.name}は「${skill.name}」を候補化 → ${target.name}（Gauge ${Number(threshold)}）`);return true;
}
function cancelReservation(actor,reason,consumeGauge=true){
 const r=actor?.reservedAction;if(!r)return;
 r.status='cancelled';r.failureReason=reason;actor.lastReservation={...r};battle.log.push(`[Tick ${battle.tick}] ${actor.name}の行動候補は実行不成立 — ${reason}`);actor.reservedAction=null;
 if(consumeGauge)actor.gauge=Math.max(0,Number(actor.gauge||0)-battleGaugeConsumeAmount('failed'));resetAiEvaluationCursor(actor);
}
function precheckSkillExecution(actor,r,skill,target){
 const compiled=compileSkillForRuntime(skill);if(!compiled.ok)return{ok:false,reason:`スキル定義エラー: ${compiled.errors.join(' / ')}`,code:'INVALID_SKILL',skill,compiled};
 const conditionResult=evaluateTaggedSkillConditions(actor,compiled,target);if(!conditionResult.ok)return{ok:false,reason:'発動条件不成立',code:'CONDITION_FAILED',skill,compiled,conditionResult};
 const eligibility=typeof actionExecutionEligibility==='function'?actionExecutionEligibility(actor,{actionKind:'skill_action',skillId:compiled.definition.id,cooldown:compiled.definition.parameters.cooldown,compiled}):{ok:true,costCheck:{ok:true,costs:[],failures:[]}};
 if(!eligibility.ok){const reason=eligibility.reason==='COOLDOWN'?`クールダウン中（残り${eligibility.cooldownRemaining} Tick）`:eligibility.reason==='COST_SHORTAGE'?`MP不足（必要${eligibility.costCheck?.failures?.[0]?.required??'?'} / 現在${eligibility.costCheck?.failures?.[0]?.available??'?'}）`:'行動不能';return{ok:false,reason,code:eligibility.reason||'ACTION_DISABLED',eligibility,skill,compiled,conditionResult};}
 const resolved=resolveTaggedTargets(actor,target,compiled.definition);if(!resolved.ok)return{ok:false,reason:resolved.reason,code:'NO_VALID_TARGET',skill,compiled,conditionResult,eligibility};
 const executionSnapshot={checkedAt:battle.tick,skillId:compiled.definition.id,targetIds:resolved.targets.map(x=>x.id),targetStates:resolved.targets.map(x=>({id:x.id,alive:x.alive!==false,hp:Number(x.hp)||0})),presentationTargetId:r?.targetId||target?.id||null,costs:(eligibility.costCheck?.costs||[]).map(x=>({...x})),conditionResult:JSON.parse(JSON.stringify(conditionResult))};
 return{ok:true,target,skill,compiled,actionKind:'skill',executionSnapshot};
}
function evaluateCandidateExecution(actor){
 const r=actor?.reservedAction,max=battleGaugeMax();if(!r)return{ok:false,reason:'AI候補なし',code:'NO_CANDIDATE'};if(!actor.alive)return{ok:false,reason:'行動者が戦闘不能',code:'ACTOR_DEAD'};if(actor.gauge+1e-9<max)return{ok:false,reason:`Gauge不足 (${actor.gauge}/${max})`,code:'GAUGE_SHORTAGE'};
 if(r.type==='wait')return{ok:true,target:null,actionKind:'wait'};
 const target=battle.units.find(unit=>unit.id===String(r.targetId||''));if(!target)return{ok:false,reason:'候補対象が行動順到達時点で存在しません',code:'NO_VALID_TARGET'};
 if(r.type==='attack'){if(!target.alive)return{ok:false,reason:'通常攻撃の対象が行動順到達時点で無効です',code:'NO_VALID_TARGET'};if(target.side===actor.side)return{ok:false,reason:'通常攻撃の対象が敵ではありません',code:'INVALID_ATTACK_TARGET'};const eligibility=typeof actionExecutionEligibility==='function'?actionExecutionEligibility(actor,{actionKind:'normal_action'}):{ok:true};if(!eligibility.ok)return{ok:false,reason:'行動不能',code:eligibility.reason||'ACTION_DISABLED',eligibility};return{ok:true,target,actionKind:'attack'};}
 if(r.type==='skill'){const skill=formalBattleSkillExact(r.skillId)||formalBattleSkill(r.skillId);if(!skill)return{ok:false,reason:'候補の正式Production Skillがありません',code:'NO_FORMAL_PRODUCTION_SKILL'};return precheckSkillExecution(actor,r,skill,target);}
 return{ok:false,reason:'候補行動種別が不正です',code:'INVALID_ACTION'};
}
function evaluateActionExecution(actor){return evaluateCandidateExecution(actor)}
function evaluateFormalReservationExecution(actor){return evaluateCandidateExecution(actor)}
function revalidateReservation(actor){return evaluateCandidateExecution(actor)}
function waitForSceneIdle(timeout=5000){return new Promise(resolve=>{const started=performance.now();const check=()=>{if((!sceneBusy&&sceneQueue.length===0)||performance.now()-started>=timeout)return resolve();setTimeout(check,25)};check()})}
async function completeBattleEnding(){
 if(battle.ending||!battle.pendingResult)return;
 battle.ending=true;
 await waitForSceneIdle();
 if(currentPhase!=='battle'||!battle.pendingResult){battle.ending=false;return}
 battle.result=battle.pendingResult;battle.pendingResult=null;
 recordValidationEvent('battle_finished',{result:battle.result});
 battle.log.push(`[Tick ${battle.tick}] 戦闘終了 — ${battle.result}`);
 renderBattle();ensureSceneUnits();renderBattleResult();
 battle.ending=false;
}
function clearBattleEndDotStacks(){for(const u of battle.units){if(Array.isArray(u.dotStacks)&&u.dotStacks.length){const count=u.dotStacks.length;u.dotStacks=[];typeof recordValidationEvent==='function'&&recordValidationEvent('dot_stacks_cleared',{target_id:u.id,count,reason:'battle_end'})}}}
function clearBattleEndModifierStacks(){for(const u of battle.units){if(Array.isArray(u.modifierStacks)&&u.modifierStacks.length){const count=u.modifierStacks.length;u.modifierStacks=[];typeof recordValidationEvent==='function'&&recordValidationEvent('modifier_stacks_cleared',{target_id:u.id,count,reason:'battle_end'})}}}
function clearBattleEndCooldowns(){for(const u of battle.units){const count=u.cooldowns&&typeof u.cooldowns==='object'&&!Array.isArray(u.cooldowns)?Object.keys(u.cooldowns).length:0;if(count){u.cooldowns={};typeof recordValidationEvent==='function'&&recordValidationEvent('cooldowns_cleared',{target_id:u.id,count,reason:'battle_end'})}}}
function finishIfNeeded(){
 const allyAlive=battle.units.some(u=>u.alive&&u.side==='味方'),enemyAlive=battle.units.some(u=>u.alive&&u.side==='敵');
 if(allyAlive&&enemyAlive)return false;
 if(battle.pendingResult||battle.result)return true;
 const resolved=allyAlive?'味方勝利':enemyAlive?'敵勝利':'引き分け';
 battle.units.forEach(u=>{u.reservedAction=null;u.castingAction=null});processApplyLifecycleCleanup('battle_end');clearAllCoverEffects('battle_end');clearBattleEndCooldowns();
 if(formalAdventureSimulationDepth>0){
  battle.result=resolved;battle.pendingResult=null;battle.running=false;
  battle.log.push(`[Tick ${battle.tick}] 戦闘終了 — ${battle.result}`);recordValidationEvent('battle_finished',{result:battle.result});return true;
 }
 battle.pendingResult=resolved;
 battle.log.push(`[Tick ${battle.tick}] 決着条件を検出 — 最終演出を待機`);
 battle.running=false;battle.runToken++;
 if(battle.timer)cancelAnimationFrame(battle.timer);battle.timer=null;
 renderBattle();completeBattleEnding();return true;
}
function basicAttackStrikeProfiles(attacker){
 const rows=Array.isArray(attacker?.basicAttackProfiles)&&attacker.basicAttackProfiles.length?attacker.basicAttackProfiles:null;
 if(!rows)return[{weaponStyle:String(attacker?.weaponStyle||'single'),weaponSlot:null,weaponId:null,attack:Number(attacker?.attack)||0,accuracy:Number(attacker?.accuracy)||0,baseCriticalRate:Number(attacker?.baseCriticalRate)||0}];
 return rows.map((row,index)=>({weaponStyle:String(row?.weaponStyle||attacker?.weaponStyle||'single'),weaponSlot:row?.weaponSlot||null,weaponId:row?.weaponId||null,attack:Number.isFinite(Number(row?.attack))?Number(row.attack):Number(attacker?.attack)||0,accuracy:Number.isFinite(Number(row?.accuracy))?Number(row.accuracy):Number(attacker?.accuracy)||0,baseCriticalRate:Number.isFinite(Number(row?.baseCriticalRate))?Number(row.baseCriticalRate):Number(attacker?.baseCriticalRate)||0,strikeIndex:index}));
}
function performBasicAttack(attacker,target,{prechecked=false}={}){
 if(!target)return false;
 if(!prechecked){const eligibility=typeof actionExecutionEligibility==='function'?actionExecutionEligibility(attacker,{actionKind:'normal_action'}):{ok:true};if(!eligibility.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:attacker?.id||null,target_id:target?.id||null,action_kind:'normal_action',reason:eligibility.reason,status_instance_id:eligibility.statusInstanceId,status_id:eligibility.statusId});return false}}
 if(!target.alive)return false;
 const profiles=basicAttackStrikeProfiles(attacker),dual=String(attacker?.weaponStyle||profiles[0]?.weaponStyle||'single')==='dual_wield',strikes=dual?profiles.slice(0,2):profiles.slice(0,1);let processed=false;
 for(let strikeIndex=0;strikeIndex<strikes.length;strikeIndex++){
  if(!target.alive||battle.result||battle.pendingResult)break;
  const profile=strikes[strikeIndex],sourceView={...attacker,attack:profile.attack,accuracy:profile.accuracy,baseCriticalRate:profile.baseCriticalRate},hitRate=currentBattleHitRatePercent(sourceView,target),hitRoll=currentBattleRoll(attacker,target,'BASIC_ATTACK','hit',strikeIndex)*100;processed=true;
  if(hitRoll>=hitRate){queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:true,damage:0});battle.log.push(`[Tick ${battle.tick}] ${attacker.name}の通常攻撃${dual?` Hit${strikeIndex+1}`:''} → ${target.name} MISS（命中率${hitRate.toFixed(2)}%）`);typeof recordValidationEvent==='function'&&recordValidationEvent('basic_attack_miss',{source_id:attacker.id,target_id:target.id,weapon_style:profile.weaponStyle,weapon_slot:profile.weaponSlot,weapon_id:profile.weaponId,strike_index:strikeIndex,accuracy:currentBattleAccuracy(sourceView),evasion:currentBattleEvasion(target),hit_rate:hitRate,hit_roll:hitRoll});continue;}
  const baseDamage=Math.max(0,effectiveAttackValue(sourceView)),resistance=effectiveDamageResist(target),postResistance=Math.max(0,baseDamage*(1-resistance/100)),criticalRate=currentBattleCriticalRatePercent(sourceView),criticalRoll=currentBattleRoll(attacker,target,'BASIC_ATTACK','critical',strikeIndex)*100,critical=criticalRoll<criticalRate,criticalDamage=currentBattleCriticalDamagePercent(attacker),criticalMultiplier=critical?1+criticalDamage/100:1,finalDamage=Math.max(0,Math.floor(postResistance*criticalMultiplier)),shield=consumeShieldDamage(target,finalDamage,{sourceId:attacker.id,damageType:'basic_attack'}),damage=shield.hpDamage,before=target.hp;target.hp=Math.max(0,target.hp-damage);const applied=before-target.hp;
  queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});attacker.damageDealt+=applied;target.damageTaken+=applied;
  battle.log.push(`[Tick ${battle.tick}] ${attacker.name}の通常攻撃${dual?` Hit${strikeIndex+1}`:''} → ${target.name}に${applied}HPダメージ（基礎${baseDamage}、耐性${resistance}%、Crit${critical?'ON':'OFF'}、シールド吸収${shield.absorbed}、残HP ${target.hp}/${target.maxHp}）`);recordValidationEvent('basic_attack',{source_id:attacker.id,target_id:target.id,weapon_style:profile.weaponStyle,weapon_slot:profile.weaponSlot,weapon_id:profile.weaponId,strike_index:strikeIndex,accuracy:currentBattleAccuracy(sourceView),evasion:currentBattleEvasion(target),hit_rate:hitRate,hit_roll:hitRoll,base_damage:baseDamage,resistance,post_resistance_damage:postResistance,critical_rate:criticalRate,critical_roll:criticalRoll,critical,critical_damage:criticalDamage,critical_multiplier:criticalMultiplier,final_damage:finalDamage,damage:applied,hp_before:before,hp_after:target.hp,shield_absorbed:shield.absorbed});
  if(target.hp<=0){if(typeof resetCombatantOnDeath==='function')resetCombatantOnDeath(target,{reason:'basic_attack',sourceId:attacker.id});else{target.alive=false;target.gauge=0;target.reservedAction=null;target.castingAction=null;}recordValidationEvent('basic_attack_ko',{source_id:attacker.id,target_id:target.id,weapon_style:profile.weaponStyle,weapon_slot:profile.weaponSlot,weapon_id:profile.weaponId,strike_index:strikeIndex});battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`);break;}
 }
 finishIfNeeded();return processed;
}
function commitActivatedAction(actor,r,{skillId=null,targetId=null}={}){actor.actions++;actor.lastActionTick=battle.tick;battle.actions++;actor.lastReservation={...r,status:'completed',completedAt:battle.tick,executedSkillId:skillId,executedTargetId:targetId};}
function interruptCasting(actor,reason){const c=actor?.castingAction;if(!c)return false;actor.castingAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}の「${c.label||c.skillId}」は詠唱中断 — ${reason}`);typeof recordValidationEvent==='function'&&recordValidationEvent('skill_cast_interrupted',{source_id:actor.id,skill_id:c.skillId||null,target_id:c.targetId||null,reason,started_at:c.startedAt,interrupted_at:battle.tick});resetAiEvaluationCursor(actor);return true;}
function castingFinalTargets(actor,c,compiled){const ids=Array.isArray(c?.executionSnapshot?.targetIds)?c.executionSnapshot.targetIds:[],side=compiled?.definition?.target?.side,isRevive=compiled?.definition?.logicOrder?.includes('REVIVE'),valid=[];for(const id of ids){const target=battle.units.find(x=>x.id===id);if(!target||target.exited===true||target.untargetable===true||target.outOfRange===true||target.out_of_range===true)continue;const sideOk=side==='self'?target.id===actor.id:side==='ally'?target.side===actor.side:side==='enemy'?target.side!==actor.side:side==='corpse'?target.side===actor.side:false;if(!sideOk)continue;if(isRevive){if(target.alive||Number(target.hp)>0)continue;}else if(!target.alive)continue;valid.push(target)}return valid}
function activateCasting(actor){const c=actor?.castingAction;if(!c||!actor.alive)return false;const skill=formalBattleSkillExact(c.skillId)||formalBattleSkill(c.skillId),compiled=skill?compileSkillForRuntime(skill):null;if(!skill||!compiled?.ok){interruptCasting(actor,'SKILL_UNAVAILABLE');return false;}const targets=castingFinalTargets(actor,c,compiled);if(!targets.length){actor.castingAction=null;battle.log.push(`[Tick ${battle.tick}] ${actor.name}の「${c.label||c.skillId}」は不発 — 固定Targetがすべて無効`);typeof recordValidationEvent==='function'&&recordValidationEvent('skill_cast_fizzled',{source_id:actor.id,skill_id:c.skillId,target_ids:c.executionSnapshot?.targetIds||[],reason:'NO_VALID_FIXED_TARGET',started_at:c.startedAt,completed_at:battle.tick,no_cost:true,no_cooldown:true});resetAiEvaluationCursor(actor);return false;}actor.castingAction=null;const finalSnapshot={...(c.executionSnapshot||{}),targetIds:targets.map(x=>x.id)};
 typeof recordValidationEvent==='function'&&recordValidationEvent('skill_cast_completed',{source_id:actor.id,skill_id:c.skillId,target_id:c.targetId,target_ids:finalSnapshot.targetIds,started_at:c.startedAt,completed_at:battle.tick});
 const result=executeSkillRuntime(actor,targets[0]||null,skill,{executionSnapshot:finalSnapshot,skipExecutionEligibility:true});if(result?.ok!==true)return false;commitActivatedAction(actor,c.reservation,{skillId:c.skillId,targetId:targets[0]?.id||c.targetId});if(typeof recordValidationEvent==='function'){if(c.reservation?.formalAi)recordValidationEvent('action_execution_committed',{source_id:actor.id,skill_id:skill?.id||null,skill_name:skill?.name||null,target_id:targets[0]?.id||c.targetId,presentation_skill_id:c.reservation?.skillId||null,presentation_target_id:c.reservation?.targetId||null,formal_ai:true,activation_tick:battle.tick,cast_duration_ticks:c.durationTicks});else recordValidationEvent('action_execution_committed',{source_id:actor.id,skill_id:skill.id,skill_name:skill.name||null,target_id:targets[0]?.id||c.targetId,presentation_skill_id:c.reservation?.skillId||null,presentation_target_id:c.reservation?.targetId||null,activation_tick:battle.tick,cast_duration_ticks:c.durationTicks});}return true;
}
function processCastingActions(){for(const actor of battle.units.filter(u=>u?.castingAction)){if(battle.result||battle.pendingResult)break;if(!actor.alive){interruptCasting(actor,'ACTOR_DEAD');continue;}const castingSkill=formalBattleSkillExact(actor.castingAction.skillId)||formalBattleSkill(actor.castingAction.skillId);if(!castingSkill||!compileSkillForRuntime(castingSkill).ok){interruptCasting(actor,'SKILL_UNAVAILABLE');continue;}const blocked=typeof actionExecutionEligibility==='function'?actionExecutionEligibility(actor,{actionKind:'casting_interrupt_probe'}):{ok:true};if(!blocked.ok&&blocked.reason==='ACTION_DISABLED'){interruptCasting(actor,'ACTION_DISABLED');continue;}if(Number(actor.castingAction.completeAt)<=battle.tick)activateCasting(actor);}}
function executeReservation(actor){
 const r=actor?.reservedAction;if(!r||actor.castingAction)return false;const checked=evaluateCandidateExecution(actor);
 if(!checked.ok){typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_blocked',{source_id:actor.id,presentation_skill_id:r.skillId||null,presentation_target_id:r.targetId||null,reason:checked.code||checked.reason,status_instance_id:checked.eligibility?.statusInstanceId||null,status_id:checked.eligibility?.statusId||null});cancelReservation(actor,checked.reason,true);return false;}
 r.status='execution_checked';actor.gauge=Math.max(0,Number(actor.gauge||0)-battleGaugeConsumeAmount('success'));actor.reservedAction=null;resetAiEvaluationCursor(actor);
 if(r.type==='wait'){battle.log.push(`[Tick ${battle.tick}] ${actor.name}はAI候補「待機」を実行`);commitActivatedAction(actor,r,{skillId:null,targetId:null});typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_committed',{source_id:actor.id,skill_id:null,target_id:null,presentation_skill_id:null,presentation_target_id:null,formal_ai:!!r.formalAi,action_kind:'wait'});return true;}
 if(r.type==='attack'){const target=checked.target;battle.log.push(`[Tick ${battle.tick}] ${actor.name}はAI候補「通常攻撃」を実行 → ${target.name}`);commitActivatedAction(actor,r,{skillId:null,targetId:target.id});typeof recordValidationEvent==='function'&&recordValidationEvent('action_execution_committed',{source_id:actor.id,skill_id:null,target_id:target.id,presentation_target_id:r.targetId||null,formal_ai:!!r.formalAi,action_kind:'attack'});return performBasicAttack(actor,target,{prechecked:true});}
 const target=checked.target,skill=checked.skill,durationTicks=Math.max(0,Math.floor(Number(checked.compiled?.definition?.parameters?.castTime)||0));actor.castingAction={reservation:{...r},skillId:skill.id,label:skill.name,targetId:target?.id||null,startedAt:battle.tick,completeAt:battle.tick+durationTicks,durationTicks,executionSnapshot:checked.executionSnapshot};r.status='casting';battle.log.push(`[Tick ${battle.tick}] ${actor.name}は「${skill.name}」の実行可否を確定${durationTicks?`、詠唱開始（${durationTicks} Tick）`:'、即時発動'}`);typeof recordValidationEvent==='function'&&recordValidationEvent('skill_cast_started',{source_id:actor.id,skill_id:skill.id,target_id:target?.id||null,duration_ticks:durationTicks,complete_at:battle.tick+durationTicks,eligibility_checked_once:true});
 if(durationTicks===0)return activateCasting(actor);return true;
}
function activationPriorityFeatureEnabled(){return true}
function p0113Hash32(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
function createBattleTieSeed(){
 if(battleLaunchContext?.seed!=null)return String(battleLaunchContext.seed);
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
 if(unit.reservedAction?.formalAi&&unit.reservedAction?.type!=='skill')return 0;
 const prioritySkillId=unit.reservedAction?.skillId||unit.defaultSkillId,skill=formalBattleSkillExact(prioritySkillId)||formalBattleSkill(prioritySkillId),compiled=skill?compileSkillForRuntime(skill):null;
 return compiled?.ok?Number(compiled.definition.parameters.activationPriority)||0:0;
}
function fixDueActionOrder(due){
 const rows=due.map((unit,index)=>({unit,index,priority:activationPriorityOf(unit),tieRoll:Number(unit.battleTieRoll)||0}));
 rows.sort((a,b)=>b.priority-a.priority||b.tieRoll-a.tieRoll);
 if(activationPriorityFeatureEnabled()&&typeof recordValidationEvent==='function')recordValidationEvent('activation_order_fixed',{tick:battle.tick,order:rows.map((x,i)=>({rank:i+1,source_id:x.unit.id,skill_id:(x.unit.reservedAction?.skillId||x.unit.defaultSkillId)||null,priority:x.priority,battle_tie_roll:x.tieRoll||null}))});
 return rows.map(x=>x.unit);
}
function evaluateCrossedAiThresholds(actor,previousGauge,currentGauge){
 const max=battleGaugeMax(),step=battleAiReevaluationStep();if(!actor?.alive||actor.castingAction)return;
 let threshold=Number(actor.nextAiEvaluationGauge);if(!Number.isFinite(threshold)||threshold<=0)threshold=step;
 while(threshold<=max+1e-9&&previousGauge+1e-9<threshold&&currentGauge+1e-9>=threshold){reserveAction(actor,{threshold,phase:actor.lastAiEvaluationGauge==null?'reservation':'rethink'});markAiEvaluation(actor,threshold);if(threshold>=max-1e-9)break;threshold=Math.min(max,threshold+step);actor.nextAiEvaluationGauge=threshold;}
 if(currentGauge+1e-9>=max&&actor.lastAiEvaluationGauge!==max&&!actor.castingAction){reserveAction(actor,{threshold:max,phase:actor.lastAiEvaluationGauge==null?'reservation':'rethink'});markAiEvaluation(actor,max);}
}
function processTicks(count){
 for(let n=0;n<count&&!battle.result&&!battle.pendingResult;n++){
  battle.tick++;processApplyLifecycleExpirations();processCooldowns();processCoverEffects();processCastingActions();if(battle.result||battle.pendingResult)break;if(battle.validationMode)continue;
  const max=battleGaugeMax();GAUGE_MAX=max;
  for(const u of battle.units.filter(u=>u.alive&&!u.castingAction)){const before=Math.max(0,Math.min(max,Number(u.gauge)||0)),after=Math.max(0,Math.min(max,before+battleAgGainPerTick(u.agi)));u.gauge=after;evaluateCrossedAiThresholds(u,before,after);}
  const dueBase=battle.units.filter(u=>u.alive&&!u.castingAction&&u.reservedAction&&u.gauge+1e-9>=max);
  const due=fixDueActionOrder(dueBase);
  for(const u of due){if(battle.result||battle.pendingResult)break;executeReservation(u)}
 }
}
function simulateFormalAdventureBattle({party,formation,monsters,seed=1,maxTicks=200000}={}){
 if(!window.GKAdventureBattleCore||!window.GKGameAISaveBridge||!window.GKGameAIBattleBridge)throw new Error('Formal Adventure Battle runtime is not loaded');
 const previousBattle=battle,previousContext=battleLaunchContext,normalizedParty=Array.isArray(party)?party:[];
 formalAdventureSimulationDepth++;
 try{
  battleLaunchContext={formation:GKAdventureBattleCore.normalizeFormation(formation),monsters:clone(monsters||[]),seed,source:'adventure_questrun'};
  const allies=normalizedParty.map((row,i)=>makeCombatant({id:`A${i}`,characterId:String(row?.character_id||row?.id||''),name:String(row?.name||`Adventurer ${i+1}`),side:'味方',ownedSkillIds:Array.isArray(row?.skills)?clone(row.skills):[],equippedSkillId:String(row?.equipped_skill_id||row?.equippedSkillId||''),defaultSkillId:String(row?.equipped_skill_id||row?.equippedSkillId||row?.skills?.[0]||''),agi:Math.max(1,Math.floor(Number(row?.agi)||1)),attack:Math.max(1,Math.floor(Number(row?.attack??row?.atk)||1)),accuracy:Math.max(0,Number(row?.accuracy)||0),evasion:Math.max(0,Number(row?.evasion)||0),magicWeaponBonus:Math.max(0,Number(row?.magic_weapon_bonus??row?.magicWeaponBonus)||0),baseCriticalRate:Math.max(0,Number(row?.base_critical_rate??row?.baseCriticalRate)||0),magicIncreaseRate:Number.isFinite(Number(row?.magic_increase_rate??row?.magicIncreaseRate))?Math.max(0,Number(row?.magic_increase_rate??row?.magicIncreaseRate)):undefined,criticalDamage:Number.isFinite(Number(row?.critical_damage??row?.criticalDamage))?Math.max(0,Number(row?.critical_damage??row?.criticalDamage)):undefined,damageResist:Number.isFinite(Number(row?.damage_resist??row?.damageResist))?Math.max(0,Number(row?.damage_resist??row?.damageResist)):undefined,statusResistance:row?.status_resistance??row?.statusResistance??{},maxHp:Math.max(1,Math.floor(Number(row?.max_hp??row?.maxHp??row?.hp)||1)),maxMp:Math.max(0,Math.floor(Number(row?.max_mp??row?.maxMp??100)||0)),mp:Math.max(0,Math.floor(Number(row?.mp??row?.max_mp??row?.maxMp??100)||0)),gauge:0,actions:0,order:i,lastActionTick:null}));
  if(!allies.length)throw new Error('Party Snapshot is empty');
  const expanded=GKAdventureBattleCore.expandFormation(battleLaunchContext.formation,battleLaunchContext.monsters||[]);
  const enemies=expanded.map((row,i)=>makeCombatant({id:`E${i}`,monsterId:row.monster_id,name:row.name,side:'敵',aiPolicy:row.aiPolicy,ownedSkillIds:clone(row.skillIds||[]),defaultSkillId:row.defaultSkillId,agi:row.agi,attack:row.attack,maxHp:row.maxHp,gauge:0,actions:0,order:100+i,lastActionTick:null}));
  if(!enemies.length)throw new Error('Enemy Formation is empty');
  battle={tick:0,actions:0,units:[...allies,...enemies],log:[],timer:null,running:false,runToken:0,lastFrameAt:0,tickAccumulator:0,result:null,pendingResult:null,ending:false,reward:null,rewardApplied:false,validationMode:false,validationCaptureEvents:true,validationEvents:[],validationMeta:null};
  initializeBattleTieRolls(seed);recordValidationEvent('battle_started',{seed,source:'adventure_questrun'});
  const cap=Math.max(1,Math.floor(Number(maxTicks)||200000));
  while(!battle.result&&!battle.pendingResult&&battle.tick<cap)processTicks(1);
  if(!battle.result){const error=new Error(`Formal Adventure Battle exceeded maxTicks: ${cap}`);error.code='FORMAL_ADVENTURE_BATTLE_TICK_LIMIT';throw error;}
  const result=GKAdventureBattleCore.buildBattleResult({battle,context:battleLaunchContext});result.reward={};return result;
 }finally{battle=previousBattle;battleLaunchContext=previousContext;formalAdventureSimulationDepth=Math.max(0,formalAdventureSimulationDepth-1);}
}
window.GKGameFormalAdventureBattle=Object.freeze({simulate:simulateFormalAdventureBattle});

function advanceTicks(count){if(battle.result||battle.pendingResult)return;processTicks(Math.max(0,Number(count)||0));renderBattle()}
function processUntilNextAction(maxTicks=10000){
 if(battle.result||battle.pendingResult)return false;
 const before=battle.actions;let guard=0;
 while(battle.actions===before&&!battle.result&&!battle.pendingResult&&guard++<maxTicks)processTicks(1);
 return battle.actions>before;
}
function scenePaceDelayMs(){const speed=Math.max(.25,Number($('sceneSpeed')?.value)||1);return Math.max(120,Math.round(180*speed))}
async function startSceneBattle(){
 if(battle.result){renderBattleResult();setPhase('result',{keepBattle:true});return}
 if(battle.pendingResult||battle.running)return;
 pauseBattle();battle.running=true;const token=++battle.runToken;renderBattle();
 while(battle.running&&token===battle.runToken&&!battle.result&&!battle.pendingResult){
  processUntilNextAction();renderBattle();
  await waitForSceneIdle();
  if(!battle.running||token!==battle.runToken||battle.result||battle.pendingResult)break;
  await sleep(scenePaceDelayMs());
 }
 if(token===battle.runToken&&battle.running&&(battle.result||battle.pendingResult)){battle.running=false;renderBattle()}
}
function restartSceneBattle(){resetBattle();startSceneBattle()}
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


$('sceneAuto').onclick=startSceneBattle;$('scenePause').onclick=pauseBattle;$('sceneReset').onclick=restartSceneBattle;
$('sceneStep').onclick=()=>{if(battle.running)pauseBattle();if(battle.result||battle.pendingResult)return;processUntilNextAction();renderBattle()};
$('sceneMotion').onchange=ensureSceneUnits;$('sceneLayout').value=localStorage.getItem('ga_scene_layout')||'jp';$('sceneLayout').onchange=()=>{localStorage.setItem('ga_scene_layout',$('sceneLayout').value);sceneSignature='';ensureSceneUnits(true)};addEventListener('resize',()=>{sceneSignature='';ensureSceneUnits(true)});
