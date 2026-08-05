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
const SAVE_KEY='guildAdventureV9.save.v1', SAVE_VERSION=1;
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
const QUESTS=[
 {id:'Q-001',name:'街道の魔物討伐',rank:'E',stars:1,recommendedLevel:1,description:'街道を塞ぐスライムとウルフを討伐する。',reward:180,bonus:60,enemies:[{name:'森スライム',agi:7,attack:22,maxHp:240},{name:'街道ウルフ',agi:12,attack:30,maxHp:300}],drops:['錆びた剣','旅人の外套','革の腕輪']},
 {id:'Q-002',name:'ゴブリン斥候隊',rank:'D',stars:2,recommendedLevel:4,description:'森に入り込んだゴブリン斥候隊を排除する。',reward:320,bonus:120,enemies:[{name:'ゴブリン斥候',agi:11,attack:35,maxHp:360},{name:'ゴブリン弓兵',agi:9,attack:40,maxHp:300},{name:'ゴブリン隊長',agi:8,attack:48,maxHp:520}],drops:['青銅の剣','革の鎧','狩人の弓','迅速の指輪']},
 {id:'Q-003',name:'古代祭壇の守護者',rank:'C',stars:4,recommendedLevel:8,description:'古代祭壇で目覚めた守護者を鎮める。高レア装備の可能性がある。',reward:600,bonus:300,enemies:[{name:'石像守護者',agi:6,attack:58,maxHp:900},{name:'紋章の残響',agi:14,attack:42,maxHp:480}],drops:['紋章の剣','守護者の鎧','魔力の指輪','古代の護符']}
];
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
let data={saveVersion:SAVE_VERSION,schemaRevision:'1.1.0',gameVersion:'GA-B474',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),characters:[],partyIds:[],selectedQuestId:'Q-001',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null}};let selectedId=null;
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
function beginNewGame(){seedRoster();resetBattle();render();setPhase('base')}
function continueGame(){
 
$('titleStart').onclick=beginNewGame;
$('titleContinue').onclick=continueGame;
$('titleSettings').onclick=()=>alert('設定画面は後続Buildで独立フェーズとして接続します。');
if($('baseToTitle'))$('baseToTitle').onclick=()=>setPhase('title');
$('baseDepart').onclick=$('baseDepartSide').onclick=()=>{if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');return}prepareEvent();setPhase('event')};
$('eventBackBase').onclick=$('eventRetreat').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('eventObserve').onclick=()=>{const q=selectedQuest();$('eventNotice').textContent='敵情報：'+q.enemies.map(e=>`${e.name}(HP${e.maxHp}/攻撃${e.attack}/AGI${e.agi})`).join('、')};
$('eventBattle').onclick=()=>{resetBattle();setPhase('battle')};
$('battleAbort').onclick=()=>setPhase('event');
$('resultToEvent').onclick=()=>setPhase('event',{keepBattle:true});
$('resultToBase').onclick=()=>{setPhase('base',{keepBattle:true});setBaseView('home',{instant:true})};
document.querySelectorAll('#phaseDevNav [data-phase]').forEach(btn=>btn.onclick=()=>setPhase(btn.dataset.phase,{keepBattle:true}));
document.querySelectorAll('#baseMobileNav [data-base-tab]').forEach(btn=>btn.onclick=()=>setBaseView(btn.dataset.baseTab));
document.querySelectorAll('[data-open-base-view]').forEach(btn=>btn.onclick=()=>setBaseView(btn.dataset.openBaseView));
const mobileDepart=$('mobileDepart');if(mobileDepart)mobileDepart.onclick=()=>{if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');setBaseView('party');return}prepareEvent();setPhase('event')};

$('devGoBattle').onclick=()=>{resetBattle();setPhase('battle')};
$('devGoBase').onclick=()=>setPhase('base',{keepBattle:true});
$('devGoEvent').onclick=()=>setPhase('event',{keepBattle:true});
$('devGoResult').onclick=()=>setPhase('result',{keepBattle:true});
if($('devStudioLink')&&$('studioBackLink'))$('devStudioLink').href=$('studioBackLink').href;

try{const raw=localStorage.getItem(SAVE_KEY);if(raw){data=normalize(JSON.parse(raw));selectedId=data.characters[0]?.id||null;render();notify('セーブデータを読み込みました。');}}
 catch(e){alert(`読込失敗: ${e.message}`);return}
 setPhase('base');
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
 const victory=battle.result==='味方勝利';
 const quest=selectedQuest();const reward=victory?quest.reward:0;let dropped=null;if(victory&&quest.drops.length){const eligible=quest.drops.map(n=>({name:n,e:EQUIPMENT[n]}));const total=eligible.reduce((a,x)=>a+(RARITY[x.e.rarity]?.weight||1),0);let roll=Math.random()*total;for(const x of eligible){roll-=RARITY[x.e.rarity]?.weight||1;if(roll<=0){dropped=x.name;break}}dropped=dropped||eligible[0].name;}
 data.guild=data.guild||{gold:0,victories:0,defeats:0,lastBattle:null};
 if(victory){data.guild.gold=(data.guild.gold||0)+reward;data.guild.victories=(data.guild.victories||0)+1}
 else if(battle.result==='敵勝利'){data.guild.defeats=(data.guild.defeats||0)+1}
 data.guild.lastBattle={result:battle.result,rewardGold:reward,tick:battle.tick,actions:battle.actions,at:new Date().toISOString()};
 if(dropped)data.inventory.push(dropped);battle.reward={gold:reward,victory,dropped};battle.rewardApplied=true;persist();renderGuildSummary();
 return battle.reward;
}
function renderBattleResult(){
 const reward=applyBattleOutcome()||{gold:0,victory:false};
 $('resultHeading').textContent=battle.result||'戦闘結果';
 $('resultSummary').textContent=`${battle.actions}回の行動、${battle.tick} Tickで戦闘が終了しました。`;
 const panel=$('resultReward');
 if(panel)panel.innerHTML=reward.victory
  ?`<h3>遠征報酬</h3><p>ギルド資金 <b>+${reward.gold} G</b></p>${reward.dropped?`<div class="loot-reveal rarity-${EQUIPMENT[reward.dropped].rarity}"><div class="small">戦利品を獲得</div><b>${RARITY[EQUIPMENT[reward.dropped].rarity].label} ${reward.dropped}</b><div class="small">${RARITY[EQUIPMENT[reward.dropped].rarity].name} ／ ${EQUIPMENT[reward.dropped].description}</div></div>`:''}<p class="small">現在の所持金：${data.guild.gold} G ／ 戦績：${data.guild.victories}勝 ${data.guild.defeats}敗</p>`
  :`<h3>遠征結果</h3><p>今回は報酬を獲得できませんでした。</p><p class="small">現在の所持金：${data.guild.gold} G ／ 戦績：${data.guild.victories}勝 ${data.guild.defeats}敗</p>`;
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
function makeCharacter(name,job){return{id:uid(),name,level:1,job,stats:Object.fromEntries(STATS.map(s=>[s,10])),skills:['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'],equippedSkillId:'SKL-TEST-ATTACK',aiGraph:defaultAiGraph(),aiPolicy:'lowestHp',equipment:{weapon:null,armor:null,accessory:null},jobHistory:[{job,level:1,at:new Date().toISOString()}],growthHistory:[],createdAt:new Date().toISOString()}}
function normalize(raw){
 if(!raw||raw.saveVersion!==1||!Array.isArray(raw.characters))throw new Error('Save Data Version 1ではありません。');
 raw.characters.forEach(c=>{
  if(!c.id||typeof c.name!=='string'||!c.name.trim()||!JOBS[c.job]||!Number.isInteger(c.level)||c.level<1||c.level>50)throw new Error('キャラクターデータが不正です。');
  if(!c.stats||typeof c.stats!=='object')throw new Error(`${c.name}の能力値が不正です。`);
  STATS.forEach(s=>{if(!Number.isInteger(c.stats[s])||c.stats[s]<0)throw new Error(`${c.name}の${s}が不正です。`)});
  c.skills=Array.isArray(c.skills)&&c.skills.length?c.skills.filter(id=>['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'].includes(id)):['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'];c.equippedSkillId=c.skills.includes(c.equippedSkillId)?c.equippedSkillId:(c.skills[0]||'SKL-TEST-ATTACK');c.aiGraph=normalizeAiGraph(c.aiGraph);
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
 raw.selectedQuestId=QUESTS.some(q=>q.id===raw.selectedQuestId)?raw.selectedQuestId:'Q-001';
 raw.inventory=Array.isArray(raw.inventory)?raw.inventory.filter(x=>EQUIPMENT[x]):[];
 raw.characters.forEach(c=>{c.aiPolicy=['weakest','lowestHp','random','boss','finish'].includes(c.aiPolicy)?c.aiPolicy:'lowestHp';c.equipment=c.equipment&&typeof c.equipment==='object'?c.equipment:{weapon:null,armor:null,accessory:null}});
 raw.schemaRevision='1.4.0';raw.gameVersion='GA-B474';
 return raw;
}
function persist(){data.updatedAt=new Date().toISOString();localStorage.setItem(SAVE_KEY,JSON.stringify(data))}
function render(){
 const roster=$('roster');$('empty').classList.toggle('hidden',data.characters.length>0);roster.innerHTML=data.characters.map(c=>`<button class="unit adventurer-row ${c.id===selectedId?'selected':''}" data-id="${c.id}"><div><div class="name">${escapeHtml(c.name)}</div><span class="tag">Lv ${c.level}</span><span class="tag">${c.job}</span></div><span class="adventurer-arrow">›</span></button>`).join('');
 roster.querySelectorAll('.unit').forEach(el=>el.onclick=()=>{selectedId=el.dataset.id;render();setBaseView('adventurer',{keepScroll:true});$('detailCard')?.scrollIntoView({behavior:'smooth',block:'start'})});
 renderExpeditionSetup();
 const c=data.characters.find(x=>x.id===selectedId);$('detailCard').classList.toggle('hidden',!c);renderCharacterSkillView();if(!c)return;
 if($('changeJob'))$('changeJob').value=c.job;const currentA=JOBS[c.job];
 $('detail').innerHTML=`<div class="row"><div><div class="name">${escapeHtml(c.name)}</div><span class="tag">Lv ${c.level} / 50</span><span class="tag">現在職：${c.job}</span></div></div><div class="stats">${STATS.map(s=>`<div class="stat"><span class="small">${s}</span><b>${c.stats[s]}</b></div>`).join('')}</div><h3>装着スキル</h3><div class="small">${escapeHtml(findTagSkill(c.equippedSkillId)?.name||'未装着')}</div><h3>装備</h3><div class="small">${Object.values(c.equipment||{}).filter(Boolean).join(' / ')||'なし'}（攻撃 +${equipmentBonus(c).attack} / HP +${equipmentBonus(c).maxHp} / AGI ${equipmentBonus(c).agi>=0?'+':''}${equipmentBonus(c).agi}）</div><h3>転職履歴</h3><div class="small">${c.jobHistory.map(h=>`Lv${h.level} ${h.job}`).join(' → ')}</div><h3>直近の成長</h3><div class="small">${c.growthHistory.slice(-5).reverse().map(g=>`Lv${g.toLevel}: ${g.gained.length?g.gained.join(', '):'能力上昇なし'}`).join('<br>')||'まだレベルアップしていません。'}</div>`;
 $('levelBtn').disabled=c.level>=50;
}
function renderCharacterSkillView(){
 const c=data.characters.find(x=>x.id===selectedId),title=$('characterSkillTitle'),current=$('characterSkillCurrent'),list=$('characterSkillList');
 if(!title||!current||!list)return;
 if(!c){title.textContent='冒険者のスキル';current.innerHTML='<div class="skill-empty">冒険者を選択してください。</div>';list.innerHTML='';return}
 const equipped=findTagSkill(c.equippedSkillId);title.textContent=`${c.name}のスキル`;
 current.innerHTML=`<div class="skill-loadout-current"><b>装着中</b><div class="name">${escapeHtml(equipped?.name||'未装着')}</div><div class="small">戦闘ではこのスキルをAIが予約・実行します。</div></div>`;
 const owned=(c.skills||[]).map(findTagSkill).filter(x=>x&&compileTaggedSkill(x).ok);
 list.innerHTML=owned.length?owned.map(skill=>{const compiled=compileTaggedSkill(skill),selected=skill.id===c.equippedSkillId;return `<div class="skill-choice ${selected?'selected':''}"><div><b>${escapeHtml(skill.name)}</b><div class="small">${escapeHtml(compiled.definition.logicOrder.join(' → '))} ／ 対象 ${escapeHtml(compiled.definition.target.side)}・${escapeHtml(compiled.definition.target.range)}</div><div class="skill-tags">${skill.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div></div><button type="button" class="${selected?'good':'primary'}" data-equip-skill="${skill.id}" ${selected?'disabled':''}>${selected?'装着中':'装着する'}</button></div>`}).join(''):'<div class="skill-empty">装着可能なスキルがありません。</div>';
 list.querySelectorAll('[data-equip-skill]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.equipSkill;if(!c.skills.includes(id)||!findTagSkill(id))return;c.equippedSkillId=id;persist();render();renderCharacterSkillView();notify(`${c.name}が${findTagSkill(id).name}を装着しました。`)});
}
function selectedQuest(){return QUESTS.find(q=>q.id===data.selectedQuestId)||QUESTS[0]}
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
function renderExpeditionSetup(){
 const party=$('partyEditor');if(party){party.innerHTML=data.characters.map(c=>`<div class="unit"><label><input type="checkbox" data-party="${c.id}" ${data.partyIds.includes(c.id)?'checked':''}> <b>${escapeHtml(c.name)}</b> <span class="tag">${c.job}</span></label><div><button type="button" data-open-ai="${c.id}">AIチップ編集</button> <span class="small">${(c.aiGraph?.cells||[]).length}チップ</span></div><div class="small">装備: ${Object.entries(c.equipment||{}).filter(([,v])=>v).map(([slot,n])=>`${n} <button type="button" class="mini" data-unequip="${c.id}:${slot}">外す</button>`).join(' / ')||'なし'}</div></div>`).join('')||'<p class="small">冒険者を作成してください。</p>';party.querySelectorAll('[data-party]').forEach(el=>el.onchange=()=>{if(el.checked&&data.partyIds.length>=6){el.checked=false;notify('パーティは最大6人です。','warn');return}data.partyIds=el.checked?[...data.partyIds,el.dataset.party]:data.partyIds.filter(id=>id!==el.dataset.party);persist();renderExpeditionSetup()});party.querySelectorAll('[data-open-ai]').forEach(btn=>btn.onclick=()=>openAiEditorFor(data.characters.find(x=>x.id===btn.dataset.openAi)));party.querySelectorAll('[data-unequip]').forEach(btn=>btn.onclick=e=>{e.preventDefault();const [id,slot]=btn.dataset.unequip.split(':'),c=data.characters.find(x=>x.id===id);if(c&&c.equipment?.[slot]){data.inventory.push(c.equipment[slot]);c.equipment[slot]=null;persist();render();notify(`${c.name}の装備を外しました。`)}})}
 const ql=$('questList');if(ql){ql.innerHTML=QUESTS.map(q=>`<label class="unit quest-card ${q.id===data.selectedQuestId?'selected':''}"><input type="radio" name="quest" value="${q.id}" ${q.id===data.selectedQuestId?'checked':''}> <b>${q.name}</b> <span class="tag">${'★'.repeat(q.stars)}</span><span class="tag">Rank ${q.rank}</span><div class="small">推奨Lv ${q.recommendedLevel} ／ 敵 ${q.enemies.length}体</div><p>${q.description}</p><div class="small">基本報酬 <b>${q.reward} G</b> ／ 初回想定ボーナス ${q.bonus} G<br>候補: ${q.drops.map(n=>`${RARITY[EQUIPMENT[n].rarity].label}${n}`).join('・')}</div></label>`).join('');ql.querySelectorAll('input[name=quest]').forEach(el=>el.onchange=()=>{data.selectedQuestId=el.value;persist();renderExpeditionSetup()})}
 const qs=$('questSummary'),q=selectedQuest();if(qs)qs.textContent=`選択中：${q.name} ／ 敵 ${q.enemies.length}体 ／ 編成人数 ${data.partyIds.length}人`;
 const inv=$('inventoryList');if(inv){inv.innerHTML=data.inventory.length?data.inventory.map((name,i)=>{const e=EQUIPMENT[name],r=RARITY[e.rarity];return `<div class="unit loot-card rarity-${e.rarity}"><b>${r.label} ${name}</b> <span class="tag">${r.name}</span><span class="tag">${e.slot}</span><div class="small">攻撃 +${e.attack||0} / HP +${e.maxHp||0} / AGI ${e.agi>=0?'+':''}${e.agi||0}<br>${e.description||''}</div><label>装備先<select data-equip-index="${i}"><option value="">選択</option>${data.characters.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label></div>`}).join(''):'<p class="small">装備はまだありません。依頼を達成して戦利品を集めましょう。</p>';inv.querySelectorAll('[data-equip-index]').forEach(el=>el.onchange=()=>{if(!el.value)return;const c=data.characters.find(x=>x.id===el.value),name=data.inventory[Number(el.dataset.equipIndex)],e=EQUIPMENT[name];if(!c||!e)return;c.equipment=c.equipment||{weapon:null,armor:null,accessory:null};const previous=c.equipment[e.slot];c.equipment[e.slot]=name;if(previous)data.inventory.push(previous);data.inventory.splice(Number(el.dataset.equipIndex),1);persist();render();notify(`${c.name}が${name}を装備しました。`)})}
 renderGuildSummary();
 refreshMobileHome();
 setBaseView(activeBaseView,{keepScroll:true});
}
function prepareEvent(){const q=selectedQuest();$('eventTitle').textContent=q.name;$('eventBody').textContent=q.description;$('eventNotice').textContent=`編成 ${data.partyIds.length}人。周囲を観察すると敵情報を確認できます。`}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
$('createBtn').onclick=()=>{const name=$('newName').value.trim();if(!name){notify('名前を入力してください。','bad');return}const c=makeCharacter(name,$('newJob').value);data.characters.push(c);if(data.partyIds.length<6)data.partyIds.push(c.id);selectedId=c.id;$('newName').value='';persist();render();notify(`${name}を作成しました。`)};
$('levelBtn').onclick=()=>{const c=data.characters.find(x=>x.id===selectedId);if(!c||c.level>=50)return;const a=JOBS[c.job],gained=[],growth={};STATS.forEach(s=>{const amount=rollGrowth(a[s]);growth[s]=amount;if(amount>0){c.stats[s]+=amount;gained.push(`${s} +${amount}`)}});const from=c.level;c.level++;c.growthHistory.push({fromLevel:from,toLevel:c.level,job:c.job,growth,gained,ruleRevision:'V9-1.0.1',at:new Date().toISOString()});persist();render();notify(`${c.name}がLv${c.level}になりました。${gained.length?' 上昇: '+gained.join(', '):' 能力値上昇なし'}`)};
function growthRank(value){return value>=12?'A':value>=9?'B':'C'}
function growthRankGrid(job){const a=JOBS[job];return `<div class="growth-grid">${STATS.map(stat=>{const r=growthRank(a[stat]);return `<div class="growth-cell"><span class="small">${stat}</span><b class="rank-${r}">${r}</b></div>`}).join('')}</div>`}
function openJobChangeModal(){const c=data.characters.find(x=>x.id===selectedId);if(!c)return;$('jobChangeCurrent').innerHTML=`現在：<b>${escapeHtml(c.job)}</b>`;$('jobChangeList').innerHTML=Object.keys(JOBS).map(job=>`<div class="job-option ${job===c.job?'selected':''}" data-job-option="${job}"><div class="job-option-name">${job}${job===c.job?'（現在）':''}</div>${growthRankGrid(job)}<button class="primary job-confirm" data-job-confirm="${job}" ${job===c.job?'disabled':''}>${job===c.job?'現在の職業':'この職業へ転職'}</button></div>`).join('');$('jobChangeModal').classList.add('open');$('jobChangeModal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.querySelectorAll('[data-job-confirm]').forEach(btn=>btn.onclick=()=>confirmJobChange(btn.dataset.jobConfirm))}
function closeJobChangeModal(){$('jobChangeModal').classList.remove('open');$('jobChangeModal').setAttribute('aria-hidden','true');document.body.style.overflow=''}
function confirmJobChange(next){const c=data.characters.find(x=>x.id===selectedId);if(!c||next===c.job)return;const old=c.job;c.job=next;c.jobHistory.push({job:next,level:c.level,from:old,at:new Date().toISOString()});persist();render();closeJobChangeModal();notify(`${c.name}は${old}から${next}へ転職しました。次回以降の能力成長率が変わります。`)}
$('openJobChange').onclick=openJobChangeModal;$('jobChangeClose').onclick=closeJobChangeModal;$('jobChangeModal').onclick=e=>{if(e.target===$('jobChangeModal'))closeJobChangeModal()};

$('deleteBtn').onclick=()=>{const c=data.characters.find(x=>x.id===selectedId);if(!c)return;if(!confirm(`${c.name}を削除しますか？`))return;data.characters=data.characters.filter(x=>x.id!==selectedId);data.partyIds=data.partyIds.filter(id=>id!==selectedId);selectedId=null;persist();render();notify('キャラクターを削除しました。','warn')};
$('saveBtn').onclick=()=>{persist();notify('ブラウザへ保存しました。')};
$('loadBtn').onclick=()=>{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('保存データがありません。');data=normalize(JSON.parse(raw));selectedId=data.characters[0]?.id||null;render();notify('ブラウザ保存を読み込みました。')}catch(e){notify(e.message,'bad')}};

$('titleStart').onclick=beginNewGame;
$('titleContinue').onclick=continueGame;
$('titleSettings').onclick=()=>alert('設定画面は後続Buildで独立フェーズとして接続します。');
if($('baseToTitle'))$('baseToTitle').onclick=()=>setPhase('title');
$('baseDepart').onclick=$('baseDepartSide').onclick=()=>{if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');return}prepareEvent();setPhase('event')};
$('eventBackBase').onclick=$('eventRetreat').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('eventObserve').onclick=()=>{const q=selectedQuest();$('eventNotice').textContent='敵情報：'+q.enemies.map(e=>`${e.name}(HP${e.maxHp}/攻撃${e.attack}/AGI${e.agi})`).join('、')};
$('eventBattle').onclick=()=>{resetBattle();setPhase('battle')};
$('battleAbort').onclick=()=>setPhase('event');
$('resultToEvent').onclick=()=>setPhase('event',{keepBattle:true});
$('resultToBase').onclick=()=>{setPhase('base',{keepBattle:true});setBaseView('home',{instant:true})};
document.querySelectorAll('#phaseDevNav [data-phase]').forEach(btn=>btn.onclick=()=>setPhase(btn.dataset.phase,{keepBattle:true}));
$('exportBtn').onclick=()=>{persist();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`guild-adventure-v9-save-v1-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);notify('JSONを書き出しました。')};
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{data=normalize(JSON.parse(await file.text()));selectedId=data.characters[0]?.id||null;persist();render();notify('JSONを読み込みました。')}catch(err){notify(err.message,'bad')}finally{e.target.value=''}};
$('clearBtn').onclick=()=>{if(!confirm('正式版Phase Aの全データを初期化しますか？'))return;data={saveVersion:1,schemaRevision:'1.1.0',gameVersion:'GA-B474',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),characters:[],partyIds:[],selectedQuestId:'Q-001',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null}};selectedId=null;persist();render();notify('全データを初期化しました。','warn')};

const DOT_LOG_SCHEMA_VERSION='1.0.0';
function ensureValidationState(){
 if(!Array.isArray(battle.validationEvents))battle.validationEvents=[];
 if(typeof battle.validationMode!=='boolean')battle.validationMode=false;
 return battle;
}
function recordValidationEvent(type,payload={}){
 ensureValidationState();
 if(!battle.validationMode)return;
 battle.validationEvents.push({tick:battle.tick,type,...payload});
}
function selectedValidationContext(){
 const skill=findTagSkill($('tagTestSkill')?.value);
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
const TAG_SKILL_TEST_BUILD='GA-B474 / Studio Export Bridge / ATTACK + DOT + BUFF + DEBUFF + FOLLOW_UP';
const TAG_SKILLS=[
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
const STUDIO_SKILL_EXPORT_URL=window.GA_PROJECT_CONFIG.skillExportUrl;
const studioSkillBridge={status:'idle',source_url:STUDIO_SKILL_EXPORT_URL,schema_version:null,data_version:null,generated_by:null,imported_ids:[],errors:[],loaded_at:null};
function normalizeStudioTagSkill(record){
 if(!record||typeof record!=='object')return null;
 const tags=Array.isArray(record.tags)?record.tags.map(x=>String(x).trim()).filter(Boolean):[];
 if(!record.id||!record.name||!tags.length)return null;
 return{id:String(record.id),name:String(record.name),tags,source:'studio_export',environment:record.environment||'production',definition_format:record.definition_format||'tag_v1'};
}
async function loadStudioSkillDefinitions(){
 studioSkillBridge.status='loading';studioSkillBridge.errors=[];
 try{
  const response=await fetch(STUDIO_SKILL_EXPORT_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const payload=await response.json(),rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);
  const imported=rows.map(normalizeStudioTagSkill).filter(Boolean);
  if(!imported.length)throw new Error('タグ定義スキルが0件です');
  for(const skill of imported){const i=TAG_SKILLS.findIndex(x=>x.id===skill.id);if(i>=0)TAG_SKILLS.splice(i,1,skill);else TAG_SKILLS.push(skill)}
  studioSkillBridge.status='loaded';studioSkillBridge.schema_version=payload?.schema_version||null;studioSkillBridge.data_version=payload?.data_version||null;studioSkillBridge.generated_by=payload?.generated_by||null;studioSkillBridge.imported_ids=imported.map(x=>x.id);studioSkillBridge.loaded_at=new Date().toISOString();
  if(typeof populateTagSkillTestUI==='function')populateTagSkillTestUI();
  if(typeof renderCharacterSkills==='function')renderCharacterSkills();
  return studioSkillBridge;
 }catch(error){studioSkillBridge.status='failed';studioSkillBridge.errors=[String(error?.message||error)];return studioSkillBridge}
}
function buildStudioBridgeValidationReport(){
 const required=['SKL-TEST-ATTACK','SKL-TEST-POISON','SKL-TEST-BUFF-10','SKL-TEST-DEBUFF-10','SKL-TEST-FOLLOW-POISON'];
 const compile_results=required.map(id=>{const skill=findTagSkill(id),compiled=skill?compileTaggedSkill(skill):null;return{id,found:!!skill,source:skill?.source||'embedded',tags:skill?.tags||[],compiled_ok:!!compiled?.ok,logic_order:compiled?.definition?.logicOrder||[],errors:compiled?.errors||['skill not found']}});
 const errors=[];
 if(studioSkillBridge.status!=='loaded')errors.push(`Studio出力未読込: ${studioSkillBridge.status}`);
 for(const row of compile_results){if(!row.found)errors.push(`${row.id}が見つかりません`);else if(row.source!=='studio_export')errors.push(`${row.id}がStudio出力由来ではありません`);else if(!row.compiled_ok)errors.push(`${row.id}のコンパイル失敗`)}
 return{schema_version:'1.0.0',build:'GA-B474',generated_at:new Date().toISOString(),test:{id:'TAG-STUDIO-EXPORT-BRIDGE-001',mode:'formal_data_bridge'},source:{url:studioSkillBridge.source_url,status:studioSkillBridge.status,schema_version:studioSkillBridge.schema_version,data_version:studioSkillBridge.data_version,generated_by:studioSkillBridge.generated_by,loaded_at:studioSkillBridge.loaded_at,imported_count:studioSkillBridge.imported_ids.length,imported_ids:[...studioSkillBridge.imported_ids]},compile_results,summary:{required_count:required.length,studio_sourced_count:compile_results.filter(x=>x.source==='studio_export').length,compiled_count:compile_results.filter(x=>x.compiled_ok).length,passed:errors.length===0,errors:[...studioSkillBridge.errors,...errors]}};
}
function downloadStudioBridgeValidationJson(){const report=buildStudioBridgeValidationReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-studio-bridge-validation-GA-B474-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}

function buildFormalRuntimeRegressionReport(){
 const required=['SKL-TEST-ATTACK','SKL-TEST-POISON','SKL-TEST-BUFF-10','SKL-TEST-DEBUFF-10','SKL-TEST-FOLLOW-POISON'];
 const imported=TAG_SKILLS.filter(x=>x.source==='studio_export');
 const production=imported.filter(x=>(x.environment||'production')==='production');
 const validation=imported.filter(x=>(x.environment||'production')==='validation');
 const compileRow=skill=>{const compiled=compileTaggedSkill(skill);return{id:skill.id,name:skill.name,source:skill.source,environment:skill.environment||'production',compiled_ok:!!compiled.ok,logic_order:compiled.definition?.logicOrder||[],errors:compiled.errors||[]}};
 const production_results=production.map(compileRow);
 const validation_results=validation.map(skill=>{const row=compileRow(skill);return{...row,expected_result:'rejected',validation_passed:!row.compiled_ok&&row.errors.length>0}});
 const required_results=required.map(id=>{const skill=findTagSkill(id);return{id,found:!!skill,source:skill?.source||null,environment:skill?.environment||null,compiled_ok:!!(skill&&compileTaggedSkill(skill).ok)}});
 const production_embedded=TAG_SKILLS.filter(x=>x.source!=='studio_export' && (x.environment||'production')==='production').map(x=>x.id);
 const errors=[];
 if(studioSkillBridge.status!=='loaded')errors.push(`Studio出力未読込: ${studioSkillBridge.status}`);
 if(!studioSkillBridge.data_version)errors.push('data_versionがありません');
 for(const row of required_results){if(!row.found)errors.push(`${row.id}がありません`);else if(row.source!=='studio_export')errors.push(`${row.id}が固定定義です`);else if(row.environment!=='production')errors.push(`${row.id}がproductionではありません`);else if(!row.compiled_ok)errors.push(`${row.id}のコンパイルに失敗しました`)}
 for(const row of production_results){if(!row.compiled_ok)errors.push(`${row.id}: ${row.errors.join(', ')}`)}
 for(const row of validation_results){if(!row.validation_passed)errors.push(`${row.id}: validation定義が期待どおり拒否されませんでした`)}
 if(production_embedded.length)errors.push(`正式運用対象に固定定義が残っています: ${production_embedded.join(', ')}`);
 return{schema_version:'1.1.0',build:'GA-B474',generated_at:new Date().toISOString(),test:{id:'TAG-FORMAL-RUNTIME-REGRESSION-001',mode:'formal_runtime_environment_separation'},source:{status:studioSkillBridge.status,url:studioSkillBridge.source_url,data_version:studioSkillBridge.data_version,generated_by:studioSkillBridge.generated_by,imported_count:imported.length},required_results,production_results,validation_results,dependency_audit:{production_embedded_ids:production_embedded,studio_production_ids:production.map(x=>x.id),studio_validation_ids:validation.map(x=>x.id)},summary:{required_count:required.length,required_studio_sourced:required_results.filter(x=>x.source==='studio_export'&&x.environment==='production').length,production_compile_count:production_results.filter(x=>x.compiled_ok).length,production_definition_count:production_results.length,validation_expected_rejection_count:validation_results.filter(x=>x.validation_passed).length,validation_definition_count:validation_results.length,production_embedded_count:production_embedded.length,passed:errors.length===0,errors}};
}
function downloadFormalRuntimeRegressionJson(){const report=buildFormalRuntimeRegressionReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-formal-runtime-regression-GA-B474-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}
const TAG_LOGIC_ORDER=['ATTACK','DOT','FOLLOW_UP','HEAL','HOT','BUFF','DEBUFF','SHIELD','SUMMON','DISPEL','REVIVE'];
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
 const targetSide=g.has('敵')?'enemy':g.has('味方')?'ally':g.has('自分')?'self':g.has('死体')?'corpse':g.has('地点')?'point':null;
 const range=g.has('単体')?'single':g.has('全体')?'all':g.has('前列')?'front':g.has('後列')?'back':g.has('ランダム')?'random':g.has('貫通')?'pierce':null;
 const damageType=g.has('物理')?'physical':g.has('魔法')?'magical':g.has('固定')?'fixed':null;
 return{ok:errors.length===0,errors,warnings,definition:{id:skill?.id||'',name:skill?.name||'',target:{side:targetSide,range},logicOrder,parameters:{damageType,damage:n.DAMAGE?.value??null,dotPower:n.DOT_POWER?.value??null,dotDuration:n.DOT_DURATION?.value??null,dotInterval:n.DOT_INTERVAL?.value??null,stackGain:n.STACK_GAIN?.value??null,modifierStat:['ATK','DEF','AGI','VIT','INT','DEX','LUK'].find(x=>g.has(x))||null,modifierPower:n.POWER?.value??null,modifierDuration:n.DURATION?.value??null,followUpTrigger:g.has('TRIGGER_ALLY_ATTACK')?'ALLY_ATTACK':null,followUpCondition:g.has('CONDITION_POISONED')?'POISONED':null},sourceTags:[...(skill?.tags||[])]},parsed};
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
function calculateTaggedAttackDamage(attacker,definition){
 const rate=Number(definition.parameters.damage);
 if(definition.parameters.damageType==='fixed')return Math.max(0,Math.floor(rate));
 return Math.max(0,Math.floor(effectiveAttackValue(attacker)*(rate/100)));
}
function applyTaggedDamage(attacker,target,damage,skill){
 const before=target.hp;target.hp=Math.max(0,target.hp-damage);const applied=before-target.hp;
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage:applied});
 attacker.damageDealt+=applied;target.damageTaken+=applied;
 battle.log.push(`[Tick ${battle.tick}] [TAG][ATTACK] ${attacker.name}の${skill.name} → ${target.name}に${applied}ダメージ（DAMAGE=${skill.parameters.damage}, 残HP ${target.hp}/${target.maxHp}）`);typeof recordValidationEvent==='function'&&recordValidationEvent('attack',{source_id:attacker.id,target_id:target.id,skill_id:skill.id,damage:applied,hp_before:before,hp_after:target.hp});
 if(target.hp<=0){target.alive=false;target.gauge=0;target.reservedAction=null;clearModifierStacksOnDeath(target,{cause:'tagged_attack',sourceId:attacker.id});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
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
 if(target.hp<=0){const clearedStacks=Array.isArray(target.dotStacks)?target.dotStacks.length:0;target.alive=false;target.gauge=0;target.reservedAction=null;target.dotStacks=[];clearModifierStacksOnDeath(target,{cause:'dot',sourceId:stack.sourceId});recordModifierSourceDefeated(target);battle.log.push(`[Tick ${battle.tick}] ${target.name}は${stack.label}により戦闘不能`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_defeat',{source_id:stack.sourceId,target_id:target.id,stack_id:stack.id,label:stack.label,hp_before:before,hp_after:target.hp,cleared_dot_stacks:clearedStacks})}finishIfNeeded();return true;
}
function processDotStacks(){
 for(const target of battle.units){const list=ensureDotStackList(target);if(!list.length)continue;if(!target.alive){target.dotStacks=[];continue}const keep=[];
  for(const stack of list){while(target.alive&&stack.nextTick<=battle.tick&&stack.nextTick<=stack.expiresAt){applyDotTick(target,stack);stack.nextTick+=stack.interval;if(battle.result||battle.pendingResult)break}if(target.alive&&stack.nextTick<=stack.expiresAt)keep.push(stack);else if(target.alive){battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ${target.name}の${stack.label}#${stack.id}が終了`);typeof recordValidationEvent==='function'&&recordValidationEvent('dot_expired',{target_id:target.id,stack_id:stack.id,label:stack.label})}}
  target.dotStacks=keep;if(battle.result||battle.pendingResult)break}
}
function dotStatusText(unit){const stacks=ensureDotStackList(unit);if(!stacks.length)return'なし';const groups={};for(const x of stacks)(groups[x.label]||(groups[x.label]=[])).push(x);return Object.entries(groups).map(([label,items])=>`${label}×${items.length}（次:${Math.min(...items.map(x=>x.nextTick))} / 最長:${Math.max(...items.map(x=>x.expiresAt))}）`).join('、')}
function executeTaggedSkill(actor,target,skillSource,{manual=false,isFollowUp=false}={}){
 const compiled=compileTaggedSkill(skillSource);
 battle.log.push(`[Tick ${battle.tick}] [TAG][COMPILE] ${skillSource?.id||'unknown'} ${compiled.ok?'成功':'失敗'}`);
 if(!compiled.ok){compiled.errors.forEach(x=>battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${x}`));return{ok:false,stage:'compile',compiled}}
 const resolved=resolveTaggedTargets(actor,target,compiled.definition);
 if(!resolved.ok){battle.log.push(`[Tick ${battle.tick}] [TAG][ERROR] ${resolved.reason}`);return{ok:false,stage:'target',reason:resolved.reason,compiled}}
 const targetResults=[];
 for(const resolvedTarget of resolved.targets){
  let attackResult=null,dotResult=null,modifierResult=null,followUpResult=null,attackSucceeded=!compiled.definition.logicOrder.includes('ATTACK');
  for(const logic of compiled.definition.logicOrder){
   if(logic==='ATTACK'){attackResult=applyTaggedDamage(actor,resolvedTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!attackResult?.ok}
   else if(logic==='DOT'){if(!attackSucceeded)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] ATTACK不成立のためDOT付与をスキップ`);else if(!resolvedTarget.alive)battle.log.push(`[Tick ${battle.tick}] [TAG][DOT] 対象戦闘不能のためDOT付与をスキップ`);else dotResult=applyTaggedDot(actor,resolvedTarget,compiled)}
   else if(logic==='FOLLOW_UP'){followUpResult=applyTaggedDamage(actor,resolvedTarget,calculateTaggedAttackDamage(actor,compiled.definition),compiled.definition);attackSucceeded=!!followUpResult?.ok}
   else if(logic==='BUFF'||logic==='DEBUFF'){modifierResult=applyTaggedModifier(actor,resolvedTarget,compiled,logic)}
   else battle.log.push(`[Tick ${battle.tick}] [TAG][PENDING] ${logic}ロジックは未接続`);
  }
  targetResults.push({targetId:resolvedTarget.id,attackResult,dotResult,modifierResult,followUpResult});
  if(attackResult?.ok&&!isFollowUp)dispatchConditionalFollowUps(actor,resolvedTarget,{trigger:'ALLY_ATTACK',originSkillId:compiled.definition.id});
  else if(followUpResult?.ok&&isFollowUp)recordValidationEvent('follow_up_chain_blocked',{source_id:actor.id,target_id:resolvedTarget.id,skill_id:compiled.definition.id,reason:'FOLLOW_UP_CANNOT_CHAIN'});
 }
 if(manual)renderBattle();
 const first=targetResults[0]||{};
 return{ok:true,compiled,targets:resolved.targets.map(x=>x.id),targetResults,attackResult:first.attackResult,dotResult:first.dotResult,modifierResult:first.modifierResult,followUpResult:first.followUpResult};
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
function populateTagSkillTestUI(){
 const skill=$('tagTestSkill'),actor=$('tagTestActor'),target=$('tagTestTarget');if(!skill||!actor||!target)return;
 const selectedSkill=skill.value,selectedActor=actor.value,selectedTarget=target.value;
 skill.innerHTML=TAG_SKILLS.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
 actor.innerHTML=battle.units.filter(x=>x.alive).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}（${x.side}）</option>`).join('');
 const a=battle.units.find(x=>x.id===(selectedActor||actor.value))||battle.units.find(x=>x.alive);
 target.innerHTML=battle.units.filter(x=>x.alive&&(!a||x.id!==a.id)).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}（${x.side}）</option>`).join('');
 if(selectedSkill&&TAG_SKILLS.some(x=>x.id===selectedSkill))skill.value=selectedSkill;
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
 const prefix=kind==='BUFF'?(all?'SKL-TEST-BUFF-ALL-':'SKL-TEST-BUFF-'):(all?'SKL-TEST-DEBUFF-ALL-':'SKL-TEST-DEBUFF-'),skills=[findTagSkill(prefix+'10'),findTagSkill(prefix+'30'),findTagSkill(prefix+'20')],applications=[{tick:0,power:10,duration:1000},{tick:100,power:30,duration:500},{tick:200,power:20,duration:1000}],testId=`TAG-${kind}-${all?'ALL-':' '}HIGHEST-001`.replace(' ','');
 battle.validationMeta={kind,testId,startTick:0,requestedTicks:1200,actorId:actor.id,targetId:targets[0].id,targetIds:targets.map(x=>x.id),range:all?'all':'single',applications,expectedTransitions:[[0,10],[100,30],[600,20],[1200,0]]};recordValidationEvent('test_started',{build:'GA-B474',test_id:testId,target_ids:targets.map(x=>x.id)});
 let result=executeTaggedSkill(actor,targets[0],skills[0]);processTicks(100);result=executeTaggedSkill(actor,targets[0],skills[1]);processTicks(100);result=executeTaggedSkill(actor,targets[0],skills[2]);processTicks(1000);recordValidationEvent('test_completed',{});renderBattle();const report=downloadModifierValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled)+`
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
 const skills=[findTagSkill('SKL-TEST-DEBUFF-10'),findTagSkill('SKL-TEST-DEBUFF-30'),findTagSkill('SKL-TEST-DEBUFF-20')];battle.validationMeta={mode:'target_death',testId:'TAG-MODIFIER-TARGET-DEATH-001',startTick:0,requestedTicks:1200,deathTick:300,actorId:actor.id,targetId:target.id};recordValidationEvent('test_started',{build:'GA-B474',test_id:battle.validationMeta.testId});
 let result=executeTaggedSkill(actor,target,skills[0]);processTicks(100);executeTaggedSkill(actor,target,skills[1]);processTicks(100);executeTaggedSkill(actor,target,skills[2]);processTicks(100);defeatUnitForModifierValidation(target,'validation_target_death');processTicks(900);recordValidationEvent('test_completed',{});renderBattle();const report=downloadModifierDeathValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled)+`\n${formatModifierDeathSummary(report)}`;
}
function runModifierSourceDeathValidation(){
 pauseBattle();resetBattle();const source=battle.units.find(x=>x.alive&&x.side==='味方'),target=ensureValidationTargets('味方',2).find(x=>x.id!==source?.id);if(!source||!target){$('tagTestResult').textContent='[MODIFIER SOURCE TEST] FAILED / 使用者または対象がありません';return}
 source.modifierStacks=[];target.modifierStacks=[];battle.validationMode=true;battle.validationEvents=[];battle.actions=0;modifierStackSequence=0;
 const skill=findTagSkill('SKL-TEST-BUFF-10');battle.validationMeta={mode:'source_death',testId:'TAG-MODIFIER-SOURCE-DEATH-001',startTick:0,requestedTicks:1200,deathTick:200,actorId:source.id,targetId:target.id};recordValidationEvent('test_started',{build:'GA-B474',test_id:battle.validationMeta.testId});
 const result=executeTaggedSkill(source,target,skill);processTicks(200);defeatUnitForModifierValidation(source,'validation_source_death');processTicks(1000);recordValidationEvent('test_completed',{});renderBattle();const report=downloadModifierDeathValidationJson();$('tagTestResult').textContent=formatCompileResult(result.compiled)+`\n${formatModifierDeathSummary(report)}`;
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
 executeTaggedSkill(initiator,target,findTagSkill('SKL-TEST-ATTACK'));processTicks(5);
 applyTaggedDot(initiator,target,compileTaggedSkill(findTagSkill('SKL-TEST-POISON')));executeTaggedSkill(initiator,target,findTagSkill('SKL-TEST-ATTACK'));processTicks(5);
 recordValidationEvent('test_completed',{});renderBattle();const report=downloadConditionalFollowUpValidationJson();$('tagTestResult').textContent=`[FOLLOW UP JSON TEST] ${report.summary.passed?'PASS':'FAIL'}\n[TRIGGERED] ${report.summary.follow_up_triggered}\n[SKIPPED] ${report.summary.condition_skipped}\n[DAMAGE] ${report.summary.follow_up_damage_events}\n[CHAIN BLOCKED] ${report.summary.chain_blocked}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;
}
function setupTagSkillTestUI(){
 const execute=$('tagTestExecute'),compile=$('tagTestCompile'),actor=$('tagTestActor'),run1000=$('tagTestRun1000'),runStackLimit=$('tagTestRunStackLimit'),runStaggered=$('tagTestRunStaggered'),runDefeat=$('tagTestRunDefeat'),runBuffHighest=$('tagTestRunBuffHighest'),runDebuffHighest=$('tagTestRunDebuffHighest'),runBuffAll=$('tagTestRunBuffAll'),runDebuffAll=$('tagTestRunDebuffAll'),runModifierTargetDeath=$('tagTestRunModifierTargetDeath'),runModifierSourceDeath=$('tagTestRunModifierSourceDeath'),runConditionalFollowUp=$('tagTestRunConditionalFollowUp'),runStudioBridge=$('tagTestRunStudioBridge'),runFormalRegression=$('tagTestRunFormalRegression'),exportJson=$('tagTestExportJson');if(!execute||execute.dataset.bound)return;
 execute.dataset.bound='1';
 actor.onchange=populateTagSkillTestUI;
 compile.onclick=()=>{const result=compileTaggedSkill(findTagSkill($('tagTestSkill').value));$('tagTestResult').textContent=formatCompileResult(result)};
 execute.onclick=()=>{const skill=findTagSkill($('tagTestSkill').value),a=battle.units.find(x=>x.id===$('tagTestActor').value),t=battle.units.find(x=>x.id===$('tagTestTarget').value);const result=executeTaggedSkill(a,t,skill,{manual:true});$('tagTestResult').textContent=formatCompileResult(result.compiled||compileTaggedSkill(skill))+(result.ok?`\n[EXECUTE] SUCCESS${result.attackResult?` / damage=${result.attackResult.damage}`:''}${result.dotResult?` / DOT=${result.dotResult.added||0} stack${result.dotResult.reason?` / ${result.dotResult.reason}`:''}`:''}`:`\n[EXECUTE] FAILED / ${result.reason||result.stage}`)};
 const runIsolatedValidation=({executionCount=1,expectedStacks=1,expectedRejects=0,testId='TAG-DOT-1000TICK-001',requestedTicks=1000}={})=>{
  pauseBattle();
  const selected={skillId:$('tagTestSkill').value,actorId:$('tagTestActor').value,targetId:$('tagTestTarget').value};
  resetBattle();
  const skill=findTagSkill(selected.skillId),actor=battle.units.find(x=>x.id===selected.actorId)||battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.id===selected.targetId)||battle.units.find(x=>x.alive&&x.side!==actor?.side);
  if(!skill||!actor||!target){$('tagTestResult').textContent='[JSON TEST] FAILED / 使用者・対象・スキルを選択してください';return}
  const compiled=compileTaggedSkill(skill);
  if(!compiled.ok||!compiled.definition.logicOrder.includes('DOT')){$('tagTestResult').textContent=formatCompileResult(compiled)+'\n[JSON TEST] FAILED / DOTスキルを選択してください';return}
  target.maxHp=Math.max(target.maxHp,5000);target.hp=target.maxHp;target.alive=true;
  battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
  battle.validationMeta={testId,startTick:battle.tick,requestedTicks,skillId:skill.id,actorId:actor.id,targetId:target.id,tags:[...(skill.tags||[])],dotPower:compiled.definition.parameters.dotPower,dotDuration:compiled.definition.parameters.dotDuration,dotInterval:compiled.definition.parameters.dotInterval,stackGain:compiled.definition.parameters.stackGain,expectedStacks,expectedRejects,expectedAttackCount:executionCount,initialState:{target_hp:target.hp,target_alive:target.alive,active_dot_stacks:target.dotStacks?.length||0}};
  recordValidationEvent('test_started',{build:'GA-B474',test_id:testId});
  let lastResult=null;
  for(let i=0;i<executionCount;i++){lastResult=executeTaggedSkill(actor,target,skill,{manual:false});if(!lastResult.ok)recordValidationEvent('error',{message:lastResult.reason||lastResult.stage||'execute failed',execution_index:i})}
  processTicks(requestedTicks);recordValidationEvent('test_completed',{});renderBattle();const report=downloadValidationJson();$('tagTestResult').textContent=formatCompileResult(lastResult?.compiled||compiled)+`\n${formatValidationSummary(report)}`;
 };
 if(run1000)run1000.onclick=()=>runIsolatedValidation();
 if(runStackLimit)runStackLimit.onclick=()=>runIsolatedValidation({executionCount:6,expectedStacks:5,expectedRejects:1,testId:'TAG-DOT-STACK-LIMIT-001'});
 if(runStaggered)runStaggered.onclick=()=>{
  pauseBattle();
  const selected={skillId:$('tagTestSkill').value,actorId:$('tagTestActor').value,targetId:$('tagTestTarget').value};
  resetBattle();
  const skill=findTagSkill(selected.skillId),actor=battle.units.find(x=>x.id===selected.actorId)||battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.id===selected.targetId)||battle.units.find(x=>x.alive&&x.side!==actor?.side);
  if(!skill||!actor||!target){$('tagTestResult').textContent='[JSON TEST] FAILED / 使用者・対象・スキルを選択してください';return}
  const compiled=compileTaggedSkill(skill);
  if(!compiled.ok||!compiled.definition.logicOrder.includes('DOT')){$('tagTestResult').textContent=formatCompileResult(compiled)+'\n[JSON TEST] FAILED / DOTスキルを選択してください';return}
  target.maxHp=Math.max(target.maxHp,5000);target.hp=target.maxHp;target.alive=true;
  battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
  battle.validationMeta={testId:'TAG-DOT-STAGGERED-TIMER-001',startTick:0,requestedTicks:1600,skillId:skill.id,actorId:actor.id,targetId:target.id,tags:[...(skill.tags||[])],dotPower:compiled.definition.parameters.dotPower,dotDuration:compiled.definition.parameters.dotDuration,dotInterval:compiled.definition.parameters.dotInterval,stackGain:compiled.definition.parameters.stackGain,expectedStacks:3,expectedRejects:0,expectedAttackCount:3,expectedAddTicks:[0,250,600],expectedExpireTicks:[1000,1250,1600],initialState:{target_hp:target.hp,target_alive:target.alive,active_dot_stacks:0}};
  recordValidationEvent('test_started',{build:'GA-B474',test_id:'TAG-DOT-STAGGERED-TIMER-001'});
  let results=[];
  results.push(executeTaggedSkill(actor,target,skill,{manual:false}));
  processTicks(250);results.push(executeTaggedSkill(actor,target,skill,{manual:false}));
  processTicks(350);results.push(executeTaggedSkill(actor,target,skill,{manual:false}));
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
  const skill=findTagSkill(selected.skillId),actor=battle.units.find(x=>x.id===selected.actorId)||battle.units.find(x=>x.alive&&x.side==='味方'),target=battle.units.find(x=>x.id===selected.targetId)||battle.units.find(x=>x.alive&&x.side!==actor?.side);
  if(!skill||!actor||!target){$('tagTestResult').textContent='[JSON TEST] FAILED / 使用者・対象・スキルを選択してください';return}
  const compiled=compileTaggedSkill(skill);
  if(!compiled.ok||!compiled.definition.logicOrder.includes('DOT')){$('tagTestResult').textContent=formatCompileResult(compiled)+'\n[JSON TEST] FAILED / DOTスキルを選択してください';return}
  if(!battle.units.some(x=>x.alive&&x.side===target.side&&x.id!==target.id)){battle.units.push(makeCombatant({id:'E-DUMMY',name:'検証用生存敵',side:target.side,aiPolicy:'lowestHp',agi:1,attack:1,maxHp:9999,gauge:0,actions:0,order:999,lastActionTick:null}))}
  target.maxHp=100;target.hp=100;target.alive=true;target.dotStacks=[];
  battle.validationMode=true;battle.validationEvents=[];battle.actions=0;
  battle.validationMeta={testId:'TAG-DOT-DEFEAT-001',startTick:0,requestedTicks:1000,skillId:skill.id,actorId:actor.id,targetId:target.id,tags:[...(skill.tags||[])],dotPower:compiled.definition.parameters.dotPower,dotDuration:compiled.definition.parameters.dotDuration,dotInterval:compiled.definition.parameters.dotInterval,stackGain:compiled.definition.parameters.stackGain,expectedStacks:1,expectedRejects:0,expectedAttackCount:1,expectedDotHits:3,expectedDotDamageTotal:52,expectedExpiredCount:0,expectedDefeatCount:1,expectedDefeatTick:300,expectedTargetAlive:false,initialState:{target_hp:100,target_alive:true,active_dot_stacks:0}};
  recordValidationEvent('test_started',{build:'GA-B474',test_id:'TAG-DOT-DEFEAT-001'});
  const result=executeTaggedSkill(actor,target,skill,{manual:false});
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
 if(runFormalRegression)runFormalRegression.onclick=async()=>{if(studioSkillBridge.status!=='loaded')await loadStudioSkillDefinitions();const report=downloadFormalRuntimeRegressionJson();$('tagTestResult').textContent=`[FORMAL REGRESSION] ${report.summary.passed?'PASS':'FAIL'}\n[STATUS] ${report.source.status}\n[PRODUCTION DEFINITIONS] ${report.summary.production_compile_count}/${report.summary.production_definition_count}\n[VALIDATION REJECTIONS] ${report.summary.validation_expected_rejection_count}/${report.summary.validation_definition_count}\n[REQUIRED STUDIO] ${report.summary.required_studio_sourced}/${report.summary.required_count}\n[EMBEDDED PRODUCTION] ${report.summary.production_embedded_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`};
 if(exportJson)exportJson.onclick=()=>{const report=battle.validationMeta?.kind?downloadModifierValidationJson():downloadValidationJson();$('tagTestResult').textContent=`${$('tagTestResult').textContent}\n[JSON] 出力完了 / ${report.summary.passed?'PASS':'FAIL'}`};
 populateTagSkillTestUI();
}
const GAUGE_MAX=100;
const RESERVATION_DELAY_TICKS=4;
let battle={tick:0,actions:0,units:[],log:[],timer:null,running:false,runToken:0,lastFrameAt:0,tickAccumulator:0,result:null,pendingResult:null,ending:false,reward:null,rewardApplied:false,validationMode:false,validationEvents:[],validationMeta:null};
function makeCombatant(base){return {...base,hp:base.maxHp,alive:true,damageDealt:0,damageTaken:0,dotStacks:[],modifierStacks:[],reservedAction:null,lastReservation:null,defaultSkillId:base.defaultSkillId||'SKL-TEST-ATTACK'}}
function makeBattleUnits(){
 const members=data.partyIds.map(id=>data.characters.find(c=>c.id===id)).filter(Boolean).slice(0,6);
 const allies=members.map((c,i)=>{const b=equipmentBonus(c);return makeCombatant({id:`A${i}`,characterId:c.id,name:c.name,side:'味方',aiPolicy:c.aiPolicy,defaultSkillId:c.equippedSkillId||c.skills?.[0]||'SKL-TEST-ATTACK',agi:Math.max(1,c.stats.AGI+b.agi),attack:10+c.stats.STR*3+c.level*2+b.attack,maxHp:100+c.stats.VIT*20+c.level*10+b.maxHp,gauge:0,actions:0,order:i,lastActionTick:null})});
 if(!allies.length)allies.push(makeCombatant({id:'A0',name:'検証剣士',side:'味方',aiPolicy:'lowestHp',defaultSkillId:'SKL-TEST-POISON',agi:11,attack:48,maxHp:360,gauge:0,actions:0,order:0,lastActionTick:null}));
 const q=selectedQuest();const enemies=q.enemies.map((e,i)=>makeCombatant({id:`E${i}`,name:e.name,side:'敵',aiPolicy:'lowestHp',agi:e.agi,attack:e.attack,maxHp:e.maxHp,gauge:0,actions:0,order:100+i,lastActionTick:null}));
 return [...allies,...enemies];
}

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

