/* Extracted without logic changes from game/index.html — GA-B475 */
const FIXED_CANVAS_WIDTH=1600;
const FIXED_CANVAS_HEIGHT=900;
const fixedCanvasHost=document.getElementById('fixedCanvasHost');
const fixedCanvas=document.getElementById('fixedCanvas');
let canvasResizeFrame=0;
let viewportSettleTimer=0;
let lastViewportSignature='';
function readVisualViewport(){
 const viewport=window.visualViewport;
 const width=Math.max(1,Math.round(viewport?.width||window.innerWidth||document.documentElement.clientWidth||1));
 const height=Math.max(1,Math.round(viewport?.height||window.innerHeight||document.documentElement.clientHeight||1));
 const offsetLeft=Math.round(viewport?.offsetLeft||0);
 const offsetTop=Math.round(viewport?.offsetTop||0);
 return {width,height,offsetLeft,offsetTop};
}
function updateFixedCanvasScale(){
 const {width,height,offsetLeft,offsetTop}=readVisualViewport();
 const mobileResponsive=width<=900;
 if(mobileResponsive){
  document.documentElement.style.setProperty('--viewport-width',`${width}px`);
  document.documentElement.style.setProperty('--viewport-height',`${height}px`);
  document.documentElement.style.setProperty('--game-scale','1');
  if(fixedCanvasHost){fixedCanvasHost.style.width='';fixedCanvasHost.style.height='';fixedCanvasHost.style.transform=''}
  if(fixedCanvas){fixedCanvas.style.left='';fixedCanvas.style.top=''}
  const badge=document.getElementById('canvasScaleBadge');if(badge)badge.textContent='Portrait Development';
  lastViewportSignature=`mobile:${width}x${height}@${offsetLeft},${offsetTop}`;
  return;
 }
 const scale=Math.min(width/FIXED_CANVAS_WIDTH,height/FIXED_CANVAS_HEIGHT);
 const safeScale=Number.isFinite(scale)&&scale>0?scale:1;
 const root=document.documentElement;
 root.style.setProperty('--viewport-width',`${width}px`);
 root.style.setProperty('--viewport-height',`${height}px`);
 root.style.setProperty('--game-scale',String(safeScale));
 if(fixedCanvasHost){
  fixedCanvasHost.style.width=`${width}px`;
  fixedCanvasHost.style.height=`${height}px`;
  fixedCanvasHost.style.transform=`translate3d(${offsetLeft}px,${offsetTop}px,0)`;
 }
 if(fixedCanvas){
  fixedCanvas.style.left=`${width/2}px`;
  fixedCanvas.style.top=`${height/2}px`;
 }
 const badge=document.getElementById('canvasScaleBadge');
 if(badge)badge.textContent=`1600×900 / ${Math.round(safeScale*100)}%`;
 lastViewportSignature=`${width}x${height}@${offsetLeft},${offsetTop}`;
}
function scheduleFixedCanvasUpdate(){
 cancelAnimationFrame(canvasResizeFrame);
 canvasResizeFrame=requestAnimationFrame(()=>requestAnimationFrame(updateFixedCanvasScale));
}
function settleFixedCanvas(duration=900){
 clearTimeout(viewportSettleTimer);
 const started=performance.now();
 let previous='';
 let stableFrames=0;
 const sample=()=>{
  const v=readVisualViewport();
  const signature=`${v.width}x${v.height}@${v.offsetLeft},${v.offsetTop}`;
  updateFixedCanvasScale();
  stableFrames=signature===previous?stableFrames+1:0;
  previous=signature;
  if(performance.now()-started<duration&&stableFrames<5){
   viewportSettleTimer=setTimeout(sample,60);
  }
 };
 sample();
}
function handleViewportMutation(){scheduleFixedCanvasUpdate();settleFixedCanvas(720)}
window.addEventListener('resize',handleViewportMutation,{passive:true});
window.addEventListener('orientationchange',()=>settleFixedCanvas(1400),{passive:true});
window.addEventListener('pageshow',()=>settleFixedCanvas(1000),{passive:true});
window.addEventListener('load',()=>settleFixedCanvas(1000),{once:true,passive:true});
window.addEventListener('focus',()=>settleFixedCanvas(600),{passive:true});
window.visualViewport?.addEventListener('resize',handleViewportMutation,{passive:true});
window.visualViewport?.addEventListener('scroll',scheduleFixedCanvasUpdate,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)settleFixedCanvas(800)});
updateFixedCanvasScale();
requestAnimationFrame(()=>requestAnimationFrame(()=>settleFixedCanvas(1000)));
'use strict';
const SAVE_KEY='guildAdventureV10.save.v3', SAVE_VERSION=3;
const STATS=['STR','VIT','AGI','DEX','INT','MND','LUK'];
const JOBS={
 '剣士':{STR:13,VIT:12,AGI:8,DEX:11,INT:9,MND:10,LUK:7},
 '騎士':{STR:11,VIT:13,AGI:7,DEX:9,INT:10,MND:12,LUK:8},
 '盗賊':{STR:9,VIT:10,AGI:13,DEX:12,INT:7,MND:8,LUK:11},
 '弓兵':{STR:10,VIT:9,AGI:7,DEX:13,INT:8,MND:11,LUK:12},
 '魔術師':{STR:7,VIT:8,AGI:11,DEX:10,INT:13,MND:12,LUK:9},
 '神官':{STR:8,VIT:7,AGI:9,DEX:11,INT:12,MND:13,LUK:10},
 '冒険家':{STR:12,VIT:11,AGI:10,DEX:7,INT:8,MND:9,LUK:13}
};
const RARITY={common:{label:'★',name:'一般',weight:60},uncommon:{label:'★★',name:'上質',weight:27},rare:{label:'★★★',name:'希少',weight:10},epic:{label:'★★★★',name:'英雄',weight:2.5},legendary:{label:'★★★★★',name:'伝説',weight:.5}};
const EQUIPMENT={
 '錆びた剣':{slot:'weapon',rarity:'common',attack:8,maxHp:0,agi:0,description:'使い込まれた練習用の剣。'},
 '青銅の剣':{slot:'weapon',rarity:'uncommon',attack:16,maxHp:0,agi:0,description:'扱いやすい青銅製の剣。'},
 '狩人の弓':{slot:'weapon',rarity:'uncommon',attack:13,maxHp:0,agi:2,description:'素早い射撃を助ける軽量弓。'},
 '紋章の剣':{slot:'weapon',rarity:'epic',attack:32,maxHp:40,agi:1,description:'古代紋章の力を宿す剣。'},
 '旅人の外套':{slot:'armor',rarity:'common',attack:0,maxHp:50,agi:1,description:'旅に適した軽い外套。'},
 '革の鎧':{slot:'armor',rarity:'uncommon',attack:0,maxHp:90,agi:0,description:'動きやすさと防御を両立した鎧。'},
 '守護者の鎧':{slot:'armor',rarity:'epic',attack:0,maxHp:180,agi:-1,description:'祭壇守護者の石片から作られた重鎧。'},
 '革の腕輪':{slot:'accessory',rarity:'common',attack:3,maxHp:25,agi:0,description:'新人冒険者向けの腕輪。'},
 '迅速の指輪':{slot:'accessory',rarity:'rare',attack:4,maxHp:20,agi:4,description:'行動速度を高める青い指輪。'},
 '魔力の指輪':{slot:'accessory',rarity:'rare',attack:9,maxHp:45,agi:1,description:'魔力を攻撃力へ変換する指輪。'},
 '古代の護符':{slot:'accessory',rarity:'legendary',attack:18,maxHp:120,agi:3,description:'失われた文明の祝福を帯びた護符。'}
};
let data={saveVersion:SAVE_VERSION,schemaRevision:'1.6.0',gameVersion:'GA-B486.198',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),characters:[],aiPrograms:[],aiLayouts:[],aiPresets:[],partyIds:[],selectedQuestId:'',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null},flags:{},quest_progress:{completed_quest_ids:[],unlocked_quest_ids:[]},quest_resources:{},adventure:{quest_runs:[],active_quest_run_id:'',history_limit:20,stone_selection_by_quest:{}}};let selectedId=null;
const $=id=>document.getElementById(id), clone=o=>JSON.parse(JSON.stringify(o)), uid=()=>`C-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const PHASES=['devhome','title','base','event','battle','result'];
let currentPhase='title';
function setPhase(next,options={}){
 if(!PHASES.includes(next))return;
 if(currentPhase==='battle'&&next!=='battle'&&!options.keepBattle)pauseBattle();
 document.querySelectorAll('.phase-screen').forEach(el=>el.classList.toggle('active',el.dataset.phase===next));
 currentPhase=next;document.body.dataset.phase=next;
 if(next==='devhome'){renderDeveloperWorkspaceSummary()}
 if(next==='base'){ $('baseRosterCount').textContent=String(data.characters.length); renderGuildSummary(); }
 if(next==='battle'){sceneSignature='';ensureSceneUnits(true)}
 scrollTo({top:0,behavior:'instant'});
}
function seedRoster(){
 if(data.characters.length)return;
 const samples=[['アルト','剣士'],['セリア','騎士'],['ロウ','盗賊'],['フィン','弓兵'],['ミナ','魔術師'],['エル','神官']];
 samples.forEach(([name,job])=>data.characters.push(makeCharacter(name,job)));
 data.partyIds=data.characters.map(c=>c.id);data.guild.gold=500;data.inventory=['錆びた剣','旅人の外套'];
 data.characters[0].equipment={weapon:'錆びた剣',armor:null,accessory:null};
 data.characters[1].equipment={weapon:null,armor:'旅人の外套',accessory:null};
 selectedId=data.characters[0].id;persist();
}
function beginNewGame(){seedRoster();resetBattle();render();if(typeof setupR06GameE2EUI==='function')setupR06GameE2EUI();setPhase('base')}
function continueGame(){
 
$('titleStart').onclick=beginNewGame;
$('titleContinue').onclick=continueGame;
$('titleSettings').onclick=()=>alert('設定画面は後続Buildで独立フェーズとして接続します。');
if($('baseToTitle'))$('baseToTitle').onclick=()=>setPhase('title');
$('baseDepart').onclick=$('baseDepartSide').onclick=beginSelectedAdventure;
$('eventBackBase').onclick=$('eventRetreat').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};if($('adventureReturn'))$('adventureReturn').onclick=returnFromAdventurePlayback;
$('battleAbort').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('resultToEvent').onclick=launchStandaloneBattle;
$('resultToBase').onclick=()=>{setPhase('base',{keepBattle:true});setBaseView('home',{instant:true})};
document.querySelectorAll('#phaseDevNav [data-phase]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.phase==='battle'){launchStandaloneBattle();return}setPhase(btn.dataset.phase,{keepBattle:true})});
document.querySelectorAll('#baseMobileNav [data-base-tab]').forEach(btn=>btn.onclick=()=>setBaseView(btn.dataset.baseTab));
document.querySelectorAll('[data-open-base-view]').forEach(btn=>btn.onclick=()=>setBaseView(btn.dataset.openBaseView));
const mobileDepart=$('mobileDepart');if(mobileDepart)mobileDepart.onclick=async()=>{if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');setBaseView('party');return}await beginSelectedAdventure()};

loadAdventureContent().then(content=>{applyAdventureFlagDefaults(content);registerAdventureQuestCards(content);reconcileFormalAdventureQuestSelection();persist();if(typeof renderExpeditionSetup==='function')renderExpeditionSetup();}).catch(error=>{adventureQuestCatalog=[];setAdventureStoryLoadError(error);if(typeof renderExpeditionSetup==='function')renderExpeditionSetup();});
ensureAdventurePlaybackTicker();

$('devGoBattle').onclick=launchStandaloneBattle;
$('devGoBase').onclick=()=>setPhase('base',{keepBattle:true});
$('devGoEvent').onclick=()=>setPhase('event',{keepBattle:true});
$('devGoResult').onclick=()=>setPhase('result',{keepBattle:true});
if($('devStudioLink')&&$('studioBackLink'))$('devStudioLink').href=$('studioBackLink').href;

try{const raw=localStorage.getItem(SAVE_KEY);if(raw){data=normalize(JSON.parse(raw));selectedId=data.characters[0]?.id||null;render();notify('セーブデータを読み込みました。');}}
 catch(e){alert(`読込失敗: ${e.message}`);return}
 if(typeof setupR06GameE2EUI==='function')setupR06GameE2EUI();
 const activeRun=currentAdventureQuestRun();if(activeRun)openAdventurePlayback(activeRun);else setPhase('base');
}


function renderDeveloperWorkspaceSummary(){
 const roster=$('devRosterCount'),gold=$('devGuildGold');
 if(roster)roster.textContent=`${data.characters.length}名`;
 if(gold)gold.textContent=`${data.guild?.gold||0} G`;
}
function openPortraitDeveloperWorkspace(){syncPortraitDevelopmentMode()}

function renderGuildSummary(){
 const guild=data.guild||{gold:0,victories:0,defeats:0};
 const gold=$('baseGuildGold'),record=$('baseBattleRecord');
 if(gold)gold.textContent=String(guild.gold||0);
 if(record)record.textContent=`${guild.victories||0}勝 / ${guild.defeats||0}敗`;
}
function applyBattleOutcome(){
 if(battle.rewardApplied||!battle.result)return battle.reward||null;
 const structuredBattleResult=window.GKAdventureBattleCore?GKAdventureBattleCore.buildBattleResult({battle,context:battleLaunchContext||{}}):null;
 battle.reward={gold:0,victory:battle.result==='味方勝利',dropped:null,standalone:true,battle_result:structuredBattleResult};
 battle.rewardApplied=true;
 return battle.reward;
}
function renderBattleResult(){
 const reward=applyBattleOutcome()||{gold:0,victory:false,standalone:true};
 $('resultHeading').textContent=battle.result||'戦闘結果';
 $('resultSummary').textContent=`${battle.actions}回の行動、${battle.tick} Tickで戦闘が終了しました。`;
 const panel=$('resultReward');
 if(panel)panel.innerHTML=`<h3>Standalone Battle 検証結果</h3><p>${reward.victory?'勝利':'敗北'}。このBattle Sceneは検証専用です。</p><p class="small">Gold・Item・戦績・Quest進行を正式SaveへCommitしません。正式冒険の結果反映はQuestRun帰還処理だけが行います。</p>`;
}

function aptitudeExpected(v){return (v/10).toFixed(2)}
function rollGrowth(v){
 if(v<7||v>13)throw new Error('適性値は7～13である必要があります。');
 if(v<10)return Math.random()*100<v*10?1:0;
 if(v===10)return 1;
 return 1+(Math.random()*100<(v-10)*10?1:0);
}
function notify(text,type='ok'){const n=$('notice');n.textContent=text;n.className=type}
function jobOptions(){return Object.keys(JOBS).map(j=>`<option value="${j}">${j}</option>`).join('')}
$('newJob').innerHTML=jobOptions();if($('changeJob'))$('changeJob').innerHTML=jobOptions();
if($('jobTable'))$('jobTable').innerHTML=Object.entries(JOBS).map(([job,a])=>`<tr><td><b>${job}</b></td>${STATS.map(s=>`<td>${a[s]} <span class="small">(期待値 ${aptitudeExpected(a[s])})</span></td>`).join('')}</tr>`).join('');
function makeCharacter(name,job){return{id:uid(),name,level:1,job,stats:Object.fromEntries(STATS.map(s=>[s,10])),skills:['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'],equippedSkillId:'SKL-TEST-ATTACK',formalAiBinding:null,equipment:{weapon:null,armor:null,accessory:null},jobHistory:[{job,level:1,at:new Date().toISOString()}],growthHistory:[],createdAt:new Date().toISOString()}}
function normalize(raw){
 raw=window.GKGameAISaveBridge?GKGameAISaveBridge.assertCurrent(raw):clone(raw);
 if(!raw||raw.saveVersion!==SAVE_VERSION||!Array.isArray(raw.characters))throw new Error(`Save Data Version ${SAVE_VERSION}ではありません。`);
 if(!Array.isArray(raw.aiPrograms)||!Array.isArray(raw.aiLayouts)||!Array.isArray(raw.aiPresets))throw new Error('Formal AI保存領域が不正です。');
 raw.characters.forEach(c=>{
  if(!c.id||typeof c.name!=='string'||!c.name.trim()||!JOBS[c.job]||!Number.isInteger(c.level)||c.level<1||c.level>50)throw new Error('キャラクターデータが不正です。');
  if(!c.stats||typeof c.stats!=='object')throw new Error(`${c.name}の能力値が不正です。`);
  STATS.forEach(s=>{if(!Number.isInteger(c.stats[s])||c.stats[s]<0)throw new Error(`${c.name}の${s}が不正です。`)});
  c.skills=Array.isArray(c.skills)&&c.skills.length?c.skills.filter(id=>['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'].includes(id)):['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'];c.equippedSkillId=c.skills.includes(c.equippedSkillId)?c.equippedSkillId:(c.skills[0]||'SKL-TEST-ATTACK');
  c.jobHistory=Array.isArray(c.jobHistory)?c.jobHistory:[];
  c.growthHistory=Array.isArray(c.growthHistory)?c.growthHistory:[];
  delete c.aptitudes;
 });
 raw.guild=raw.guild&&typeof raw.guild==='object'?raw.guild:{};
 raw.guild.gold=Math.max(0,Number(raw.guild.gold)||0);
 raw.guild.victories=Math.max(0,Number(raw.guild.victories)||0);
 raw.guild.defeats=Math.max(0,Number(raw.guild.defeats)||0);
 raw.guild.lastBattle=raw.guild.lastBattle&&typeof raw.guild.lastBattle==='object'?raw.guild.lastBattle:null;
 raw.partyIds=Array.isArray(raw.partyIds)?raw.partyIds.filter(id=>raw.characters.some(c=>c.id===id)).slice(0,6):raw.characters.slice(0,6).map(c=>c.id);
 raw.selectedQuestId=typeof raw.selectedQuestId==='string'?raw.selectedQuestId:'';
 raw.inventory=Array.isArray(raw.inventory)?raw.inventory.map(String).filter(Boolean):[];
 raw.flags=raw.flags&&typeof raw.flags==='object'?raw.flags:{};
 raw.quest_progress=raw.quest_progress&&typeof raw.quest_progress==='object'?raw.quest_progress:{};raw.quest_progress.completed_quest_ids=Array.isArray(raw.quest_progress.completed_quest_ids)?[...new Set(raw.quest_progress.completed_quest_ids.map(String))]:[];raw.quest_progress.unlocked_quest_ids=Array.isArray(raw.quest_progress.unlocked_quest_ids)?[...new Set(raw.quest_progress.unlocked_quest_ids.map(String))]:[];
 raw.quest_resources=raw.quest_resources&&typeof raw.quest_resources==='object'?Object.fromEntries(Object.entries(raw.quest_resources).map(([k,v])=>[String(k),Math.max(0,Math.floor(Number(v)||0))])):{};
 if(window.GKAdventureStorySystem)GKAdventureStorySystem.ensureQuestRunStore(raw);else raw.adventure=raw.adventure&&typeof raw.adventure==='object'?raw.adventure:{quest_runs:[],active_quest_run_id:'',history_limit:20,stone_selection_by_quest:{}};
 raw.characters.forEach(c=>{c.equipment=c.equipment&&typeof c.equipment==='object'?c.equipment:{weapon:null,armor:null,accessory:null};c.formalAiBinding=window.GKGameAISaveBridge?GKGameAISaveBridge.normalizeBinding(c.formalAiBinding):null;});
 raw.schemaRevision='1.6.0';raw.gameVersion='GA-B486.198';
 return raw;
}
function persist(){
 data.saveVersion=SAVE_VERSION;
 data.aiPrograms=Array.isArray(data.aiPrograms)?data.aiPrograms:[];
 data.aiLayouts=Array.isArray(data.aiLayouts)?data.aiLayouts:[];
 data.aiPresets=Array.isArray(data.aiPresets)?data.aiPresets:[];
 data.updatedAt=new Date().toISOString();
 if(window.GKAdventureStorySystem)GKAdventureStorySystem.ensureQuestRunStore(data);
 localStorage.setItem(SAVE_KEY,JSON.stringify(data));
}
function storeAdventureQuestRun(run,{startedAt=new Date().toISOString()}={}){if(!window.GKAdventureStorySystem)throw new Error('Adventure Story System is not loaded');const stored=GKAdventureStorySystem.startQuestRunPlayback(data,run,{startedAt});persist();return stored}
function currentAdventureQuestRun(){return window.GKAdventureStorySystem?GKAdventureStorySystem.activeQuestRun(data):null}
function resumeAdventurePlayback(nowMs=Date.now()){return window.GKAdventureStorySystem?GKAdventureStorySystem.resumeQuestRun(data,nowMs):null}
function commitAdventureQuestRun(runId){if(!window.GKAdventureStorySystem)return{applied:false,reason:'story_system_unavailable'};const result=GKAdventureStorySystem.commitStoredQuestRun(data,runId,{applyReward:(save,reward)=>{save.guild=save.guild||{};if(Number(reward.gold))save.guild.gold=Math.max(0,Number(save.guild.gold)||0)+Number(reward.gold);save.inventory=Array.isArray(save.inventory)?save.inventory:[];if(Array.isArray(reward.items))save.inventory.push(...reward.items.map(String).filter(Boolean));save.quest_resources=save.quest_resources&&typeof save.quest_resources==='object'?save.quest_resources:{};for(const row of (Array.isArray(reward.resources)?reward.resources:[])){const id=String(row?.resource_id||'');const count=Math.max(0,Math.floor(Number(row?.count)||0));if(id&&count)save.quest_resources[id]=Math.max(0,Math.floor(Number(save.quest_resources[id])||0))+count;}},applyFlags:(save,flags)=>{save.flags=save.flags&&typeof save.flags==='object'?save.flags:{};Object.assign(save.flags,flags||{});},applyQuestProgress:(save,progress)=>{save.quest_progress=save.quest_progress&&typeof save.quest_progress==='object'?save.quest_progress:{};const completed=new Set((save.quest_progress.completed_quest_ids||[]).map(String)),unlocked=new Set((save.quest_progress.unlocked_quest_ids||[]).map(String));const completeId=String(progress?.complete_quest_id||'');if(completeId)completed.add(completeId);for(const id of progress?.unlock_quest_ids||[]){const qid=String(id||'');if(qid)unlocked.add(qid);}save.quest_progress.completed_quest_ids=[...completed];save.quest_progress.unlocked_quest_ids=[...unlocked];save.flags=save.flags&&typeof save.flags==='object'?save.flags:{};Object.assign(save.flags,progress?.set_flags||{});}});persist();renderGuildSummary();return result}
function adventurePlaybackLabel(nowMs=Date.now()){const state=resumeAdventurePlayback(nowMs);if(!state)return'';const p=state.playback,done=p.complete?'帰還可能':'進行中';return`冒険 ${done} ${Math.min(p.elapsed_seconds,p.duration_seconds).toFixed(0)}/${p.duration_seconds.toFixed(0)}秒`;}

let adventurePlaybackHistoryRunId='';
let adventurePlaybackLastVisibleCount=0;
let adventurePlaybackDetailItemIndex=null;
let adventureHistoryFilter='all';
let adventureReturnSummary=null;
function adventureQuestRunHistory(){return window.GKAdventureStorySystem?GKAdventureStorySystem.questRunHistory(data):[];}
function adventureQuestRunById(runId){return adventureQuestRunHistory().find(run=>String(run.quest_run_id)===String(runId))||null;}
function adventurePlaybackViewState(nowMs=Date.now()){
 if(adventurePlaybackHistoryRunId){const run=adventureQuestRunById(adventurePlaybackHistoryRunId);if(run){const start=Date.parse(run.playback_started_at||''),duration=Math.max(1,Number(run.adventure_duration_seconds)||300),historyNow=Number.isFinite(start)?Math.max(nowMs,start+duration*1000):nowMs+duration*1000;const playback=GKAdventureStorySystem.playbackState(run,historyNow);return{run,playback,history:true};}adventurePlaybackHistoryRunId='';}
 const state=resumeAdventurePlayback(nowMs);return state?{...state,history:false}:null;
}
function adventureQuestRunStatus(run,nowMs=Date.now()){
 if(!run)return'';if(run.results_applied)return run.final_result?.success===false?'失敗・帰還済み':'成功・帰還済み';
 const active=String(data.adventure?.active_quest_run_id||'')===String(run.quest_run_id);if(active){const p=GKAdventureStorySystem.playbackState(run,nowMs);return p.complete?'帰還待ち':'進行中';}
 return run.final_result?.success===false?'失敗':'完了';
}
function renderAdventureHistory(){
 const list=$('adventureHistoryList'),resume=$('adventureResume'),filter=$('adventureHistoryFilter'),count=$('adventureHistoryCount');if(!list)return;const history=adventureQuestRunHistory(),active=currentAdventureQuestRun();
 if(filter){filter.value=adventureHistoryFilter;filter.onchange=()=>{adventureHistoryFilter=filter.value||'all';renderAdventureHistory();};}
 if(resume){resume.classList.toggle('hidden',!active);resume.textContent=active?(resumeAdventurePlayback()?.playback.complete?'帰還待ちの冒険へ戻る':'進行中の冒険へ戻る'):'進行中の冒険へ戻る';resume.onclick=()=>active&&openAdventurePlayback(active);}
 const filtered=history.filter(run=>{if(adventureHistoryFilter==='all')return true;const status=adventureQuestRunStatus(run);if(adventureHistoryFilter==='active')return status==='進行中'||status==='帰還待ち';if(adventureHistoryFilter==='success')return run.final_result?.success!==false&&(run.results_applied||status==='完了');if(adventureHistoryFilter==='failure')return run.final_result?.success===false;return true;});
 if(count)count.textContent=`${filtered.length} / ${history.length}件`;
 if(!history.length){list.innerHTML='<div class="adventure-history-empty small">冒険履歴はまだありません。</div>';return;}
 if(!filtered.length){list.innerHTML='<div class="adventure-history-empty small">条件に一致する冒険履歴はありません。</div>';return;}
 list.innerHTML=filtered.slice(0,12).map(run=>{const isActive=active?.quest_run_id===run.quest_run_id,status=adventureQuestRunStatus(run),started=String(run.playback_started_at||'').slice(0,16).replace('T',' '),resultLabel=run.final_result?.success===false?'失敗':'成功';return`<div class="adventure-history-row ${isActive?'active':''}"><div><b>${escapeHtml(run.quest_id||'Quest')}</b> <span class="tag">${escapeHtml(status)}</span><div class="small">${escapeHtml(started)} ／ ${Number(run.adventure_duration_seconds||300)}秒 ／ ${escapeHtml(resultLabel)}</div></div><div class="adventure-history-actions">${isActive?`<button type="button" class="primary" data-adventure-resume="${escapeHtml(run.quest_run_id)}">戻る</button>`:`<button type="button" data-adventure-history="${escapeHtml(run.quest_run_id)}">履歴を見る</button>`}</div></div>`}).join('');
 list.querySelectorAll('[data-adventure-resume]').forEach(btn=>btn.onclick=()=>{const run=adventureQuestRunById(btn.dataset.adventureResume);if(run)openAdventurePlayback(run);});
 list.querySelectorAll('[data-adventure-history]').forEach(btn=>btn.onclick=()=>{const run=adventureQuestRunById(btn.dataset.adventureHistory);if(run)openAdventurePlayback(run,{history:true});});
}

function adventurePlaybackEntry(run,item){
 const type=String(item?.type||'');
 if(type==='scene'){const scene=run.scene_snapshots?.[Number(item.result_index)];return{kind:'scene',title:'ストーリーイベントが発生した',detail:scene||null};}
 if(type==='event'||type==='random_event'){
  const ev=run.event_results?.[Number(item.result_index)];
  if(ev?.type==='battle'&&Number.isInteger(Number(item.battle_result_index)))return{kind:'battle',title:'戦闘イベントが発生した',detail:run.battle_results?.[Number(item.battle_result_index)]||null};
  return{kind:'event',title:'イベントが発生した',detail:ev||null};
 }
 if(type==='random_battle')return{kind:'battle',title:'戦闘が発生した',detail:run.battle_results?.[Number(item.result_index)]||null};
 return{kind:'event',title:'冒険イベントが発生した',detail:null};
}
function adventurePlaybackEventText(event,unitNames={}){
 const type=String(event?.type||'event'),p=event?.payload&&typeof event.payload==='object'?event.payload:event;
 const unitLabel=(id,fallback='')=>String(unitNames?.[String(id||'')]||fallback||id||'');
 const actor=unitLabel(p.source_id,p.actor_name||p.actor||p.source_name||p.source||''),target=unitLabel(p.target_id,p.target_name||p.target||'');
 const skill=p.skill_name||p.skill||'',status=p.status_name||p.status||p.status_id||'',value=Number(p.value??p.amount??p.damage??p.applied??0)||0,hpAfter=Number.isFinite(Number(p.hp_after))?Number(p.hp_after):null;
 if(type==='battle_start')return'戦闘開始';if(type==='battle_end')return`戦闘終了${p.result?'：'+p.result:''}`;
 if(type==='action_start')return`${actor||'ユニット'} 行動開始`;if(type==='skill_cast')return`${actor||'ユニット'}${skill?'：'+skill:' がスキルを使用'}`;
 if(type==='damage')return`${target||'対象'}に${value}ダメージ${hpAfter===null?'':`（残HP ${hpAfter}）`}`;if(type==='heal')return`${target||'対象'}を${value}回復${hpAfter===null?'':`（残HP ${hpAfter}）`}`;
 if(type==='status_apply')return`${target||'対象'}に状態付与${status?'：'+status:''}`;if(type==='status_remove')return`${target||'対象'}の状態解除${status?'：'+status:''}`;if(type==='ko')return`${target||actor||'ユニット'}が戦闘不能`;
 if(type==='hit')return`${actor||'攻撃'} → ${target||'対象'} 命中`;return type;
}
function adventurePlaybackEventMeta(event){const tick=Number(event?.at_tick);return`${Number.isFinite(tick)?`TICK ${tick}`:'TICK -'} ／ ${String(event?.type||'event')}`;}
function restoreAdventurePlaybackDetailPosition(){const detail=$('adventurePlaybackDetail'),log=$('adventurePlaybackLog');if(detail&&log&&log.contains(detail))log.insertAdjacentElement('afterend',detail);}
function placeAdventurePlaybackDetail(itemIndex,{scroll=false}={}){const detail=$('adventurePlaybackDetail'),log=$('adventurePlaybackLog'),index=Number(itemIndex);if(!detail||!log||!Number.isInteger(index))return false;const row=log.querySelector(`[data-adventure-entry-index="${index}"]`);if(!row)return false;row.insertAdjacentElement('afterend',detail);if(scroll)requestAnimationFrame(()=>detail.scrollIntoView({block:'nearest',behavior:'smooth'}));return true;}
function closeAdventurePlaybackDetail(){stopAdventureBattleDetailPlayback();adventurePlaybackDetailItemIndex=null;const detail=$('adventurePlaybackDetail');if(detail){detail.classList.add('hidden');detail.innerHTML='';}restoreAdventurePlaybackDetailPosition();}
let adventureBattleDetailTimer=0;
function stopAdventureBattleDetailPlayback(){if(adventureBattleDetailTimer){clearInterval(adventureBattleDetailTimer);adventureBattleDetailTimer=0;}}
function mountAdventureBattleDetailPlayback(detail,battleResult){
 stopAdventureBattleDetailPlayback();const events=Array.isArray(battleResult?.playback_events)?battleResult.playback_events:[],units=Array.isArray(battleResult?.unit_final_state)?battleResult.unit_final_state:[],unitNames=Object.fromEntries(units.map(u=>[String(u.id||''),String(u.name||u.id||'')]));let cursor=events.length?0:-1;
 const draw=()=>{const current=detail.querySelector('[data-adventure-battle-current]'),history=detail.querySelector('[data-adventure-battle-events]'),counter=detail.querySelector('[data-adventure-battle-counter]'),play=detail.querySelector('[data-adventure-battle-play]');if(!current||!history)return;const e=events[cursor];current.innerHTML=e?`<div class="small">${escapeHtml(adventurePlaybackEventMeta(e))}</div><div>${escapeHtml(adventurePlaybackEventText(e,unitNames))}</div>`:'再生イベントはありません。';history.innerHTML=cursor>=0?events.slice(0,cursor+1).map((row,i)=>`<div class="adventure-battle-event ${i===cursor?'current':''}"><span>${i+1}</span><span class="small">${escapeHtml(Number.isFinite(Number(row?.at_tick))?`T${Number(row.at_tick)}`:'T-')}</span><span>${escapeHtml(adventurePlaybackEventText(row,unitNames))}</span></div>`).join(''):'<div class="small">再生イベントはありません。</div>';if(counter)counter.textContent=events.length?`${cursor+1} / ${events.length}`:'0 / 0';detail.querySelector('[data-adventure-battle-prev]')?.toggleAttribute('disabled',cursor<=0);detail.querySelector('[data-adventure-battle-next]')?.toggleAttribute('disabled',cursor<0||cursor>=events.length-1);if(play)play.textContent=adventureBattleDetailTimer?'一時停止':'再生';history.querySelector('.current')?.scrollIntoView({block:'nearest'});};
 const step=delta=>{if(!events.length)return;cursor=Math.max(0,Math.min(events.length-1,cursor+delta));draw();};
 detail.querySelector('[data-adventure-battle-first]')?.addEventListener('click',()=>{stopAdventureBattleDetailPlayback();cursor=events.length?0:-1;draw();});detail.querySelector('[data-adventure-battle-prev]')?.addEventListener('click',()=>{stopAdventureBattleDetailPlayback();step(-1);});detail.querySelector('[data-adventure-battle-next]')?.addEventListener('click',()=>{stopAdventureBattleDetailPlayback();step(1);});detail.querySelector('[data-adventure-battle-last]')?.addEventListener('click',()=>{stopAdventureBattleDetailPlayback();cursor=events.length?events.length-1:-1;draw();});detail.querySelector('[data-adventure-battle-play]')?.addEventListener('click',()=>{if(adventureBattleDetailTimer){stopAdventureBattleDetailPlayback();draw();return;}if(!events.length)return;if(cursor>=events.length-1)cursor=0;adventureBattleDetailTimer=setInterval(()=>{if(cursor>=events.length-1){stopAdventureBattleDetailPlayback();draw();return;}cursor++;draw();},700);draw();});draw();
}
function renderAdventurePlaybackDetail(run,itemIndex){
 stopAdventureBattleDetailPlayback();const detail=$('adventurePlaybackDetail');if(!detail)return;const index=Number(itemIndex),item=run.timeline_result?.[index];if(!item){adventurePlaybackDetailItemIndex=null;detail.classList.add('hidden');detail.innerHTML='';restoreAdventurePlaybackDetailPosition();return;}
 adventurePlaybackDetailItemIndex=index;const view=adventurePlaybackEntry(run,item);let body='';
 if(view.kind==='scene'){
  const scene=view.detail||{},dialogues=Array.isArray(scene.dialogues)?scene.dialogues:[];
  body=`<div class="adventure-detail-head"><div><b>ストーリーイベント</b><div class="small">保存済み Scene Snapshot ／ ${escapeHtml(scene.scene_id||item.ref_id||'')}</div></div><button type="button" data-adventure-detail-close>閉じる</button></div><div class="adventure-scene-dialogues">${dialogues.length?dialogues.map(d=>`<div class="adventure-scene-line"><b>${escapeHtml(d.speaker||d.character_name||'')}</b><div>${escapeHtml(d.text||d.body||'')}</div></div>`).join(''):'<div class="small">会話Snapshotはありません。</div>'}</div>`;
 }else if(view.kind==='battle'){
  const br=view.detail||{},events=Array.isArray(br.playback_events)?br.playback_events:[],stats=br.statistics||{},units=Array.isArray(br.unit_final_state)?br.unit_final_state:[];
  const enemies=units.filter(u=>String(u?.side||'')==='敵'),enemyCounts=new Map();for(const u of enemies){const name=String(u?.name||u?.monster_id||u?.id||'敵');enemyCounts.set(name,(enemyCounts.get(name)||0)+1);}const enemySummary=[...enemyCounts.entries()].map(([name,count])=>`${escapeHtml(name)} ×${count}`).join(' ／ ');
  body=`<div class="adventure-detail-head"><div><b>戦闘結果</b><div class="small">保存済みBattle Result / Playback Eventsのみを再生</div></div><button type="button" data-adventure-detail-close>閉じる</button></div><div class="adventure-battle-summary"><div class="adventure-battle-stat"><b>結果</b><div>${br.victory===false?'敗北':'勝利'}</div></div><div class="adventure-battle-stat"><b>行動数</b><div>${Number(stats.actions)||0}</div></div><div class="adventure-battle-stat"><b>味方与ダメージ</b><div>${Number(stats.ally_damage)||0}</div></div><div class="adventure-battle-stat"><b>敵与ダメージ</b><div>${Number(stats.enemy_damage)||0}</div></div></div>${enemySummary?`<div class="small"><b>出現モンスター</b>：${enemySummary}</div>`:''}<div class="small"><b>戦闘報酬</b>：${escapeHtml(adventureRewardDetail(br.reward))}</div>${units.length?`<div class="small">最終状態：${units.map(u=>`${escapeHtml(u.name||u.id||'unit')} HP ${Number(u.hp)||0}/${Number(u.max_hp)||0}`).join(' ／ ')}</div>`:''}<div class="adventure-battle-playback"><div class="adventure-battle-current" data-adventure-battle-current></div><div class="adventure-battle-controls"><button type="button" data-adventure-battle-first>最初</button><button type="button" data-adventure-battle-prev>前</button><button type="button" class="primary" data-adventure-battle-play>再生</button><button type="button" data-adventure-battle-next>次</button><button type="button" data-adventure-battle-last>最後</button><span class="small" data-adventure-battle-counter></span></div><div class="adventure-detail-events" data-adventure-battle-events></div></div>`;
 }else{
  const ev=view.detail||{};body=`<div class="adventure-detail-head"><div><b>イベント結果</b><div class="small">保存済み Event Result ／ ${escapeHtml(ev.event_id||item.resolved_ref_id||item.ref_id||'')}</div></div><button type="button" data-adventure-detail-close>閉じる</button></div><p>${ev.success===false?'失敗':'完了'}</p><div class="small"><b>イベント報酬</b>：${escapeHtml(adventureRewardDetail(ev.reward))}</div>`;
 }
 detail.innerHTML=body;detail.classList.remove('hidden');placeAdventurePlaybackDetail(index,{scroll:true});if(view.kind==='battle')mountAdventureBattleDetailPlayback(detail,view.detail||{});detail.querySelector('[data-adventure-detail-close]')?.addEventListener('click',closeAdventurePlaybackDetail);
}
function renderAdventurePlayback(nowMs=Date.now()){
 const panel=$('adventurePlaybackPanel');if(!panel)return null;const state=adventurePlaybackViewState(nowMs);
 if(!state){panel.classList.add('hidden');return null;}
 const {run,playback,history}=state;panel.classList.remove('hidden');
 if($('eventTitle'))$('eventTitle').textContent=adventureQuestRunTitle(run);
 const elapsed=Math.min(playback.elapsed_seconds,playback.duration_seconds),pct=Math.max(0,Math.min(100,(elapsed/playback.duration_seconds)*100));
 if($('adventurePlaybackClock'))$('adventurePlaybackClock').textContent=history?`履歴 ／ ${playback.duration_seconds.toFixed(0)}秒`:`${elapsed.toFixed(0)} / ${playback.duration_seconds.toFixed(0)}秒${playback.complete?' ／ 帰還可能':''}`;
 if($('adventurePlaybackProgress'))$('adventurePlaybackProgress').style.width=`${pct}%`;
 if($('eventNotice'))$('eventNotice').textContent=history?'保存済みQuestRunの履歴を表示しています。再抽選・再戦闘は行いません。':playback.complete?(run.final_result?.success?'冒険が完了しました。保存済み結果を確定して帰還できます。':'冒険は失敗しました。帰還すると今回の報酬は反映されません。'):'冒険は開始時刻基準で進行中です。別画面を見ていても時間は進みます。';
 const log=$('adventurePlaybackLog');if(log){const visible=playback.visible_timeline||[];restoreAdventurePlaybackDetailPosition();log.innerHTML=visible.length?visible.map((item,i)=>{const actualIndex=(run.timeline_result||[]).indexOf(item),view=adventurePlaybackEntry(run,item),current=!history&&i===visible.length-1&&!playback.complete;return`<div class="adventure-log-entry ${current?'current':''}" data-adventure-entry-index="${actualIndex}" ${current?'aria-current="step"':''}><span class="time">${Number(item.at_seconds||0).toFixed(0)}s</span><span>${escapeHtml(view.title)}${current?' <span class="now">現在</span>':''}</span><button type="button" data-adventure-detail="${actualIndex}">見る</button></div>`}).join(''):'<div class="small">まだ表示可能な冒険ログはありません。</div>';log.querySelectorAll('[data-adventure-detail]').forEach(btn=>btn.onclick=()=>renderAdventurePlaybackDetail(run,btn.dataset.adventureDetail));const detail=$('adventurePlaybackDetail');if(adventurePlaybackDetailItemIndex!=null&&detail&&!detail.classList.contains('hidden'))placeAdventurePlaybackDetail(adventurePlaybackDetailItemIndex);if(!history&&visible.length>adventurePlaybackLastVisibleCount){adventurePlaybackLastVisibleCount=visible.length;requestAnimationFrame(()=>log.querySelector('.adventure-log-entry.current')?.scrollIntoView({block:'nearest',behavior:'smooth'}));}}
 const ret=$('adventureReturn');if(ret){ret.disabled=history?false:!playback.complete;ret.textContent=history?'履歴を閉じる':(playback.complete?'帰還して結果を確定':'冒険進行中');}
 return state;
}
function adventureQuestRunTitle(run){const stored=String(run?.quest_name||'').trim();if(stored)return stored;const formal=formalAdventureQuests().find(x=>String(x.id)===String(run?.quest_id));return String(formal?.name||run?.quest_id||'冒険');}
function openAdventurePlayback(run,{history=false}={}){
 adventureReturnSummary=null;closeAdventurePlaybackDetail();const resultPanel=$('adventureReturnResult'),returnButton=$('adventureReturn');if(resultPanel){resultPanel.classList.add('hidden');resultPanel.innerHTML='';}if(returnButton)returnButton.classList.remove('hidden');
 adventurePlaybackHistoryRunId=history?String(run?.quest_run_id||''):'';adventurePlaybackLastVisibleCount=0;$('eventTitle').textContent=adventureQuestRunTitle(run);$('eventBody').textContent=history?'保存済みQuestRunの冒険履歴です。':'Quest開始時に確定したQuestRunを再生しています。';setPhase('event');ensureAdventurePlaybackTicker();renderAdventurePlayback();if(history)renderAdventureReturnResult(adventureQuestRunSummary(run),{history:true});
}
function adventureRewardDetail(reward){const r=reward&&typeof reward==='object'?reward:{},parts=[];if(Number(r.gold))parts.push(`Gold ${Number(r.gold)}`);for(const row of (Array.isArray(r.resources)?r.resources:[])){const id=String(row?.resource_id||'素材'),count=Math.max(0,Number(row?.count)||0);if(count)parts.push(`${id} ×${count}`);}if(Array.isArray(r.items)&&r.items.length)parts.push(`装備/Item ${r.items.length}件`);return parts.length?parts.join(' ／ '):'なし';}
function adventureRewardSummary(reward){const r=reward&&typeof reward==='object'?reward:{},parts=[];if(Number(r.gold))parts.push(`Gold ${Number(r.gold)}`);if(Array.isArray(r.items)&&r.items.length)parts.push(`装備/Item ${r.items.length}件`);if(Array.isArray(r.resources)&&r.resources.length)parts.push(`素材/石板 ${r.resources.reduce((n,x)=>n+Math.max(0,Number(x?.count)||0),0)}個`);return parts.length?parts.join(' ／ '):'なし';}
function adventureStartCostDetail(startCost){const cost=startCost?.cost&&typeof startCost.cost==='object'?startCost.cost:{},parts=[];if(Number(cost.gold))parts.push(`Gold ${Number(cost.gold)}`);for(const[id,countRaw]of Object.entries(cost.resources&&typeof cost.resources==='object'?cost.resources:{})){const count=Math.max(0,Number(countRaw)||0);if(count)parts.push(`${id} ×${count}`);}return parts.length?parts.join(' ／ '):'なし';}
function adventureStoneSelectionDetail(startCost,difficulty){const selected=Array.isArray(startCost?.selected_stones)&&startCost.selected_stones.length?startCost.selected_stones:Array.isArray(difficulty?.stones)?difficulty.stones:[];const parts=selected.map(row=>{const id=String(row?.stone_id||'').trim(),count=Math.max(0,Number(row?.count)||0);return id&&count?`${id} ×${count}`:'';}).filter(Boolean);return parts.length?parts.join(' ／ '):'なし';}
function adventureFlagDetail(flags){const rows=flags&&typeof flags==='object'?Object.entries(flags):[];return rows.length?rows.map(([id,value])=>`${id}=${String(value)}`).join(' ／ '):'なし';}
function adventureQuestRunSummary(run){return{run_id:String(run?.quest_run_id||''),quest_id:String(run?.quest_id||''),quest_name:adventureQuestRunTitle(run),success:run?.final_result?.success!==false,reward:clone(run?.reward_result||{}),flags:clone(run?.flag_result||{}),progress:clone(run?.quest_progress_result||{}),start_cost:clone(run?.start_cost_result||{}),difficulty:clone(run?.difficulty_snapshot||{}),results_applied:Boolean(run?.results_applied)};}
function renderAdventureReturnResult(summary,{history=false}={}){closeAdventurePlaybackDetail();const panel=$('adventureReturnResult'),ret=$('adventureReturn');if(!panel)return;const progress=summary?.progress&&typeof summary.progress==='object'?summary.progress:{},completeQuestId=String(progress.complete_quest_id||''),unlockCount=Array.isArray(progress.unlock_quest_ids)?progress.unlock_quest_ids.filter(Boolean).length:0,difficulty=summary?.difficulty&&typeof summary.difficulty==='object'?summary.difficulty:{},effectiveBudget=Number(difficulty.effective_enemy_budget),budgetText=Number.isFinite(effectiveBudget)?String(effectiveBudget):'記録なし',saveStatus=summary?.results_applied?'反映済み':'未反映';const note=history?'保存済みQuestRunの総合結果です。再計算・再抽選・再Commitは行いません。':'QuestRunに保存済みの結果を正式Saveへ反映しました。再計算はしていません。';panel.innerHTML=`<b>${history?'総合結果 ／ ':''}${summary?.success===false?'冒険失敗':'冒険成功'}</b><div class="small">${note}</div><div class="adventure-result-grid"><div class="adventure-result-item"><b>報酬</b><div>${escapeHtml(summary?.success===false?'失敗のため報酬なし':adventureRewardDetail(summary?.reward))}</div></div><div class="adventure-result-item"><b>Flag更新</b><div>${escapeHtml(adventureFlagDetail(summary?.flags))}</div></div><div class="adventure-result-item"><b>Quest進行</b><div>${escapeHtml(summary?.success===false?'完了なし':(completeQuestId?`完了 ${completeQuestId}${unlockCount?` ／ 解放 ${unlockCount}件`:''}`:'変更なし'))}</div></div><div class="adventure-result-item"><b>QuestRun</b><div class="small">${escapeHtml(summary?.run_id||'')}</div></div><div class="adventure-result-item"><b>正式Save</b><div>${escapeHtml(saveStatus)}</div></div><div class="adventure-result-item"><b>開始コスト</b><div>${escapeHtml(adventureStartCostDetail(summary?.start_cost))}</div></div><div class="adventure-result-item"><b>使用石板</b><div>${escapeHtml(adventureStoneSelectionDetail(summary?.start_cost,difficulty))}</div></div><div class="adventure-result-item"><b>最終Enemy Budget</b><div>${escapeHtml(budgetText)}</div></div></div>${history?'':`<button type="button" class="primary" id="adventureReturnHome">拠点へ戻る</button>`}`;panel.classList.remove('hidden');if(history){if(ret)ret.classList.remove('hidden');return;}if(ret)ret.classList.add('hidden');$('adventureReturnHome').onclick=()=>{adventureReturnSummary=null;panel.classList.add('hidden');if(ret)ret.classList.remove('hidden');setPhase('base');setBaseView('home',{instant:true});render();};}

function returnFromAdventurePlayback(){
 if(adventurePlaybackHistoryRunId){adventurePlaybackHistoryRunId='';adventurePlaybackLastVisibleCount=0;setPhase('base');setBaseView('quest',{instant:true});renderExpeditionSetup();return;}
 const current=currentAdventureQuestRun();if(!current)return;const state=resumeAdventurePlayback();if(!state?.playback.complete)return;
 const summary=adventureQuestRunSummary(current);
 const result=commitAdventureQuestRun(current.quest_run_id);if(!result.applied){$('eventNotice').textContent=`帰還処理に失敗しました：${result.reason||'unknown'}`;return;}summary.results_applied=true;
 adventureReturnSummary=summary;renderGuildSummary();renderAdventureHistory();if($('eventNotice'))$('eventNotice').textContent=summary.success?'冒険結果を反映しました。帰還結果を確認してください。':'冒険失敗。確定済み仕様により報酬は反映されません。';renderAdventureReturnResult(summary);notify(summary.success?'冒険結果を反映しました。':'冒険失敗。報酬なしで帰還します。',summary.success?'ok':'warn');
}
let adventurePlaybackTimer=0;
function ensureAdventurePlaybackTicker(){if(adventurePlaybackTimer)return;adventurePlaybackTimer=setInterval(()=>{if(currentAdventureQuestRun()){if(currentPhase==='event')renderAdventurePlayback();else if(currentPhase==='base'){renderGuildSummary();const qs=$('questSummary');if(qs&&typeof renderExpeditionSetup==='function')renderExpeditionSetup();}}},1000);}


const ADVENTURE_EXPORT_FILES={manifest:'../Export/manifest.json',quests:['../Export/quest/main_quests.json','../Export/quest/sub_quests.json','../Export/quest/event_quests.json'],chapters:'../Export/scenario/chapters.json',sections:'../Export/scenario/sections.json',scenes:'../Export/scenario/scenes.json',events:'../Export/event/events.json',flags:'../Export/event/flags.json',monsters:'../Export/monster/monsters.json',tablets:'../Export/stone/stones.json',maps:'../Export/world/maps.json',explorationOutcomes:'../Export/exploration/outcomes.json',adventureSettings:'../Export/system/adventure_settings.json',dropTables:'../Export/system/drop_tables.json'};
const ADVENTURE_EXPORT_TIMEOUT_MS=15000;
let adventureContentCache=null;
async function fetchAdventureResponse(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ADVENTURE_EXPORT_TIMEOUT_MS);try{return await fetch(url,{cache:'no-store',signal:controller.signal});}catch(cause){const error=new Error(`Adventure Export network failed: ${url}`);error.code='EXPORT_NETWORK_FAILED';error.files=[url];error.detail=cause?.name==='AbortError'?`timeout ${ADVENTURE_EXPORT_TIMEOUT_MS}ms`:String(cause?.message||'network failed');throw error;}finally{clearTimeout(timer);}}
async function fetchAdventureExport(url){const res=await fetchAdventureResponse(url);if(!res.ok){const error=new Error(`Adventure Export load failed: ${url} (${res.status})`);error.code='EXPORT_STORY_JSON_LOAD_FAILED';error.files=[url];error.detail=`HTTP ${res.status}`;throw error;}let json;try{json=await res.json();}catch(cause){const error=new Error(`Adventure Export JSON parse failed: ${url}`);error.code='EXPORT_STORY_JSON_LOAD_FAILED';error.files=[url];error.detail=String(cause?.message||'JSON parse failed');throw error;}return{url,data:Array.isArray(json?.data)?json.data:[],data_version:String(json?.data_version||'')};}
async function fetchAdventureManifest(){const res=await fetchAdventureResponse(ADVENTURE_EXPORT_FILES.manifest);if(!res.ok){const error=new Error(`Adventure Export manifest load failed (${res.status})`);error.code='EXPORT_MANIFEST_LOAD_FAILED';error.files=[ADVENTURE_EXPORT_FILES.manifest];error.detail=`HTTP ${res.status}`;throw error;}try{return await res.json();}catch(cause){const error=new Error('Adventure Export manifest JSON parse failed');error.code='EXPORT_MANIFEST_LOAD_FAILED';error.files=[ADVENTURE_EXPORT_FILES.manifest];error.detail=String(cause?.message||'JSON parse failed');throw error;}}
function assertAdventureExportVersionConsistency(manifest,documents){const expected=String(manifest?.data_version||'');const mismatches=(documents||[]).filter(doc=>expected&&doc.data_version!==expected);if(mismatches.length){const error=new Error(`Adventure Export data_version mismatch: ${mismatches.map(x=>x.url).join(', ')}`);error.code='EXPORT_VERSION_MISMATCH';error.files=mismatches.map(x=>x.url);error.detail=`expected ${expected}; ${mismatches.map(x=>`${x.url}=${x.data_version||'missing'}`).join(', ')}`;throw error;}return true;}
async function loadAdventureContent({force=false}={}){if(adventureContentCache&&!force)return adventureContentCache;const questDocs=await Promise.all(ADVENTURE_EXPORT_FILES.quests.map(fetchAdventureExport));const [chapters,sections,scenes,events,flags,monsters,tablets,maps,explorationOutcomes,adventureSettings,dropTables,manifest]=await Promise.all([... [ADVENTURE_EXPORT_FILES.chapters,ADVENTURE_EXPORT_FILES.sections,ADVENTURE_EXPORT_FILES.scenes,ADVENTURE_EXPORT_FILES.events,ADVENTURE_EXPORT_FILES.flags,ADVENTURE_EXPORT_FILES.monsters,ADVENTURE_EXPORT_FILES.tablets,ADVENTURE_EXPORT_FILES.maps,ADVENTURE_EXPORT_FILES.explorationOutcomes,ADVENTURE_EXPORT_FILES.adventureSettings,ADVENTURE_EXPORT_FILES.dropTables].map(fetchAdventureExport),fetchAdventureManifest()]);const documents=[...questDocs,chapters,sections,scenes,events,flags,monsters,tablets,maps,explorationOutcomes,adventureSettings,dropTables];assertAdventureExportVersionConsistency(manifest,documents);adventureContentCache={quests:questDocs.flatMap(x=>x.data),chapters:chapters.data,sections:sections.data,scenes:scenes.data,events:events.data,flags:flags.data,monsters:monsters.data,tablets:tablets.data,maps:maps.data,explorationOutcomes:explorationOutcomes.data,adventureSettings:adventureSettings.data,dropTables:dropTables.data,manifest};return adventureContentCache;}
let adventureQuestCatalog=[];
let adventureStoryLoadState={status:'loading',loading_started_at:'',loaded_at:'',failed_at:'',load_elapsed_ms:0,quest_count:0,excluded_count:0,data_version:'',generated_at:'',error_code:'',error_files:[],error_detail:''};
let adventureQuestImportIssues=[];
function adventureEventUsages(event){const raw=event?.usage;if(Array.isArray(raw))return raw.map(String);const one=String(raw||'').trim();return one?[one]:[];}
function adventureRandomStaticCandidates(content,placement){const filter=placement?.filter&&typeof placement.filter==='object'?placement.filter:{},type=String(filter.event_type||''),group=String(filter.group||''),tags=(Array.isArray(filter.tags)?filter.tags:[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean);return(content?.events||[]).filter(event=>{if(event?.enabled===false||!adventureEventUsages(event).includes('random'))return false;if(type&&String(event?.type||'')!==type)return false;if(group&&String(event?.group||'')!==group)return false;const eventTags=new Set((Array.isArray(event?.tags)?event.tags:[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean));if(tags.some(tag=>!eventTags.has(tag)))return false;return Number(event?.random_base_weight??1)>0;});}
function adventureBattleResolverAvailable(){return typeof window.GKAdventureEncounterResolver?.resolveEncounter==='function';}
function adventureExplorationResolverAvailable(){return typeof window.GKAdventureEncounterResolver?.resolveExploration==='function';}
function adventureP7EventRuntimeSupported(event){const type=String(event?.type||'');if(type==='battle')return adventureBattleResolverAvailable();if(type==='exploration')return adventureExplorationResolverAvailable();return true;}
function adventureQuestEnvironmentNeeds(content,quest){
 const eventById=new Map((content?.events||[]).map(e=>[String(e?.id||''),e])),types=new Set();
 for(const box of (Array.isArray(quest?.boxes)?quest.boxes:[]))for(const zoneKey of ['event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post'])for(const placement of (Array.isArray(box?.[zoneKey])?box[zoneKey]:[])){
  if(placement?.kind==='fixed_event'){const e=eventById.get(String(placement?.event_id||''));if(e&&['battle','exploration'].includes(String(e.type||'')))types.add(String(e.type));}
  if(placement?.kind==='random_event')for(const e of adventureRandomStaticCandidates(content,placement))if(['battle','exploration'].includes(String(e.type||'')))types.add(String(e.type));
 }
 return [...types];
}
function validateAdventureEncounterOverride(content,quest){
 const eventById=new Map((content?.events||[]).map(e=>[String(e?.id||''),e])),monsterIds=new Set((content?.monsters||[]).map(m=>String(m?.id||'')));
 for(const box of (Array.isArray(quest?.boxes)?quest.boxes:[]))for(const zoneKey of ['event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post'])for(const placement of (Array.isArray(box?.[zoneKey])?box[zoneKey]:[])){
  if(placement?.kind==='random_event'&&placement?.encounter_override)return{ready:false,quest_id:String(quest?.id||''),box_id:String(box?.box_id||''),code:'FORMAL_QUEST_RANDOM_OVERRIDE_INVALID'};
  if(placement?.kind!=='fixed_event'||!placement?.encounter_override)continue;const e=eventById.get(String(placement?.event_id||''));if(String(e?.type||'')!=='battle')return{ready:false,quest_id:String(quest?.id||''),box_id:String(box?.box_id||''),code:'FORMAL_QUEST_OVERRIDE_NON_BATTLE'};
  const o=placement.encounter_override,mode=String(o.mode||'resolver');if(!['resolver','required_monsters','fixed_formation'].includes(mode))return{ready:false,quest_id:String(quest?.id||''),box_id:String(box?.box_id||''),code:'FORMAL_QUEST_OVERRIDE_MODE_INVALID'};
  const rows=mode==='required_monsters'?o.required_monsters:mode==='fixed_formation'?o.formation:[];if(mode!=='resolver'&&(!Array.isArray(rows)||!rows.length))return{ready:false,quest_id:String(quest?.id||''),box_id:String(box?.box_id||''),code:'FORMAL_QUEST_OVERRIDE_FORMATION_EMPTY'};for(const row of rows||[])if(!monsterIds.has(String(row?.monster_id||'')))return{ready:false,quest_id:String(quest?.id||''),box_id:String(box?.box_id||''),event_id:String(placement?.event_id||''),code:'FORMAL_QUEST_OVERRIDE_MONSTER_MISSING'};
 }
 return{ready:true};
}
function assessAdventureQuestImport(content,quest){
 const id=String(quest?.id||''),boxes=Array.isArray(quest?.boxes)?quest.boxes:[];
 if(!id)return{ready:false,quest_id:id,code:'FORMAL_QUEST_ID_MISSING'};
 const duration=Number(quest?.adventure_duration_seconds);if(!Number.isFinite(duration)||duration<1)return{ready:false,quest_id:id,code:'FORMAL_QUEST_DURATION_INVALID'};
 if(!boxes.length)return{ready:false,quest_id:id,code:'FORMAL_QUEST_BOXES_EMPTY'};
 const environmentNeeds=adventureQuestEnvironmentNeeds(content,quest),mapId=String(quest?.context?.map_id||'');if(environmentNeeds.length&&!mapId)return{ready:false,quest_id:id,code:'FORMAL_QUEST_MAP_REQUIRED',event_types:environmentNeeds};if(mapId&&!(content?.maps||[]).some(m=>String(m?.id||'')===mapId))return{ready:false,quest_id:id,map_id:mapId,code:'FORMAL_QUEST_MAP_MISSING'};const overrideCheck=validateAdventureEncounterOverride(content,quest);if(!overrideCheck.ready)return overrideCheck;
 const sceneIds=new Set((content?.scenes||[]).map(x=>String(x?.id||'')).filter(Boolean)),eventById=new Map((content?.events||[]).map(x=>[String(x?.id||''),x]));
 for(const box of boxes){const boxId=String(box?.box_id||'');for(const key of ['pre_scene_id','mid_scene_id','post_scene_id']){const sceneId=String(box?.[key]||'');if(sceneId&&!sceneIds.has(sceneId))return{ready:false,quest_id:id,box_id:boxId,scene_id:sceneId,code:'FORMAL_QUEST_SCENE_MISSING'};}for(const zoneKey of ['event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post']){for(const placement of Array.isArray(box?.[zoneKey])?box[zoneKey]:[]){const kind=String(placement?.kind||'');if(kind==='random_event'){const candidates=adventureRandomStaticCandidates(content,placement);if(!candidates.length&&(placement?.required===true||placement?.allow_none===false))return{ready:false,quest_id:id,box_id:boxId,code:'FORMAL_QUEST_RANDOM_EVENT_NO_CANDIDATES'};const unsupported=candidates.filter(event=>!adventureP7EventRuntimeSupported(event));if(unsupported.length)return{ready:false,quest_id:id,box_id:boxId,event_id:String(unsupported[0]?.id||''),code:'FORMAL_QUEST_RANDOM_EVENT_RESOLVER_PENDING'};continue;}if(kind!=='fixed_event')return{ready:false,quest_id:id,box_id:boxId,code:'FORMAL_QUEST_PLACEMENT_INVALID'};const eventId=String(placement?.event_id||''),event=eventById.get(eventId);if(!event)return{ready:false,quest_id:id,box_id:boxId,event_id:eventId,code:'FORMAL_QUEST_EVENT_MISSING'};if(!adventureP7EventRuntimeSupported(event))return{ready:false,quest_id:id,box_id:boxId,event_id:eventId,code:'FORMAL_QUEST_EVENT_RESOLVER_PENDING'};}}}
 return{ready:true,quest_id:id};
}
function applyAdventureFlagDefaults(content){
 data.flags=data.flags&&typeof data.flags==='object'&&!Array.isArray(data.flags)?data.flags:{};
 let added=0;
 for(const definition of (Array.isArray(content?.flags)?content.flags:[])){
  const id=String(definition?.id||'').trim();if(!id)continue;
  if(!Object.prototype.hasOwnProperty.call(data.flags,id)){data.flags[id]=Boolean(definition?.default_value);added++;}
 }
 return{added,total:Array.isArray(content?.flags)?content.flags.length:0};
}
function registerAdventureQuestCards(content){const assessments=(content?.quests||[]).map(quest=>({quest,assessment:assessAdventureQuestImport(content,quest)}));adventureQuestImportIssues=assessments.filter(x=>!x.assessment.ready&&x.assessment.quest_id).map(x=>x.assessment);adventureQuestCatalog=assessments.filter(x=>x.assessment.ready).map(({quest:q})=>({id:String(q.id),name:String(q.name||q.id),rank:'Story',stars:1,recommendedLevel:Math.max(1,Math.floor(Number(q.recommended_level)||1)),description:String(q.summary||''),reward:0,bonus:0,enemies:[],drops:[],adventureStory:true}));const loadedAt=new Date().toISOString(),elapsed=adventureStoryLoadElapsedMs(loadedAt);adventureStoryLoadState={status:'loaded',loaded_at:loadedAt,load_elapsed_ms:elapsed,quest_count:adventureQuestCatalog.length,excluded_count:adventureQuestImportIssues.length,data_version:String(content?.manifest?.data_version||''),generated_at:String(content?.manifest?.generated_at||'')};return adventureQuestCatalog;}
function formalAdventureQuests(){return adventureQuestCatalog.slice();}
function formalAdventureQuestImportIssues(){return adventureQuestImportIssues.slice();}
function formalAdventureQuestImportIssueMessage(issue){return({FORMAL_QUEST_ID_MISSING:'Quest IDが未設定',FORMAL_QUEST_DURATION_INVALID:'Quest冒険時間が1秒以上でない',FORMAL_QUEST_BOXES_EMPTY:'Quest Boxが0件',FORMAL_QUEST_SCENE_MISSING:'Quest BoxのScene参照切れ',FORMAL_QUEST_EVENT_MISSING:'Quest BoxのEvent参照切れ',FORMAL_QUEST_PLACEMENT_INVALID:'Event配置種別が不正',FORMAL_QUEST_RANDOM_EVENT_NO_CANDIDATES:'Random Event枠に実行可能候補がなく、何も起きない動作も許可されていません',FORMAL_QUEST_RANDOM_EVENT_RESOLVER_PENDING:'Random Event候補に未対応ResolverのEventがあります',FORMAL_QUEST_EVENT_RESOLVER_PENDING:'Event Resolverが利用できません',FORMAL_QUEST_MAP_REQUIRED:'戦闘/探索Eventを含むQuestにはMap設定が必要です',FORMAL_QUEST_MAP_MISSING:'Questが参照するMapがExportに存在しません',FORMAL_QUEST_RANDOM_OVERRIDE_INVALID:'Random Event枠にStory Battle Overrideは設定できません',FORMAL_QUEST_OVERRIDE_NON_BATTLE:'Battle以外の固定EventにEncounter Overrideが設定されています',FORMAL_QUEST_OVERRIDE_MODE_INVALID:'Encounter Override modeが不正です',FORMAL_QUEST_OVERRIDE_FORMATION_EMPTY:'Story Battle Overrideの敵編成が空です',FORMAL_QUEST_OVERRIDE_MONSTER_MISSING:'Story Battle Overrideが存在しないMonsterを参照しています'})[issue?.code]||'P7-B Runtime要件不整合';}
function formatAdventureExportGeneratedAt(value){const date=new Date(value||'');return Number.isNaN(date.getTime())?'生成日時未設定':`生成 ${date.toLocaleString()}`;}
function adventureStoryLoadErrorCode(error){if(error?.code)return String(error.code);const message=String(error?.message||error||'');if(message.includes('data_version mismatch'))return'EXPORT_VERSION_MISMATCH';if(message.includes('manifest load failed'))return'EXPORT_MANIFEST_LOAD_FAILED';return'EXPORT_STORY_JSON_LOAD_FAILED';}
function adventureStoryLoadElapsedMs(endedAt){const started=Date.parse(adventureStoryLoadState.loading_started_at||''),ended=Date.parse(endedAt||'');return Number.isFinite(started)&&Number.isFinite(ended)?Math.max(0,ended-started):0;}
function setAdventureStoryLoading(){adventureStoryLoadState={...adventureStoryLoadState,status:'loading',loading_started_at:new Date().toISOString()};const status=$('storyDataLoadStatus');if(status)status.textContent=formalAdventureStoryLoadLabel();}
function setAdventureStoryLoadError(error){const failedAt=new Date().toISOString(),elapsed=adventureStoryLoadElapsedMs(failedAt);adventureStoryLoadState={...adventureStoryLoadState,status:'error',failed_at:failedAt,load_elapsed_ms:elapsed,error_code:adventureStoryLoadErrorCode(error),error_files:Array.isArray(error?.files)?error.files.map(String):[],error_detail:String(error?.detail||'')};}
function formalAdventureStoryLoadLabel(){const s=adventureStoryLoadState;if(s.status==='error'){const reason=({EXPORT_VERSION_MISMATCH:'Export世代不一致',EXPORT_MANIFEST_LOAD_FAILED:'manifest読込失敗',EXPORT_STORY_JSON_LOAD_FAILED:'Story JSON読込失敗',EXPORT_NETWORK_FAILED:'Export通信失敗'})[s.error_code]||'原因不明',failed=s.failed_at?new Date(s.failed_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—',elapsed=s.load_elapsed_ms>0?` ／ 所要 ${s.load_elapsed_ms}ms`:'';return`読込失敗：${reason} ／ 失敗時刻 ${failed}${elapsed}${s.error_files?.length?` ／ 対象 ${s.error_files.join(', ')}`:''}${s.error_detail?` ／ 詳細 ${s.error_detail}`:''}`;}if(s.status!=='loaded'){const started=s.loading_started_at?new Date(s.loading_started_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';return started?`再読込中 ／ 開始 ${started}`:'読込中';}const time=s.loaded_at?new Date(s.loaded_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—',version=s.data_version||'未設定',generated=formatAdventureExportGeneratedAt(s.generated_at),elapsed=s.load_elapsed_ms>0?` ／ 所要 ${s.load_elapsed_ms}ms`:'';return`Export ${version} ／ ${generated} ／ 最終読込 ${time}${elapsed} ／ 利用可能 ${s.quest_count}件 ／ 除外 ${s.excluded_count}件`;}
let adventureStoryReloadPromise=null;
function reloadFormalAdventureQuests(){if(adventureStoryReloadPromise)return adventureStoryReloadPromise;const button=$('reloadStoryQuests');if(button)button.disabled=true;setAdventureStoryLoading();adventureStoryReloadPromise=(async()=>{try{const content=await loadAdventureContent({force:true});applyAdventureFlagDefaults(content);registerAdventureQuestCards(content);reconcileFormalAdventureQuestSelection();persist();renderExpeditionSetup();notify(`Storyデータを再読込しました（Quest ${formalAdventureQuests().length}件）。`,'ok');return{ok:true,count:formalAdventureQuests().length,issues:formalAdventureQuestImportIssues()};}catch(error){setAdventureStoryLoadError(error);renderExpeditionSetup();notify('Storyデータの再読込に失敗しました。Export配置を確認してください。','bad');return{ok:false,error};}finally{const current=$('reloadStoryQuests');if(current)current.disabled=false;}})();adventureStoryReloadPromise.then(()=>{adventureStoryReloadPromise=null},()=>{adventureStoryReloadPromise=null});return adventureStoryReloadPromise;}
function reconcileFormalAdventureQuestSelection(){const quests=formalAdventureQuests();if(!quests.length){data.selectedQuestId='';return null}let selected=quests.find(q=>q.id===data.selectedQuestId);if(!selected){selected=quests[0];data.selectedQuestId=selected.id;persist()}return selected;}
function resolveAdventureBundle(content,questId){const quest=(content?.quests||[]).find(q=>String(q.id)===String(questId));if(!quest||!assessAdventureQuestImport(content,quest).ready)return null;return{quest,scenes:content.scenes||[],events:content.events||[],monsters:content.monsters||[],tablets:content.tablets||[],maps:content.maps||[],explorationOutcomes:content.explorationOutcomes||[],adventureSettings:content.adventureSettings||[],dropTables:content.dropTables||[]};}
function adventurePartySnapshot(){return data.partyIds.map(id=>data.characters.find(c=>c.id===id)).filter(Boolean).slice(0,6).map(c=>{const b=equipmentBonus(c);return{character_id:c.id,id:c.id,name:c.name,job:c.job,level:c.level,max_hp:100+c.stats.VIT*20+c.level*10+b.maxHp,attack:10+c.stats.STR*3+c.level*2+b.attack,agi:Math.max(1,c.stats.AGI+b.agi),skills:clone(c.skills||[]),equipped_skill_id:c.equippedSkillId||''};});}
function adventureEventCondition(event,flags){return(event?.required_flags||[]).every(id=>Boolean(flags?.[id]));}
function adventureEventResult({event}){const flags={};for(const id of event?.set_flags||[])flags[id]=true;return{success:true,reward:{},flags};}
function resolveAdventureBattleEncounter({request},bundle){const resolver=window.GKAdventureEncounterResolver?.resolveEncounter;if(typeof resolver!=='function')throw new Error('Adventure Encounter Resolver is not loaded');return resolver({request:clone(request),monster_master:clone(bundle?.monsters||[]),map_master:clone(bundle?.maps||[]),adventure_settings:clone(bundle?.adventureSettings||[])});}
function resolveAdventureExploration({request},bundle){const resolver=window.GKAdventureEncounterResolver?.resolveExploration;if(typeof resolver!=='function')throw new Error('Adventure Exploration Resolver is not loaded');return resolver({request:clone(request),outcome_master:clone(bundle?.explorationOutcomes||[]),map_master:clone(bundle?.maps||[]),adventure_settings:clone(bundle?.adventureSettings||[])});}
function resolveAdventureEventReward(args,bundle){const resolver=window.GKAdventureRewardResolver?.resolveEventReward;if(typeof resolver!=='function')throw new Error('Adventure Reward Resolver is not loaded');return resolver({...clone(args||{}),monsters:clone(bundle?.monsters||[]),drop_tables:clone(bundle?.dropTables||[])});}
function simulateAdventureBattle({formation,seed,encounter_result},bundle,partySnapshot){if(!window.GKGameFormalAdventureBattle?.simulate)throw new Error('Formal Adventure Battle simulation is not loaded');const scaling=encounter_result?.battle_scaling||null,monsterMaster=scaling&&window.GKAdventureEncounterResolver?.applyBattleScaling?GKAdventureEncounterResolver.applyBattleScaling(bundle.monsters,scaling):bundle.monsters;return GKGameFormalAdventureBattle.simulate({party:partySnapshot,formation,monsters:monsterMaster,seed});}
function adventureStoneSelectionMap(){data.adventure=data.adventure&&typeof data.adventure==='object'?data.adventure:{};data.adventure.stone_selection_by_quest=data.adventure.stone_selection_by_quest&&typeof data.adventure.stone_selection_by_quest==='object'?data.adventure.stone_selection_by_quest:{};return data.adventure.stone_selection_by_quest}
function adventureSelectedStones(questId,validTablets=null){const raw=adventureStoneSelectionMap()[String(questId||'')]||{},valid=Array.isArray(validTablets)?new Set(validTablets.map(x=>String(x?.id||'')).filter(Boolean)):null;return Object.entries(raw).map(([stone_id,count])=>({stone_id,count:Math.max(0,Math.floor(Number(count)||0))})).filter(x=>x.count>0&&(!valid||valid.has(String(x.stone_id||''))))}
function setAdventureStoneCount(questId,stoneId,count){const map=adventureStoneSelectionMap(),qid=String(questId||''),id=String(stoneId||'');map[qid]=map[qid]&&typeof map[qid]==='object'?map[qid]:{};const n=Math.max(0,Math.floor(Number(count)||0));if(n)map[qid][id]=n;else delete map[qid][id];persist();renderExpeditionSetup()}
function adventureQuestStartState(quest,bundle={}){const progress=data.quest_progress||{},requirements=GKAdventureStorySystem.questStartRequirements(quest,{completedQuestIds:progress.completed_quest_ids||[],flags:data.flags||{}}),baseCost=GKAdventureStorySystem.normalizeQuestStartCost(quest),selectedStones=adventureSelectedStones(quest?.id,bundle.tablets||[]),stoneCost=GKAdventureStorySystem.stoneResourceCost(selectedStones),cost=GKAdventureStorySystem.mergeQuestStartCosts(baseCost,stoneCost),afford=GKAdventureStorySystem.canAffordQuestStartCost(data,cost),difficulty=GKAdventureStorySystem.resolveAdventureDifficulty({quest,selectedStones,tablets:bundle.tablets||[],adventureSettings:bundle.adventureSettings||[]});return{ok:requirements.ok&&afford.ok,requirements,baseCost,stoneCost,cost,afford,selectedStones,difficulty};}
function adventureQuestStartFailureMessage(result){if(result.reason==='formal_quest_unavailable')return'正式Story Questが選択されていません。StudioからQuestをExportしてください。';if(result.reason==='quest_prerequisite_missing')return`前提クエスト未達成：${(result.missing_prerequisite_ids||[]).join(', ')}`;if(result.reason==='quest_required_flag_missing')return`開始条件Flag不足：${(result.missing_required_flags||[]).join(', ')}`;if(result.reason==='insufficient_start_cost')return'開始コストまたは選択した石板が不足しています。';if(result.reason==='export_load_failed')return'ストーリーデータを読み込めませんでした。';if(result.reason==='simulation_failed_before_cost')return'冒険生成に失敗しました。石板・開始コストは消費していません。';return'冒険を開始できませんでした。';}
async function startSelectedQuestAdventure({forceReload=false}={}){if(!window.GKAdventureStorySystem||!window.GKGameFormalAdventureBattle||!window.GKAdventureRewardResolver)return{started:false,reason:'adventure_runtime_unavailable'};const current=currentAdventureQuestRun();if(current)return{started:false,reason:'active_quest_run',run:current};let content;try{content=await loadAdventureContent({force:forceReload});}catch(error){return{started:false,reason:'export_load_failed',error};}const bundle=resolveAdventureBundle(content,data.selectedQuestId);if(!bundle)return{started:false,reason:'formal_quest_unavailable'};const startState=adventureQuestStartState(bundle.quest,bundle);if(startState.requirements.missing_prerequisite_ids.length)return{started:false,reason:'quest_prerequisite_missing',...startState.requirements};if(startState.requirements.missing_required_flags.length)return{started:false,reason:'quest_required_flag_missing',...startState.requirements};if(!startState.afford.ok)return{started:false,reason:'insufficient_start_cost',...startState.afford};const partySnapshot=adventurePartySnapshot();let run;try{run=GKAdventureStorySystem.simulateQuest({quest:bundle.quest,scenes:bundle.scenes,events:bundle.events,monsters:bundle.monsters,tablets:bundle.tablets,adventureSettings:bundle.adventureSettings,selectedStones:startState.selectedStones,difficultySnapshot:startState.difficulty,rewardScalingSnapshot:startState.difficulty.reward_scaling_snapshot,partySnapshot,flags:clone(data.flags||{}),startCostResult:{consumed:false,pending:true,cost:clone(startState.cost),base_cost:clone(startState.baseCost),stone_cost:clone(startState.stoneCost)},checkEventCondition:adventureEventCondition,resolveEvent:adventureEventResult,resolveBattleEncounter:adventureBattleResolverAvailable()?args=>resolveAdventureBattleEncounter(args,bundle):undefined,resolveExploration:adventureExplorationResolverAvailable()?args=>resolveAdventureExploration(args,bundle):undefined,resolveReward:args=>resolveAdventureEventReward(args,bundle),simulateBattle:args=>simulateAdventureBattle(args,bundle,partySnapshot)});run.quest_name=String(bundle.quest?.name||bundle.quest?.id||'');}catch(error){return{started:false,reason:'simulation_failed_before_cost',error,cost:startState.cost};}const consumed=GKAdventureStorySystem.consumeQuestStartCost(data,startState.cost);if(!consumed.consumed)return{started:false,...consumed};run.start_cost_result={consumed:true,cost:clone(consumed.cost),base_cost:clone(startState.baseCost),stone_cost:clone(startState.stoneCost),selected_stones:clone(startState.selectedStones)};data.adventure=data.adventure||{};data.adventure.last_start_cost={quest_id:String(bundle.quest.id||''),consumed_at:new Date().toISOString(),cost:clone(consumed.cost),stone_cost:clone(startState.stoneCost)};const stored=storeAdventureQuestRun(run);persist();return{started:true,run:stored,bundle};}
async function beginSelectedAdventure(){if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');return}const result=await startSelectedQuestAdventure();if(!result.started){if(result.reason==='active_quest_run'){openAdventurePlayback(result.run);return}notify(adventureQuestStartFailureMessage(result),'bad');return}openAdventurePlayback(result.run);}
function render(){
 const roster=$('roster');$('empty').classList.toggle('hidden',data.characters.length>0);roster.innerHTML=data.characters.map(c=>`<button class="unit adventurer-row ${c.id===selectedId?'selected':''}" data-id="${c.id}"><div><div class="name">${escapeHtml(c.name)}</div><span class="tag">Lv ${c.level}</span><span class="tag">${c.job}</span></div><span class="adventurer-arrow">›</span></button>`).join('');
 roster.querySelectorAll('.unit').forEach(el=>el.onclick=()=>{selectedId=el.dataset.id;render();setBaseView('adventurer',{keepScroll:true});$('detailCard')?.scrollIntoView({behavior:'smooth',block:'start'})});
 renderExpeditionSetup();
 const c=data.characters.find(x=>x.id===selectedId);$('detailCard').classList.toggle('hidden',!c);renderCharacterSkillView();if(!c)return;
 if($('changeJob'))$('changeJob').value=c.job;const currentA=JOBS[c.job];
 $('detail').innerHTML=`<div class="row"><div><div class="name">${escapeHtml(c.name)}</div><span class="tag">Lv ${c.level} / 50</span><span class="tag">現在職：${c.job}</span></div></div><div class="stats">${STATS.map(s=>`<div class="stat"><span class="small">${s}</span><b>${c.stats[s]}</b></div>`).join('')}</div><h3>装着スキル</h3><div class="small">${escapeHtml(findSkill(c.equippedSkillId)?.name||'未装着')}</div><h3>装備</h3><div class="small">${Object.values(c.equipment||{}).filter(Boolean).join(' / ')||'なし'}（攻撃 +${equipmentBonus(c).attack} / HP +${equipmentBonus(c).maxHp} / AGI ${equipmentBonus(c).agi>=0?'+':''}${equipmentBonus(c).agi}）</div><h3>転職履歴</h3><div class="small">${c.jobHistory.map(h=>`Lv${h.level} ${h.job}`).join(' → ')}</div><h3>直近の成長</h3><div class="small">${c.growthHistory.slice(-5).reverse().map(g=>`Lv${g.toLevel}: ${g.gained.length?g.gained.join(', '):'能力上昇なし'}`).join('<br>')||'まだレベルアップしていません。'}</div>`;
 $('levelBtn').disabled=c.level>=50;
}
function skillDisplayTags(skill,compiled){
 const explicit=Array.isArray(skill?.tags)?skill.tags.map(t=>String(t).trim()).filter(Boolean):[];
 if(explicit.length)return explicit;
 const logic=Array.isArray(compiled?.definition?.logicOrder)?compiled.definition.logicOrder:[];
 const target=compiled?.definition?.target||{};
 const targetTags=[target.side,target.range].filter(Boolean).map(String);
 return [...logic,...targetTags];
}
const developerE2ESkillOverrides=new Map();
function developerE2EOverrideSkillId(characterId){return developerE2ESkillOverrides.get(String(characterId||''))||null}
function setDeveloperE2EOverride(characterId,skillId){
 const cid=String(characterId||''),sid=String(skillId||'');
 if(!cid||!sid)return false;
 developerE2ESkillOverrides.set(cid,sid);return true;
}
function clearDeveloperE2EOverrides(){developerE2ESkillOverrides.clear()}
function developerE2ESkillLabel(character){const sid=developerE2EOverrideSkillId(character?.id),skill=sid&&typeof findDeveloperE2ESkill==='function'?findDeveloperE2ESkill(sid):null;return skill?`${skill.name} (${skill.id})`:null}

function renderCharacterSkillView(){
 const c=data.characters.find(x=>x.id===selectedId),title=$('characterSkillTitle'),current=$('characterSkillCurrent'),list=$('characterSkillList');
 if(!title||!current||!list)return;
 if(!c){title.textContent='冒険者のスキル';current.innerHTML='<div class="skill-empty">冒険者を選択してください。</div>';list.innerHTML='';return}
 const equipped=findSkill(c.equippedSkillId);title.textContent=`${c.name}のスキル`;
 current.innerHTML=`<div class="skill-loadout-current"><b>装着中</b><div class="name">${escapeHtml(equipped?.name||'未装着')}</div><div class="small">戦闘ではこのスキルをAIが予約・実行します。</div></div>`;
 const owned=(c.skills||[]).map(findSkill).filter(x=>x&&compileSkillForRuntime(x).ok);
 list.innerHTML=owned.length?owned.map(skill=>{const compiled=compileSkillForRuntime(skill),selected=skill.id===c.equippedSkillId,tags=skillDisplayTags(skill,compiled);return `<div class="skill-choice ${selected?'selected':''}"><div><b>${escapeHtml(skill.name)}</b><div class="small">${escapeHtml(compiled.definition.logicOrder.join(' → '))} ／ 対象 ${escapeHtml(compiled.definition.target.side)}・${escapeHtml(compiled.definition.target.range)}</div><div class="skill-tags">${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div></div><button type="button" class="${selected?'good':'primary'}" data-equip-skill="${skill.id}" ${selected?'disabled':''}>${selected?'装着中':'装着する'}</button></div>`}).join(''):'<div class="skill-empty">装着可能なスキルがありません。</div>';
 list.querySelectorAll('[data-equip-skill]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.equipSkill;if(!c.skills.includes(id)||!findSkill(id))return;c.equippedSkillId=id;persist();render();renderCharacterSkillView();notify(`${c.name}が${findSkill(id).name}を装着しました。`)});
}
function selectedQuest(){const formal=formalAdventureQuests();return formal.find(q=>q.id===data.selectedQuestId)||formal[0]||null}
function equipmentBonus(c){return Object.values(c.equipment||{}).filter(Boolean).reduce((a,n)=>{const e=EQUIPMENT[n];if(e){a.attack+=e.attack||0;a.maxHp+=e.maxHp||0;a.agi+=e.agi||0}return a},{attack:0,maxHp:0,agi:0})}

let activeBaseView='home';
function setBaseView(view,opts={}){
 activeBaseView=view||'home';
 document.querySelectorAll('#phase-base [data-base-view]').forEach(el=>el.classList.toggle('base-view-active',el.dataset.baseView===activeBaseView));
 document.querySelectorAll('#baseMobileNav [data-base-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.baseTab===activeBaseView));
 if(!opts.keepScroll){const root=document.getElementById('phase-base');root?.scrollIntoView({block:'start'});window.scrollTo({top:0,behavior:opts.instant?'auto':'smooth'});}
}
function refreshMobileHome(){
 const q=selectedQuest();
 const set=(id,text)=>{const el=$(id);if(el)el.textContent=text};
 set('mobileRosterCount',`${data.characters.length}名`);
 set('mobileGuildGold',`${data.guild.gold} G`);
 set('mobileBattleRecord',`${data.guild.victories}勝 / ${data.guild.defeats}敗`);
 set('mobileQuestName',q?.name||'未選択');
}
function renderAdventureStonePicker(quest){
 const el=$('adventureStonePicker');if(!el)return;if(!quest){el.innerHTML='<div class="small">Questを選択すると難易度調整用の石板を設定できます。</div>';return;}
 const tablets=adventureContentCache?.tablets||[],settings=adventureContentCache?.adventureSettings||[],selected=adventureSelectedStones(quest.id,tablets),byId=new Map(selected.map(x=>[x.stone_id,x.count])),difficulty=window.GKAdventureStorySystem?GKAdventureStorySystem.resolveAdventureDifficulty({quest,selectedStones:selected,tablets,adventureSettings:settings}):null;
 const rows=tablets.filter(t=>t&&t.enabled!==false&&String(t.status||'')!=='archived');
 el.innerHTML=`<b>石板によるQuest難易度調整</b><div class="small">選択した石板はQuestRun開始時に追加開始コストとして全て消費され、成功・失敗に関係なく返却されません。</div>${rows.length?`<div class="grid" style="margin-top:8px">${rows.map(t=>{const id=String(t.id||''),available=Math.max(0,Math.floor(Number(data.quest_resources?.[id])||0)),count=Math.max(0,Math.floor(Number(byId.get(id))||0)),level=Math.max(0,Number(t?.stone_level??t?.params?.stone_level??t?.enemy_budget_bonus??t?.params?.enemy_budget_bonus)||0);return `<label class="unit"><b>${escapeHtml(t.name||id)}</b> <span class="tag">Budget +${level}/個</span><div class="small">所持 ${available}</div><input type="number" min="0" max="${available}" step="1" value="${Math.min(count,available)}" data-adventure-stone="${escapeHtml(id)}"></label>`}).join('')}</div>`:'<div class="small">使用可能な石板Masterがありません。</div>'}${difficulty?`<div class="small" style="margin-top:8px">基礎Budget <b>${difficulty.base_enemy_budget}</b> ＋ 石板 <b>${difficulty.stone_budget_delta}</b> ＝ 最終Budget <b>${difficulty.effective_enemy_budget}</b> ／ Event報酬補正（現在設定） <b>×${Number(difficulty.reward_scaling_snapshot?.reward_multiplier||1).toFixed(2)}</b></div>`:''}`;
 el.querySelectorAll('[data-adventure-stone]').forEach(input=>input.onchange=()=>{const id=input.dataset.adventureStone,available=Math.max(0,Math.floor(Number(data.quest_resources?.[id])||0)),n=Math.min(available,Math.max(0,Math.floor(Number(input.value)||0)));setAdventureStoneCount(quest.id,id,n)});
}
function characterAiEditorSummary(c){const formal=window.GKGameAISaveBridge?GKGameAISaveBridge.loadForCharacter(data,c?.id):null;return formal?`${formal.program.nodes.length}チップ / Formal`:'AI未設定'; }
function renderExpeditionSetup(){
 const party=$('partyEditor');if(party){party.innerHTML=data.characters.map(c=>`<div class="unit"><label><input type="checkbox" data-party="${c.id}" ${data.partyIds.includes(c.id)?'checked':''}> <b>${escapeHtml(c.name)}</b> <span class="tag">${c.job}</span></label><div><button type="button" data-open-ai="${c.id}">AIチップ編集</button> <span class="small">${characterAiEditorSummary(c)}</span></div><div class="small">装備: ${Object.entries(c.equipment||{}).filter(([,v])=>v).map(([slot,n])=>`${n} <button type="button" class="mini" data-unequip="${c.id}:${slot}">外す</button>`).join(' / ')||'なし'}</div></div>`).join('')||'<p class="small">冒険者を作成してください。</p>';party.querySelectorAll('[data-party]').forEach(el=>el.onchange=()=>{if(el.checked&&data.partyIds.length>=6){el.checked=false;notify('パーティは最大6人です。','warn');return}data.partyIds=el.checked?[...data.partyIds,el.dataset.party]:data.partyIds.filter(id=>id!==el.dataset.party);persist();renderExpeditionSetup()});party.querySelectorAll('[data-open-ai]').forEach(btn=>btn.onclick=()=>openAiEditorFor(data.characters.find(x=>x.id===btn.dataset.openAi)));party.querySelectorAll('[data-unequip]').forEach(btn=>btn.onclick=e=>{e.preventDefault();const [id,slot]=btn.dataset.unequip.split(':'),c=data.characters.find(x=>x.id===id);if(c&&c.equipment?.[slot]){data.inventory.push(c.equipment[slot]);c.equipment[slot]=null;persist();render();notify(`${c.name}の装備を外しました。`)}})}
 const ql=$('questList'),formalQuests=formalAdventureQuests(),importIssues=formalAdventureQuestImportIssues();if(ql){const issueNotice=importIssues.length?`<details class="small warn"><summary>${importIssues.length}件のQuestを参照不整合のため除外</summary><ul>${importIssues.map(issue=>`<li><b>${escapeHtml(issue.quest_id)}</b>：${escapeHtml(formalAdventureQuestImportIssueMessage(issue))}</li>`).join('')}</ul><p>StudioのExport検証でQuest Box / Scene / Event参照を確認してください。</p></details>`:'';ql.innerHTML=(formalQuests.length?formalQuests.map(q=>`<label class="unit quest-card ${q.id===data.selectedQuestId?'selected':''}"><input type="radio" name="quest" value="${q.id}" ${q.id===data.selectedQuestId?'checked':''}> <b>${escapeHtml(q.name)}</b> <span class="tag">Story</span><div class="small">推奨Lv ${q.recommendedLevel}</div><p>${escapeHtml(q.description)}</p></label>`).join(''):'<p class="small">P7-Bで実行可能なStory Questがありません。StudioでQuest Box / Map / Event条件を設定してExportしてください。</p>')+issueNotice+`<div class="small" id="storyDataLoadStatus">${escapeHtml(formalAdventureStoryLoadLabel())}</div><div class="toolbar"><button type="button" id="reloadStoryQuests">Storyデータを再読込</button></div>`;ql.querySelectorAll('input[name=quest]').forEach(el=>el.onchange=()=>{data.selectedQuestId=el.value;persist();renderExpeditionSetup()});$('reloadStoryQuests').onclick=reloadFormalAdventureQuests}
 const qs=$('questSummary'),q=formalQuests.find(x=>x.id===data.selectedQuestId)||null;if(qs){const activeLabel=adventurePlaybackLabel();qs.textContent=q?`選択中：${q.name} ／ 編成人数 ${data.partyIds.length}人${activeLabel?' ／ '+activeLabel:''}`:`正式Story Quest未選択 ／ 編成人数 ${data.partyIds.length}人${activeLabel?' ／ '+activeLabel:''}`;}
 renderAdventureStonePicker(q?((adventureContentCache?.quests||[]).find(x=>String(x.id)===String(q.id))||q):null);
 renderAdventureHistory();
 const inv=$('inventoryList');if(inv){inv.innerHTML=data.inventory.length?data.inventory.map((name,i)=>{const e=EQUIPMENT[name]||null,r=RARITY[e?.rarity||'common']||RARITY.common;if(!e)return `<div class="unit loot-card rarity-common"><b>${r.label} ${escapeHtml(name)}</b> <span class="tag">未接続装備ID</span><div class="small">Reward Resultとして保存済みです。Formal Equipment Runtime接続後もIDを失わないよう保持します。</div></div>`;return `<div class="unit loot-card rarity-${e.rarity}"><b>${r.label} ${name}</b> <span class="tag">${r.name}</span><span class="tag">${e.slot}</span><div class="small">攻撃 +${e.attack||0} / HP +${e.maxHp||0} / AGI ${e.agi>=0?'+':''}${e.agi||0}<br>${e.description||''}</div><label>装備先<select data-equip-index="${i}"><option value="">選択</option>${data.characters.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label></div>`}).join(''):'<p class="small">装備はまだありません。依頼を達成して戦利品を集めましょう。</p>';inv.querySelectorAll('[data-equip-index]').forEach(el=>el.onchange=()=>{if(!el.value)return;const c=data.characters.find(x=>x.id===el.value),name=data.inventory[Number(el.dataset.equipIndex)],e=EQUIPMENT[name];if(!c||!e)return;c.equipment=c.equipment||{weapon:null,armor:null,accessory:null};const previous=c.equipment[e.slot];c.equipment[e.slot]=name;if(previous)data.inventory.push(previous);data.inventory.splice(Number(el.dataset.equipIndex),1);persist();render();notify(`${c.name}が${name}を装備しました。`)})}
 renderGuildSummary();
 refreshMobileHome();
 setBaseView(activeBaseView,{keepScroll:true});
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function createCharacterFromForm(){
 const nameInput=$('newName'),jobInput=$('newJob');
 try{
  const name=String(nameInput?.value||'').trim(),job=String(jobInput?.value||'');
  if(!name){notify('名前を入力してください。','bad');return}
  if(!JOBS[job]){notify('初期職業を選択してください。','bad');return}
  const c=makeCharacter(name,job);
  data.characters.push(c);
  if(data.partyIds.length<6)data.partyIds.push(c.id);
  selectedId=c.id;
  if(nameInput)nameInput.value='';
  let saveError=null;
  try{persist()}catch(error){saveError=error;console.error('character persist failed',error)}
  try{render()}catch(error){console.error('character render failed',error);notify(`冒険者は作成しましたが画面更新に失敗しました: ${error.message}`,'bad');return}
  if(saveError){notify(`冒険者は作成しましたがブラウザ保存に失敗しました: ${saveError.message}`,'bad');return}
  notify(`${name}を作成しました。`);
 }catch(error){console.error('character creation failed',error);notify(`冒険者を作成できません: ${error.message}`,'bad')}
}
$('createBtn').onclick=createCharacterFromForm;
$('levelBtn').onclick=()=>{const c=data.characters.find(x=>x.id===selectedId);if(!c||c.level>=50)return;const a=JOBS[c.job],gained=[],growth={};STATS.forEach(s=>{const amount=rollGrowth(a[s]);growth[s]=amount;if(amount>0){c.stats[s]+=amount;gained.push(`${s} +${amount}`)}});const from=c.level;c.level++;c.growthHistory.push({fromLevel:from,toLevel:c.level,job:c.job,growth,gained,ruleRevision:'V9-1.0.1',at:new Date().toISOString()});persist();render();notify(`${c.name}がLv${c.level}になりました。${gained.length?' 上昇: '+gained.join(', '):' 能力値上昇なし'}`)};
function growthRank(value){return value>=12?'A':value>=9?'B':'C'}
function growthRankGrid(job){const a=JOBS[job];return `<div class="growth-grid">${STATS.map(stat=>{const r=growthRank(a[stat]);return `<div class="growth-cell"><span class="small">${stat}</span><b class="rank-${r}">${r}</b></div>`}).join('')}</div>`}
function openJobChangeModal(){const c=data.characters.find(x=>x.id===selectedId);if(!c)return;$('jobChangeCurrent').innerHTML=`現在：<b>${escapeHtml(c.job)}</b>`;$('jobChangeList').innerHTML=Object.keys(JOBS).map(job=>`<div class="job-option ${job===c.job?'selected':''}" data-job-option="${job}"><div class="job-option-name">${job}${job===c.job?'（現在）':''}</div>${growthRankGrid(job)}<button class="primary job-confirm" data-job-confirm="${job}" ${job===c.job?'disabled':''}>${job===c.job?'現在の職業':'この職業へ転職'}</button></div>`).join('');$('jobChangeModal').classList.add('open');$('jobChangeModal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.querySelectorAll('[data-job-confirm]').forEach(btn=>btn.onclick=()=>confirmJobChange(btn.dataset.jobConfirm))}
function closeJobChangeModal(){$('jobChangeModal').classList.remove('open');$('jobChangeModal').setAttribute('aria-hidden','true');document.body.style.overflow=''}
function confirmJobChange(next){const c=data.characters.find(x=>x.id===selectedId);if(!c||next===c.job)return;const old=c.job;c.job=next;c.jobHistory.push({job:next,level:c.level,from:old,at:new Date().toISOString()});persist();render();closeJobChangeModal();notify(`${c.name}は${old}から${next}へ転職しました。次回以降の能力成長率が変わります。`)}
$('openJobChange').onclick=openJobChangeModal;$('jobChangeClose').onclick=closeJobChangeModal;$('jobChangeModal').onclick=e=>{if(e.target===$('jobChangeModal'))closeJobChangeModal()};

$('deleteBtn').onclick=()=>{const c=data.characters.find(x=>x.id===selectedId);if(!c)return;if(!confirm(`${c.name}を削除しますか？`))return;data.characters=data.characters.filter(x=>x.id!==selectedId);data.partyIds=data.partyIds.filter(id=>id!==selectedId);selectedId=null;persist();render();notify('キャラクターを削除しました。','warn')};
$('saveBtn').onclick=()=>{persist();notify('ブラウザへ保存しました。')};
$('loadBtn').onclick=()=>{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('保存データがありません。');data=normalize(JSON.parse(raw));window.GKGameAIEditorUI?.resetSessions();selectedId=data.characters[0]?.id||null;render();notify('ブラウザ保存を読み込みました。')}catch(e){notify(e.message,'bad')}};

$('titleStart').onclick=beginNewGame;
$('titleContinue').onclick=continueGame;
$('titleSettings').onclick=()=>alert('設定画面は後続Buildで独立フェーズとして接続します。');
if($('baseToTitle'))$('baseToTitle').onclick=()=>setPhase('title');
$('baseDepart').onclick=$('baseDepartSide').onclick=beginSelectedAdventure;
$('eventBackBase').onclick=$('eventRetreat').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};if($('adventureReturn'))$('adventureReturn').onclick=returnFromAdventurePlayback;
$('battleAbort').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('resultToEvent').onclick=launchStandaloneBattle;
$('resultToBase').onclick=()=>{setPhase('base',{keepBattle:true});setBaseView('home',{instant:true})};
document.querySelectorAll('#phaseDevNav [data-phase]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.phase==='battle'){launchStandaloneBattle();return}setPhase(btn.dataset.phase,{keepBattle:true})});
$('exportBtn').onclick=()=>{persist();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`guild-adventure-v9-save-v2-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);notify('JSONを書き出しました。')};
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{data=normalize(JSON.parse(await file.text()));window.GKGameAIEditorUI?.resetSessions();selectedId=data.characters[0]?.id||null;persist();render();notify('JSONを読み込みました。')}catch(err){notify(err.message,'bad')}finally{e.target.value=''}};
$('clearBtn').onclick=()=>{if(!confirm('正式版Phase Aの全データを初期化しますか？'))return;data={saveVersion:SAVE_VERSION,schemaRevision:'1.6.0',gameVersion:'GA-B486.198',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),characters:[],aiPrograms:[],aiLayouts:[],aiPresets:[],partyIds:[],selectedQuestId:'',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null},flags:{},quest_progress:{completed_quest_ids:[],unlocked_quest_ids:[]},quest_resources:{},adventure:{quest_runs:[],active_quest_run_id:'',history_limit:20,stone_selection_by_quest:{}}};selectedId=null;persist();render();notify('全データを初期化しました。','warn')};