function resetBattle(){pauseBattle();sceneQueue=[];sceneBusy=false;battle={tick:0,actions:0,units:makeBattleUnits(),log:[],timer:null,running:false,runToken:battle.runToken,lastFrameAt:0,tickAccumulator:0,result:null,pendingResult:null,ending:false,reward:null,rewardApplied:false,validationMode:false,validationEvents:[],validationMeta:null};renderBattle();ensureSceneUnits(true);setupTagSkillTestUI();populateTagSkillTestUI()}
function renderBattle(){
 $('battleTick').textContent=`Tick: ${battle.tick}`;$('battleActions').textContent=`行動回数: ${battle.actions}`;$('battleStatus').textContent=`状態: ${battle.result?'戦闘終了':battle.pendingResult?'最終演出待機':battle.running?'オート進行中':'待機'}`;$('battleResult').textContent=`勝敗: ${battle.result||'未決着'}`;
 $('battleUnits').innerHTML=battle.units.map(u=>{const until=u.alive?(u.reservedAction?Math.max(0,u.reservedAction.executeAt-battle.tick):(u.gauge===0?Math.ceil(GAUGE_MAX/u.agi):Math.ceil(Math.max(0,GAUGE_MAX-u.gauge)/u.agi))):'—';const last=u.lastActionTick==null?'未行動':`Tick ${u.lastActionTick}`;const hpPct=Math.max(0,Math.min(100,u.hp/u.maxHp*100));const rv=reservationView(u);const target=u.reservedAction?battle.units.find(x=>x.id===u.reservedAction.targetId):null;const reservationText=u.reservedAction?`${rv.icon} ${u.reservedAction.label} → ${target?.name||'対象なし'}（Tick ${u.reservedAction.executeAt}実行予定）`:`${rv.icon} ${rv.title}`;return `<div class="battle-unit"><div class="name">${escapeHtml(u.name)}${u.alive?'':'（戦闘不能）'}</div><span class="tag">${u.side}</span><span class="tag">AGI ${u.agi}</span><span class="tag">攻撃 ${effectiveAttackValue(u)}（基礎${u.attack}）</span><span class="tag">行動 ${u.actions}回</span><div class="small">HP ${u.hp} / ${u.maxHp}</div><div class="bar"><i style="width:${hpPct}%;background:var(--good)"></i></div><div class="small">Gauge ${u.gauge} / ${GAUGE_MAX}（毎Tick +${u.alive?u.agi:0}）</div><div class="bar"><i style="width:${Math.min(100,u.gauge)}%"></i></div><div class="small"><b>予約:</b> ${escapeHtml(reservationText)}</div><div class="small"><b>DOT:</b> ${escapeHtml(dotStatusText(u))}</div><div class="small"><b>BUFF/DEBUFF:</b> ${escapeHtml(modifierStatusText(u))}</div><div class="small">次の処理まで約 ${until} Tick ／ 最終行動 ${last} ／ 与ダメージ ${u.damageDealt}</div></div>`}).join('');
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
function revalidateReservation(actor){
 const r=actor.reservedAction;if(!r)return{ok:false,reason:'予約なし'};
 if(!actor.alive)return{ok:false,reason:'行動者が戦闘不能'};
 let target=battle.units.find(u=>u.id===r.targetId);
 if(!target||!target.alive||target.side===actor.side){
  return{ok:false,reason:'予約時の固定対象が無効'};
 }
 if(actor.gauge<GAUGE_MAX)return{ok:false,reason:`Gauge不足 (${actor.gauge}/${GAUGE_MAX})`};
 return{ok:true,target};
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
function finishIfNeeded(){
 const allyAlive=battle.units.some(u=>u.alive&&u.side==='味方'),enemyAlive=battle.units.some(u=>u.alive&&u.side==='敵');
 if(allyAlive&&enemyAlive)return false;
 if(battle.pendingResult||battle.result)return true;
 battle.pendingResult=allyAlive?'味方勝利':enemyAlive?'敵勝利':'引き分け';
 battle.units.forEach(u=>u.reservedAction=null);
 battle.log.push(`[Tick ${battle.tick}] 決着条件を検出 — 最終演出を待機`);
 battle.running=false;battle.runToken++;
 if(battle.timer)cancelAnimationFrame(battle.timer);battle.timer=null;
 renderBattle();completeBattleEnding();return true;
}
function performBasicAttack(attacker,target){
 if(!target)return false;
 const damage=Math.max(1,attacker.attack);target.hp=Math.max(0,target.hp-damage);
 queueSceneEvent({attackerId:attacker.id,targetId:target.id,attackerName:attacker.name,attackerSide:attacker.side,miss:false,damage});
 attacker.damageDealt+=damage;target.damageTaken+=damage;
 battle.log.push(`[Tick ${battle.tick}] ${attacker.name}の通常攻撃 → ${target.name}に${damage}ダメージ（残HP ${target.hp}/${target.maxHp}）`);
 if(target.hp<=0){target.alive=false;target.gauge=0;target.reservedAction=null;battle.log.push(`[Tick ${battle.tick}] ${target.name}は戦闘不能`)}
 finishIfNeeded();return true;
}
function executeReservation(actor){
 const r=actor.reservedAction;if(!r||r.executeAt>battle.tick)return false;
 r.status='revalidating';
 const checked=revalidateReservation(actor);
 if(!checked.ok){cancelReservation(actor,checked.reason);return false}
 const target=checked.target,skill=findTagSkill(r.skillId);
 if(!skill){cancelReservation(actor,`スキルが見つかりません: ${r.skillId}`,false);return false}
 const compiled=compileTaggedSkill(skill);
 if(!compiled.ok){cancelReservation(actor,`スキル定義エラー: ${compiled.errors.join(' / ')}`,false);return false}
 r.status='executing';actor.gauge=Math.max(0,actor.gauge-GAUGE_MAX);actor.actions++;actor.lastActionTick=battle.tick;battle.actions++;
 battle.log.push(`[Tick ${battle.tick}] ${actor.name}の予約を実行 — ${r.label} → ${target.name}`);
 actor.lastReservation={...r,status:'completed',completedAt:battle.tick};actor.reservedAction=null;
 return executeTaggedSkill(actor,target,skill).ok;
}
function processTicks(count){
 for(let n=0;n<count&&!battle.result&&!battle.pendingResult;n++){
  battle.tick++;
  processModifierStacks();
  processDotStacks();
  if(battle.result||battle.pendingResult)break;
  if(battle.validationMode)continue;
  battle.units.filter(u=>u.alive).forEach(u=>u.gauge+=u.agi);
  const reservable=battle.units.filter(u=>u.alive&&!u.reservedAction&&u.gauge>=GAUGE_MAX).sort((a,b)=>(b.gauge-GAUGE_MAX)-(a.gauge-GAUGE_MAX)||b.agi-a.agi||a.order-b.order);
  reservable.forEach(reserveAction);
  const due=battle.units.filter(u=>u.alive&&u.reservedAction&&u.reservedAction.executeAt<=battle.tick).sort((a,b)=>a.reservedAction.executeAt-b.reservedAction.executeAt||(b.gauge-GAUGE_MAX)-(a.gauge-GAUGE_MAX)||b.agi-a.agi||a.order-b.order);
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

const AI_GRID=8;
const AI_CHIPS={
 start:[{type:'start',label:'開始'}],
 condition:[{type:'condition',label:'自分HP判定',key:'selfHp',value:40},{type:'condition',label:'味方HP判定',key:'allyHp',value:40},{type:'condition',label:'敵が射程内',key:'enemyRange',value:1},{type:'condition',label:'スキル使用可能',key:'skillReady',value:1}],
 branch:[{type:'branch',label:'YES / NO'},{type:'branch',label:'確率分岐',key:'chance',value:50}],
 target:[{type:'target',label:'最弱の味方',key:'lowestAlly'},{type:'target',label:'最も近い敵',key:'nearestEnemy'},{type:'target',label:'HP最少の敵',key:'lowestEnemy'},{type:'target',label:'ボス',key:'boss'}],
 action:[{type:'action',label:'通常攻撃',key:'attack'},{type:'action',label:'スキル使用',key:'skill',value:'ヒール'},{type:'action',label:'接近',key:'approach'},{type:'action',label:'離脱',key:'retreat'},{type:'action',label:'防御',key:'guard'},{type:'action',label:'待機',key:'wait'}],
 advanced:[{type:'advanced',label:'3 Tick待機',key:'waitTicks',value:3},{type:'advanced',label:'連続禁止',key:'noRepeat',value:1},{type:'advanced',label:'サブルーチン',key:'subroutine',value:'A'}]
};
function defaultAiGraph(){return{version:1,cells:[{id:'N1',x:0,y:0,type:'start',label:'開始'},{id:'N2',x:0,y:1,type:'target',label:'HP最少の敵',key:'lowestEnemy'},{id:'N3',x:0,y:2,type:'action',label:'通常攻撃',key:'attack'}]}}
function normalizeAiGraph(g){if(!g||!Array.isArray(g.cells))return defaultAiGraph();g.cells=g.cells.filter(n=>Number.isInteger(n.x)&&Number.isInteger(n.y)&&n.x>=0&&n.x<AI_GRID&&n.y>=0&&n.y<AI_GRID);return g}
let aiEditCharacter=null,aiDraft=null,aiSelectedTemplate=null,aiHistory=[],aiSelectedNodeId=null,aiPaletteCategory='condition',aiRunTimer=null;
function openAiEditorFor(c){if(!c)return;aiEditCharacter=c;aiDraft=clone(normalizeAiGraph(c.aiGraph));aiHistory=[];aiSelectedNodeId=null;aiSelectedTemplate=null;$('aiEditorTitle').textContent=`${c.name} — AIチップ編集`;$('aiEditor').classList.add('open');$('aiEditor').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderAiPalette();renderAiBoard()}
function closeAiEditor(){clearInterval(aiRunTimer);$('aiEditor').classList.remove('open');$('aiEditor').setAttribute('aria-hidden','true');$('aiConfig').classList.remove('open');document.body.style.overflow=''}
function saveAiHistory(){aiHistory.push(JSON.stringify(aiDraft));if(aiHistory.length>30)aiHistory.shift()}
function nodeAt(x,y){return aiDraft.cells.find(n=>n.x===x&&n.y===y)}
function renderAiBoard(){const board=$('aiBoard');board.innerHTML='';for(let y=0;y<AI_GRID;y++)for(let x=0;x<AI_GRID;x++){const cell=document.createElement('button');cell.type='button';cell.className='ai-cell';cell.dataset.x=x;cell.dataset.y=y;const n=nodeAt(x,y);if(n){cell.innerHTML=`<div class="ai-chip ${n.type}" data-node="${n.id}"><b>${escapeHtml(n.label)}</b>${n.value!==undefined?`<small>${escapeHtml(String(n.value))}</small>`:''}${n.type==='branch'?'<span class="yes">YES</span><span class="no">NO</span>':''}</div>`;cell.onclick=()=>openAiNodeConfig(n)}else cell.onclick=()=>placeAiChip(x,y);board.appendChild(cell)}}
function renderAiPalette(){const cats=[['start','開始'],['condition','条件'],['branch','分岐'],['target','対象'],['action','行動'],['advanced','高度']];$('aiPaletteTabs').innerHTML=cats.map(([k,l])=>`<button class="${k===aiPaletteCategory?'active':''}" data-ai-cat="${k}">${l}</button>`).join('');$('aiPaletteTabs').querySelectorAll('[data-ai-cat]').forEach(b=>b.onclick=()=>{aiPaletteCategory=b.dataset.aiCat;aiSelectedTemplate=null;renderAiPalette()});$('aiPaletteGrid').innerHTML=(AI_CHIPS[aiPaletteCategory]||[]).map((t,i)=>`<button class="ai-palette-chip ${aiSelectedTemplate?.label===t.label?'selected':''}" data-ai-template="${i}">${t.label}</button>`).join('');$('aiPaletteGrid').querySelectorAll('[data-ai-template]').forEach(b=>b.onclick=()=>{aiSelectedTemplate=clone(AI_CHIPS[aiPaletteCategory][Number(b.dataset.aiTemplate)]);renderAiPalette()})}
function placeAiChip(x,y){if(!aiSelectedTemplate)return;saveAiHistory();aiDraft.cells.push({...clone(aiSelectedTemplate),id:'N'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),x,y});renderAiBoard()}
function openAiNodeConfig(n){aiSelectedNodeId=n.id;$('aiConfigTitle').textContent=n.label;let body='<p class="small">このチップの設定を変更します。</p>';if(n.type==='condition')body+=`<label>判定値<input id="aiNodeValue" type="number" min="0" max="100" value="${Number(n.value??40)}"></label>`;if(n.type==='action'&&n.key==='skill')body+=`<label>使用スキル<select id="aiNodeValue"><option>ヒール</option><option>炎斬り</option><option>挑発</option><option>ファイア</option></select></label>`;if(n.type==='advanced')body+=`<label>値<input id="aiNodeValue" value="${escapeHtml(String(n.value??''))}"></label>`;$('aiConfigBody').innerHTML=body;$('aiConfig').classList.add('open');const input=$('aiNodeValue');if(input){input.value=String(n.value??input.value);input.onchange=()=>{saveAiHistory();n.value=input.type==='number'?Number(input.value):input.value;renderAiBoard()}}}
function deleteAiSelected(){const i=aiDraft.cells.findIndex(n=>n.id===aiSelectedNodeId);if(i>=0){saveAiHistory();aiDraft.cells.splice(i,1);renderAiBoard()}$('aiConfig').classList.remove('open')}
function loadPriestPreset(){saveAiHistory();aiDraft={version:1,cells:[{id:'P1',x:0,y:0,type:'start',label:'開始'},{id:'P2',x:0,y:1,type:'condition',label:'味方HP判定',key:'allyHp',value:40},{id:'P3',x:1,y:1,type:'branch',label:'YES / NO'},{id:'P4',x:2,y:0,type:'target',label:'最弱の味方',key:'lowestAlly'},{id:'P5',x:3,y:0,type:'action',label:'スキル使用',key:'skill',value:'ヒール'},{id:'P6',x:2,y:2,type:'target',label:'最も近い敵',key:'nearestEnemy'},{id:'P7',x:3,y:2,type:'action',label:'通常攻撃',key:'attack'}]};renderAiBoard()}
function simulateAi(){clearInterval(aiRunTimer);const nodes=[...aiDraft.cells].sort((a,b)=>a.y-b.y||a.x-b.x);let i=0;document.querySelectorAll('.ai-chip').forEach(e=>e.classList.remove('active-run'));aiRunTimer=setInterval(()=>{document.querySelectorAll('.ai-chip').forEach(e=>e.classList.remove('active-run'));if(i>=nodes.length){clearInterval(aiRunTimer);return}document.querySelector(`[data-node="${nodes[i++].id}"]`)?.classList.add('active-run')},500)}
$('aiEditorClose').onclick=closeAiEditor;$('aiEditorSave').onclick=()=>{if(aiEditCharacter){aiEditCharacter.aiGraph=clone(aiDraft);persist();notify(`${aiEditCharacter.name}のAIチップを保存しました。`)}closeAiEditor()};$('aiUndo').onclick=()=>{if(!aiHistory.length)return;aiDraft=JSON.parse(aiHistory.pop());renderAiBoard()};$('aiClear').onclick=()=>{if(confirm('盤面をすべて消去しますか？')){saveAiHistory();aiDraft={version:1,cells:[]};renderAiBoard()}};$('aiPreset').onclick=loadPriestPreset;$('aiTest').onclick=simulateAi;$('aiDeleteChip').onclick=deleteAiSelected;$('aiConfigClose').onclick=()=>$('aiConfig').classList.remove('open');
const openAiBtn=$('openAiEditor');if(openAiBtn)openAiBtn.onclick=()=>openAiEditorFor(data.characters.find(x=>x.id===selectedId));const skillBtn=$('openSkillPlaceholder');if(skillBtn)skillBtn.onclick=()=>{renderCharacterSkillView();setBaseView('character-skills');};const equipViewBtn=$('openEquipView');if(equipViewBtn)equipViewBtn.onclick=()=>setBaseView('equipment');

const DEV_KEY='ga_developer_mode';
function syncPortraitDevelopmentMode(){
 const enabled=localStorage.getItem(DEV_KEY)==='1';
 document.documentElement.classList.remove('dev-mode-boot','dev-portrait-boot');
 document.body.classList.remove('dev-portrait');
 document.querySelectorAll('.global-orientation,.orientation-guide').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')});
 const panel=$('developerPanel');
 if(panel&&!enabled)panel.open=false;
 if(typeof scheduleFixedCanvasUpdate==='function')scheduleFixedCanvasUpdate();
}

function setDeveloperMode(enabled){
 const panel=$('developerPanel'),button=$('developerModeBtn');
 if(panel){panel.classList.toggle('hidden',!enabled);if(!enabled)panel.open=false}
 if(button){button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'開発者モード ON':'開発者モード'}
 document.body.classList.toggle('dev-enabled',enabled);localStorage.setItem(DEV_KEY,enabled?'1':'0');
 syncPortraitDevelopmentMode();
}
$('developerModeBtn').onclick=()=>{
 const enabled=localStorage.getItem(DEV_KEY)==='1';
 if(!enabled&&!confirm('Battle Coreの数値画面を表示します。開発・検証用途でのみ使用してください。'))return;
 setDeveloperMode(!enabled);
};
setDeveloperMode(localStorage.getItem(DEV_KEY)==='1');

addEventListener('resize',syncPortraitDevelopmentMode);
addEventListener('orientationchange',()=>setTimeout(syncPortraitDevelopmentMode,120));



$('titleStart').onclick=beginNewGame;
$('titleContinue').onclick=continueGame;
$('titleSettings').onclick=()=>alert('設定画面は後続Buildで独立フェーズとして接続します。');
if($('baseToTitle'))$('baseToTitle').onclick=()=>setPhase('title');
$('baseDepart').onclick=$('baseDepartSide').onclick=()=>{if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');return}prepareEvent();setPhase('event')};
$('eventBackBase').onclick=$('eventRetreat').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('eventObserve').onclick=()=>{const q=selectedQuest();$('eventNotice').textContent='敵情報：'+q.enemies.map(e=>`${e.name}(HP${e.maxHp}/攻撃${e.attack}/AGI${e.agi})`).join('、')};
$('eventBattle').onclick=()=>{resetBattle();setPhase('battle')};
$('battleAbort').onclick=()=>setPhase('event');
$('resultToEvent').onclick=()=>setPhase('event',{keepBattle:true});
$('resultToBase').onclick=()=>{setPhase('base',{keepBattle:true});setBaseView('home',{instant:true})};
document.querySelectorAll('#phaseDevNav [data-phase]').forEach(btn=>btn.onclick=()=>setPhase(btn.dataset.phase,{keepBattle:true}));

try{const raw=localStorage.getItem(SAVE_KEY);if(raw){data=normalize(JSON.parse(raw));selectedId=data.characters[0]?.id||null}}catch(e){notify(`自動読込失敗: ${e.message}`,'bad')}render();resetBattle();setPhase('title',{keepBattle:true});