const DOT_LOG_SCHEMA_VERSION='1.0.0';
function ensureValidationState(){
 if(!Array.isArray(battle.validationEvents))battle.validationEvents=[];
 if(typeof battle.validationMode!=='boolean')battle.validationMode=false;
 return battle;
}
function recordValidationEvent(type,payload={}){
 ensureValidationState();
 if(!battle.validationMode&&battle.validationCaptureEvents!==true)return;
 battle.validationEvents.push({tick:battle.tick,type,...payload});
}
function selectedValidationContext(){
 const skill=findSkill($('tagTestSkill')?.value);
 const actor=battle.units.find(x=>x.id===$('tagTestActor')?.value);
 const target=battle.units.find(x=>x.id===$('tagTestTarget')?.value);
 return{skill,actor,target};
}
function buildValidationReport(){
 ensureValidationState();
 const meta=battle.validationMeta||{};
 const target=battle.units.find(x=>x.id===meta.targetId);
 const attackEvents=battle.validationEvents.filter(x=>x.type==='attack');
 const dotEvents=battle.validationEvents.filter(x=>x.type==='dot_damage');
 const added=battle.validationEvents.filter(x=>x.type==='dot_stack_added');
 const rejected=battle.validationEvents.filter(x=>x.type==='dot_stack_rejected');
 const expired=battle.validationEvents.filter(x=>x.type==='dot_expired');
 const defeated=battle.validationEvents.filter(x=>x.type==='dot_defeat');
 const loggedErrors=battle.validationEvents.filter(x=>x.type==='error');
 const expectedStacks=Number(meta.expectedStacks??meta.stackGain??0)||null;
 const expectedRejects=Number(meta.expectedRejects??0);
 const hitsPerStack=meta.dotDuration&&meta.dotInterval?Math.floor(meta.dotDuration/meta.dotInterval):null;
 const expectedHits=meta.expectedDotHits??(hitsPerStack==null||expectedStacks==null?null:hitsPerStack*expectedStacks);
 const expectedDotTotal=meta.expectedDotDamageTotal??(expectedHits==null?null:expectedHits*(meta.dotPower||0));
 const validationErrors=loggedErrors.map(x=>x.message||String(x));
 const requestedTicks=Number(meta.requestedTicks);
 if(!Number.isFinite(requestedTicks)||requestedTicks<=0)validationErrors.push('requested_ticksが正の数ではありません');
 if(Number.isFinite(requestedTicks)&&(battle.tick-(meta.startTick??battle.tick))!==requestedTicks)validationErrors.push(`Tick進行数不一致: ${battle.tick-(meta.startTick??battle.tick)}/${requestedTicks}`);
 if(!meta.skillId)validationErrors.push('skill_idがありません');
 if(!meta.actorId)validationErrors.push('user_idがありません');
 if(!meta.targetId)validationErrors.push('target_idがありません');
 if(!Array.isArray(meta.tags)||meta.tags.length===0)validationErrors.push('tagsが空です');
 if(attackEvents.length!==(meta.expectedAttackCount??1))validationErrors.push(`ATTACK回数不一致: ${attackEvents.length}/${meta.expectedAttackCount??1}`);
 if(expectedStacks!=null&&added.reduce((a,x)=>a+(x.count||1),0)!==expectedStacks)validationErrors.push(`DOT追加数不一致: ${added.reduce((a,x)=>a+(x.count||1),0)}/${expectedStacks}`);
 if(rejected.length!==expectedRejects)validationErrors.push(`DOT拒否数不一致: ${rejected.length}/${expectedRejects}`);
 if(expectedHits!=null&&dotEvents.length!==expectedHits)validationErrors.push(`DOT Hit数不一致: ${dotEvents.length}/${expectedHits}`);
 if(expectedDotTotal!=null&&dotEvents.reduce((a,x)=>a+(x.damage||0),0)!==expectedDotTotal)validationErrors.push(`DOT合計不一致: ${dotEvents.reduce((a,x)=>a+(x.damage||0),0)}/${expectedDotTotal}`);
 const expectedExpired=meta.expectedExpiredCount??(expectedStacks??0);
 if(expired.length!==expectedExpired)validationErrors.push(`DOT終了数不一致: ${expired.length}/${expectedExpired}`);
 if(meta.expectedDefeatCount!=null&&defeated.length!==meta.expectedDefeatCount)validationErrors.push(`DOT撃破数不一致: ${defeated.length}/${meta.expectedDefeatCount}`);
 if(meta.expectedDefeatTick!=null&&defeated[0]?.tick!==meta.expectedDefeatTick)validationErrors.push(`DOT撃破Tick不一致: ${defeated[0]?.tick??'なし'}/${meta.expectedDefeatTick}`);
 if(meta.expectedTargetAlive!=null&&target?.alive!==meta.expectedTargetAlive)validationErrors.push(`対象生存状態不一致: ${target?.alive}/${meta.expectedTargetAlive}`);
 if(meta.expectedDefeatTick!=null&&dotEvents.some(x=>x.tick>meta.expectedDefeatTick))validationErrors.push('撃破後にDOTダメージが発生しています');
 if((target?.dotStacks?.length??0)!==0)validationErrors.push('検証終了後もDOTスタックが残っています');
 if(battle.actions!==0)validationErrors.push(`通常AI行動が混入しました: ${battle.actions}`);
 if(Array.isArray(meta.expectedAddTicks)){
  const actualAddTicks=added.flatMap(x=>Array.from({length:x.count||1},()=>x.tick));
  if(JSON.stringify(actualAddTicks)!==JSON.stringify(meta.expectedAddTicks))validationErrors.push(`DOT付与Tick不一致: ${actualAddTicks.join(',')}/${meta.expectedAddTicks.join(',')}`);
 }
 if(Array.isArray(meta.expectedExpireTicks)){
  const actualExpireTicks=expired.map(x=>x.tick);
  if(JSON.stringify(actualExpireTicks)!==JSON.stringify(meta.expectedExpireTicks))validationErrors.push(`DOT終了Tick不一致: ${actualExpireTicks.join(',')}/${meta.expectedExpireTicks.join(',')}`);
 }
 if(meta.expectedHitTicksByStack){
  for(const [stackId,ticks] of Object.entries(meta.expectedHitTicksByStack)){
   const actual=dotEvents.filter(x=>x.stack_id===stackId).map(x=>x.tick);
   if(JSON.stringify(actual)!==JSON.stringify(ticks))validationErrors.push(`${stackId}のDOT発生Tick不一致: ${actual.join(',')}/${ticks.join(',')}`);
  }
 }
 const report={
  schema_version:DOT_LOG_SCHEMA_VERSION,
  build:'GA-B474',
  generated_at:new Date().toISOString(),
  test:{id:meta.testId||'TAG-DOT-1000TICK-001',mode:'isolated',start_tick:meta.startTick??0,end_tick:battle.tick,requested_ticks:meta.requestedTicks??null},
  input:{skill_id:meta.skillId||'',user_id:meta.actorId||'',target_id:meta.targetId||'',tags:meta.tags||[],execution_count:meta.expectedAttackCount??1},
  expectations:{dot_stacks:expectedStacks,dot_rejections:expectedRejects,dot_hits:expectedHits,dot_damage_total:expectedDotTotal,dot_defeats:meta.expectedDefeatCount??null,defeat_tick:meta.expectedDefeatTick??null,target_alive:meta.expectedTargetAlive??null,add_ticks:meta.expectedAddTicks||null,expire_ticks:meta.expectedExpireTicks||null,hit_ticks_by_stack:meta.expectedHitTicksByStack||null},
  initial_state:meta.initialState||{},
  events:battle.validationEvents,
  final_state:{target_hp:target?.hp??null,target_alive:target?.alive??null,active_dot_stacks:target?.dotStacks?.length??0},
  summary:{
   attack_count:attackEvents.length,
   attack_damage:attackEvents.reduce((a,x)=>a+(x.damage||0),0),
   dot_stacks_added:added.reduce((a,x)=>a+(x.count||1),0),
   dot_stacks_rejected:rejected.length,
   dot_hit_count:dotEvents.length,
   dot_damage_total:dotEvents.reduce((a,x)=>a+(x.damage||0),0),
   dot_expired_count:expired.length,
   dot_defeat_count:defeated.length,
   expected_dot_hit_count:expectedHits,
   expected_dot_damage_total:expectedDotTotal,
   normal_ai_actions:battle.actions,
   passed:validationErrors.length===0,
   errors:validationErrors
  }
 };
 return report;
}
function downloadValidationJson(){
 const report=buildValidationReport();
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`tag-dot-validation-GA-B474-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);
 return report;
}
function formatValidationSummary(report){
 const s=report.summary;
 return `[JSON TEST] ${s.passed?'PASS':'FAIL'}\n[Tick] ${report.test.start_tick} -> ${report.test.end_tick}\n[ATTACK] count=${s.attack_count}, damage=${s.attack_damage}\n[DOT] added=${s.dot_stacks_added}, rejected=${s.dot_stacks_rejected}, hits=${s.dot_hit_count}/${s.expected_dot_hit_count}, total=${s.dot_damage_total}/${s.expected_dot_damage_total}\n[EXPIRED] ${s.dot_expired_count}
[DOT DEFEAT] ${s.dot_defeat_count}\n[AI ACTIONS] ${s.normal_ai_actions}\n[ACTIVE STACKS] ${report.final_state.active_dot_stacks}\n[ERRORS] ${s.errors.length}${s.errors.length?'\n'+s.errors.map(x=>' - '+x).join('\n'):''}`;
}
const TAG_SKILL_BUILD='GA-B474 / Studio Export Bridge / ATTACK + DOT + BUFF + DEBUFF + FOLLOW_UP';
const SKILLS=[
 {id:'SKL-TEST-ATTACK',name:'タグ攻撃テスト',tags:['ATTACK','敵','単体','物理','DAMAGE=100'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-HEAVY',name:'強打テスト',tags:['ATTACK','敵','単体','物理','DAMAGE=150'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-INVALID',name:'不正攻撃（DAMAGEなし）',tags:['ATTACK','敵','単体','物理'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-POISON',name:'毒斬り（DOT実装確認）',tags:['ATTACK','DOT','敵','単体','物理','毒属性','DAMAGE=100','DOT_POWER=20','DOT_DURATION=1000','DOT_INTERVAL=100','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-BUFF-10',name:'攻撃強化10',tags:['BUFF','味方','単体','ATK','POWER=10','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-BUFF-30',name:'攻撃強化30',tags:['BUFF','味方','単体','ATK','POWER=30','DURATION=500','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-BUFF-20',name:'攻撃強化20',tags:['BUFF','味方','単体','ATK','POWER=20','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-BUFF-ALL-10',name:'味方全体攻撃強化10',tags:['BUFF','味方','全体','ATK','POWER=10','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-BUFF-ALL-30',name:'味方全体攻撃強化30',tags:['BUFF','味方','全体','ATK','POWER=30','DURATION=500','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-BUFF-ALL-20',name:'味方全体攻撃強化20',tags:['BUFF','味方','全体','ATK','POWER=20','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-DEBUFF-10',name:'攻撃弱体10',tags:['DEBUFF','敵','単体','ATK','POWER=10','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-DEBUFF-30',name:'攻撃弱体30',tags:['DEBUFF','敵','単体','ATK','POWER=30','DURATION=500','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-DEBUFF-20',name:'攻撃弱体20',tags:['DEBUFF','敵','単体','ATK','POWER=20','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-DEBUFF-ALL-10',name:'敵全体攻撃弱体10',tags:['DEBUFF','敵','全体','ATK','POWER=10','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-DEBUFF-ALL-30',name:'敵全体攻撃弱体30',tags:['DEBUFF','敵','全体','ATK','POWER=30','DURATION=500','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-DEBUFF-ALL-20',name:'敵全体攻撃弱体20',tags:['DEBUFF','敵','全体','ATK','POWER=20','DURATION=1000','STACK_GAIN=1'],source:'embedded_validation',environment:'development'},
 {id:'SKL-TEST-FOLLOW-POISON',name:'毒状態への連携追撃',tags:['FOLLOW_UP','TRIGGER_ALLY_ATTACK','CONDITION_POISONED','敵','単体','物理','DAMAGE=80'],source:'embedded_validation',environment:'development'},
];
function populateTagSkillTestUI(){
 const skill=$('tagTestSkill'),actor=$('tagTestActor'),target=$('tagTestTarget');if(!skill||!actor||!target)return;
 const selectedSkill=skill.value,selectedActor=actor.value,selectedTarget=target.value;
 skill.innerHTML=SKILLS.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
 actor.innerHTML=battle.units.filter(x=>x.alive).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}（${x.side}）</option>`).join('');
 const a=battle.units.find(x=>x.id===(selectedActor||actor.value))||battle.units.find(x=>x.alive);
 target.innerHTML=battle.units.filter(x=>x.alive&&(!a||x.id!==a.id)).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}（${x.side}）</option>`).join('');
 if(selectedSkill&&SKILLS.some(x=>x.id===selectedSkill))skill.value=selectedSkill;
 if(selectedActor&&battle.units.some(x=>x.id===selectedActor&&x.alive))actor.value=selectedActor;
 const currentActor=battle.units.find(x=>x.id===actor.value);
 const preferred=battle.units.find(x=>x.id===selectedTarget&&x.alive&&x.id!==currentActor?.id)||battle.units.find(x=>x.alive&&x.side!==currentActor?.side);
 if(preferred)target.value=preferred.id;
}
function buildModifierValidationReport(){
 const meta=battle.validationMeta||{},targetIds=meta.targetIds||[meta.targetId].filter(Boolean),targets=targetIds.map(id=>battle.units.find(x=>x.id===id)).filter(Boolean),events=battle.validationEvents||[];
 const added=events.filter(x=>x.type==='modifier_stack_added'),expired=events.filter(x=>x.type==='modifier_expired'),changes=events.filter(x=>x.type==='modifier_effective_changed'),errors=events.filter(x=>x.type==='error').map(x=>x.message||String(x));
 const actualByTarget={};for(const id of targetIds)actualByTarget[id]=changes.filter(x=>x.target_id===id).map(x=>({tick:x.tick,before:x.before,after:x.after,reason:x.reason}));
 if(battle.tick-meta.startTick!==meta.requestedTicks)errors.push(`Tick進行数不一致: ${battle.tick-meta.startTick}/${meta.requestedTicks}`);
 const expectedPerTarget=3,expectedTotal=expectedPerTarget*targetIds.length;
 if(added.reduce((n,x)=>n+(x.count||1),0)!==expectedTotal)errors.push(`スタック追加数不一致: ${added.reduce((n,x)=>n+(x.count||1),0)}/${expectedTotal}`);
 if(expired.length!==expectedTotal)errors.push(`スタック終了数不一致: ${expired.length}/${expectedTotal}`);
 for(const id of targetIds){const transitions=(actualByTarget[id]||[]).map(x=>[x.tick,x.after]);if(JSON.stringify(transitions)!==JSON.stringify(meta.expectedTransitions))errors.push(`${id} 実効値遷移不一致: ${JSON.stringify(transitions)}/${JSON.stringify(meta.expectedTransitions)}`)}
 for(const t of targets)if(ensureModifierStackList(t).length!==0)errors.push(`${t.id} にmodifierスタックが残っています`);
 if(battle.actions!==0)errors.push(`通常AI行動が混入しました: ${battle.actions}`);
 return{schema_version:'1.1.0',build:'GA-B474',generated_at:new Date().toISOString(),test:{id:meta.testId,mode:'isolated',start_tick:meta.startTick,end_tick:battle.tick,requested_ticks:meta.requestedTicks},input:{kind:meta.kind,stat:'ATK',source_id:meta.actorId,target_ids:targetIds,range:meta.range||'single',applications:meta.applications},events,final_state:{targets:targets.map(t=>({target_id:t.id,target_alive:t.alive,active_modifier_stacks:ensureModifierStackList(t).length,effective_power:effectiveModifierPower(t,meta.kind,'ATK'),effective_attack:effectiveAttackValue(t)}))},summary:{target_count:targetIds.length,modifier_stacks_added:added.reduce((n,x)=>n+(x.count||1),0),modifier_stacks_expired:expired.length,effective_transitions_by_target:actualByTarget,normal_ai_actions:battle.actions,passed:errors.length===0,errors}};
}
function downloadModifierValidationJson(){const report=buildModifierValidationReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-modifier-validation-GA-B474-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}
function formatModifierValidationSummary(report){const s=report.summary;return `[MODIFIER JSON TEST] ${s.passed?'PASS':'FAIL'}
[Tick] ${report.test.start_tick} -> ${report.test.end_tick}
[TARGETS] ${s.target_count}
[STACKS] added=${s.modifier_stacks_added}, expired=${s.modifier_stacks_expired}
[AI ACTIONS] ${s.normal_ai_actions}
[ERRORS] ${s.errors.length}${s.errors.length?'\n'+s.errors.map(x=>' - '+x).join('\n'):''}`}
function ensureValidationTargets(side,count){let targets=battle.units.filter(x=>x.alive&&x.side===side);while(targets.length<count){const i=targets.length,b=makeCombatant({id:`${side==='味方'?'A':'E'}-MOD-${i+1}`,name:`${side}検証${i+1}`,side,aiPolicy:'lowestHp',agi:1,attack:40+i*3,maxHp:500,gauge:0,actions:0,order:800+i,lastActionTick:null});battle.units.push(b);targets.push(b)}return targets.slice(0,count)}
function runModifierHighestValidation(kind,{all=false}={}){
 pauseBattle();resetBattle();const actor=battle.units.find(x=>x.alive&&x.side==='味方');if(!actor){$('tagTestResult').textContent='[MODIFIER TEST] FAILED / 使用者がありません';return}
 const targetSide=kind==='BUFF'?actor.side:battle.units.find(x=>x.side!==actor.side)?.side||'敵',targets=all?ensureValidationTargets(targetSide,3):[kind==='BUFF'?actor:battle.units.find(x=>x.alive&&x.side!==actor.side)].filter(Boolean);if(!targets.length){$('tagTestResult').textContent='[MODIFIER TEST] FAILED / 対象がありません';return}
 targets.forEach(t=>t.modifierStacks=[]);battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
 const prefix=kind==='BUFF'?(all?'SKL-TEST-BUFF-ALL-':'SKL-TEST-BUFF-'):(all?'SKL-TEST-DEBUFF-ALL-':'SKL-TEST-DEBUFF-'),skills=[findSkill(prefix+'10'),findSkill(prefix+'30'),findSkill(prefix+'20')],applications=[{tick:0,power:10,duration:1000},{tick:100,power:30,duration:500},{tick:200,power:20,duration:1000}],testId=`TAG-${kind}-${all?'ALL-':' '}HIGHEST-001`.replace(' ','');
 battle.validationMeta={kind,testId,startTick:0,requestedTicks:1200,actorId:actor.id,targetId:targets[0].id,targetIds:targets.map(x=>x.id),range:all?'all':'single',applications,expectedTransitions:[[0,10],[100,30],[600,20],[1200,0]]};recordValidationEvent('test_started',{build:'GA-B474',test_id:testId,target_ids:targets.map(x=>x.id)});
 let result=executeSkillRuntime(actor,targets[0],skills[0]);processTicks(100);result=executeSkillRuntime(actor,targets[0],skills[1]);processTicks(100);result=executeSkillRuntime(actor,targets[0],skills[2]);processTicks(1000);recordValidationEvent('test_completed',{});renderBattle();const report=downloadModifierValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled)+`
${formatModifierValidationSummary(report)}`;
}
function buildModifierDeathValidationReport(){
 const meta=battle.validationMeta||{},events=battle.validationEvents||[],target=battle.units.find(x=>x.id===meta.targetId),source=battle.units.find(x=>x.id===meta.actorId),errors=events.filter(x=>x.type==='error').map(x=>x.message||String(x));
 const cleared=events.filter(x=>x.type==='modifier_cleared_on_death'),cleanup=events.filter(x=>x.type==='modifier_death_cleanup'),expired=events.filter(x=>x.type==='modifier_expired'),sourceDefeated=events.filter(x=>x.type==='modifier_source_defeated');
 if(battle.tick-meta.startTick!==meta.requestedTicks)errors.push(`Tick進行数不一致: ${battle.tick-meta.startTick}/${meta.requestedTicks}`);
 if(meta.mode==='target_death'){
  if(cleared.length!==3)errors.push(`死亡時解除数不一致: ${cleared.length}/3`);
  if(cleanup.length!==1||cleanup[0].cleared_count!==3)errors.push('死亡時一括解除イベント不一致');
  if(expired.some(x=>x.target_id===meta.targetId))errors.push('死亡後に通常終了イベントが発生しました');
  if(target?.alive!==false)errors.push('対象が戦闘不能ではありません');
  if(target&&ensureModifierStackList(target).length!==0)errors.push('死亡対象にmodifierが残っています');
 }else{
  if(sourceDefeated.length!==1||sourceDefeated[0].persistent_stack_count!==1)errors.push('付与者死亡時の継続記録不一致');
  if(cleared.some(x=>x.target_id===meta.targetId))errors.push('付与者死亡により対象効果が解除されました');
  if(expired.filter(x=>x.target_id===meta.targetId).length!==1)errors.push('対象効果が自然終了していません');
  if(source?.alive!==false)errors.push('付与者が戦闘不能ではありません');
  if(target?.alive!==true)errors.push('効果対象が生存していません');
  if(target&&ensureModifierStackList(target).length!==0)errors.push('自然終了後もmodifierが残っています');
 }
 if(battle.actions!==0)errors.push(`通常AI行動が混入しました: ${battle.actions}`);
 return{schema_version:'1.2.0',build:'GA-B474',generated_at:new Date().toISOString(),test:{id:meta.testId,mode:'isolated',lifecycle_mode:meta.mode,start_tick:meta.startTick,end_tick:battle.tick,requested_ticks:meta.requestedTicks},input:{kind:'BUFF',stat:'ATK',source_id:meta.actorId,target_id:meta.targetId,death_tick:meta.deathTick,policy:meta.mode==='source_death'?'grant_persists_until_expiry':'target_death_clears_all'},events,final_state:{source_alive:source?.alive??null,target_alive:target?.alive??null,target_active_modifier_stacks:target?ensureModifierStackList(target).length:null,target_effective_power:target?effectiveModifierPower(target,'BUFF','ATK'):null},summary:{modifier_stacks_cleared_on_death:cleared.length,death_cleanup_events:cleanup.length,modifier_stacks_expired:expired.length,source_defeated_events:sourceDefeated.length,normal_ai_actions:battle.actions,passed:errors.length===0,errors}};
}
function downloadModifierDeathValidationJson(){const report=buildModifierDeathValidationReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-modifier-death-validation-GA-B474-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}
function formatModifierDeathSummary(report){const s=report.summary;return `[MODIFIER DEATH JSON TEST] ${s.passed?'PASS':'FAIL'}\n[MODE] ${report.test.lifecycle_mode}\n[Tick] ${report.test.start_tick} -> ${report.test.end_tick}\n[CLEARED] ${s.modifier_stacks_cleared_on_death}\n[EXPIRED] ${s.modifier_stacks_expired}\n[AI ACTIONS] ${s.normal_ai_actions}\n[ERRORS] ${s.errors.length}${s.errors.length?'\n'+s.errors.map(x=>' - '+x).join('\n'):''}`}
function defeatUnitForModifierValidation(unit,cause){if(!unit?.alive)return;unit.hp=0;unit.alive=false;unit.gauge=0;unit.reservedAction=null;const cleared=clearModifierStacksOnDeath(unit,{cause});const persistent=recordModifierSourceDefeated(unit);recordValidationEvent('unit_defeated',{target_id:unit.id,cause,cleared_modifier_stacks:cleared,persistent_granted_stacks:persistent})}
function runModifierTargetDeathValidation(){
 pauseBattle();resetBattle();const actor=battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.alive&&x.side==='敵');if(!actor||!target){$('tagTestResult').textContent='[MODIFIER DEATH TEST] FAILED / 使用者または対象がありません';return}
 target.modifierStacks=[];battle.validationMode=true;battle.validationEvents=[];battle.actions=0;modifierStackSequence=0;
 const skills=[findSkill('SKL-TEST-DEBUFF-10'),findSkill('SKL-TEST-DEBUFF-30'),findSkill('SKL-TEST-DEBUFF-20')];battle.validationMeta={mode:'target_death',testId:'TAG-MODIFIER-TARGET-DEATH-001',startTick:0,requestedTicks:1200,deathTick:300,actorId:actor.id,targetId:target.id};recordValidationEvent('test_started',{build:'GA-B474',test_id:battle.validationMeta.testId});
 let result=executeSkillRuntime(actor,target,skills[0]);processTicks(100);executeSkillRuntime(actor,target,skills[1]);processTicks(100);executeSkillRuntime(actor,target,skills[2]);processTicks(100);defeatUnitForModifierValidation(target,'validation_target_death');processTicks(900);recordValidationEvent('test_completed',{});renderBattle();const report=downloadModifierDeathValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled)+`\n${formatModifierDeathSummary(report)}`;
}
function runModifierSourceDeathValidation(){
 pauseBattle();resetBattle();const source=battle.units.find(x=>x.alive&&x.side==='味方'),target=ensureValidationTargets('味方',2).find(x=>x.id!==source?.id);if(!source||!target){$('tagTestResult').textContent='[MODIFIER SOURCE TEST] FAILED / 使用者または対象がありません';return}
 source.modifierStacks=[];target.modifierStacks=[];battle.validationMode=true;battle.validationEvents=[];battle.actions=0;modifierStackSequence=0;
 const skill=findSkill('SKL-TEST-BUFF-10');battle.validationMeta={mode:'source_death',testId:'TAG-MODIFIER-SOURCE-DEATH-001',startTick:0,requestedTicks:1200,deathTick:200,actorId:source.id,targetId:target.id};recordValidationEvent('test_started',{build:'GA-B474',test_id:battle.validationMeta.testId});
 const result=executeSkillRuntime(source,target,skill);processTicks(200);defeatUnitForModifierValidation(source,'validation_source_death');processTicks(1000);recordValidationEvent('test_completed',{});renderBattle();const report=downloadModifierDeathValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled)+`\n${formatModifierDeathSummary(report)}`;
}
function buildConditionalFollowUpValidationReport(){
 const meta=battle.validationMeta||{},events=battle.validationEvents||[],errors=[];
 const triggered=events.filter(x=>x.type==='follow_up_triggered'),skipped=events.filter(x=>x.type==='follow_up_skipped'),blocked=events.filter(x=>x.type==='follow_up_chain_blocked'),attacks=events.filter(x=>x.type==='attack');
 const followDamage=attacks.filter(x=>x.skill_id==='SKL-TEST-FOLLOW-POISON');
 if(battle.tick!==meta.requestedTicks)errors.push(`Tick不一致: ${battle.tick}/${meta.requestedTicks}`);
 if(triggered.length!==1)errors.push(`連携発動数不一致: ${triggered.length}/1`);
 if(skipped.filter(x=>x.reason==='CONDITION_POISONED_FALSE').length!==1)errors.push('毒なし時の条件抑止が1回ではありません');
 if(followDamage.length!==1)errors.push(`連携ダメージ回数不一致: ${followDamage.length}/1`);
 if(blocked.length!==1)errors.push(`多重連鎖防止イベント不一致: ${blocked.length}/1`);
 if(battle.actions!==0)errors.push(`通常AI行動が混入しました: ${battle.actions}`);
 return{schema_version:'1.3.0',build:'GA-B474',generated_at:new Date().toISOString(),test:{id:meta.testId,mode:'isolated',start_tick:0,end_tick:battle.tick,requested_ticks:meta.requestedTicks},input:{trigger:'ALLY_ATTACK',condition:'POISONED',initiator_id:meta.initiatorId,follower_id:meta.followerId,target_id:meta.targetId,follow_up_skill_id:'SKL-TEST-FOLLOW-POISON'},events,final_state:{target_hp:battle.units.find(x=>x.id===meta.targetId)?.hp??null,target_alive:battle.units.find(x=>x.id===meta.targetId)?.alive??null},summary:{follow_up_triggered:triggered.length,condition_skipped:skipped.length,follow_up_damage_events:followDamage.length,chain_blocked:blocked.length,normal_ai_actions:battle.actions,passed:errors.length===0,errors}};
}
function downloadConditionalFollowUpValidationJson(){const report=buildConditionalFollowUpValidationReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-follow-up-validation-GA-B474-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}
function runConditionalFollowUpValidation(){
 pauseBattle();resetBattle();const allies=ensureValidationTargets('味方',3),initiator=allies[0],follower=allies[1],target=battle.units.find(x=>x.alive&&x.side==='敵');if(!initiator||!follower||!target){$('tagTestResult').textContent='[FOLLOW UP TEST] FAILED / 必要ユニットがありません';return}
 battle.validationMode=true;battle.validationEvents=[];battle.actions=0;dotStackSequence=0;follower.followUpSkillIds=['SKL-TEST-FOLLOW-POISON'];target.maxHp=Math.max(target.maxHp,5000);target.hp=target.maxHp;target.dotStacks=[];
 battle.validationMeta={testId:'TAG-FOLLOW-UP-POISONED-001',requestedTicks:10,initiatorId:initiator.id,followerId:follower.id,targetId:target.id};recordValidationEvent('test_started',{build:'GA-B474',test_id:battle.validationMeta.testId});
 executeSkillRuntime(initiator,target,findSkill('SKL-TEST-ATTACK'));processTicks(5);
 applyTaggedDot(initiator,target,compileSkillForRuntime(findSkill('SKL-TEST-POISON')));executeSkillRuntime(initiator,target,findSkill('SKL-TEST-ATTACK'));processTicks(5);
 recordValidationEvent('test_completed',{});renderBattle();const report=downloadConditionalFollowUpValidationJson();$('tagTestResult').textContent=`[FOLLOW UP JSON TEST] ${report.summary.passed?'PASS':'FAIL'}\n[TRIGGERED] ${report.summary.follow_up_triggered}\n[SKIPPED] ${report.summary.condition_skipped}\n[DAMAGE] ${report.summary.follow_up_damage_events}\n[CHAIN BLOCKED] ${report.summary.chain_blocked}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;
}

function runHealSingleValidation(){
 pauseBattle();resetBattle();
 const actor=battle.units.find(x=>x.alive&&x.side==='味方');
 const target=battle.units.find(x=>x.alive&&x.side==='味方'&&x.id!==actor?.id);
 const skill=findSkill('SKL-TEST-HEAL-100');
 if(!actor||!target||!skill){$('tagTestResult').textContent='[HEAL SINGLE] FAILED / 必要データがありません';return}
 target.hp=Math.max(1,target.maxHp-50);
 const before=target.hp,result=executeSkillRuntime(actor,target,skill),after=target.hp;
 const passed=result.ok&&after===target.maxHp&&result.healResult?.healed===50&&result.healResult?.overheal===50;
 $('tagTestResult').textContent=`[HEAL SINGLE] ${passed?'PASS':'FAIL'}\nHP ${before} → ${after}/${target.maxHp}\n回復 ${result.healResult?.healed??0}\n超過 ${result.healResult?.overheal??0}`;
 renderBattle();
}
function runHealAllValidation(){
 pauseBattle();resetBattle();
 const allies=battle.units.filter(x=>x.alive&&x.side==='味方');
 const actor=allies[0],skill=findSkill('SKL-TEST-HEAL-ALL-60');
 if(!actor||allies.length<2||!skill){$('tagTestResult').textContent='[HEAL ALL] FAILED / 必要データがありません';return}
 allies.forEach((u,i)=>u.hp=Math.max(1,u.maxHp-(30+i*40)));
 const before=allies.map(u=>({id:u.id,hp:u.hp,maxHp:u.maxHp}));
 const result=executeSkillRuntime(actor,allies[1],skill);
 const after=allies.map(u=>({id:u.id,hp:u.hp,maxHp:u.maxHp}));
 const passed=result.ok&&result.targets.length===allies.length&&after.every((u,i)=>u.hp===Math.min(u.maxHp,before[i].hp+60));
 $('tagTestResult').textContent=`[HEAL ALL] ${passed?'PASS':'FAIL'}\n対象 ${result.targets.length}/${allies.length}\n`+after.map((u,i)=>`${u.id}: ${before[i].hp}→${u.hp}/${u.maxHp}`).join('\n');
 renderBattle();
}


const SHIELD_VALIDATION_SKILLS=[
 {id:'SKL-TEST-SHIELD-100',name:'単体シールド100',tags:['SHIELD','味方','単体','SHIELD=100','DURATION=500']},
 {id:'SKL-TEST-SHIELD-ALL-60',name:'味方全体シールド60',tags:['SHIELD','味方','全体','SHIELD=60','DURATION=300']},
 {id:'SKL-TEST-SHIELD-40',name:'単体シールド40',tags:['SHIELD','味方','単体','SHIELD=40','DURATION=700']}
];
function prepareShieldValidationFixture(){pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];for(const fixture of SHIELD_VALIDATION_SKILLS){const i=SKILLS.findIndex(x=>x.id===fixture.id);const row={...fixture,source:'validation_fixture',environment:'validation'};if(i>=0)SKILLS.splice(i,1,row);else SKILLS.push(row)}const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',2);return{allies,enemies,skills:{single:findSkill('SKL-TEST-SHIELD-100'),all:findSkill('SKL-TEST-SHIELD-ALL-60'),small:findSkill('SKL-TEST-SHIELD-40')}}}
function shieldUnitSnapshot(u){return{id:u.id,name:u.name,side:u.side,hp:u.hp,max_hp:u.maxHp,alive:u.alive,shield_total:shieldTotal(u),shield_effects:ensureShieldEffects(u).map(x=>({id:x.id,skill_id:x.skillId,amount:x.amount,remaining:x.remaining,sequence:x.sequence??null,applied_at:x.appliedAt,expires_at:x.expiresAt}))}}
function makeShieldCase({id,label,initialState,events,finalState,expectations,result,errors}){return{id,label,initial_state:initialState,events,final_state:finalState,expectations,result,passed:errors.length===0,errors}}
function tagTestRunCleanseJson(){
 const cases=[],errors=[];const run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)errors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const msg=String(e?.message||e);cases.push({id,label,passed:false,errors:[msg]});errors.push(`${id}: ${msg}`)}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;statusEffectSequence=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.statusEffects=[];u.statusResistance={};u.alive=true;u.hp=u.maxHp}return{actor:allies[0],target:allies[1],allies,enemies}};
 const status=(id,duration=400)=>({id:`SKL-TEST-${id}`,name:id,tags:['STATUS',`STATUS_ID=${id}`,'味方','単体',`DURATION=${duration}`]});
 const cleanse=(extra=[])=>({id:'SKL-TEST-CLEANSE-1',name:'単体解除1',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=1','CLEANSE_CATEGORY=status','CLEANSE_ORDER=oldest',...extra]});
 run('CLEANSE-SINGLE-OLDEST','単体・最古1件解除',()=>{const f=prep();executeSkillRuntime(f.actor,f.target,status('STATUS-A'));battle.tick=10;executeSkillRuntime(f.actor,f.target,status('STATUS-B'));const result=executeSkillRuntime(f.actor,f.target,cleanse()),ids=f.target.statusEffects.map(x=>x.statusId),er=[];if(result.cleanseResult?.removedCount!==1)er.push('解除数が1ではありません');if(ids.includes('STATUS-A')||!ids.includes('STATUS-B'))er.push(`最古順解除が不正:${ids.join(',')}`);return{id:'CLEANSE-SINGLE-OLDEST',label:'単体・最古1件解除',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result,passed:!er.length,errors:er}});
 run('CLEANSE-ALL-SINGLE','単体全解除',()=>{const f=prep();executeSkillRuntime(f.actor,f.target,status('STATUS-A'));battle.tick=1;executeSkillRuntime(f.actor,f.target,status('STATUS-B'));const skill={id:'SKL-TEST-CLEANSE-ALL',name:'単体全解除',tags:['CLEANSE','味方','単体','CLEANSE_ALL','CLEANSE_CATEGORY=status']},result=executeSkillRuntime(f.actor,f.target,skill),er=[];if(result.cleanseResult?.removedCount!==2||f.target.statusEffects.length)er.push('全解除されていません');return{id:'CLEANSE-ALL-SINGLE',label:'単体全解除',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-ALLY-ALL','味方全体解除',()=>{const f=prep();for(const u of f.allies)executeSkillRuntime(f.actor,u,status(`STATUS-${u.id}`));const skill={id:'SKL-TEST-CLEANSE-ALL-PARTY',name:'味方全体状態異常解除',tags:['CLEANSE','味方','全体','CLEANSE_ALL','CLEANSE_CATEGORY=status']},result=executeSkillRuntime(f.actor,f.actor,skill),er=[];if(f.allies.some(u=>u.statusEffects.length))er.push('味方全体解除に失敗');return{id:'CLEANSE-ALLY-ALL',label:'味方全体解除',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-NONE-OK','対象効果なし正常終了',()=>{const f=prep(),result=executeSkillRuntime(f.actor,f.target,cleanse()),er=[];if(!result.ok||result.cleanseResult?.removedCount!==0)er.push('対象なしが正常終了ではありません');return{id:'CLEANSE-NONE-OK',label:'対象効果なし正常終了',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-PROTECTED-SKIP','保護効果を解除しない',()=>{const f=prep();executeSkillRuntime(f.actor,f.target,status('STATUS-PROTECTED'));f.target.statusEffects[0].protected=true;const result=executeSkillRuntime(f.actor,f.target,{id:'SKL-TEST-CLEANSE-ALL',name:'全解除',tags:['CLEANSE','味方','単体','CLEANSE_ALL','CLEANSE_CATEGORY=status']}),er=[];if(!f.target.statusEffects.length||result.cleanseResult?.skippedProtectedCount!==1)er.push('protected効果が正しくスキップされていません');return{id:'CLEANSE-PROTECTED-SKIP',label:'保護効果を解除しない',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-DEAD-REJECT','死亡対象拒否',()=>{const f=prep();f.target.alive=false;f.target.hp=0;const result=executeSkillRuntime(f.actor,f.target,cleanse()),er=[];if(result.ok)er.push('死亡対象が受理されました');return{id:'CLEANSE-DEAD-REJECT',label:'死亡対象拒否',result,passed:!er.length,errors:er}});
 run('CLEANSE-INVALID-DATA','不正データ拒否',()=>{const a=compileSkillForRuntime({id:'BAD-C1',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=0']}),b=compileSkillForRuntime({id:'BAD-C2',tags:['CLEANSE','味方','単体','CLEANSE_ALL','CLEANSE_COUNT=1']}),c=compileSkillForRuntime({id:'BAD-C3',tags:['CLEANSE','敵','単体','CLEANSE_COUNT=1']}),d=compileSkillForRuntime({id:'BAD-C4',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=1','CLEANSE_CATEGORY=all_negative']}),er=[];if(a.ok||b.ok||c.ok||d.ok)er.push('不正データを受理しました');return{id:'CLEANSE-INVALID-DATA',label:'不正データ拒否',result:{count_zero:a,all_and_count:b,enemy_target:c,unsupported_category:d},passed:!er.length,errors:er}});
 const report={schema_version:'1.0.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-CLEANSE-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunCleanseJson'},current_spec:{scope:'status_only',target_sides:['self','ally'],ranges:['single','all'],count:['CLEANSE_COUNT','CLEANSE_ALL'],order:'oldest',protected_is_not_removed:true,no_effect_is_success:true},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cleanse-device-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[CLEANSE DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}`;return report;
}


function tagTestRunShieldJson(){const cases=[],allErrors=[];const run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)allErrors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const msg=String(e?.message||e);cases.push(makeShieldCase({id,label,initialState:null,events:[],finalState:null,expectations:{},result:null,errors:[msg]}));allErrors.push(`${id}: ${msg}`)}};
 run('SHIELD-ABSORB-PARTIAL','シールド内吸収',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],skill=f.skills.single,errors=[];target.hp=target.maxHp;const initial=shieldUnitSnapshot(target),grant=executeSkillRuntime(actor,target,skill),damage=applyTaggedDamage(f.enemies[0],target,60,{id:'TEST-DAMAGE-60',name:'検証ダメージ60',parameters:{damage:60}});if(shieldTotal(target)!==40)errors.push(`残量が40ではありません: ${shieldTotal(target)}`);if(target.hp!==target.maxHp)errors.push('HPが変化しました');return makeShieldCase({id:'SHIELD-ABSORB-PARTIAL',label:'シールド内吸収',initialState:initial,events:[...battle.validationEvents],finalState:shieldUnitSnapshot(target),expectations:{shield_remaining:40,hp_unchanged:true},result:{grant,damage},errors})});
 run('SHIELD-OVERFLOW','超過ダメージ',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],skill=f.skills.single,errors=[];target.hp=target.maxHp;executeSkillRuntime(actor,target,skill);const before=target.hp,damage=applyTaggedDamage(f.enemies[0],target,150,{id:'TEST-DAMAGE-150',name:'検証ダメージ150',parameters:{damage:150}});if(shieldTotal(target)!==0)errors.push('シールドが0ではありません');if(target.hp!==before-50)errors.push(`HPダメージが50ではありません: ${before-target.hp}`);return makeShieldCase({id:'SHIELD-OVERFLOW',label:'超過ダメージ',initialState:{target:{...shieldUnitSnapshot(target),hp:before,shield_total:100}},events:[...battle.validationEvents],finalState:shieldUnitSnapshot(target),expectations:{shield_remaining:0,hp_damage:50},result:damage,errors})});
 run('SHIELD-INVALID-DATA-REJECT','不正シールド拒否',()=>{const invalid={id:'SKL-INVALID-SHIELD-0',name:'不正シールド',tags:['SHIELD','味方','単体','SHIELD=0','DURATION=100']},compiled=compileSkillForRuntime(invalid),errors=[];if(compiled.ok)errors.push('SHIELD=0が受理されました');if(!compiled.errors.some(x=>x.includes('0より大きい')))errors.push('期待する値エラーがありません');return makeShieldCase({id:'SHIELD-INVALID-DATA-REJECT',label:'不正シールド拒否',initialState:{skill:invalid},events:[],finalState:{compiled_ok:compiled.ok,compile_errors:compiled.errors},expectations:{compiled_ok:false},result:compiled,errors})});
 run('SHIELD-DEAD-REJECT','戦闘不能対象拒否',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[];target.hp=0;target.alive=false;const result=executeSkillRuntime(actor,target,f.skills.single);if(result.ok)errors.push('戦闘不能対象へ付与されました');if(shieldTotal(target)!==0)errors.push('戦闘不能対象に残量があります');return makeShieldCase({id:'SHIELD-DEAD-REJECT',label:'戦闘不能対象拒否',initialState:shieldUnitSnapshot(target),events:[...battle.validationEvents],finalState:shieldUnitSnapshot(target),expectations:{execution_ok:false,shield_total:0},result,errors})});
 run('SHIELD-ALL','味方全体付与',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],errors=[],enemyBefore=f.enemies.map(shieldTotal),result=executeSkillRuntime(actor,actor,f.skills.all);for(const u of f.allies)if(shieldTotal(u)!==60)errors.push(`${u.id}の残量が60ではありません`);if(f.enemies.some((u,i)=>shieldTotal(u)!==enemyBefore[i]))errors.push('敵へシールドが付与されました');return makeShieldCase({id:'SHIELD-ALL',label:'味方全体付与',initialState:{allies:f.allies.map(shieldUnitSnapshot),enemies:f.enemies.map(shieldUnitSnapshot)},events:[...battle.validationEvents],finalState:{allies:f.allies.map(shieldUnitSnapshot),enemies:f.enemies.map(shieldUnitSnapshot)},expectations:{ally_count:f.allies.length,shield_each:60,enemy_unchanged:true},result,errors})});
 run('SHIELD-MULTIPLE-FIFO','複数シールド競合',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[];executeSkillRuntime(actor,target,f.skills.single);executeSkillRuntime(actor,target,f.skills.small);const before=shieldUnitSnapshot(target),damage=applyTaggedDamage(f.enemies[0],target,120,{id:'TEST-DAMAGE-120',name:'検証ダメージ120',parameters:{damage:120}}),after=shieldUnitSnapshot(target);if(before.shield_total!==140)errors.push(`加算合計が140ではありません: ${before.shield_total}`);if(after.shield_total!==20)errors.push(`残量が20ではありません: ${after.shield_total}`);if(after.shield_effects.length!==1||after.shield_effects[0].skill_id!=='SKL-TEST-SHIELD-40')errors.push('FIFO消費順が不正です');return makeShieldCase({id:'SHIELD-MULTIPLE-FIFO',label:'複数シールド競合',initialState:before,events:[...battle.validationEvents],finalState:after,expectations:{stacking:'additive_instances',consume_order:'fifo',remaining:20},result:damage,errors})});
 run('SHIELD-DURATION-EXPIRE','持続終了',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[],short={id:'SKL-TEST-SHIELD-SHORT',name:'短時間シールド',tags:['SHIELD','味方','単体','SHIELD=25','DURATION=5']};executeSkillRuntime(actor,target,short);const initial=shieldUnitSnapshot(target);processTicks(5);const final=shieldUnitSnapshot(target);if(final.shield_total!==0)errors.push(`Tick5で終了していません: ${final.shield_total}`);return makeShieldCase({id:'SHIELD-DURATION-EXPIRE',label:'持続終了',initialState:initial,events:[...battle.validationEvents],finalState:final,expectations:{expires_at_tick:5,shield_total:0},result:{tick:battle.tick},errors})});
 run('SHIELD-BATTLE-END-CLEAR','戦闘終了時消去',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[];executeSkillRuntime(actor,target,f.skills.single);const initial=shieldUnitSnapshot(target);for(const e of battle.units.filter(u=>u.side==='敵')){e.hp=0;e.alive=false}finishIfNeeded();const final=shieldUnitSnapshot(target);if(final.shield_total!==0)errors.push('戦闘終了後にシールドが残っています');return makeShieldCase({id:'SHIELD-BATTLE-END-CLEAR',label:'戦闘終了時消去',initialState:initial,events:[...battle.validationEvents],finalState:final,expectations:{battle_pending_result:true,shield_total:0},result:{pending_result:battle.pendingResult},errors})});
 const report={schema_version:'1.3.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-SHIELD-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunShieldJson'},design_decisions:{stacking:'additive individual instances',consumption:'FIFO by appliedAt',dot_consumes_shield:true,death_clears:true,battle_end_clears:true},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:allErrors.length===0,errors:allErrors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-shield-device-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[SHIELD DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.map(x=>' - '+x).join('\n'):''}\n[JSON] 出力完了`;renderBattle();return report}

function tagTestRunStatusJson(){
 const cases=[],errors=[],run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)errors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const m=String(e?.message||e);cases.push({id,label,passed:false,errors:[m]});errors.push(`${id}: ${m}`)}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];statusEffectSequence=0;const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.statusEffects=[];u.statusResistance={}}return{actor:allies[0],target:enemies[0]}};
 const skill=(duration=400)=>({id:'SKL-TEST-STATUS-ACCURACY-DOWN',name:'命中低下',tags:['STATUS','STATUS_ID=STATUS-ACCURACY-DOWN','敵','単体',`DURATION=${duration}`]});
 run('STATUS-APPLY-NO-RESIST','耐性0・100%付与',()=>{const f=prep(),r=executeSkillRuntime(f.actor,f.target,skill()),e=f.target.statusEffects[0],er=[];if(!r.ok||!e)er.push('付与失敗');if(e?.effectiveDurationTick!==400||e?.expiresTick!==400)er.push(`持続時間不一致:${e?.effectiveDurationTick}`);return{id:'STATUS-APPLY-NO-RESIST',label:'耐性0・100%付与',initial_state:{resistance:0},events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result:r,passed:!er.length,errors:er}});
 run('STATUS-DURATION-25-RESIST','耐性25%で持続短縮',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':25};const r=executeSkillRuntime(f.actor,f.target,skill()),e=f.target.statusEffects[0],er=[];if(!e)er.push('状態異常が付与されていません');if(e?.effectiveDurationTick!==300||e?.expiresTick!==300)er.push(`実効持続時間が300ではありません:${e?.effectiveDurationTick}`);return{id:'STATUS-DURATION-25-RESIST',label:'耐性25%で持続短縮',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result:r,passed:!er.length,errors:er}});
 run('STATUS-DURATION-75-RESIST','耐性75%でも付与',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':75};const r=executeSkillRuntime(f.actor,f.target,skill()),e=f.target.statusEffects[0],er=[];if(!e)er.push('耐性75%で付与されていません');if(e?.effectiveDurationTick!==100||e?.expiresTick!==100)er.push(`実効持続時間が100ではありません:${e?.effectiveDurationTick}`);return{id:'STATUS-DURATION-75-RESIST',label:'耐性75%でも付与',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result:r,passed:!er.length,errors:er}});
 run('STATUS-RESIST-CAP','耐性上限75%',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':100};executeSkillRuntime(f.actor,f.target,skill());const e=f.target.statusEffects[0],er=[];if(!e)er.push('状態異常が付与されていません');if(e?.targetResistance!==75||e?.effectiveDurationTick!==100)er.push(`耐性上限または持続時間不一致:${e?.targetResistance}/${e?.effectiveDurationTick}`);return{id:'STATUS-RESIST-CAP',label:'耐性上限75%',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},passed:!er.length,errors:er}});
 run('STATUS-REFRESH','再付与更新',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':25};executeSkillRuntime(f.actor,f.target,skill());battle.tick=100;executeSkillRuntime(f.actor,f.target,skill());const er=[];if(f.target.statusEffects.length!==1)er.push('件数が1ではありません');if(f.target.statusEffects[0]?.expiresTick!==400)er.push(`期限が400ではありません:${f.target.statusEffects[0]?.expiresTick}`);if(!battle.validationEvents.some(x=>x.type==='status_refreshed'))er.push('status_refreshedなし');return{id:'STATUS-REFRESH',label:'再付与更新',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},passed:!er.length,errors:er}});
 run('STATUS-EXPIRE','満了',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':75};executeSkillRuntime(f.actor,f.target,skill());battle.tick=100;processStatusEffects();const er=[];if(f.target.statusEffects.length)er.push('満了していません');if(!battle.validationEvents.some(x=>x.type==='status_removed'&&x.reason==='expired'))er.push('expiredログなし');return{id:'STATUS-EXPIRE',label:'満了',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-MANUAL-REMOVE','手動解除API',()=>{const f=prep();executeSkillRuntime(f.actor,f.target,skill());removeStatus(f.target,{status_id:'STATUS-ACCURACY-DOWN'},'manual_dispel',battle.tick);const er=[];if(f.target.statusEffects.length)er.push('解除されていません');return{id:'STATUS-MANUAL-REMOVE',label:'手動解除API',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-TARGET-DEATH','対象死亡消去',()=>{const f=prep();executeSkillRuntime(f.actor,f.target,skill());f.target.alive=false;removeStatus(f.target,{category:'status'},'target_dead',battle.tick);const er=[];if(f.target.statusEffects.length)er.push('死亡時消去されていません');return{id:'STATUS-TARGET-DEATH',label:'対象死亡消去',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-BATTLE-END','戦闘終了消去',()=>{const f=prep();executeSkillRuntime(f.actor,f.target,skill());clearAllStatuses('battle_end');const er=[];if(f.target.statusEffects.length)er.push('戦闘終了消去されていません');return{id:'STATUS-BATTLE-END',label:'戦闘終了消去',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-INVALID-DATA','不正データ拒否',()=>{const a=compileSkillForRuntime({id:'BAD1',tags:['STATUS','敵','単体','DURATION=300']}),b=compileSkillForRuntime({id:'BAD2',tags:['STATUS','STATUS_ID=X','敵','単体','DURATION=0']}),er=[];if(a.ok||b.ok)er.push('不正データを受理しました');return{id:'STATUS-INVALID-DATA',label:'不正データ拒否',result:{missing_status_id:a,invalid_duration:b},passed:!er.length,errors:er}});
 const report={schema_version:'1.1.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-STATUS-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunStatusJson'},design_decisions:{attack_hit_applies_status:true,application_rate:100,resistance_affects:'duration',resistance_cap_percent:75,duration_formula:'floor(base_duration * (1 - resistance/100))',minimum_duration_tick:1},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-status-device-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[STATUS DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}`;return report;
}



function tagTestRunReviveJson(){
 const cases=[],errors=[];const run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)errors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const msg=String(e?.message||e);cases.push({id,label,passed:false,errors:[msg]});errors.push(`${id}: ${msg}`)}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.alive=true;u.hp=u.maxHp;u.gauge=0;u.reservedAction=null;u.statusEffects=[];u.dotStacks=[];u.modifierStacks=[];u.shieldEffects=[]}return{actor:allies[0],target:allies[1],allies,enemies}};
 const fixed=(hp=100)=>({id:'SKL-TEST-REVIVE-FIXED',name:'固定値蘇生',tags:['REVIVE','味方','単体',`REVIVE_HP=${hp}`]});
 const rate=(value=0.25,range='単体')=>({id:`SKL-TEST-REVIVE-RATE-${range}`,name:'割合蘇生',tags:['REVIVE','味方',range,`REVIVE_HP_RATE=${value}`]});
 const defeat=(u)=>{u.statusEffects=[{instanceId:'S1'}];u.dotStacks=[{id:'D1'}];u.modifierStacks=[{id:'M1'}];u.shieldEffects=[{id:'H1',remaining:50}];u.gauge=80;u.reservedAction={kind:'test'};return resetCombatantOnDeath(u,{reason:'validation'})};
 run('REVIVE-RATE-SINGLE','最大HPの25%で単体蘇生',()=>{const f=prep();f.target.maxHp=310;defeat(f.target);const result=executeSkillRuntime(f.actor,f.target,rate(0.25)),er=[];if(!result.ok||!result.reviveResult?.ok)er.push('割合蘇生に失敗しました');if(f.target.hp!==77||result.reviveResult?.reviveMode!=='rate')er.push(`割合計算不一致:${f.target.hp}/${result.reviveResult?.reviveMode}`);return{id:'REVIVE-RATE-SINGLE',label:'最大HPの25%で単体蘇生',events:[...battle.validationEvents],result,final_state:{hp:f.target.hp,max_hp:f.target.maxHp,alive:f.target.alive,gauge:f.target.gauge},passed:!er.length,errors:er}});
 run('REVIVE-RATE-FLOOR','割合計算は小数切り捨て',()=>{const f=prep();f.target.maxHp=333;defeat(f.target);const result=executeSkillRuntime(f.actor,f.target,rate(0.25)),er=[];if(f.target.hp!==83)er.push(`切り捨て不一致:${f.target.hp}`);return{id:'REVIVE-RATE-FLOOR',label:'割合計算は小数切り捨て',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-MIN-ONE','割合計算結果は最低1HP',()=>{const f=prep();f.target.maxHp=3;defeat(f.target);const result=executeSkillRuntime(f.actor,f.target,rate(0.01)),er=[];if(f.target.hp!==1)er.push(`最低HP不一致:${f.target.hp}`);return{id:'REVIVE-RATE-MIN-ONE',label:'割合計算結果は最低1HP',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-FULL-CAP','割合1は最大HPで蘇生',()=>{const f=prep();f.target.maxHp=310;defeat(f.target);const result=executeSkillRuntime(f.actor,f.target,rate(1)),er=[];if(f.target.hp!==310)er.push(`最大HP不一致:${f.target.hp}`);return{id:'REVIVE-RATE-FULL-CAP',label:'割合1は最大HPで蘇生',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-ALL','全体割合蘇生は死亡者のみ',()=>{const f=prep(),living=f.allies[0],d1=f.allies[1],d2=f.allies[2],livingHp=living.hp;d1.maxHp=310;d2.maxHp=500;defeat(d1);defeat(d2);const result=executeSkillRuntime(f.actor,f.actor,rate(0.2,'全体')),er=[];if(d1.hp!==62||d2.hp!==100)er.push(`全体割合不一致:${d1.hp}/${d2.hp}`);if(living.hp!==livingHp)er.push('生存者が変更されました');if(result.targets?.length!==2)er.push(`対象数不一致:${result.targets?.length}`);return{id:'REVIVE-RATE-ALL',label:'全体割合蘇生は死亡者のみ',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-LIVING-REJECT','生存対象はINVALID_TARGET',()=>{const f=prep(),before=f.target.hp,result=executeSkillRuntime(f.actor,f.target,rate(0.25)),er=[];if(result.ok||result.stage!=='target')er.push('生存対象が拒否されていません');if(f.target.hp!==before)er.push('生存対象が変更されました');return{id:'REVIVE-RATE-LIVING-REJECT',label:'生存対象はINVALID_TARGET',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-INVALID-DATA','割合タグ不正データ拒否',()=>{const missing=compileSkillForRuntime({id:'BAD-R1',tags:['REVIVE','味方','単体']}),zero=compileSkillForRuntime({id:'BAD-R2',tags:['REVIVE','味方','単体','REVIVE_HP_RATE=0']}),over=compileSkillForRuntime({id:'BAD-R3',tags:['REVIVE','味方','単体','REVIVE_HP_RATE=1.01']}),both=compileSkillForRuntime({id:'BAD-R4',tags:['REVIVE','味方','単体','REVIVE_HP=100','REVIVE_HP_RATE=0.25']}),enemy=compileSkillForRuntime({id:'BAD-R5',tags:['REVIVE','敵','単体','REVIVE_HP_RATE=0.25']}),er=[];if(missing.ok||zero.ok||over.ok||both.ok||enemy.ok)er.push('不正データを受理しました');return{id:'REVIVE-RATE-INVALID-DATA',label:'割合タグ不正データ拒否',result:{missing_value:missing,zero_rate:zero,over_rate:over,fixed_and_rate:both,enemy_target:enemy},passed:!er.length,errors:er}});
 const deferredChecks=[];try{const f=prep();defeat(f.target);const result=executeSkillRuntime(f.actor,f.target,fixed(100)),er=[];if(f.target.hp!==100||result.reviveResult?.reviveMode!=='fixed')er.push('固定値蘇生は現行ゲームランタイムで互換動作しません');deferredChecks.push({id:'REVIVE-FIXED-DEFERRED',label:'固定値蘇生（死亡回避基盤への転用候補・合否対象外）',result,passed:!er.length,errors:er,release_gate:false})}catch(e){deferredChecks.push({id:'REVIVE-FIXED-DEFERRED',label:'固定値蘇生（死亡回避基盤への転用候補・合否対象外）',passed:false,errors:[String(e?.message||e)],release_gate:false})}
 const report={schema_version:'1.2.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-REVIVE-RATE-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunReviveJson'},current_spec:{scope:'revive_foundation_rate_hp_game_runtime_connection',target_side:'ally',ranges:['single','all'],release_gate_tag:'REVIVE_HP_RATE',fixed_hp_tag:'REVIVE_HP',fixed_hp_status:'deferred_for_future_last_stand_foundation_review',rate_hp_tag:'REVIVE_HP_RATE',rate_unit:'ratio_0_to_1',rate_formula:'max(1, floor(max_hp * REVIVE_HP_RATE))',fixed_and_rate:'mutually_exclusive',living_single_target:'INVALID_TARGET',death_resets_all_temporary_state:true,revive_restores_previous_effects:false,gauge_after_revive:0,same_tick_action:false,no_dead_all_is_success:true},cases,deferred_checks:deferredChecks,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-revive-rate-game-runtime-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[REVIVE RATE GAME RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}`;return report;
}


function tagTestRunAuraJson(){
 const valid=[
  {id:'AURA-ALLY-ATK',label:'味方ATKオーラ',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=highest','AURA_PRIORITY=0','ATK']},
  {id:'AURA-ALLY-DEF-EX',label:'本人除外DEFオーラ',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=15','AURA_TARGET=ally','AURA_SCOPE=allies_excluding_self','DEF']},
  {id:'AURA-ENEMY-ATK-DOWN',label:'敵全体ATK低下オーラ',tags:['AURA','AURA_EFFECT=DEBUFF','AURA_VALUE=20','AURA_TARGET=enemy','AURA_SCOPE=all','ATK']}
 ];
 const invalid=[
  {id:'AURA-BAD-STATUS',label:'STATUSオーラ未対応',tags:['AURA','AURA_EFFECT=STATUS','AURA_VALUE=10','AURA_TARGET=enemy','AURA_SCOPE=all','ATK']},
  {id:'AURA-BAD-NO-VALUE',label:'値なし拒否',tags:['AURA','AURA_EFFECT=BUFF','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','ATK']},
  {id:'AURA-BAD-ZERO',label:'0値拒否',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=0','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','ATK']},
  {id:'AURA-BAD-TARGET',label:'対象種別拒否',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=self','AURA_SCOPE=self_and_allies','ATK']},
  {id:'AURA-BAD-ENEMY-SCOPE',label:'敵対象scope制限',tags:['AURA','AURA_EFFECT=DEBUFF','AURA_VALUE=10','AURA_TARGET=enemy','AURA_SCOPE=allies_excluding_self','ATK']},
  {id:'AURA-BAD-STACK',label:'additive未対応',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=additive','ATK']},
  {id:'AURA-BAD-NO-STAT',label:'能力値なし拒否',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies']},
  {id:'AURA-BAD-COMBINED',label:'通常BUFF混在拒否',tags:['AURA','BUFF','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','ATK','POWER=10','DURATION=100','STACK_GAIN=1']}
 ];
 const cases=[],errors=[];
 const add=(row,expectedOk)=>{const result=compileSkillForRuntime({id:row.id,name:row.label,tags:row.tags});const er=[];
  if(result.ok!==expectedOk)er.push(expectedOk?'正常系が拒否されました':'異常系が受理されました');
  if(expectedOk&&result.ok){const d=result.definition,p=d.parameters||{};if(!d.logicOrder?.includes('AURA'))er.push('logicOrderにAURAがありません');if(d.target?.side!=='self'||d.target?.range!=='single')er.push(`通常target正規化不一致:${d.target?.side}/${d.target?.range}`);if(p.auraStack!=='highest')er.push(`AURA_STACK不一致:${p.auraStack}`);}
  const c={id:row.id,label:row.label,input:{tags:[...row.tags]},expected:{compiled_ok:expectedOk},result,passed:er.length===0,errors:er};cases.push(c);if(er.length)errors.push(...er.map(x=>`${row.id}: ${x}`));};
 valid.forEach(x=>add(x,true));invalid.forEach(x=>add(x,false));
 const entrypoint='game/index.html';
 const report={schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-AURA-DEVICE-001',mode:'device_validation',entrypoint,trigger:'tagTestRunAuraJson'},current_spec:{task_id:'P01-06',stage:'tag_validation',runtime_application:false,supported_effects:['BUFF','DEBUFF'],supported_stats:['ATK','DEF','MAGIC_WEAPON_BONUS','STATUS_RESIST'],value_tag:'AURA_VALUE',target_tag:'AURA_TARGET=<ally|enemy>',scope_tag:'AURA_SCOPE=<all|self_and_allies|allies_excluding_self>',stacking:'highest only',status_aura:'deferred',additive:'deferred',unique_source:'deferred'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-aura-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[AURA DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.map(x=>' - '+x).join('\n'):''}\n[JSON] 出力完了`;return report;
}

async function tagTestRunAuraRuntimeJson(){
 pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];
 if(studioSkillBridge.status!=='loaded')await loadStudioSkillDefinitions();
 const errors=[],cases=[];const add=(id,label,fn)=>{try{const row={id,label,...fn()};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(error){const message=String(error?.message||error);cases.push({id,label,passed:false,errors:[message]});errors.push(`${id}: ${message}`)}};
 const requireStudio=id=>{const skill=findSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);const c=compileSkillForRuntime(skill);if(!c.ok)throw new Error(`${id} compile: ${c.errors.join(', ')}`);return skill};
 const prepare=()=>{resetBattle();battle.validationMode=true;battle.validationEvents=[];const allies=ensureValidationTargets('味方',4),enemies=ensureValidationTargets('敵',2);for(const u of battle.units)u.auraSkillIds=[];return{allies,enemies}};
 const snap=(u)=>({id:u.id,alive:u.alive,buff_atk:effectiveModifierPower(u,'BUFF','ATK'),buff_def:effectiveModifierPower(u,'BUFF','DEF'),debuff_atk:effectiveModifierPower(u,'DEBUFF','ATK'),attack:effectiveAttackValue(u)});
 requireStudio('SKL-AURA-ALLY-ATK-10');requireStudio('SKL-AURA-ALLY-ATK-30');requireStudio('SKL-AURA-ALLY-DEF-15-EX');requireStudio('SKL-AURA-ENEMY-ATK-DOWN-20');
 add('AURA-RUNTIME-ALLY-ATK','味方ATKオーラ適用',()=>{const f=prepare(),source=f.allies[0],ally=f.allies[1],enemy=f.enemies[0];source.auraSkillIds=['SKL-AURA-ALLY-ATK-10'];const ss=snap(source),as=snap(ally),es=snap(enemy),e=[];if(ss.buff_atk!==10||as.buff_atk!==10||es.buff_atk!==0)e.push(`ATK aura mismatch self=${ss.buff_atk} ally=${as.buff_atk} enemy=${es.buff_atk}`);return{source:ss,ally:as,enemy:es,errors:e}});
 add('AURA-RUNTIME-ALLY-DEF-EX','本人除外DEFオーラ適用',()=>{const f=prepare(),source=f.allies[0],ally=f.allies[1];source.auraSkillIds=['SKL-AURA-ALLY-DEF-15-EX'];const ss=snap(source),as=snap(ally),e=[];if(ss.buff_def!==0||as.buff_def!==15)e.push(`DEF aura mismatch self=${ss.buff_def} ally=${as.buff_def}`);return{source:ss,ally:as,errors:e}});
 add('AURA-RUNTIME-ENEMY-DEBUFF','敵全体ATK低下オーラ適用',()=>{const f=prepare(),source=f.allies[0],enemy1=f.enemies[0],enemy2=f.enemies[1],ally=f.allies[1];source.auraSkillIds=['SKL-AURA-ENEMY-ATK-DOWN-20'];const e1=snap(enemy1),e2=snap(enemy2),a=snap(ally),e=[];if(e1.debuff_atk!==20||e2.debuff_atk!==20||a.debuff_atk!==0)e.push(`enemy aura mismatch e1=${e1.debuff_atk} e2=${e2.debuff_atk} ally=${a.debuff_atk}`);return{enemy1:e1,enemy2:e2,ally:a,errors:e}});
 add('AURA-RUNTIME-HIGHEST','複数発生源highest',()=>{const f=prepare(),low=f.allies[0],high=f.allies[1],target=f.allies[2];low.auraSkillIds=['SKL-AURA-ALLY-ATK-10'];high.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];const before=snap(target),e=[];if(before.buff_atk!==30)e.push(`highest=${before.buff_atk}`);return{target:before,active_auras:activeAuraEntries(target,'BUFF','ATK'),errors:e}});
 add('AURA-RUNTIME-SOURCE-DEATH-REVIVE','発生源死亡解除・蘇生再有効',()=>{const f=prepare(),low=f.allies[0],high=f.allies[1],target=f.allies[2],reviver=f.allies[3];low.auraSkillIds=['SKL-AURA-ALLY-ATK-10'];high.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];const before=snap(target);resetCombatantOnDeath(high,{reason:'aura_runtime_validation'});const afterDeath=snap(target);const reviveSkill=requireStudio('SKL-REVIVE-SINGLE-100'),reviveResult=executeSkillRuntime(reviver,high,reviveSkill),afterRevive=snap(target),e=[];if(before.buff_atk!==30||afterDeath.buff_atk!==10||afterRevive.buff_atk!==30)e.push(`transition ${before.buff_atk}->${afterDeath.buff_atk}->${afterRevive.buff_atk}`);if(!reviveResult.ok||!reviveResult.reviveResult?.ok||!high.alive)e.push('発生源蘇生に失敗');return{before,after_source_death:afterDeath,after_source_revive:afterRevive,revive_result:{ok:reviveResult.ok,detail:reviveResult.reviveResult||null,hp:high.hp,alive:high.alive},errors:e}});
 add('AURA-RUNTIME-TARGET-DEATH-REVIVE','対象死亡中無効・蘇生後再評価',()=>{const f=prepare(),source=f.allies[0],target=f.allies[1],reviver=f.allies[2];source.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];const before=snap(target);resetCombatantOnDeath(target,{reason:'aura_target_validation'});const dead=snap(target);const reviveSkill=requireStudio('SKL-REVIVE-SINGLE-100'),reviveResult=executeSkillRuntime(reviver,target,reviveSkill),after=snap(target),e=[];if(before.buff_atk!==30||dead.buff_atk!==0||after.buff_atk!==30)e.push(`target transition ${before.buff_atk}->${dead.buff_atk}->${after.buff_atk}`);if(!reviveResult.ok||!reviveResult.reviveResult?.ok||!target.alive)e.push('対象蘇生に失敗');return{before,dead,after_revive:after,revive_result:{ok:reviveResult.ok,detail:reviveResult.reviveResult||null,hp:target.hp,alive:target.alive},errors:e}});
 const report={schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-AURA-RUNTIME-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunAuraRuntimeJson'},current_spec:{task_id:'P01-06',stage:'runtime_connection_v1',runtime_application:true,source_dependency:true,stacking:'highest',source_death:'immediate_disable',source_revive:'re_evaluate_and_restore',target_death:'inactive_while_dead',target_revive:'re_evaluate',status_aura:'deferred',additive:'deferred',unique_source:'deferred'},source:{studio_status:studioSkillBridge.status,data_version:studioSkillBridge.data_version},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-aura-runtime-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[AURA RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[STUDIO] ${report.source.data_version||report.source.studio_status}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.map(x=>' - '+x).join('\n'):''}\n[JSON] 出力完了`;return report;
}
function setupR06GameE2EUI(){
 const skillSelect=$('r06E2ESkill'),characterSelect=$('r06E2ECharacter'),loadBtn=$('r06E2ELoad'),equipBtn=$('r06E2EEquip'),clearBtn=$('r06E2EClear'),status=$('r06E2EStatus');
 if(!skillSelect||!characterSelect||!loadBtn||!equipBtn||!clearBtn||!status)return;
 const renderCharacters=()=>{const current=characterSelect.value;characterSelect.innerHTML=data.characters.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');if(current&&data.characters.some(c=>c.id===current))characterSelect.value=current};
 renderCharacters();
 loadBtn.onclick=()=>{const listed=typeof listR06MasterSkillsForGameE2E==='function'?listR06MasterSkillsForGameE2E():{ok:false,skills:[],errors:['E2E bridgeがありません']};skillSelect.innerHTML=(listed.skills||[]).map(s=>`<option value="${s.id}">${s.id} / ${escapeHtml(s.name)}</option>`).join('');status.textContent=listed.ok?`R06 Master 48件を確認しました。Skillを選んで一時装着してください。`:`読込失敗: ${(listed.errors||[]).join(' / ')}`;};
 equipBtn.onclick=()=>{const cid=characterSelect.value,sid=skillSelect.value,c=data.characters.find(x=>x.id===cid);if(!c||!sid){status.textContent='冒険者とSkillを選択してください。';return}const loaded=loadR06MasterSkillForGameE2E(sid);if(!loaded.ok){status.textContent=`装着失敗: ${(loaded.errors||[]).join(' / ')}`;return}setDeveloperE2EOverride(c.id,sid);status.textContent=`E2E一時装着: ${c.name} → ${loaded.skill.name} (${sid})。リセット/再戦後もこのタブ内ではBattle Core通常経路で使用します。`;resetBattle();};
 clearBtn.onclick=()=>{clearDeveloperE2EOverrides();if(typeof clearDeveloperE2ESkills==='function')clearDeveloperE2ESkills();status.textContent='E2E一時装着を解除しました。セーブデータは変更していません。';resetBattle();};
}

function setupTagSkillTestUI(){
 const execute=$('tagTestExecute'),compile=$('tagTestCompile'),actor=$('tagTestActor'),run1000=$('tagTestRun1000'),runStackLimit=$('tagTestRunStackLimit'),runStaggered=$('tagTestRunStaggered'),runDefeat=$('tagTestRunDefeat'),runBuffHighest=$('tagTestRunBuffHighest'),runDebuffHighest=$('tagTestRunDebuffHighest'),runBuffAll=$('tagTestRunBuffAll'),runDebuffAll=$('tagTestRunDebuffAll'),runModifierTargetDeath=$('tagTestRunModifierTargetDeath'),runModifierSourceDeath=$('tagTestRunModifierSourceDeath'),runConditionalFollowUp=$('tagTestRunConditionalFollowUp'),runStudioBridge=$('tagTestRunStudioBridge'),runFormalRegression=$('tagTestRunFormalRegression'),runHealSingle=$('tagTestRunHealSingle'),runHealAll=$('tagTestRunHealAll'),runShieldJson=$('tagTestRunShieldJson'),runStatusJson=$('tagTestRunStatusJson'),runCleanseJson=$('tagTestRunCleanseJson'),runReviveJson=$('tagTestRunReviveJson'),runAuraJson=$('tagTestRunAuraJson'),runAuraRuntimeJson=$('tagTestRunAuraRuntimeJson'),runCounterJson=$('tagTestRunCounterJson'),runCoverJson=$('tagTestRunCoverJson'),runCounterRuntimeJson=$('tagTestRunCounterRuntimeJson'),runR04TriggerFoundationJson=$('tagTestRunR04TriggerFoundationJson'),runCoverRuntimeJson=$('tagTestRunCoverRuntimeJson'),runActionDisabledRuntimeJson=$('tagTestRunActionDisabledRuntimeJson'),runCooldownRuntimeJson=$('tagTestRunCooldownRuntimeJson'),runCostRuntimeJson=$('tagTestRunCostRuntimeJson'),exportJson=$('tagTestExportJson');if(!execute||execute.dataset.bound)return;
 execute.dataset.bound='1';
 actor.onchange=populateTagSkillTestUI;
 compile.onclick=()=>{const result=compileSkillForRuntime(findSkill($('tagTestSkill').value));$('tagTestResult').textContent=formatCompileResult(result)};
 execute.onclick=()=>{const skill=findSkill($('tagTestSkill').value),a=battle.units.find(x=>x.id===$('tagTestActor').value),t=battle.units.find(x=>x.id===$('tagTestTarget').value);const result=executeSkillRuntime(a,t,skill,{manual:true});$('tagTestResult').textContent=formatCompileResult(result.compiled||compileSkillForRuntime(skill))+(result.ok?`\n[EXECUTE] SUCCESS${result.attackResult?` / damage=${result.attackResult.damage}`:''}${result.dotResult?` / DOT=${result.dotResult.added||0} stack${result.dotResult.reason?` / ${result.dotResult.reason}`:''}`:''}`:`\n[EXECUTE] FAILED / ${result.reason||result.stage}`)};
 const runIsolatedValidation=({executionCount=1,expectedStacks=1,expectedRejects=0,testId='TAG-DOT-1000TICK-001',requestedTicks=1000}={})=>{
  pauseBattle();
  const selected={skillId:$('tagTestSkill').value,actorId:$('tagTestActor').value,targetId:$('tagTestTarget').value};
  resetBattle();
  const skill=findSkill(selected.skillId),actor=battle.units.find(x=>x.id===selected.actorId)||battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.id===selected.targetId)||battle.units.find(x=>x.alive&&x.side!==actor?.side);
  if(!skill||!actor||!target){$('tagTestResult').textContent='[JSON TEST] FAILED / 使用者・対象・スキルを選択してください';return}
  const compiled=compileSkillForRuntime(skill);
  if(!compiled.ok||!compiled.definition.logicOrder.includes('DOT')){$('tagTestResult').textContent=formatCompileResult(compiled)+'\n[JSON TEST] FAILED / DOTスキルを選択してください';return}
  target.maxHp=Math.max(target.maxHp,5000);target.hp=target.maxHp;target.alive=true;
  battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
  battle.validationMeta={testId,startTick:battle.tick,requestedTicks,skillId:skill.id,actorId:actor.id,targetId:target.id,tags:[...(skill.tags||[])],dotPower:compiled.definition.parameters.dotPower,dotDuration:compiled.definition.parameters.dotDuration,dotInterval:compiled.definition.parameters.dotInterval,stackGain:compiled.definition.parameters.stackGain,expectedStacks,expectedRejects,expectedAttackCount:executionCount,initialState:{target_hp:target.hp,target_alive:target.alive,active_dot_stacks:target.dotStacks?.length||0}};
  recordValidationEvent('test_started',{build:'GA-B474',test_id:testId});
  let lastResult=null;
  for(let i=0;i<executionCount;i++){lastResult=executeSkillRuntime(actor,target,skill,{manual:false});if(!lastResult.ok)recordValidationEvent('error',{message:lastResult.reason||lastResult.stage||'execute failed',execution_index:i})}
  processTicks(requestedTicks);recordValidationEvent('test_completed',{});renderBattle();const report=downloadValidationJson();$('tagTestResult').textContent=formatCompileResult(lastResult?.compiled||compiled)+`\n${formatValidationSummary(report)}`;
 };
 if(run1000)run1000.onclick=()=>runIsolatedValidation();
 if(runStackLimit)runStackLimit.onclick=()=>runIsolatedValidation({executionCount:6,expectedStacks:5,expectedRejects:1,testId:'TAG-DOT-STACK-LIMIT-001'});
 if(runStaggered)runStaggered.onclick=()=>{
  pauseBattle();
  const selected={skillId:$('tagTestSkill').value,actorId:$('tagTestActor').value,targetId:$('tagTestTarget').value};
  resetBattle();
  const skill=findSkill(selected.skillId),actor=battle.units.find(x=>x.id===selected.actorId)||battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.id===selected.targetId)||battle.units.find(x=>x.alive&&x.side!==actor?.side);
  if(!skill||!actor||!target){$('tagTestResult').textContent='[JSON TEST] FAILED / 使用者・対象・スキルを選択してください';return}
  const compiled=compileSkillForRuntime(skill);
  if(!compiled.ok||!compiled.definition.logicOrder.includes('DOT')){$('tagTestResult').textContent=formatCompileResult(compiled)+'\n[JSON TEST] FAILED / DOTスキルを選択してください';return}
  target.maxHp=Math.max(target.maxHp,5000);target.hp=target.maxHp;target.alive=true;
  battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
  battle.validationMeta={testId:'TAG-DOT-STAGGERED-TIMER-001',startTick:0,requestedTicks:1600,skillId:skill.id,actorId:actor.id,targetId:target.id,tags:[...(skill.tags||[])],dotPower:compiled.definition.parameters.dotPower,dotDuration:compiled.definition.parameters.dotDuration,dotInterval:compiled.definition.parameters.dotInterval,stackGain:compiled.definition.parameters.stackGain,expectedStacks:3,expectedRejects:0,expectedAttackCount:3,expectedAddTicks:[0,250,600],expectedExpireTicks:[1000,1250,1600],initialState:{target_hp:target.hp,target_alive:target.alive,active_dot_stacks:0}};
  recordValidationEvent('test_started',{build:'GA-B474',test_id:'TAG-DOT-STAGGERED-TIMER-001'});
  let results=[];
  results.push(executeSkillRuntime(actor,target,skill,{manual:false}));
  processTicks(250);results.push(executeSkillRuntime(actor,target,skill,{manual:false}));
  processTicks(350);results.push(executeSkillRuntime(actor,target,skill,{manual:false}));
  const stackIds=battle.validationEvents.filter(x=>x.type==='dot_stack_added').flatMap(x=>x.stack_ids||[]);
  battle.validationMeta.expectedHitTicksByStack={};
  const starts=[0,250,600];stackIds.forEach((id,i)=>{battle.validationMeta.expectedHitTicksByStack[id]=Array.from({length:10},(_,n)=>starts[i]+(n+1)*100)});
  processTicks(1000);
  results.forEach((r,i)=>{if(!r.ok)recordValidationEvent('error',{message:r.reason||r.stage||'execute failed',execution_index:i})});
  recordValidationEvent('test_completed',{});renderBattle();const report=downloadValidationJson();$('tagTestResult').textContent=formatCompileResult(results.at(-1)?.compiled||compiled)+`\n${formatValidationSummary(report)}`;
 };
 if(runDefeat)runDefeat.onclick=()=>{
  pauseBattle();
  const selected={skillId:$('tagTestSkill').value,actorId:$('tagTestActor').value,targetId:$('tagTestTarget').value};
  resetBattle();
  const skill=findSkill(selected.skillId),actor=battle.units.find(x=>x.id===selected.actorId)||battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.id===selected.targetId)||battle.units.find(x=>x.alive&&x.side!==actor?.side);
  if(!skill||!actor||!target){$('tagTestResult').textContent='[JSON TEST] FAILED / 使用者・対象・スキルを選択してください';return}
  const compiled=compileSkillForRuntime(skill);
  if(!compiled.ok||!compiled.definition.logicOrder.includes('DOT')){$('tagTestResult').textContent=formatCompileResult(compiled)+'\n[JSON TEST] FAILED / DOTスキルを選択してください';return}
  if(!battle.units.some(x=>x.alive&&x.side===target.side&&x.id!==target.id)){battle.units.push(makeCombatant({id:'E-DUMMY',name:'検証用生存敵',side:target.side,aiPolicy:'lowestHp',agi:1,attack:1,maxHp:9999,gauge:0,actions:0,order:999,lastActionTick:null}))}
  target.maxHp=100;target.hp=100;target.alive=true;target.dotStacks=[];
  battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
  battle.validationMeta={testId:'TAG-DOT-DEFEAT-001',startTick:0,requestedTicks:1000,skillId:skill.id,actorId:actor.id,targetId:target.id,tags:[...(skill.tags||[])],dotPower:compiled.definition.parameters.dotPower,dotDuration:compiled.definition.parameters.dotDuration,dotInterval:compiled.definition.parameters.dotInterval,stackGain:compiled.definition.parameters.stackGain,expectedStacks:1,expectedRejects:0,expectedAttackCount:1,expectedDotHits:3,expectedDotDamageTotal:52,expectedExpiredCount:0,expectedDefeatCount:1,expectedDefeatTick:300,expectedTargetAlive:false,initialState:{target_hp:100,target_alive:true,active_dot_stacks:0}};
  recordValidationEvent('test_started',{build:'GA-B474',test_id:'TAG-DOT-DEFEAT-001'});
  const result=executeSkillRuntime(actor,target,skill,{manual:false});
  if(!result.ok)recordValidationEvent('error',{message:result.reason||result.stage||'execute failed'});
  processTicks(1000);recordValidationEvent('test_completed',{});renderBattle();const report=downloadValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled||compiled)+`\n${formatValidationSummary(report)}`;
 };
 if(runBuffHighest)runBuffHighest.onclick=()=>runModifierHighestValidation('BUFF');
 if(runDebuffHighest)runDebuffHighest.onclick=()=>runModifierHighestValidation('DEBUFF');
 if(runBuffAll)runBuffAll.onclick=()=>runModifierHighestValidation('BUFF',{all:true});
 if(runDebuffAll)runDebuffAll.onclick=()=>runModifierHighestValidation('DEBUFF',{all:true});
 if(runModifierTargetDeath)runModifierTargetDeath.onclick=runModifierTargetDeathValidation;
 if(runModifierSourceDeath)runModifierSourceDeath.onclick=runModifierSourceDeathValidation;
 if(runConditionalFollowUp)runConditionalFollowUp.onclick=runConditionalFollowUpValidation;
 if(runStudioBridge)runStudioBridge.onclick=async()=>{if(studioSkillBridge.status!=='loaded')await loadStudioSkillDefinitions();const report=downloadStudioBridgeValidationJson();$('tagTestResult').textContent=`[STUDIO BRIDGE] ${report.summary.passed?'PASS':'FAIL'}\n[STATUS] ${report.source.status}\n[IMPORTED] ${report.source.imported_count}\n[STUDIO SOURCED] ${report.summary.studio_sourced_count}/${report.summary.required_count}\n[COMPILED] ${report.summary.compiled_count}/${report.summary.required_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`};
 if(runHealSingle)runHealSingle.onclick=runHealSingleValidation;
 if(runHealAll)runHealAll.onclick=runHealAllValidation;
 if(runShieldJson)runShieldJson.onclick=tagTestRunShieldJson;
 if(runStatusJson)runStatusJson.onclick=tagTestRunStatusJson;
 if(runCleanseJson)runCleanseJson.onclick=tagTestRunCleanseJson;
 if(runReviveJson)runReviveJson.onclick=tagTestRunReviveJson;
 if(runAuraJson)runAuraJson.onclick=tagTestRunAuraJson;
 if(runCounterJson)runCounterJson.onclick=tagTestRunCounterJson;
 if(runCoverJson)runCoverJson.onclick=tagTestRunCoverJson;
 if(runCounterRuntimeJson)runCounterRuntimeJson.onclick=tagTestRunCounterRuntimeJson;if(runR04TriggerFoundationJson)runR04TriggerFoundationJson.onclick=tagTestRunR04TriggerFoundationJson;if(runCoverRuntimeJson)runCoverRuntimeJson.onclick=tagTestRunCoverRuntimeJson;if(runActionDisabledRuntimeJson)runActionDisabledRuntimeJson.onclick=tagTestRunActionDisabledRuntimeJson;if(runCooldownRuntimeJson)runCooldownRuntimeJson.onclick=tagTestRunCooldownRuntimeJson;if(runCostRuntimeJson)runCostRuntimeJson.onclick=tagTestRunCostRuntimeJson;
 if(runAuraRuntimeJson)runAuraRuntimeJson.onclick=tagTestRunAuraRuntimeJson;
 if(runFormalRegression)runFormalRegression.onclick=async()=>{if(studioSkillBridge.status!=='loaded')await loadStudioSkillDefinitions();const report=downloadFormalRuntimeRegressionJson();$('tagTestResult').textContent=`[FORMAL REGRESSION] ${report.summary.passed?'PASS':'FAIL'}\n[STATUS] ${report.source.status}\n[PRODUCTION DEFINITIONS] ${report.summary.production_compile_count}/${report.summary.production_definition_count}\n[VALIDATION REJECTIONS] ${report.summary.validation_expected_rejection_count}/${report.summary.validation_definition_count}\n[REQUIRED STUDIO] ${report.summary.required_studio_sourced}/${report.summary.required_count}\n[EMBEDDED PRODUCTION] ${report.summary.production_embedded_count}\n[COUNTER RUNTIME] ${report.summary.counter_runtime_passed_count}/${report.summary.counter_runtime_case_count}\n[COVER RUNTIME] ${report.summary.cover_runtime_passed_count}/${report.summary.cover_runtime_case_count}\n[R06 MASTER COMPOSITE] ${report.summary.r06_master_runtime_passed_count}/${report.summary.r06_master_runtime_case_count} (Master ${report.summary.r06_master_skill_count}, composite ${report.summary.r06_master_composite_case_count})\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`};
 if(exportJson)exportJson.onclick=()=>{const report=battle.validationMeta?.kind?downloadModifierValidationJson():downloadValidationJson();$('tagTestResult').textContent=`${$('tagTestResult').textContent}\n[JSON] 出力完了 / ${report.summary.passed?'PASS':'FAIL'}`};
 populateTagSkillTestUI();
}
const GAUGE_MAX=100;
const RESERVATION_DELAY_TICKS=4;
const STANDALONE_BATTLE_FIXTURE={source:'standalone_fixture',seed:486187,formation:[{monster_id:'STANDALONE-SLIME',count:1},{monster_id:'STANDALONE-WOLF',count:1}],monsters:[{id:'STANDALONE-SLIME',name:'検証スライム',params:{maxHp:240,attack:22,agi:7,aiPolicy:'lowestHp',defaultSkillId:'SKL-TEST-ATTACK'}},{id:'STANDALONE-WOLF',name:'検証ウルフ',params:{maxHp:300,attack:30,agi:12,aiPolicy:'lowestHp',defaultSkillId:'SKL-TEST-ATTACK'}}]};
let battleLaunchContext=null;
let battle={tick:0,actions:0,units:[],log:[],timer:null,running:false,runToken:0,lastFrameAt:0,tickAccumulator:0,result:null,pendingResult:null,ending:false,reward:null,rewardApplied:false,validationMode:false,validationCaptureEvents:true,validationEvents:[],validationMeta:null};
function standaloneBattleContext(){return clone(STANDALONE_BATTLE_FIXTURE)}
function setBattleLaunchContext(context){battleLaunchContext=context?{formation:window.GKAdventureBattleCore?GKAdventureBattleCore.normalizeFormation(context.formation):clone(context.formation||[]),monsters:clone(context.monsters||[]),seed:context.seed??null,source:context.source||'standalone_fixture'}:null;return battleLaunchContext}
function clearBattleLaunchContext(){battleLaunchContext=null}
function currentBattleLaunchContext(){return battleLaunchContext?clone(battleLaunchContext):null}
function launchStandaloneBattle(){resetBattle(standaloneBattleContext());setPhase('battle')}

function makeCombatant(base){const maxMp=Math.max(0,Number(base.maxMp??100)||0);return {...base,hp:base.maxHp,maxMp,mp:Math.max(0,Math.min(maxMp,Number(base.mp??maxMp)||0)),alive:true,damageDealt:0,damageTaken:0,dotStacks:[],modifierStacks:[],reservedAction:null,lastReservation:null,defaultSkillId:base.defaultSkillId||'SKL-TEST-ATTACK'}}
function makeBattleUnits(){
 const members=data.partyIds.map(id=>data.characters.find(c=>c.id===id)).filter(Boolean).slice(0,6);
 const allies=members.map((c,i)=>{const b=equipmentBonus(c),e2e=developerE2EOverrideSkillId(c.id);return makeCombatant({id:`A${i}`,characterId:c.id,name:c.name,side:'味方',defaultSkillId:e2e||c.equippedSkillId||c.skills?.[0]||'SKL-TEST-ATTACK',agi:Math.max(1,c.stats.AGI+b.agi),attack:10+c.stats.STR*3+c.level*2+b.attack,maxHp:100+c.stats.VIT*20+c.level*10+b.maxHp,gauge:0,actions:0,order:i,lastActionTick:null})});
 if(!allies.length)allies.push(makeCombatant({id:'A0',name:'検証剣士',side:'味方',aiPolicy:'lowestHp',defaultSkillId:'SKL-TEST-POISON',agi:11,attack:48,maxHp:360,gauge:0,actions:0,order:0,lastActionTick:null}));
 if(!battleLaunchContext?.formation?.length||!window.GKAdventureBattleCore)throw new Error('Standalone Battle fixture is unavailable');
 const expanded=GKAdventureBattleCore.expandFormation(battleLaunchContext.formation,battleLaunchContext.monsters||[]);
 const enemies=expanded.map((e,i)=>makeCombatant({id:`E${i}`,monsterId:e.monster_id,name:e.name,side:'敵',aiPolicy:e.aiPolicy,defaultSkillId:e.defaultSkillId,agi:e.agi,attack:e.attack,maxHp:e.maxHp,gauge:0,actions:0,order:100+i,lastActionTick:null}));
 return [...allies,...enemies];
}

function openAiEditorFor(c){
 if(!c)return;
 if(!window.GKGameAIEditorUI||!window.GKGameAISaveBridge||!window.GKSAIProgramCompiler){notify('正式AI編集機能を読み込めません。','bad');return;}
 const saved=GKGameAISaveBridge.loadForCharacter(data,c.id);
 window.GKGameAIEditorUI.open({
  character:c,notify,program:saved?.program||null,layout:saved?.layout||null,userPresets:GKGameAISaveBridge.userPresets(data),
  onSave:async({program,layout,projectData})=>{
   const staged=GKGameAISaveBridge.saveForCharacter(data,c.id,program,layout);
   const runtime=await GKSAIProgramCompiler.compile(staged.program,projectData);
   staged.program.compiled=runtime;
   const stored=staged.save.aiPrograms.find(row=>String(row.id)===String(staged.program.id));
   if(!stored)throw new Error('保存対象Formal AI Programが見つかりません。');
   stored.compiled=clone(runtime);
   const errors=GKGameAISaveBridge.validateCurrent(staged.save);if(errors.length)throw new Error(`Formal AI保存後の検証に失敗しました。\n${errors.join('\n')}`);
   data=staged.save;persist();render();return staged;
  },
  onPresetAction:async(payload)=>{
   let result;
   if(payload.action==='create')result=GKGameAISaveBridge.createUserPreset(data,payload.name,payload.program,payload.layout);
   else if(payload.action==='duplicate')result=GKGameAISaveBridge.duplicateUserPreset(data,payload.preset_id,payload.name);
   else if(payload.action==='rename')result=GKGameAISaveBridge.renameUserPreset(data,payload.preset_id,payload.name);
   else if(payload.action==='delete')result=GKGameAISaveBridge.deleteUserPreset(data,payload.preset_id);
   else throw new Error('未対応のPreset操作です。');
   data=result.save;persist();render();return {presets:GKGameAISaveBridge.userPresets(data)};
  }
 }).catch(error=>notify(String(error?.message||error),'bad'));
}
const openAiBtn=$('openAiEditor');if(openAiBtn)openAiBtn.onclick=()=>openAiEditorFor(data.characters.find(x=>x.id===selectedId));const skillBtn=$('openSkillPlaceholder');if(skillBtn)skillBtn.onclick=()=>{renderCharacterSkillView();setBaseView('character-skills');};const equipViewBtn=$('openEquipView');if(equipViewBtn)equipViewBtn.onclick=()=>setBaseView('equipment');

function tagTestRunCoverJson(){
 const base=['COVER','COVER_TARGET=single_ally','COVER_TRIGGER=direct_attack','COVER_PRIORITY=0','COVER_REMOVABLE=true','COVER_LIFETIME=persistent','味方','単体'];
 const defs=[
  {id:'COVER-PERSISTENT',label:'永続COVER正式形',tags:base,expected:true},
  {id:'COVER-USES-1',label:'回数制限COVER',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=uses':x).concat('COVER_USES=1'),expected:true},
  {id:'COVER-DURATION-300',label:'時間制限COVER',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=duration':x).concat('DURATION=300'),expected:true},
  {id:'COVER-ALL-FOUNDATION',label:'味方全体COVER基盤',tags:['COVER','COVER_TARGET=all_allies','COVER_TRIGGER=direct_attack','COVER_PRIORITY=10','COVER_REMOVABLE=false','COVER_LIFETIME=persistent','味方','全体'],expected:true},
  {id:'COVER-BAD-NO-LIFETIME',label:'LIFETIMEなし拒否',tags:base.filter(x=>!x.startsWith('COVER_LIFETIME=')),expected:false},
  {id:'COVER-BAD-LIFETIME',label:'LIFETIME不正拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=unknown':x),expected:false},
  {id:'COVER-BAD-USES-MISSING',label:'usesでCOVER_USESなし拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=uses':x),expected:false},
  {id:'COVER-BAD-USES-ZERO',label:'COVER_USES=0拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=uses':x).concat('COVER_USES=0'),expected:false},
  {id:'COVER-BAD-USES-DURATION',label:'usesとDURATION併用拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=uses':x).concat('COVER_USES=1','DURATION=300'),expected:false},
  {id:'COVER-BAD-DURATION-MISSING',label:'durationでDURATIONなし拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=duration':x),expected:false},
  {id:'COVER-BAD-DURATION-ZERO',label:'DURATION=0拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=duration':x).concat('DURATION=0'),expected:false},
  {id:'COVER-BAD-DURATION-USES',label:'durationとCOVER_USES併用拒否',tags:base.map(x=>x==='COVER_LIFETIME=persistent'?'COVER_LIFETIME=duration':x).concat('DURATION=300','COVER_USES=1'),expected:false},
  {id:'COVER-BAD-PERSISTENT-USES',label:'persistentとCOVER_USES併用拒否',tags:[...base,'COVER_USES=1'],expected:false},
  {id:'COVER-BAD-PERSISTENT-DURATION',label:'persistentとDURATION併用拒否',tags:[...base,'DURATION=300'],expected:false},
  {id:'COVER-BAD-NO-TARGET',label:'COVER_TARGETなし拒否',tags:base.filter(x=>!x.startsWith('COVER_TARGET=')),expected:false},
  {id:'COVER-BAD-TRIGGER',label:'旧direct_damage拒否',tags:base.map(x=>x==='COVER_TRIGGER=direct_attack'?'COVER_TRIGGER=direct_damage':x),expected:false},
  {id:'COVER-BAD-NO-PRIORITY',label:'PRIORITYなし拒否',tags:base.filter(x=>!x.startsWith('COVER_PRIORITY=')),expected:false},
  {id:'COVER-BAD-REMOVABLE',label:'REMOVABLE不正拒否',tags:base.map(x=>x==='COVER_REMOVABLE=true'?'COVER_REMOVABLE=yes':x),expected:false},
  {id:'COVER-BAD-SELF',label:'自己対象拒否',tags:base.map(x=>x==='味方'?'自分':x),expected:false},
  {id:'COVER-BAD-MIXED',label:'COVERとATTACK混在拒否',tags:[...base,'ATTACK','DAMAGE=10','物理'],expected:false}
 ];
 const cases=defs.map(d=>{const result=compileSkillForRuntime({id:d.id,name:d.label,tags:d.tags}),passed=result.ok===d.expected;return{...d,result,passed,errors:passed?[]:[`期待 ${d.expected?'VALID':'INVALID'} / 実際 ${result.ok?'VALID':'INVALID'}`]}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`)),entrypoint='game/index.html';
 const report={schema_version:'1.1.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COVER-DEVICE-002',mode:'device_validation',entrypoint,trigger:'tagTestRunCoverJson'},current_spec:{task_id:'P01-08',stage:'runtime_v1',runtime_application:true,target_foundation:['single_ally','all_allies'],initial_formal_skill:'single_ally',area_attack_cover:false,direct_attack_origins:['base','counter','follow_up'],standalone_dot:false,standalone_status:false,attached_dot_status:'follow_final_target',cover_chain:false,cover_increments_derived_generation:false,counter_after_cover:true,derived_generation_control:'runtime_context_only',removable_tag:'COVER_REMOVABLE=<true|false>',priority_tag:'COVER_PRIORITY=<integer>',priority_order_details:'deferred_P01-12_P01-13',lifetime_tag:'COVER_LIFETIME=<uses|duration|persistent>',lifetime_modes:{uses:'requires COVER_USES positive integer',duration:'requires DURATION positive integer',persistent:'no COVER_USES/DURATION'},lifetime_modes_exclusive:true},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cover-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COVER JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${errors.length}${errors.length?'\n'+errors.join('\n'):''}`;return report;
}

function tagTestRunCounterJson(){
 const base=['COUNTER','COUNTER_TRIGGER=hit','COUNTER_TARGET=attacker','COUNTER_LIMIT=1','COUNTER_PRIORITY=0','COUNTER_REQUIRE_ALIVE=true','COUNTER_ALLOW_ZERO_DAMAGE=true','ATTACK','敵','単体','物理','DAMAGE=100'];
 const valid=[
  {id:'COUNTER-ATTACK-100',label:'データ駆動COUNTER＋既存ATTACK',tags:base},
  {id:'COUNTER-PRIORITY-10',label:'PRIORITY整数受理',tags:base.map(x=>x==='COUNTER_PRIORITY=0'?'COUNTER_PRIORITY=10':x)}
 ];
 const invalid=[
  {id:'COUNTER-BAD-NO-ATTACK',label:'ATTACKなし拒否',tags:base.filter(x=>x!=='ATTACK'&&!x.startsWith('DAMAGE='))},
  {id:'COUNTER-BAD-ALL',label:'範囲反撃拒否',tags:base.map(x=>x==='単体'?'全体':x)},
  {id:'COUNTER-BAD-LIMIT',label:'LIMIT複数実行拒否',tags:base.map(x=>x==='COUNTER_LIMIT=1'?'COUNTER_LIMIT=2':x)},
  {id:'COUNTER-BAD-NO-TRIGGER',label:'TRIGGERなし拒否',tags:base.filter(x=>!x.startsWith('COUNTER_TRIGGER='))},
  {id:'COUNTER-BAD-RATE',label:'反撃専用RATE拒否',tags:[...base,'COUNTER_RATE=0.5']},
  {id:'COUNTER-BAD-FOLLOWUP',label:'FOLLOW_UP混在拒否',tags:[...base,'FOLLOW_UP','TRIGGER_ALLY_ATTACK','CONDITION_POISONED']}
 ];
 const cases=[];
 for(const x of valid){const result=compileSkillForRuntime({id:x.id,name:x.label,tags:x.tags});const errors=[];if(!result.ok)errors.push(...result.errors);if(!result.definition.logicOrder.includes('COUNTER')||!result.definition.logicOrder.includes('ATTACK'))errors.push('COUNTER→ATTACK定義になっていません');if(result.definition.parameters.counterLimit!==1)errors.push('COUNTER_LIMIT=1が保持されていません');cases.push({...x,expected:{compiled_ok:true},result,passed:errors.length===0,errors});}
 for(const x of invalid){const result=compileSkillForRuntime({id:x.id,name:x.label,tags:x.tags});const errors=[];if(result.ok)errors.push('拒否されるべき定義がVALIDになりました');cases.push({...x,expected:{compiled_ok:false},result,passed:errors.length===0,errors});}
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));const entrypoint='game/index.html';
 const report={schema_version:'1.1.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COUNTER-DEVICE-001',mode:'device_validation',entrypoint,trigger:'tagTestRunCounterJson'},current_spec:{task_id:'P01-07',stage:'data_driven_tag_validation',runtime_application:false,trigger_tag:'COUNTER_TRIGGER=hit',target_tag:'COUNTER_TARGET=attacker',limit_tag:'COUNTER_LIMIT=1',priority_tag:'COUNTER_PRIORITY=<integer>',require_alive_tag:'COUNTER_REQUIRE_ALIVE=true',allow_zero_damage_tag:'COUNTER_ALLOW_ZERO_DAMAGE=true',incoming_area_attack:false,attack_definition:'existing ATTACK',critical:'existing ATTACK',passive_effects:'existing ATTACK pipeline',counter_chain:false,derived_origin_trigger:false,multiple_execution:false,duplicate_policy:'skill configuration side',dedicated_counter_damage_formula:false},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-counter-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COUNTER JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report;
}





function runCoverRuntimeRegression(){
 const cases=[],errors=[];const add=(id,label,fn)=>{try{const out=fn()||{},row={id,label,...out};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(e){const m=String(e?.message||e);cases.push({id,label,passed:false,errors:[m]});errors.push(`${id}: ${m}`)}};
 const req=id=>{const s=findSkill(id);if(!s)throw new Error(`${id}がありません`);if(s.source!=='studio_export'||(s.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return s};
 const skills={cover:req('SKL-COVER-SINGLE-ALLY'),all:req('SKL-COVER-TEST-ALL-ALLIES'),uses:req('SKL-COVER-TEST-USES-1'),duration:req('SKL-COVER-TEST-DURATION-300'),dotOnly:req('SKL-COVER-TEST-DOT-ONLY'),attack:req('SKL-TEST-ATTACK'),poison:req('SKL-TEST-POISON'),statusAttack:req('SKL-TEST-ATTACK-STATUS-ACCURACY-DOWN'),statusOnly:req('SKL-TEST-STATUS-ACCURACY-DOWN'),area:req('SKL-COUNTER-TEST-INCOMING-ALL-60'),counter:req('SKL-COUNTER-ATTACK-100'),follow:req('SKL-TEST-FOLLOW-POISON')};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;coverEffectSequence=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.coverEffects=[];u.counterSkillId=null;u.followUpSkillIds=[];u.statusEffects=[];u.dotStacks=[];u.shieldEffects=[]}return{allies,enemies}};
 const ev=t=>battle.validationEvents.filter(x=>x.type===t);
 add('COVER-RUNTIME-BASE','base直接ATTACKの対象差し替え',()=>{const f=prep(),protectedUnit=f.allies[0],coverer=f.allies[1],enemy=f.enemies[0],er=[],ph=protectedUnit.hp,ch=coverer.hp;executeSkillRuntime(coverer,protectedUnit,skills.cover);const r=executeSkillRuntime(enemy,protectedUnit,skills.attack,{origin:'base'});if(protectedUnit.hp!==ph)er.push('保護対象HPが減少');if(coverer.hp>=ch)er.push('かばう側HPが減少していない');if(ev('cover_triggered').length!==1)er.push(`cover_triggered=${ev('cover_triggered').length}`);return{protected_hp_before:ph,protected_hp_after:protectedUnit.hp,coverer_hp_before:ch,coverer_hp_after:coverer.hp,result:r,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-ATTACHED-STATUS','ATTACK付随STATUSはかばう側へ',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeSkillRuntime(c,p,skills.cover);executeSkillRuntime(e,p,skills.statusAttack,{origin:'base'});if(ensureStatusEffects(p).length)er.push('元対象へSTATUSが付与');if(!ensureStatusEffects(c).some(x=>x.statusId==='STATUS-ACCURACY-DOWN'))er.push('かばう側へSTATUSなし');return{protected_statuses:statusSnapshot(p),coverer_statuses:statusSnapshot(c),events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-ATTACHED-DOT','ATTACK付随DOTはかばう側へ',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeSkillRuntime(c,p,skills.cover);executeSkillRuntime(e,p,skills.poison,{origin:'base'});if(ensureDotStackList(p).length)er.push('元対象へDOTが付与');if(!ensureDotStackList(c).length)er.push('かばう側へDOTなし');return{protected_dot_count:ensureDotStackList(p).length,coverer_dot_count:ensureDotStackList(c).length,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-DOT-ONLY-BLOCK','DOT単独はかばわない',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeSkillRuntime(c,p,skills.cover);executeSkillRuntime(e,p,skills.dotOnly);if(!ensureDotStackList(p).length)er.push('元対象へDOTなし');if(ensureDotStackList(c).length)er.push('DOT単独をかばった');if(ev('cover_triggered').length)er.push('DOT単独でCOVER発火');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-STATUS-ONLY-BLOCK','STATUS単独はかばわない',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeSkillRuntime(c,p,skills.cover);executeSkillRuntime(e,p,skills.statusOnly);if(!ensureStatusEffects(p).length)er.push('元対象へSTATUSなし');if(ensureStatusEffects(c).length)er.push('STATUS単独をかばった');if(ev('cover_triggered').length)er.push('STATUS単独でCOVER発火');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-AREA-BLOCK','範囲ATTACKにはCOVERは反応しない',()=>{const f=prep(),coverer=f.allies[2],enemy=f.enemies[0],er=[];executeSkillRuntime(coverer,coverer,skills.all);battle.validationEvents=[];executeSkillRuntime(enemy,f.allies[0],skills.area,{origin:'base'});const covers=ev('cover_triggered'),skips=ev('cover_skipped').filter(x=>x.reason==='AREA_ATTACK');if(covers.length!==0)er.push(`cover_triggered=${covers.length}`);if(!skips.length)er.push('AREA_ATTACK skipログなし');return{cover_count:covers.length,area_skip_count:skips.length,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-USES','uses=1は1回で終了',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[],ph=p.hp;executeSkillRuntime(c,p,skills.uses);executeSkillRuntime(e,p,skills.attack,{origin:'base'});const after1=p.hp;executeSkillRuntime(e,p,skills.attack,{origin:'base'});if(after1!==ph)er.push('1回目で元対象が被弾');if(p.hp>=after1)er.push('2回目もかばわれた');if(ensureCoverEffects(p).length)er.push('uses消費後も関係が残る');return{hp_before:ph,hp_after_first:after1,hp_after_second:p.hp,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-DURATION','duration=300はTick300で終了',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeSkillRuntime(c,p,skills.duration);processTicks(300);if(ensureCoverEffects(p).length)er.push('Tick300で終了していない');const ph=p.hp;executeSkillRuntime(e,p,skills.attack,{origin:'base'});if(p.hp>=ph)er.push('満了後もかばわれた');return{tick:battle.tick,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-SOURCE-DEATH','かばう側死亡で関係終了',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],er=[];executeSkillRuntime(c,p,skills.cover);resetCombatantOnDeath(c,{reason:'cover_test'});if(ensureCoverEffects(p).length)er.push('死亡後もCOVER関係あり');if(!ev('cover_removed').some(x=>x.reason==='SOURCE_DEAD'))er.push('SOURCE_DEADログなし');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-COVERER-DEATH-NO-RESIDUAL','かばう側が死亡しても残余ダメージを元対象へ戻さない',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[],ph=p.hp;c.hp=1;executeSkillRuntime(c,p,skills.cover);executeSkillRuntime(e,p,skills.attack,{origin:'base'});if(p.hp!==ph)er.push('元対象へ残余ダメージ');if(c.alive)er.push('かばう側が死亡していない');return{protected_hp_before:ph,protected_hp_after:p.hp,coverer_hp:c.hp,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-COUNTER-COVER-COUNTER','反撃をかばい、かばった側が1回だけ反撃',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],enemy=f.enemies[0],er=[];enemy.counterSkillId=skills.counter.id;c.counterSkillId=skills.counter.id;executeSkillRuntime(c,p,skills.cover);battle.validationEvents=[];executeSkillRuntime(p,enemy,skills.attack,{origin:'base'});const covers=ev('cover_triggered').filter(x=>x.origin==='counter'),counters=ev('counter_triggered');if(covers.length!==1)er.push(`counter cover=${covers.length}`);if(counters.length!==2)er.push(`counter_triggered=${counters.length}`);if(!ev('counter_chain_blocked').some(x=>Number(x.derived_generation)===2))er.push('第2派生で打ち切られていない');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-FOLLOW-UP','follow_up直接攻撃もかばえる',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[],ph=p.hp,ch=c.hp;ensureDotStackList(p).push({id:'COVER-FOLLOW-UP-POISON-SEED',skillId:'COVER-FOLLOW-UP-POISON-SEED'});executeSkillRuntime(c,p,skills.cover);battle.validationEvents=[];executeSkillRuntime(e,p,skills.follow,{origin:'follow_up',derivedGeneration:1});if(p.hp!==ph)er.push('元対象が追撃被弾');if(c.hp>=ch)er.push('かばう側が追撃被弾していない');if(!ev('cover_triggered').some(x=>x.origin==='follow_up'))er.push('follow_up COVERログなし');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-REMOVABLE','REMOVABLE=trueのみ手動解除対象',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],er=[];executeSkillRuntime(c,p,skills.cover);const removed=removeCoverEffects(p,{reason:'manual_dispel',removableOnly:true});if(removed!==1||ensureCoverEffects(p).length)er.push(`removable解除=${removed}`);executeSkillRuntime(c,c,skills.all);const protectedOther=f.allies[0];const before=ensureCoverEffects(protectedOther).filter(x=>x.sourceId===c.id&&!x.removable).length,blocked=removeCoverEffects(protectedOther,{sourceId:c.id,reason:'manual_dispel',removableOnly:true});if(before<1||blocked!==0)er.push('REMOVABLE=falseが解除された');return{removed_true:removed,removed_false:blocked,events:[...battle.validationEvents],errors:er}});
 return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COVER-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version,cover_skill_id:skills.cover.id,uses_skill_id:skills.uses.id,duration_skill_id:skills.duration.id,dot_only_skill_id:skills.dotOnly.id},current_spec:{task_id:'P01-08',stage:'runtime_v1',direct_attack_origins:['base','counter','follow_up'],standalone_dot:false,standalone_status:false,attached_dot_status:'follow_final_target',area_attack_cover_limit_per_request:1,cover_chain:false,cover_increments_derived_generation:false,counter_after_cover:true,derived_generation_limit:2,lifetime_modes:['uses','duration','persistent'],removable_data_driven:true,priority_tie_order:'deferred_P01-12_P01-13'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunCoverRuntimeJson(){const report=runCoverRuntimeRegression();report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunCoverRuntimeJson'};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cover-runtime-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COVER RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}


function runCooldownRuntimeRegression(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COOLDOWN-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-10',stage:'runtime_v1'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]}};
 const req=id=>{const x=findSkill(id);if(!x)throw new Error(`Studio正式スキル不足: ${id}`);return x},skills={cool:req('SKL-COOLDOWN-ATTACK-300'),attack:req('SKL-TEST-ATTACK'),disabled:req('SKL-STATUS-ACTION-DISABLED-400')};
 const cases=[],add=(id,label,run)=>{try{const out=run()||{},er=out.errors||[];cases.push({id,label,...out,passed:er.length===0,errors:er})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.gauge=0;u.statusEffects=[];u.cooldowns={};u.reservedAction=null;u.actionDisabled=false}return{allies,enemies}},ev=t=>battle.validationEvents.filter(x=>x.type===t);
 add('COOLDOWN-RUNTIME-START','発動成立時にCOOLDOWN=300開始',()=>{const f=prep(),a=f.allies[0],t=f.enemies[0],er=[];const r=executeSkillRuntime(a,t,skills.cool),rem=skillCooldownRemaining(a,skills.cool.id),started=ev('cooldown_started');if(!r.ok)er.push('発動失敗');if(rem!==300)er.push(`remaining=${rem}`);if(started.length!==1||started[0].expires_at!==300)er.push('cooldown_started不正');return{remaining:rem,events:[...battle.validationEvents],errors:er}});
 add('COOLDOWN-RUNTIME-BLOCK','CD中は同一スキル実行不可',()=>{const f=prep(),a=f.allies[0],t=f.enemies[0],er=[];executeSkillRuntime(a,t,skills.cool);const hp=t.hp,r=executeSkillRuntime(a,t,skills.cool);if(r.ok||r.reason!=='COOLDOWN')er.push(`result=${r.reason||r.ok}`);if(t.hp!==hp)er.push('CD中に効果発生');if(skillCooldownRemaining(a,skills.cool.id)!==300)er.push('CDが再開始された');return{remaining:skillCooldownRemaining(a,skills.cool.id),events:[...battle.validationEvents],errors:er}});
 add('COOLDOWN-RUNTIME-EXPIRE-REUSE','Tick300で満了し再使用可能',()=>{const f=prep(),a=f.allies[0],t=f.enemies[0],er=[];executeSkillRuntime(a,t,skills.cool);processTicks(299);if(skillCooldownRemaining(a,skills.cool.id)!==1)er.push('Tick299残1でない');const blocked=executeSkillRuntime(a,t,skills.cool);if(blocked.ok)er.push('Tick299で再使用');processTicks(1);if(skillCooldownRemaining(a,skills.cool.id)!==0)er.push('Tick300で満了しない');const reused=executeSkillRuntime(a,t,skills.cool);if(!reused.ok)er.push('満了後再使用不可');if(skillCooldownRemaining(a,skills.cool.id)!==300)er.push('再使用後CD300でない');return{tick:battle.tick,remaining_after_reuse:skillCooldownRemaining(a,skills.cool.id),events:[...battle.validationEvents],errors:er}});
 add('COOLDOWN-RUNTIME-ZERO','COOLDOWN未指定/0は状態を作らない',()=>{const f=prep(),a=f.allies[0],t=f.enemies[0],er=[];executeSkillRuntime(a,t,skills.attack);executeSkillRuntime(a,t,skills.attack);if(Object.keys(ensureCooldownState(a)).length)er.push('CD0でstate生成');return{cooldowns:{...ensureCooldownState(a)},events:[...battle.validationEvents],errors:er}});
 add('COOLDOWN-RUNTIME-RESERVATION-NO-START','予約時点ではCD開始なし',()=>{const f=prep(),a=f.allies[0],er=[];a.defaultSkillId=skills.cool.id;a.gauge=GAUGE_MAX;const ok=reserveAction(a);if(!ok)er.push('予約失敗');if(skillCooldownRemaining(a,skills.cool.id)!==0)er.push('予約でCD開始');if(ev('cooldown_started').length)er.push('予約でcooldown_started');return{reserved:!!a.reservedAction,remaining:skillCooldownRemaining(a,skills.cool.id),events:[...battle.validationEvents],errors:er}});
 add('COOLDOWN-RUNTIME-ACTION-DISABLED-NO-START','実行可能判定失敗ではCD開始なし',()=>{const f=prep(),a=f.allies[0],t=f.enemies[0],src=f.enemies[1],er=[];executeSkillRuntime(src,a,skills.disabled,{skipExecutionEligibility:true});const r=executeSkillRuntime(a,t,skills.cool);if(r.ok||r.reason!=='ACTION_DISABLED')er.push('行動不能ゲート不正');if(skillCooldownRemaining(a,skills.cool.id)!==0||ev('cooldown_started').some(x=>x.source_id===a.id))er.push('行動不能失敗でCD開始');return{reason:r.reason,remaining:skillCooldownRemaining(a,skills.cool.id),events:[...battle.validationEvents],errors:er}});
 add('COOLDOWN-RUNTIME-INVALID-TARGET-NO-START','対象不成立ではCD開始なし',()=>{const f=prep(),a=f.allies[0],er=[],r=executeSkillRuntime(a,null,skills.cool);if(r.ok||r.stage!=='target')er.push('対象不成立になっていない');if(skillCooldownRemaining(a,skills.cool.id)!==0||ev('cooldown_started').length)er.push('対象不成立でCD開始');return{stage:r.stage,reason:r.reason,remaining:skillCooldownRemaining(a,skills.cool.id),events:[...battle.validationEvents],errors:er}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COOLDOWN-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version,cooldown_skill_id:skills.cool.id},current_spec:{task_id:'P01-10',stage:'runtime_v1',runtime_application:true,unit:'tick',state_scope:'per_actor_per_skill',execution_eligibility_checks_cd:true,reservation_start:false,activation_established_starts_cd:true,zero_or_omitted_state:false,casting_connection:'deferred_existing_casting_foundation_not_present'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunCooldownRuntimeJson(){pauseBattle();const report=runCooldownRuntimeRegression();report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunCooldownRuntimeJson'};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cooldown-runtime-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COOLDOWN RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}
function runCostRuntimeRegression(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COST-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-11',stage:'runtime_v1'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]}};
 const skill=findSkill('SKL-COST-MP-20-CD-300');if(!skill)return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COST-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-11',stage:'runtime_v1'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['SKL-COST-MP-20-CD-300がありません']}};
 const cases=[];const add=(id,label,run)=>{try{const detail=run(),errors=detail.errors||[];cases.push({id,label,...detail,passed:errors.length===0,errors})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.gauge=0;u.statusEffects=[];u.cooldowns={};u.reservedAction=null;u.actionDisabled=false;u.maxMp=100;u.mp=100}return{actor:allies[0],ally:allies[1],target:enemies[0],enemy2:enemies[1]}};const ev=t=>battle.validationEvents.filter(x=>x.type===t);
 add('COST-RUNTIME-COMPILE','MP_COSTを共通costsへコンパイル',()=>{const c=compileSkillForRuntime(skill),er=[];if(!c.ok)er.push('compile failed');if(c.definition.parameters.mpCost!==20)er.push(`mpCost=${c.definition.parameters.mpCost}`);if(c.definition.costs.length!==1||c.definition.costs[0].type!=='mp'||c.definition.costs[0].amount!==20)er.push('costs構造不正');return{costs:c.definition.costs,errors:er}});
 add('COST-RUNTIME-CONSUME-AND-CD','発動成立時にMP消費とCD開始',()=>{const f=prep(),er=[],before=f.actor.mp,r=executeSkillRuntime(f.actor,f.target,skill);if(!r.ok)er.push('発動失敗');if(f.actor.mp!==before-20)er.push(`mp=${f.actor.mp}`);if(skillCooldownRemaining(f.actor,skill.id)!==300)er.push('CD開始なし');if(ev('cost_consumed').length!==1)er.push(`cost_event=${ev('cost_consumed').length}`);if(ev('cooldown_started').length!==1)er.push(`cd_event=${ev('cooldown_started').length}`);return{mp_before:before,mp_after:f.actor.mp,cooldown_remaining:skillCooldownRemaining(f.actor,skill.id),events:[...battle.validationEvents],errors:er}});
 add('COST-RUNTIME-SHORTAGE-BLOCK','MP不足なら効果・消費・CDなし',()=>{const f=prep(),er=[],hp=f.target.hp;f.actor.mp=19;const r=executeSkillRuntime(f.actor,f.target,skill);if(r.ok)er.push('不足で発動');if(r.reason!=='COST_SHORTAGE')er.push(`reason=${r.reason}`);if(f.actor.mp!==19)er.push('MP変化');if(f.target.hp!==hp)er.push('効果発生');if(ev('cost_consumed').length)er.push('cost消費イベント発生');if(ev('cooldown_started').length)er.push('CD開始');return{mp:f.actor.mp,target_hp_before:hp,target_hp_after:f.target.hp,events:[...battle.validationEvents],errors:er}});
 add('COST-RUNTIME-RESERVATION-NO-CONSUME','予約時点ではMP消費なし',()=>{const f=prep(),er=[],before=f.actor.mp;f.actor.defaultSkillId=skill.id;f.actor.gauge=GAUGE_MAX;const ok=reserveAction(f.actor);if(!ok)er.push('予約失敗');if(f.actor.mp!==before)er.push('予約でMP消費');if(ev('cost_consumed').length)er.push('予約でcostイベント');return{mp_before:before,mp_after:f.actor.mp,reserved:!!f.actor.reservedAction,events:[...battle.validationEvents],errors:er}});
 add('COST-RUNTIME-INVALID-TARGET-NO-CONSUME','対象不成立ならMP/CDなし',()=>{const f=prep(),er=[],before=f.actor.mp;f.target.hp=0;f.target.alive=false;const r=executeSkillRuntime(f.actor,f.target,skill);if(r.ok)er.push('無効対象で発動');if(f.actor.mp!==before)er.push('MP消費');if(skillCooldownRemaining(f.actor,skill.id)!==0)er.push('CD開始');return{mp_before:before,mp_after:f.actor.mp,events:[...battle.validationEvents],errors:er}});
 add('COST-RUNTIME-ACTION-DISABLED-NO-CONSUME','行動不能ならMP/CDなし',()=>{const f=prep(),er=[],before=f.actor.mp;f.actor.actionDisabled=true;const r=executeSkillRuntime(f.actor,f.target,skill);if(r.ok)er.push('行動不能で発動');if(f.actor.mp!==before)er.push('MP消費');if(skillCooldownRemaining(f.actor,skill.id)!==0)er.push('CD開始');return{mp_before:before,mp_after:f.actor.mp,events:[...battle.validationEvents],errors:er}});
 add('COST-RUNTIME-SECOND-USE-CD-BLOCK','初回消費後のCD中再使用では追加消費なし',()=>{const f=prep(),er=[];executeSkillRuntime(f.actor,f.target,skill);const afterFirst=f.actor.mp,r2=executeSkillRuntime(f.actor,f.target,skill);if(r2.ok)er.push('CD中再発動');if(f.actor.mp!==afterFirst)er.push('CD中に追加消費');if(ev('cost_consumed').length!==1)er.push(`cost_events=${ev('cost_consumed').length}`);return{mp_after_first:afterFirst,mp_after_second:f.actor.mp,events:[...battle.validationEvents],errors:er}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COST-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version,cost_skill_id:skill.id},current_spec:{task_id:'P01-11',stage:'runtime_v1',runtime_application:true,formal_cost_type:'mp',extensible_cost_structure:true,reservation_consumes:false,action_order_checks_cost:true,activation_established_consumes:true,activation_established_starts_cooldown:true,insufficient_cost_effect:false,casting_connection:'deferred_existing_casting_foundation_not_present',formal_integrated_spec:'戦闘仕様 正式統合版 v5'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunCostRuntimeJson(){pauseBattle();const report=runCostRuntimeRegression();report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunCostRuntimeJson'};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cost-runtime-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COST RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}

function runActionDisabledRuntimeRegression(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-ACTION-DISABLED-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-09',stage:'runtime_v1'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]}};
 const req=id=>{const x=findSkill(id);if(!x)throw new Error(`Studio正式スキル不足: ${id}`);if(x.source!=='studio_export'||(x.environment||'production')!=='production')throw new Error(`Studio production由来ではありません: ${id}`);return x};
 const skills={disabled:req('SKL-STATUS-ACTION-DISABLED-400'),attack:req('SKL-TEST-ATTACK'),poison:req('SKL-TEST-POISON'),shield:req('SKL-TEST-SHIELD-100'),counter:req('SKL-COUNTER-ATTACK-100'),follow:req('SKL-TEST-FOLLOW-POISON'),cover:req('SKL-COVER-SINGLE-ALLY'),aura:req('SKL-AURA-ALLY-ATK-10')};
 const cases=[],add=(id,label,run)=>{try{const out=run()||{},er=out.errors||[];cases.push({id,label,...out,passed:er.length===0,errors:er})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.gauge=0;u.actions=0;u.reservedAction=null;u.lastReservation=null;u.statusEffects=[];u.dotStacks=[];u.shieldEffects=[];u.coverEffects=[];u.counterSkillId=null;u.counterDisabled=false;u.actionDisabled=false;u.followUpSkillIds=[];u.auraSkillIds=[]}return{allies,enemies}};
 const applyDisabled=(source,target)=>executeSkillRuntime(source,target,skills.disabled,{skipExecutionEligibility:true});
 const ev=t=>battle.validationEvents.filter(x=>x.type===t);
 add('ACTION-DISABLED-RUNTIME-SKILL-BLOCK','行動順到達時のスキル実行を停止',()=>{const f=prep(),actor=f.allies[0],target=f.enemies[0],source=f.enemies[1],er=[],hp=target.hp;actor.gauge=GAUGE_MAX;actor.defaultSkillId=skills.attack.id;actor.reservedAction={id:'PRESENTATION-1',skillId:skills.attack.id,label:skills.attack.name,targetId:target.id,executeAt:0,status:'reserved'};applyDisabled(source,actor);const ok=executeReservation(actor),blocked=ev('action_execution_blocked').filter(x=>x.source_id===actor.id&&x.reason==='ACTION_DISABLED');if(ok)er.push('行動不能中にスキル実行');if(target.hp!==hp)er.push('対象HPが変化');if(actor.actions!==0)er.push(`actions=${actor.actions}`);if(blocked.length!==1)er.push(`blocked=${blocked.length}`);return{target_hp_before:hp,target_hp_after:target.hp,actor_actions:actor.actions,blocked_events:blocked,events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-NORMAL-BLOCK','通常行動も共通判定で停止',()=>{const f=prep(),actor=f.allies[0],target=f.enemies[0],source=f.enemies[1],er=[],hp=target.hp;applyDisabled(source,actor);const ok=performBasicAttack(actor,target),blocked=ev('action_execution_blocked').filter(x=>x.action_kind==='normal_action');if(ok)er.push('通常行動が実行');if(target.hp!==hp)er.push('通常行動でHP変化');if(blocked.length!==1)er.push(`blocked=${blocked.length}`);return{target_hp_before:hp,target_hp_after:target.hp,events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-EXPIRE-RESTORE','STATUS満了後は通常の実行判定へ復帰',()=>{const f=prep(),actor=f.allies[0],target=f.enemies[0],source=f.enemies[1],er=[];applyDisabled(source,actor);battle.tick=400;processStatusEffects();const eligibility=actionExecutionEligibility(actor,{actionKind:'skill_action'}),hp=target.hp,result=executeSkillRuntime(actor,target,skills.attack);if(!eligibility.ok)er.push('満了後も行動不能');if(!result.ok||target.hp>=hp)er.push('満了後に攻撃不成立');return{eligibility,target_hp_before:hp,target_hp_after:target.hp,events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-RESERVATION-PRESENTATION','予約内容は実行確定を拘束しない',()=>{const f=prep(),actor=f.allies[0],preview=f.enemies[0],actual=f.enemies[1],er=[];actor.gauge=GAUGE_MAX;actor.defaultSkillId=skills.attack.id;actor.reservedAction={id:'PRESENTATION-2',skillId:'PRESENTATION-ONLY',label:'演出予約',targetId:preview.id,executeAt:0,status:'reserved'};preview.hp=0;preview.alive=false;const hp=actual.hp,ok=executeReservation(actor),committed=ev('action_execution_committed');if(!ok)er.push('実行時再評価が失敗');if(actual.hp>=hp)er.push('実行時有効対象へ攻撃なし');if(committed.length!==1||committed[0].target_id!==actual.id)er.push('実行時対象が確定されていない');return{presentation_target_id:preview.id,executed_target_id:committed[0]?.target_id||null,actual_hp_before:hp,actual_hp_after:actual.hp,events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-COUNTER-BLOCK','STATUS行動不能でCOUNTER停止',()=>{const f=prep(),def=f.allies[0],atk=f.enemies[0],source=f.enemies[1],er=[];def.counterSkillId=skills.counter.id;applyDisabled(source,def);battle.validationEvents=[];executeSkillRuntime(atk,def,skills.attack);if(ev('counter_triggered').length)er.push('COUNTERが発動');if(!ev('counter_skipped').some(x=>x.reason==='ACTION_DISABLED'))er.push('ACTION_DISABLED skipなし');return{events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-FOLLOW-UP-BLOCK','STATUS行動不能でFOLLOW_UP停止',()=>{const f=prep(),initiator=f.allies[0],follower=f.allies[1],target=f.enemies[0],source=f.enemies[1],er=[];executeSkillRuntime(initiator,target,skills.poison);battle.validationEvents=[];follower.followUpSkillIds=[skills.follow.id];applyDisabled(source,follower);battle.validationEvents=[];dispatchConditionalFollowUps(initiator,target,{trigger:'ALLY_ATTACK',originSkillId:skills.attack.id,derivedGeneration:0});if(ev('follow_up_triggered').length)er.push('FOLLOW_UPが発動');if(!ev('follow_up_skipped').some(x=>x.reason==='ACTION_DISABLED'))er.push('ACTION_DISABLED skipなし');return{events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-DOT-CONTINUES','既存DOTは行動不能中も継続',()=>{const f=prep(),actor=f.allies[0],enemy=f.enemies[0],er=[];executeSkillRuntime(enemy,actor,skills.poison);applyDisabled(enemy,actor);const hp=actor.hp;battle.tick=100;processDotStacks();if(actor.hp>=hp)er.push('DOTが停止');return{hp_before:hp,hp_after:actor.hp,dot_count:ensureDotStackList(actor).length,events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-SHIELD-CONTINUES','既存SHIELDは行動不能中も継続',()=>{const f=prep(),actor=f.allies[0],ally=f.allies[1],enemy=f.enemies[0],er=[];executeSkillRuntime(ally,actor,skills.shield);applyDisabled(enemy,actor);const hp=actor.hp,shieldBefore=shieldTotal(actor);executeSkillRuntime(enemy,actor,skills.attack);if(actor.hp!==hp)er.push('シールドが機能せずHP減少');if(shieldTotal(actor)>=shieldBefore)er.push('シールドが消費されていない');return{hp_before:hp,hp_after:actor.hp,shield_before:shieldBefore,shield_after:shieldTotal(actor),events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-AURA-CONTINUES','既存AURAは行動不能中も継続',()=>{const f=prep(),source=f.allies[0],target=f.allies[1],enemy=f.enemies[0],er=[];source.auraSkillIds=[skills.aura.id];const before=effectiveAuraPower(target,'BUFF','ATK');applyDisabled(enemy,source);const after=effectiveAuraPower(target,'BUFF','ATK');if(before<=0)er.push('AURA事前値なし');if(after!==before)er.push(`AURA ${before}->${after}`);return{aura_before:before,aura_after:after,events:[...battle.validationEvents],errors:er}});
 add('ACTION-DISABLED-RUNTIME-COVER-CONTINUES','既存COVER関係はかばう側行動不能中も継続',()=>{const f=prep(),protectedUnit=f.allies[0],coverer=f.allies[1],enemy=f.enemies[0],source=f.enemies[1],er=[],ph=protectedUnit.hp,ch=coverer.hp;executeSkillRuntime(coverer,protectedUnit,skills.cover);applyDisabled(source,coverer);battle.validationEvents=[];executeSkillRuntime(enemy,protectedUnit,skills.attack);if(protectedUnit.hp!==ph)er.push('元対象が被弾');if(coverer.hp>=ch)er.push('かばう側が被弾していない');if(ev('cover_triggered').length!==1)er.push(`cover=${ev('cover_triggered').length}`);return{protected_hp_before:ph,protected_hp_after:protectedUnit.hp,coverer_hp_before:ch,coverer_hp_after:coverer.hp,events:[...battle.validationEvents],errors:er}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-ACTION-DISABLED-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null,action_disabled_skill_id:skills.disabled.id},current_spec:{task_id:'P01-09',stage:'runtime_v1',runtime_application:true,execution_decision_point:'action_order_execution_eligibility_check',reservation_semantics:'presentation_only_no_execution_right',blocked_actions:['normal_action','skill_action','COUNTER','FOLLOW_UP'],continuous_effects_continue:['DOT','SHIELD','AURA','COVER'],canonical_source:'STATUS payload action_disabled=true',individual_status_names:'not_formalized_here'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunActionDisabledRuntimeJson(){pauseBattle();const report=runActionDisabledRuntimeRegression();report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunActionDisabledRuntimeJson'};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-action-disabled-runtime-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[ACTION DISABLED RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}

function runActivationPriorityRuntimeValidation(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),formal_candidate:'P01-12-FORMAL-1',test:{id:'TAG-ACTIVATION-PRIORITY-RUNTIME-001',mode:'formal_runtime_candidate',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-12',stage:'formal_candidate_v1',formal_runtime_enabled:true,tag:'ACTIVATION_PRIORITY=<integer>',higher_first:true,same_tick_order_fixed_once:true,next_tick_redecides:true,tie_order:'deferred_P01-13'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]}};
 const high=findSkill('SKL-ACTIVATION-PRIORITY-HIGH'),low=findSkill('SKL-ACTIVATION-PRIORITY-LOW');
 const cases=[];const add=(id,label,run)=>{try{const detail=run(),errors=detail.errors||[];cases.push({id,label,...detail,passed:errors.length===0,errors})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=false;battle.validationActivationPriority=false;battle.validationCaptureEvents=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.gauge=0;u.actions=0;u.reservedAction=null;u.lastReservation=null;u.statusEffects=[];u.cooldowns={};u.maxMp=100;u.mp=100}return{highActor:allies[0],lowActor:allies[1],target:enemies[0]}};
 add('ACTIVATION-PRIORITY-COMPILE','整数優先度を正式コンパイル',()=>{const errors=[],hc=compileSkillForRuntime(high),lc=compileSkillForRuntime(low);if(!hc.ok||hc.definition.parameters.activationPriority!==100)errors.push('high compile');if(!lc.ok||lc.definition.parameters.activationPriority!==-100)errors.push('low compile');return{high_priority:hc.definition.parameters.activationPriority,low_priority:lc.definition.parameters.activationPriority,errors}});
 add('ACTIVATION-PRIORITY-FORMAL-SAME-TICK-HIGH-FIRST','正式ランタイム・同一Tickでは高優先度を先に固定',()=>{const f=prep(),errors=[];f.highActor.defaultSkillId=high.id;f.lowActor.defaultSkillId=low.id;f.highActor.gauge=GAUGE_MAX;f.lowActor.gauge=GAUGE_MAX;reserveAction(f.lowActor);reserveAction(f.highActor);f.lowActor.reservedAction.executeAt=1;f.highActor.reservedAction.executeAt=1;processTicks(1);const fixed=battle.validationEvents.find(x=>x.type==='activation_order_fixed'),committed=battle.validationEvents.filter(x=>x.type==='action_execution_committed');if(!activationPriorityFeatureEnabled())errors.push('formal runtime disabled');if(fixed?.order?.[0]?.source_id!==f.highActor.id)errors.push('high not first in fixed order');if(committed[0]?.source_id!==f.highActor.id)errors.push('high not first committed');return{validation_gate:battle.validationActivationPriority===true,formal_feature_enabled:activationPriorityFeatureEnabled(),fixed_order:fixed?.order||[],committed_order:committed.map(x=>x.source_id),errors}});
 add('ACTIVATION-PRIORITY-NEXT-TICK-REDECIDES','次Tickでは優先度を再決定',()=>{const f=prep(),errors=[];f.highActor.defaultSkillId=high.id;f.lowActor.defaultSkillId=low.id;f.highActor.gauge=GAUGE_MAX;f.lowActor.gauge=GAUGE_MAX;reserveAction(f.lowActor);reserveAction(f.highActor);f.lowActor.reservedAction.executeAt=1;f.highActor.reservedAction.executeAt=1;processTicks(1);const first=battle.validationEvents.filter(x=>x.type==='action_execution_committed').map(x=>x.source_id);battle.validationEvents=[];f.highActor.defaultSkillId=low.id;f.lowActor.defaultSkillId=high.id;f.highActor.gauge=GAUGE_MAX;f.lowActor.gauge=GAUGE_MAX;reserveAction(f.highActor);reserveAction(f.lowActor);f.highActor.reservedAction.executeAt=2;f.lowActor.reservedAction.executeAt=2;processTicks(1);const second=battle.validationEvents.filter(x=>x.type==='action_execution_committed').map(x=>x.source_id);if(first[0]!==f.highActor.id)errors.push('tick1 high actor not first');if(second[0]!==f.lowActor.id)errors.push('tick2 reassigned high actor not first');return{tick1_committed:first,tick2_committed:second,errors}});
 add('ACTIVATION-PRIORITY-DECIMAL-REJECT','小数優先度を拒否',()=>{const bad=findSkill('ACTIVATION-PRIORITY-VALIDATION-DECIMAL'),c=compileSkillForRuntime(bad),errors=[];if(c.ok)errors.push('decimal accepted');return{compiled_ok:c.ok,compiler_errors:c.errors,errors}});
 battle.validationCaptureEvents=false;battle.validationActivationPriority=false;const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),formal_candidate:'P01-12-FORMAL-1',test:{id:'TAG-ACTIVATION-PRIORITY-RUNTIME-001',mode:'formal_runtime_candidate',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null,high_skill_id:high?.id||null,low_skill_id:low?.id||null},current_spec:{task_id:'P01-12',stage:'formal_candidate_v1',formal_runtime_enabled:true,tag:'ACTIVATION_PRIORITY=<integer>',higher_first:true,same_tick_order_fixed_once:true,next_tick_redecides:true,tie_order:'deferred_P01-13'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunActivationPriorityRuntimeJson(){pauseBattle();const report=runActivationPriorityRuntimeValidation();const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-activation-priority-formal-runtime-device-validation-GA-B486.198-P01-12-FORMAL1-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[P01-12 ACTIVATION PRIORITY FORMAL] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[FORMAL ENABLED] YES\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}
function runBattleEndEffectClearValidation(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),formal_candidate:'P01-14-FORMAL-1',passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]};
 const cases=[],add=(id,label,run)=>{try{const detail=run(),errors=detail.errors||[];cases.push({id,label,...detail,passed:errors.length===0,errors})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=false;battle.validationCaptureEvents=true;battle.validationEvents=[];battle.tick=10;const allies=ensureValidationTargets('味方',3),u=allies[0],v=allies[1],enemies=battle.units.filter(x=>x.side==='敵');u.reservedAction={executeAt:99,skillId:'TEST'};u.shieldEffects=[{id:'P0114-S',remaining:50,amount:50,appliedAt:1,expiresAt:999}];u.statusEffects=[{instanceId:'P0114-ST',statusId:'P0114-STATUS',category:'status',appliedAt:1,expiresAt:999,payload:{}}];u.coverEffects=[{id:'P0114-C',sourceId:v.id,targetId:u.id,skillId:'P0114',priority:0,removable:true,lifetime:'persistent',remainingUses:null,appliedAt:1,expiresAt:null}];u.dotStacks=[{id:'P0114-D',sourceId:enemies[0]?.id||'E0',label:'P0114 DOT',power:1,appliedAt:1,expiresAt:999,nextTickAt:999,interval:100}];u.modifierStacks=[{id:'P0114-M',sourceId:v.id,kind:'BUFF',stat:'ATK',power:10,appliedAt:1,expiresAt:999}];u.cooldowns={'P0114-SKILL':{skillId:'P0114-SKILL',duration:999,startedAt:1,expiresAt:1000}};return{u}};
 const snap=u=>({reserved_action:!!u.reservedAction,shield_effects:(u.shieldEffects||[]).length,status_effects:(u.statusEffects||[]).length,cover_effects:(u.coverEffects||[]).length,dot_stacks:(u.dotStacks||[]).length,modifier_stacks:(u.modifierStacks||[]).length,cooldowns:Object.keys(u.cooldowns||{}).length,hp:u.hp,alive:u.alive});
 const defeat=()=>{for(const e of battle.units.filter(x=>x.side==='敵')){e.hp=0;e.alive=false}};
 add('BATTLE-END-FORMAL-CLEAR-ALL-TRANSIENT','正式終了処理で7種の戦闘内一時状態を全消去',()=>{const f=prep(),before=snap(f.u),errors=[];defeat();finishIfNeeded();const after=snap(f.u);for(const k of ['reserved_action','shield_effects','status_effects','cover_effects','dot_stacks','modifier_stacks','cooldowns'])if(after[k])errors.push(`${k} remains=${after[k]}`);if(after.hp!==before.hp||after.alive!==before.alive)errors.push('persistent unit state changed');return{before,after,pending_result:battle.pendingResult,result:battle.result,events:[...battle.validationEvents],errors}});
 add('BATTLE-END-FORMAL-IDEMPOTENT','正式終了処理の再呼出しで状態不変',()=>{const f=prep(),errors=[];defeat();finishIfNeeded();const once=snap(f.u);finishIfNeeded();const twice=snap(f.u);if(JSON.stringify(once)!==JSON.stringify(twice))errors.push('second finish changed state');return{once,twice,errors}});
 battle.validationCaptureEvents=false;const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),formal_candidate:'P01-14-FORMAL-1',test:{id:'TAG-BATTLE-END-EFFECT-CLEAR-003',mode:'formal_runtime_candidate',entrypoint:'game/index.html'},current_spec:{task_id:'P01-14',stage:'formal_candidate_v1',formal_runtime_enabled:true,battle_end_clear:['reserved_action','shield_effects','status_effects','cover_effects','dot_stacks','modifier_stacks','cooldowns']},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunBattleEndEffectClearJson(){pauseBattle();const report=runBattleEndEffectClearValidation();const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-battle-end-effect-clear-formal-runtime-device-validation-GA-B486.198-P01-14-FORMAL1-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[P01-14 BATTLE END CLEAR FORMAL-1] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}`;renderBattle();return report}
function runSimultaneousActivationOrderValidation(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),formal_candidate:'P01-13-FORMAL-1',test:{id:'TAG-SIMULTANEOUS-ACTIVATION-ORDER-004',mode:'formal_runtime_candidate',entrypoint:'game/index.html'},passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]};
 const neutral=findSkill('SKL-TEST-ATTACK'),high=findSkill('SKL-ACTIVATION-PRIORITY-HIGH'),cases=[];const seed='P01-13-FORMAL1-SEED-001';
 const add=(id,label,run)=>{try{const detail=run(),errors=detail.errors||[];cases.push({id,label,...detail,passed:errors.length===0,errors})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=(useSeed=seed)=>{pauseBattle();resetBattle();battle.validationMode=false;battle.validationCaptureEvents=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.gauge=0;u.actions=0;u.reservedAction=null;u.lastReservation=null;u.statusEffects=[];u.cooldowns={};u.maxMp=100;u.mp=100;u.defaultSkillId=neutral.id}const rolls=initializeBattleTieRolls(useSeed);return{a:allies[0],b:allies[1],c:allies[2],target:enemies[0],rolls}};
 const resultOrder=()=>({fixed:(battle.validationEvents.find(x=>x.type==='activation_order_fixed')?.order||[]),committed:battle.validationEvents.filter(x=>x.type==='action_execution_committed').map(x=>x.source_id)});
 add('SIMULTANEOUS-FORMAL-BATTLE-START-ASSIGN','正式ランタイムで戦闘開始時seed/tie rollを保持',()=>{const f=prep(),errors=[];if(!battle.p0113TieSeed)errors.push('battle seed missing');if(f.rolls.length!==battle.units.length)errors.push('not all participants assigned');if(new Set(f.rolls.map(x=>x.tie_roll)).size!==f.rolls.length)errors.push('rolls not unique');return{battle_seed:battle.p0113TieSeed,rolls:f.rolls,errors}});
 add('SIMULTANEOUS-FORMAL-REPRODUCIBLE','固定seedでは正式割当を完全再現',()=>{const f1=prep(seed),r1=JSON.stringify(f1.rolls);const f2=prep(seed),r2=JSON.stringify(f2.rolls),errors=[];if(r1!==r2)errors.push('same seed mismatch');return{battle_seed:seed,first:f1.rolls,second:f2.rolls,errors}});
 add('SIMULTANEOUS-FORMAL-TIEROLL-TIEBREAK','同ACTIVATION_PRIORITYはbattleTieRoll高値を正式優先',()=>{const f=prep(),errors=[];const pair=[f.a,f.b].sort((x,y)=>y.battleTieRoll-x.battleTieRoll),winner=pair[0],loser=pair[1];winner.agi=1;winner.gauge=GAUGE_MAX;loser.agi=999;loser.gauge=GAUGE_MAX+999;for(const u of [loser,winner]){reserveAction(u);u.reservedAction.executeAt=1}processTicks(1);const o=resultOrder();if(o.fixed[0]?.source_id!==winner.id)errors.push('tie roll winner not first fixed');if(o.committed[0]!==winner.id)errors.push('tie roll winner not first committed');return{winner:{actor_id:winner.id,tie_roll:winner.battleTieRoll},loser:{actor_id:loser.id,tie_roll:loser.battleTieRoll},fixed_order:o.fixed,committed_order:o.committed,errors}});
 add('SIMULTANEOUS-FORMAL-ACTIVATION-PRIORITY-FIRST','ACTIVATION_PRIORITYはbattleTieRollより常に優先',()=>{const f=prep(),errors=[];const lowRoll=[f.a,f.b].sort((x,y)=>x.battleTieRoll-y.battleTieRoll)[0],highRoll=[f.a,f.b].find(x=>x!==lowRoll);lowRoll.defaultSkillId=high.id;highRoll.defaultSkillId=neutral.id;for(const u of [highRoll,lowRoll]){u.gauge=GAUGE_MAX;reserveAction(u);u.reservedAction.executeAt=1}processTicks(1);const o=resultOrder();if(o.fixed[0]?.source_id!==lowRoll.id)errors.push('activation priority did not override tie roll');if(o.committed[0]!==lowRoll.id)errors.push('activation priority winner not committed first');return{activation_priority_winner:{actor_id:lowRoll.id,tie_roll:lowRoll.battleTieRoll},higher_tie_roll_actor:{actor_id:highRoll.id,tie_roll:highRoll.battleTieRoll},fixed_order:o.fixed,committed_order:o.committed,errors}});
 add('SIMULTANEOUS-FORMAL-STABLE-UNTIL-END','正式battleTieRollは戦闘中固定',()=>{const f=prep(),errors=[],before=f.rolls.map(x=>({actor_id:x.actor_id,tie_roll:x.tie_roll})).sort((a,b)=>a.actor_id.localeCompare(b.actor_id));processTicks(3);const after=battle.units.map(u=>({actor_id:u.id,tie_roll:u.battleTieRoll})).sort((a,b)=>a.actor_id.localeCompare(b.actor_id));if(JSON.stringify(before)!==JSON.stringify(after))errors.push('battle tie roll changed');return{battle_seed:battle.p0113TieSeed,before,after,errors}});
 battle.validationCaptureEvents=false;const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),formal_candidate:'P01-13-FORMAL-1',test:{id:'TAG-SIMULTANEOUS-ACTIVATION-ORDER-004',mode:'formal_runtime_candidate',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-13',stage:'formal_candidate_v1',formal_runtime_enabled:true,formal_order:['activation_priority_desc','battle_tie_roll_desc'],battle_tie_roll:{seeded:true,assigned_once_at_battle_start:true,stable_until_battle_end:true,collision_rule:'reroll_colliding_actors_until_unique'},legacy_tie_keys_removed:['gauge_overflow','AGI','actor_order']},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunSimultaneousActivationOrderJson(){pauseBattle();const report=runSimultaneousActivationOrderValidation();const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-simultaneous-activation-order-formal-runtime-device-validation-GA-B486.198-P01-13-FORMAL1-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[P01-13 SIMULTANEOUS ORDER FORMAL-1] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[FORMAL RUNTIME] ENABLED\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}



function resolveSkillCompileService(){
 const formal=globalThis.GKSSkillCompileService;
 return formal?.compileSkill?formal:null;
}
async function runR04TriggerFoundationDeviceValidation(){
 const gameBuild=window.GA_PROJECT_CONFIG?.gameBuild||'UNKNOWN',entrypoint='game/index.html',engine=globalThis.GKSTriggerEngine,bridge=resolveSkillCompileService(),cases=[],rejectionCases=[],errors=[];
 const add=(bucket,id,label,detail)=>{const er=detail.errors||[],row={id,label,...detail,passed:er.length===0,errors:er};bucket.push(row);if(er.length)errors.push(...er.map(x=>`${id}: ${x}`));return row};
 if(!engine?.create||!engine?.tryActivate||!engine?.orderSimultaneousCandidates)throw new Error('GKSTriggerEngine is not loaded');
 if(!bridge?.loadRegistry)throw new Error('GKSSkillCompileService.loadRegistry is not loaded');
 const registry=await bridge.loadRegistry({force:true}),seen=[],runtime=engine.create(registry,{eventSink:e=>seen.push(e)}),required=['ON_USE','ON_HIT_RECEIVED','ON_DAMAGE_DEALT','ON_TURN_START','ON_TURN_END','ON_DEATH','ON_STATUS_APPLIED'];
 for(const type of required){const resolved=runtime.resolve(type),validated=runtime.validate({type,scope:'SELF'}),recorded=runtime.record(type,{device_probe:true}),er=[];if(!resolved.ok)er.push(`resolve=${resolved.reason}`);if(!validated.ok)er.push(`validate=${validated.reason}`);if(!recorded.ok)er.push(`record=${recorded.reason}`);const expected=registry?.triggers?.[type];if(resolved.ok&&expected&&resolved.definition?.engine_event!==expected.engine_event)er.push(`engine_event=${resolved.definition?.engine_event}/${expected.engine_event}`);add(cases,`R04-A-${type}`,`R04-A ${type} registry resolve/validate/record`,{source:'current_registry_device_probe',resolved,validated,recorded,errors:er})}
 const unknown=runtime.resolve('COUNTER');add(rejectionCases,'R04-A-UNKNOWN-TRIGGER','未知/Legacy名Triggerをfail-closedで拒否',{expected:'REJECT',actual:unknown.ok?'ACCEPT':'REJECT',result:unknown,errors:(!unknown.ok&&unknown.reason==='TRIGGER_TYPE_UNSUPPORTED')?[]:[`reason=${unknown.reason||'ACCEPT'}`]});
 const badScope=runtime.validate({type:'ON_USE',scope:'TARGET'});add(rejectionCases,'R04-A-INVALID-SCOPE','ON_USEの不正scopeを拒否',{expected:'REJECT',actual:badScope.ok?'ACCEPT':'REJECT',result:badScope,errors:badScope.ok?['invalid scope accepted']:[]});
 const hitDef=registry?.triggers?.ON_HIT_RECEIVED||{},hitContract={type:'ON_HIT_RECEIVED',engineEvent:hitDef.engine_event,dispatchMode:hitDef.dispatch_mode};
 const mismatch=engine.validateCompiledContract(hitContract,'ally_attack');add(rejectionCases,'R04-E-EVENT-MISMATCH','compiled triggerのevent不一致を拒否',{expected:'REJECT',actual:mismatch.ok?'ACCEPT':'REJECT',result:mismatch,errors:(!mismatch.ok&&mismatch.reason==='TRIGGER_ENGINE_EVENT_MISMATCH')?[]:[`reason=${mismatch.reason||'ACCEPT'}`]});
 const badDispatch=engine.validateCompiledContract({...hitContract,dispatchMode:'FUTURE_UNSAFE'},hitDef.engine_event);add(rejectionCases,'R04-E-UNSUPPORTED-DISPATCH','未対応dispatch modeを拒否',{expected:'REJECT',actual:badDispatch.ok?'ACCEPT':'REJECT',result:badDispatch,errors:(!badDispatch.ok&&badDispatch.reason==='TRIGGER_DISPATCH_MODE_UNSUPPORTED')?[]:[`reason=${badDispatch.reason||'ACCEPT'}`]});
 let dispatchCalls=0;const dispatched=engine.dispatchCompiled(hitContract,hitDef.engine_event,{device_probe:true},()=>{dispatchCalls++;return{ok:true}}),dispatchErrors=[];if(!dispatched.ok||dispatchCalls!==1)dispatchErrors.push(`dispatch ok=${dispatched.ok} calls=${dispatchCalls}`);add(cases,'R04-E-DISPATCH','正しいcompiled triggerだけhandlerへdispatch',{dispatch_result:dispatched,handler_calls:dispatchCalls,errors:dispatchErrors});
 const ordered=engine.orderSimultaneousCandidates([{id:'follow-high',kind:'FOLLOW_UP',priority:100,sequence:3},{id:'counter',kind:'COUNTER',priority:-100,sequence:2},{id:'follow-first',kind:'FOLLOW_UP',priority:7,sequence:0},{id:'follow-second',kind:'FOLLOW_UP',priority:7,sequence:1}]),expectedOrder=['counter','follow-high','follow-first','follow-second'],orderErrors=[];if(JSON.stringify(ordered.map(x=>x.id))!==JSON.stringify(expectedOrder))orderErrors.push(`order=${ordered.map(x=>x.id).join(',')}`);add(cases,'R04-E-SIMULTANEOUS-ORDER','COUNTER family→FOLLOW_UP、同familyはpriority/sequence順',{expected_order:expectedOrder,actual_order:ordered.map(x=>x.id),ordered,errors:orderErrors});
 const reentryContext=engine.createActionContext({actionId:'R04-DEVICE-REENTRY'}),first=engine.tryActivate(reentryContext,'COUNTER:A',{kind:'COUNTER'}),reentry=engine.tryActivate(reentryContext,'COUNTER:A',{kind:'COUNTER'}),reentryErrors=[];if(!first.ok)reentryErrors.push(`first=${first.reason}`);if(reentry.ok||reentry.reason!=='TRIGGER_REENTRY_BLOCKED')reentryErrors.push(`reentry=${reentry.reason||'ACCEPT'}`);first.release?.();add(rejectionCases,'R04-E-REENTRY','同一action内のTrigger再入を拒否',{expected:'REJECT_SECOND',actual:reentry.ok?'ACCEPT_SECOND':'REJECT_SECOND',first:{ok:first.ok,index:first.index},second:reentry,activation_count:reentryContext.activationCount,errors:reentryErrors});
 const limitContext=engine.createActionContext({actionId:'R04-DEVICE-LIMIT'}),accepted=[];for(let i=0;i<engine.DEFAULT_ACTION_TRIGGER_LIMIT;i++){const token=engine.tryActivate(limitContext,`FOLLOW_UP:${i}`,{kind:'FOLLOW_UP'});accepted.push({index:i+1,ok:token.ok,reason:token.reason||null});token.release?.()}const overflow=engine.tryActivate(limitContext,'FOLLOW_UP:OVERFLOW',{kind:'FOLLOW_UP'}),limitErrors=[];if(accepted.some(x=>!x.ok))limitErrors.push('activation before limit rejected');if(overflow.ok||overflow.reason!=='TRIGGER_ACTION_LIMIT_REACHED')limitErrors.push(`overflow=${overflow.reason||'ACCEPT'}`);add(rejectionCases,'R04-E-ACTION-LIMIT','1action最大Trigger発動数を超えた17回目を拒否',{expected_limit:engine.DEFAULT_ACTION_TRIGGER_LIMIT,accepted_count:accepted.filter(x=>x.ok).length,overflow,errors:limitErrors});
 const recordErrors=[];if(seen.length!==required.length)recordErrors.push(`recorded=${seen.length}/${required.length}`);add(cases,'R04-A-RECORD-AUDIT','7種Triggerのresolution eventを実機上で記録',{recorded_count:seen.length,expected_count:required.length,events:seen,errors:recordErrors});
 return{schema_version:'1.0.0',build:gameBuild,generated_at:new Date().toISOString(),test:{id:'R04-TRIGGER-FOUNDATION-DEVICE-001',mode:'current_registry_trigger_foundation_and_guard_device_revalidation',entrypoint,trigger:'tagTestRunR04TriggerFoundationJson'},provenance:{registry_source:'current_skill_registry_via_GKSSkillCompileService',uses_studio_export:false,uses_retired_demo_export:false,production_browser_trigger_engine:true},scope:['R04-A seven Trigger Registry types','R04-A fail-closed validation','R04-E compiled event/dispatch rejection','R04-E simultaneous ordering','R04-E recursion/re-entry guard','R04-E one-action activation limit'],cases,rejection_cases:rejectionCases,summary:{positive_case_count:cases.length,positive_passed_count:cases.filter(x=>x.passed).length,rejection_case_count:rejectionCases.length,rejection_passed_count:rejectionCases.filter(x=>x.passed).length,passed:errors.length===0,errors}};
}
async function tagTestRunR04TriggerFoundationJson(){
 pauseBattle();const report=await runR04TriggerFoundationDeviceValidation(),build=report.build||'UNKNOWN';const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`r04-trigger-foundation-device-validation-${build}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[R04 TRIGGER FOUNDATION] ${report.summary.passed?'PASS':'FAIL'}\n[POSITIVE] ${report.summary.positive_passed_count}/${report.summary.positive_case_count}\n[REJECTION] ${report.summary.rejection_passed_count}/${report.summary.rejection_case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;renderBattle();return report;
}


function runCounterRuntimeRegression(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COUNTER-RUNTIME-002',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-07',stage:'runtime_v1_1'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]}};
 const requireSkill=id=>{const x=findSkill(id);if(!x)throw new Error(`Studio正式スキル不足: ${id}`);if(x.source!=='studio_export'||(x.environment||'production')!=='production')throw new Error(`Studio production由来ではありません: ${id}`);return x};
 const counter=requireSkill('SKL-COUNTER-ATTACK-100'),counterStatus=requireSkill('SKL-COUNTER-TEST-ATTACK-STATUS-100'),single=requireSkill('SKL-TEST-ATTACK'),area=requireSkill('SKL-COUNTER-TEST-INCOMING-ALL-60');
 const cases=[];const add=(id,label,run)=>{try{const detail=run(),errors=detail.errors||[];cases.push({id,label,...detail,passed:errors.length===0,errors})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{resetBattle();battle.validationMode=true;battle.validationEvents=[];const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.counterSkillId=null;u.counterDisabled=false;u.hp=u.maxHp;u.alive=true;u.shieldEffects=[];u.statusEffects=[]}return{defender:allies[0],ally:allies[1],attacker:enemies[0],enemy2:enemies[1]}};
 add('COUNTER-RUNTIME-BASIC','単体直接ATTACK命中で反撃',()=>{const f=prep();f.defender.counterSkillId=counter.id;const ah=f.attacker.hp;executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length!==1)er.push(`trigger=${ev.length}`);if(f.attacker.hp>=ah)er.push('攻撃者へ反撃ダメージなし');return{attacker_hp_before:ah,attacker_hp_after:f.attacker.hp,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-SHIELD-ZERO','シールド全吸収でも反撃',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.defender.shieldEffects=[{id:'TEST-SHIELD',sequence:1,sourceId:f.defender.id,skillId:'TEST',skillName:'TEST',amount:9999,remaining:9999,appliedAt:0,expiresAt:9999}];const hp=f.defender.hp;executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(f.defender.hp!==hp)er.push('HPが減少');if(ev.length!==1)er.push(`trigger=${ev.length}`);return{defender_hp_before:hp,defender_hp_after:f.defender.hp,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-DEFENDER-DEAD','被弾死亡時は反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.defender.hp=1;executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('死亡後に反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-AREA-BLOCK','範囲攻撃には反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;executeSkillRuntime(f.attacker,f.defender,area,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('範囲攻撃へ反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-DERIVED-BLOCK','派生originには反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;executeSkillRuntime(f.attacker,f.defender,single,{origin:'follow_up',suppressDerived:true});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('派生攻撃へ反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-BATTLE-END','元攻撃で戦闘終了確定ならBATTLE_ENDゲートで反撃しない',()=>{const f=prep();f.defender.side='敵';f.attacker.side='味方';f.defender.counterSkillId=counter.id;f.defender.hp=1;for(const u of battle.units){if(u.side==='敵'&&u.id!==f.defender.id){u.hp=0;u.alive=false}}executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),skip=battle.validationEvents.filter(x=>x.type==='counter_skipped'&&x.reason==='BATTLE_END'),er=[];if(ev.length)er.push('戦闘終了確定後に反撃');if(!battle.pendingResult&&!battle.result)er.push('戦闘終了が確定していません');if(skip.length!==1)er.push(`BATTLE_END gate=${skip.length}`);return{pending_result:battle.pendingResult,result:battle.result,battle_end_gate_count:skip.length,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-ATTACHED-STATUS','反撃ATTACKの付随STATUSも既存パイプラインで適用',()=>{const f=prep();f.defender.counterSkillId=counterStatus.id;const before=ensureStatusEffects(f.attacker).length;executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const triggered=battle.validationEvents.filter(x=>x.type==='counter_triggered'&&x.counter_skill_id===counterStatus.id),applied=battle.validationEvents.filter(x=>x.type==='status_applied'&&x.skill_id===counterStatus.id&&x.target_id===f.attacker.id),after=ensureStatusEffects(f.attacker),matched=after.filter(x=>x.statusId==='STATUS-ACCURACY-DOWN'&&x.skillId===counterStatus.id),er=[];if(triggered.length!==1)er.push(`counter_triggered=${triggered.length}`);if(applied.length!==1)er.push(`status_applied=${applied.length}`);if(matched.length!==1)er.push(`status_effect=${matched.length}`);return{status_count_before:before,status_count_after:after.length,status_id:'STATUS-ACCURACY-DOWN',counter_skill_id:counterStatus.id,status_events:applied,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-ACTION-DISABLED','行動不能なら反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.defender.counterDisabled=true;executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('行動不能で反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-NO-CHAIN','反撃から反撃・追撃を連鎖しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.attacker.counterSkillId=counter.id;const follower=f.ally;follower.followUpSkillIds=['SKL-TEST-FOLLOW-POISON'];executeSkillRuntime(f.attacker,f.defender,single,{origin:'base'});const triggered=battle.validationEvents.filter(x=>x.type==='counter_triggered'),chain=battle.validationEvents.filter(x=>x.type==='counter_chain_blocked'),er=[];if(triggered.length!==1)er.push(`counter_triggered=${triggered.length}`);if(!chain.length)er.push('counter chain block記録なし');return{events:[...battle.validationEvents],errors:er}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.198',generated_at:new Date().toISOString(),test:{id:'TAG-COUNTER-RUNTIME-002',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null,counter_skill_id:counter.id,status_counter_skill_id:counterStatus.id,area_fixture_skill_id:area.id},current_spec:{task_id:'P01-07',stage:'runtime_v1_1',trigger:'hit',incoming_direct_single_only:true,shield_zero_damage_counter:true,defender_alive_required:true,battle_end_blocks_counter:true,battle_end_gate_verified:true,counter_target:'attacker',attack_definition:'existing ATTACK pipeline',attached_attack_effects:'existing ATTACK pipeline',counter_and_follow_up_chain:false,action_disabled_blocks_counter:true,critical:'deferred_to_attack_runtime',passive_trigger_pipeline:'deferred_to_attack_runtime'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunCounterRuntimeJson(){
 pauseBattle();if(studioSkillBridge.status!=='loaded'){const out=document.getElementById('tagTestResult');if(out)out.textContent='[COUNTER RUNTIME] Studioデータを読み込んでから再実行してください';return null}
 const report=runCounterRuntimeRegression(),errors=report.summary.errors||[];
 report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunCounterRuntimeJson'};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-counter-runtime-device-validation-GA-B486.198-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COUNTER RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${errors.length}${errors.length?'\n'+errors.join('\n'):''}`;return report;
}





