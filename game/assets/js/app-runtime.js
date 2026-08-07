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
const TAG_SKILL_BUILD='GA-B474 / Studio Export Bridge / ATTACK + DOT + BUFF + DEBUFF + FOLLOW_UP';
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

function runHealSingleValidation(){
 pauseBattle();resetBattle();
 const actor=battle.units.find(x=>x.alive&&x.side==='味方');
 const target=battle.units.find(x=>x.alive&&x.side==='味方'&&x.id!==actor?.id);
 const skill=findTagSkill('SKL-TEST-HEAL-100');
 if(!actor||!target||!skill){$('tagTestResult').textContent='[HEAL SINGLE] FAILED / 必要データがありません';return}
 target.hp=Math.max(1,target.maxHp-50);
 const before=target.hp,result=executeTaggedSkill(actor,target,skill),after=target.hp;
 const passed=result.ok&&after===target.maxHp&&result.healResult?.healed===50&&result.healResult?.overheal===50;
 $('tagTestResult').textContent=`[HEAL SINGLE] ${passed?'PASS':'FAIL'}\nHP ${before} → ${after}/${target.maxHp}\n回復 ${result.healResult?.healed??0}\n超過 ${result.healResult?.overheal??0}`;
 renderBattle();
}
function runHealAllValidation(){
 pauseBattle();resetBattle();
 const allies=battle.units.filter(x=>x.alive&&x.side==='味方');
 const actor=allies[0],skill=findTagSkill('SKL-TEST-HEAL-ALL-60');
 if(!actor||allies.length<2||!skill){$('tagTestResult').textContent='[HEAL ALL] FAILED / 必要データがありません';return}
 allies.forEach((u,i)=>u.hp=Math.max(1,u.maxHp-(30+i*40)));
 const before=allies.map(u=>({id:u.id,hp:u.hp,maxHp:u.maxHp}));
 const result=executeTaggedSkill(actor,allies[1],skill);
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
function prepareShieldValidationFixture(){pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];for(const fixture of SHIELD_VALIDATION_SKILLS){const i=TAG_SKILLS.findIndex(x=>x.id===fixture.id);const row={...fixture,source:'validation_fixture',environment:'validation'};if(i>=0)TAG_SKILLS.splice(i,1,row);else TAG_SKILLS.push(row)}const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',2);return{allies,enemies,skills:{single:findTagSkill('SKL-TEST-SHIELD-100'),all:findTagSkill('SKL-TEST-SHIELD-ALL-60'),small:findTagSkill('SKL-TEST-SHIELD-40')}}}
function shieldUnitSnapshot(u){return{id:u.id,name:u.name,side:u.side,hp:u.hp,max_hp:u.maxHp,alive:u.alive,shield_total:shieldTotal(u),shield_effects:ensureShieldEffects(u).map(x=>({id:x.id,skill_id:x.skillId,amount:x.amount,remaining:x.remaining,sequence:x.sequence??null,applied_at:x.appliedAt,expires_at:x.expiresAt}))}}
function makeShieldCase({id,label,initialState,events,finalState,expectations,result,errors}){return{id,label,initial_state:initialState,events,final_state:finalState,expectations,result,passed:errors.length===0,errors}}
function tagTestRunCleanseJson(){
 const cases=[],errors=[];const run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)errors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const msg=String(e?.message||e);cases.push({id,label,passed:false,errors:[msg]});errors.push(`${id}: ${msg}`)}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;statusEffectSequence=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.statusEffects=[];u.statusResistance={};u.alive=true;u.hp=u.maxHp}return{actor:allies[0],target:allies[1],allies,enemies}};
 const status=(id,duration=400)=>({id:`SKL-TEST-${id}`,name:id,tags:['STATUS',`STATUS_ID=${id}`,'味方','単体',`DURATION=${duration}`]});
 const cleanse=(extra=[])=>({id:'SKL-TEST-CLEANSE-1',name:'単体解除1',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=1','CLEANSE_CATEGORY=status','CLEANSE_ORDER=oldest',...extra]});
 run('CLEANSE-SINGLE-OLDEST','単体・最古1件解除',()=>{const f=prep();executeTaggedSkill(f.actor,f.target,status('STATUS-A'));battle.tick=10;executeTaggedSkill(f.actor,f.target,status('STATUS-B'));const result=executeTaggedSkill(f.actor,f.target,cleanse()),ids=f.target.statusEffects.map(x=>x.statusId),er=[];if(result.cleanseResult?.removedCount!==1)er.push('解除数が1ではありません');if(ids.includes('STATUS-A')||!ids.includes('STATUS-B'))er.push(`最古順解除が不正:${ids.join(',')}`);return{id:'CLEANSE-SINGLE-OLDEST',label:'単体・最古1件解除',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result,passed:!er.length,errors:er}});
 run('CLEANSE-ALL-SINGLE','単体全解除',()=>{const f=prep();executeTaggedSkill(f.actor,f.target,status('STATUS-A'));battle.tick=1;executeTaggedSkill(f.actor,f.target,status('STATUS-B'));const skill={id:'SKL-TEST-CLEANSE-ALL',name:'単体全解除',tags:['CLEANSE','味方','単体','CLEANSE_ALL','CLEANSE_CATEGORY=status']},result=executeTaggedSkill(f.actor,f.target,skill),er=[];if(result.cleanseResult?.removedCount!==2||f.target.statusEffects.length)er.push('全解除されていません');return{id:'CLEANSE-ALL-SINGLE',label:'単体全解除',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-ALLY-ALL','味方全体解除',()=>{const f=prep();for(const u of f.allies)executeTaggedSkill(f.actor,u,status(`STATUS-${u.id}`));const skill={id:'SKL-TEST-CLEANSE-ALL-PARTY',name:'味方全体状態異常解除',tags:['CLEANSE','味方','全体','CLEANSE_ALL','CLEANSE_CATEGORY=status']},result=executeTaggedSkill(f.actor,f.actor,skill),er=[];if(f.allies.some(u=>u.statusEffects.length))er.push('味方全体解除に失敗');return{id:'CLEANSE-ALLY-ALL',label:'味方全体解除',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-NONE-OK','対象効果なし正常終了',()=>{const f=prep(),result=executeTaggedSkill(f.actor,f.target,cleanse()),er=[];if(!result.ok||result.cleanseResult?.removedCount!==0)er.push('対象なしが正常終了ではありません');return{id:'CLEANSE-NONE-OK',label:'対象効果なし正常終了',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-PROTECTED-SKIP','保護効果を解除しない',()=>{const f=prep();executeTaggedSkill(f.actor,f.target,status('STATUS-PROTECTED'));f.target.statusEffects[0].protected=true;const result=executeTaggedSkill(f.actor,f.target,{id:'SKL-TEST-CLEANSE-ALL',name:'全解除',tags:['CLEANSE','味方','単体','CLEANSE_ALL','CLEANSE_CATEGORY=status']}),er=[];if(!f.target.statusEffects.length||result.cleanseResult?.skippedProtectedCount!==1)er.push('protected効果が正しくスキップされていません');return{id:'CLEANSE-PROTECTED-SKIP',label:'保護効果を解除しない',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('CLEANSE-DEAD-REJECT','死亡対象拒否',()=>{const f=prep();f.target.alive=false;f.target.hp=0;const result=executeTaggedSkill(f.actor,f.target,cleanse()),er=[];if(result.ok)er.push('死亡対象が受理されました');return{id:'CLEANSE-DEAD-REJECT',label:'死亡対象拒否',result,passed:!er.length,errors:er}});
 run('CLEANSE-INVALID-DATA','不正データ拒否',()=>{const a=compileTaggedSkill({id:'BAD-C1',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=0']}),b=compileTaggedSkill({id:'BAD-C2',tags:['CLEANSE','味方','単体','CLEANSE_ALL','CLEANSE_COUNT=1']}),c=compileTaggedSkill({id:'BAD-C3',tags:['CLEANSE','敵','単体','CLEANSE_COUNT=1']}),d=compileTaggedSkill({id:'BAD-C4',tags:['CLEANSE','味方','単体','CLEANSE_COUNT=1','CLEANSE_CATEGORY=all_negative']}),er=[];if(a.ok||b.ok||c.ok||d.ok)er.push('不正データを受理しました');return{id:'CLEANSE-INVALID-DATA',label:'不正データ拒否',result:{count_zero:a,all_and_count:b,enemy_target:c,unsupported_category:d},passed:!er.length,errors:er}});
 const report={schema_version:'1.0.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-CLEANSE-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunCleanseJson'},current_spec:{scope:'status_only',target_sides:['self','ally'],ranges:['single','all'],count:['CLEANSE_COUNT','CLEANSE_ALL'],order:'oldest',protected_is_not_removed:true,no_effect_is_success:true},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cleanse-device-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[CLEANSE DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}`;return report;
}


function tagTestRunShieldJson(){const cases=[],allErrors=[];const run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)allErrors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const msg=String(e?.message||e);cases.push(makeShieldCase({id,label,initialState:null,events:[],finalState:null,expectations:{},result:null,errors:[msg]}));allErrors.push(`${id}: ${msg}`)}};
 run('SHIELD-ABSORB-PARTIAL','シールド内吸収',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],skill=f.skills.single,errors=[];target.hp=target.maxHp;const initial=shieldUnitSnapshot(target),grant=executeTaggedSkill(actor,target,skill),damage=applyTaggedDamage(f.enemies[0],target,60,{id:'TEST-DAMAGE-60',name:'検証ダメージ60',parameters:{damage:60}});if(shieldTotal(target)!==40)errors.push(`残量が40ではありません: ${shieldTotal(target)}`);if(target.hp!==target.maxHp)errors.push('HPが変化しました');return makeShieldCase({id:'SHIELD-ABSORB-PARTIAL',label:'シールド内吸収',initialState:initial,events:[...battle.validationEvents],finalState:shieldUnitSnapshot(target),expectations:{shield_remaining:40,hp_unchanged:true},result:{grant,damage},errors})});
 run('SHIELD-OVERFLOW','超過ダメージ',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],skill=f.skills.single,errors=[];target.hp=target.maxHp;executeTaggedSkill(actor,target,skill);const before=target.hp,damage=applyTaggedDamage(f.enemies[0],target,150,{id:'TEST-DAMAGE-150',name:'検証ダメージ150',parameters:{damage:150}});if(shieldTotal(target)!==0)errors.push('シールドが0ではありません');if(target.hp!==before-50)errors.push(`HPダメージが50ではありません: ${before-target.hp}`);return makeShieldCase({id:'SHIELD-OVERFLOW',label:'超過ダメージ',initialState:{target:{...shieldUnitSnapshot(target),hp:before,shield_total:100}},events:[...battle.validationEvents],finalState:shieldUnitSnapshot(target),expectations:{shield_remaining:0,hp_damage:50},result:damage,errors})});
 run('SHIELD-INVALID-DATA-REJECT','不正シールド拒否',()=>{const invalid={id:'SKL-INVALID-SHIELD-0',name:'不正シールド',tags:['SHIELD','味方','単体','SHIELD=0','DURATION=100']},compiled=compileTaggedSkill(invalid),errors=[];if(compiled.ok)errors.push('SHIELD=0が受理されました');if(!compiled.errors.some(x=>x.includes('0より大きい')))errors.push('期待する値エラーがありません');return makeShieldCase({id:'SHIELD-INVALID-DATA-REJECT',label:'不正シールド拒否',initialState:{skill:invalid},events:[],finalState:{compiled_ok:compiled.ok,compile_errors:compiled.errors},expectations:{compiled_ok:false},result:compiled,errors})});
 run('SHIELD-DEAD-REJECT','戦闘不能対象拒否',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[];target.hp=0;target.alive=false;const result=executeTaggedSkill(actor,target,f.skills.single);if(result.ok)errors.push('戦闘不能対象へ付与されました');if(shieldTotal(target)!==0)errors.push('戦闘不能対象に残量があります');return makeShieldCase({id:'SHIELD-DEAD-REJECT',label:'戦闘不能対象拒否',initialState:shieldUnitSnapshot(target),events:[...battle.validationEvents],finalState:shieldUnitSnapshot(target),expectations:{execution_ok:false,shield_total:0},result,errors})});
 run('SHIELD-ALL','味方全体付与',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],errors=[],enemyBefore=f.enemies.map(shieldTotal),result=executeTaggedSkill(actor,actor,f.skills.all);for(const u of f.allies)if(shieldTotal(u)!==60)errors.push(`${u.id}の残量が60ではありません`);if(f.enemies.some((u,i)=>shieldTotal(u)!==enemyBefore[i]))errors.push('敵へシールドが付与されました');return makeShieldCase({id:'SHIELD-ALL',label:'味方全体付与',initialState:{allies:f.allies.map(shieldUnitSnapshot),enemies:f.enemies.map(shieldUnitSnapshot)},events:[...battle.validationEvents],finalState:{allies:f.allies.map(shieldUnitSnapshot),enemies:f.enemies.map(shieldUnitSnapshot)},expectations:{ally_count:f.allies.length,shield_each:60,enemy_unchanged:true},result,errors})});
 run('SHIELD-MULTIPLE-FIFO','複数シールド競合',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[];executeTaggedSkill(actor,target,f.skills.single);executeTaggedSkill(actor,target,f.skills.small);const before=shieldUnitSnapshot(target),damage=applyTaggedDamage(f.enemies[0],target,120,{id:'TEST-DAMAGE-120',name:'検証ダメージ120',parameters:{damage:120}}),after=shieldUnitSnapshot(target);if(before.shield_total!==140)errors.push(`加算合計が140ではありません: ${before.shield_total}`);if(after.shield_total!==20)errors.push(`残量が20ではありません: ${after.shield_total}`);if(after.shield_effects.length!==1||after.shield_effects[0].skill_id!=='SKL-TEST-SHIELD-40')errors.push('FIFO消費順が不正です');return makeShieldCase({id:'SHIELD-MULTIPLE-FIFO',label:'複数シールド競合',initialState:before,events:[...battle.validationEvents],finalState:after,expectations:{stacking:'additive_instances',consume_order:'fifo',remaining:20},result:damage,errors})});
 run('SHIELD-DURATION-EXPIRE','持続終了',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[],short={id:'SKL-TEST-SHIELD-SHORT',name:'短時間シールド',tags:['SHIELD','味方','単体','SHIELD=25','DURATION=5']};executeTaggedSkill(actor,target,short);const initial=shieldUnitSnapshot(target);processTicks(5);const final=shieldUnitSnapshot(target);if(final.shield_total!==0)errors.push(`Tick5で終了していません: ${final.shield_total}`);return makeShieldCase({id:'SHIELD-DURATION-EXPIRE',label:'持続終了',initialState:initial,events:[...battle.validationEvents],finalState:final,expectations:{expires_at_tick:5,shield_total:0},result:{tick:battle.tick},errors})});
 run('SHIELD-BATTLE-END-CLEAR','戦闘終了時消去',()=>{const f=prepareShieldValidationFixture(),actor=f.allies[0],target=f.allies[1],errors=[];executeTaggedSkill(actor,target,f.skills.single);const initial=shieldUnitSnapshot(target);for(const e of battle.units.filter(u=>u.side==='敵')){e.hp=0;e.alive=false}finishIfNeeded();const final=shieldUnitSnapshot(target);if(final.shield_total!==0)errors.push('戦闘終了後にシールドが残っています');return makeShieldCase({id:'SHIELD-BATTLE-END-CLEAR',label:'戦闘終了時消去',initialState:initial,events:[...battle.validationEvents],finalState:final,expectations:{battle_pending_result:true,shield_total:0},result:{pending_result:battle.pendingResult},errors})});
 const report={schema_version:'1.3.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-SHIELD-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunShieldJson'},design_decisions:{stacking:'additive individual instances',consumption:'FIFO by appliedAt',dot_consumes_shield:true,death_clears:true,battle_end_clears:true},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:allErrors.length===0,errors:allErrors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-shield-device-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[SHIELD DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.map(x=>' - '+x).join('\n'):''}\n[JSON] 出力完了`;renderBattle();return report}

function tagTestRunStatusJson(){
 const cases=[],errors=[],run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)errors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const m=String(e?.message||e);cases.push({id,label,passed:false,errors:[m]});errors.push(`${id}: ${m}`)}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];statusEffectSequence=0;const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.statusEffects=[];u.statusResistance={}}return{actor:allies[0],target:enemies[0]}};
 const skill=(duration=400)=>({id:'SKL-TEST-STATUS-ACCURACY-DOWN',name:'命中低下',tags:['STATUS','STATUS_ID=STATUS-ACCURACY-DOWN','敵','単体',`DURATION=${duration}`]});
 run('STATUS-APPLY-NO-RESIST','耐性0・100%付与',()=>{const f=prep(),r=executeTaggedSkill(f.actor,f.target,skill()),e=f.target.statusEffects[0],er=[];if(!r.ok||!e)er.push('付与失敗');if(e?.effectiveDurationTick!==400||e?.expiresTick!==400)er.push(`持続時間不一致:${e?.effectiveDurationTick}`);return{id:'STATUS-APPLY-NO-RESIST',label:'耐性0・100%付与',initial_state:{resistance:0},events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result:r,passed:!er.length,errors:er}});
 run('STATUS-DURATION-25-RESIST','耐性25%で持続短縮',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':25};const r=executeTaggedSkill(f.actor,f.target,skill()),e=f.target.statusEffects[0],er=[];if(!e)er.push('状態異常が付与されていません');if(e?.effectiveDurationTick!==300||e?.expiresTick!==300)er.push(`実効持続時間が300ではありません:${e?.effectiveDurationTick}`);return{id:'STATUS-DURATION-25-RESIST',label:'耐性25%で持続短縮',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result:r,passed:!er.length,errors:er}});
 run('STATUS-DURATION-75-RESIST','耐性75%でも付与',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':75};const r=executeTaggedSkill(f.actor,f.target,skill()),e=f.target.statusEffects[0],er=[];if(!e)er.push('耐性75%で付与されていません');if(e?.effectiveDurationTick!==100||e?.expiresTick!==100)er.push(`実効持続時間が100ではありません:${e?.effectiveDurationTick}`);return{id:'STATUS-DURATION-75-RESIST',label:'耐性75%でも付与',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},result:r,passed:!er.length,errors:er}});
 run('STATUS-RESIST-CAP','耐性上限75%',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':100};executeTaggedSkill(f.actor,f.target,skill());const e=f.target.statusEffects[0],er=[];if(!e)er.push('状態異常が付与されていません');if(e?.targetResistance!==75||e?.effectiveDurationTick!==100)er.push(`耐性上限または持続時間不一致:${e?.targetResistance}/${e?.effectiveDurationTick}`);return{id:'STATUS-RESIST-CAP',label:'耐性上限75%',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},passed:!er.length,errors:er}});
 run('STATUS-REFRESH','再付与更新',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':25};executeTaggedSkill(f.actor,f.target,skill());battle.tick=100;executeTaggedSkill(f.actor,f.target,skill());const er=[];if(f.target.statusEffects.length!==1)er.push('件数が1ではありません');if(f.target.statusEffects[0]?.expiresTick!==400)er.push(`期限が400ではありません:${f.target.statusEffects[0]?.expiresTick}`);if(!battle.validationEvents.some(x=>x.type==='status_refreshed'))er.push('status_refreshedなし');return{id:'STATUS-REFRESH',label:'再付与更新',events:[...battle.validationEvents],final_state:{statuses:statusSnapshot(f.target)},passed:!er.length,errors:er}});
 run('STATUS-EXPIRE','満了',()=>{const f=prep();f.target.statusResistance={'STATUS-ACCURACY-DOWN':75};executeTaggedSkill(f.actor,f.target,skill());battle.tick=100;processStatusEffects();const er=[];if(f.target.statusEffects.length)er.push('満了していません');if(!battle.validationEvents.some(x=>x.type==='status_removed'&&x.reason==='expired'))er.push('expiredログなし');return{id:'STATUS-EXPIRE',label:'満了',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-MANUAL-REMOVE','手動解除API',()=>{const f=prep();executeTaggedSkill(f.actor,f.target,skill());removeStatus(f.target,{status_id:'STATUS-ACCURACY-DOWN'},'manual_dispel',battle.tick);const er=[];if(f.target.statusEffects.length)er.push('解除されていません');return{id:'STATUS-MANUAL-REMOVE',label:'手動解除API',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-TARGET-DEATH','対象死亡消去',()=>{const f=prep();executeTaggedSkill(f.actor,f.target,skill());f.target.alive=false;removeStatus(f.target,{category:'status'},'target_dead',battle.tick);const er=[];if(f.target.statusEffects.length)er.push('死亡時消去されていません');return{id:'STATUS-TARGET-DEATH',label:'対象死亡消去',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-BATTLE-END','戦闘終了消去',()=>{const f=prep();executeTaggedSkill(f.actor,f.target,skill());clearAllStatuses('battle_end');const er=[];if(f.target.statusEffects.length)er.push('戦闘終了消去されていません');return{id:'STATUS-BATTLE-END',label:'戦闘終了消去',events:[...battle.validationEvents],passed:!er.length,errors:er}});
 run('STATUS-INVALID-DATA','不正データ拒否',()=>{const a=compileTaggedSkill({id:'BAD1',tags:['STATUS','敵','単体','DURATION=300']}),b=compileTaggedSkill({id:'BAD2',tags:['STATUS','STATUS_ID=X','敵','単体','DURATION=0']}),er=[];if(a.ok||b.ok)er.push('不正データを受理しました');return{id:'STATUS-INVALID-DATA',label:'不正データ拒否',result:{missing_status_id:a,invalid_duration:b},passed:!er.length,errors:er}});
 const report={schema_version:'1.1.0',build:'GA-B486.24',generated_at:new Date().toISOString(),test:{id:'TAG-STATUS-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunStatusJson'},design_decisions:{attack_hit_applies_status:true,application_rate:100,resistance_affects:'duration',resistance_cap_percent:75,duration_formula:'floor(base_duration * (1 - resistance/100))',minimum_duration_tick:1},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-status-device-validation-GA-B486.24-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[STATUS DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}`;return report;
}



function tagTestRunReviveJson(){
 const cases=[],errors=[];const run=(id,label,fn)=>{try{const c=fn();cases.push(c);if(!c.passed)errors.push(...c.errors.map(x=>`${id}: ${x}`))}catch(e){const msg=String(e?.message||e);cases.push({id,label,passed:false,errors:[msg]});errors.push(`${id}: ${msg}`)}};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',1);for(const u of battle.units){u.alive=true;u.hp=u.maxHp;u.gauge=0;u.reservedAction=null;u.statusEffects=[];u.dotStacks=[];u.modifierStacks=[];u.shieldEffects=[]}return{actor:allies[0],target:allies[1],allies,enemies}};
 const fixed=(hp=100)=>({id:'SKL-TEST-REVIVE-FIXED',name:'固定値蘇生',tags:['REVIVE','味方','単体',`REVIVE_HP=${hp}`]});
 const rate=(value=0.25,range='単体')=>({id:`SKL-TEST-REVIVE-RATE-${range}`,name:'割合蘇生',tags:['REVIVE','味方',range,`REVIVE_HP_RATE=${value}`]});
 const defeat=(u)=>{u.statusEffects=[{instanceId:'S1'}];u.dotStacks=[{id:'D1'}];u.modifierStacks=[{id:'M1'}];u.shieldEffects=[{id:'H1',remaining:50}];u.gauge=80;u.reservedAction={kind:'test'};return resetCombatantOnDeath(u,{reason:'validation'})};
 run('REVIVE-RATE-SINGLE','最大HPの25%で単体蘇生',()=>{const f=prep();f.target.maxHp=310;defeat(f.target);const result=executeTaggedSkill(f.actor,f.target,rate(0.25)),er=[];if(!result.ok||!result.reviveResult?.ok)er.push('割合蘇生に失敗しました');if(f.target.hp!==77||result.reviveResult?.reviveMode!=='rate')er.push(`割合計算不一致:${f.target.hp}/${result.reviveResult?.reviveMode}`);return{id:'REVIVE-RATE-SINGLE',label:'最大HPの25%で単体蘇生',events:[...battle.validationEvents],result,final_state:{hp:f.target.hp,max_hp:f.target.maxHp,alive:f.target.alive,gauge:f.target.gauge},passed:!er.length,errors:er}});
 run('REVIVE-RATE-FLOOR','割合計算は小数切り捨て',()=>{const f=prep();f.target.maxHp=333;defeat(f.target);const result=executeTaggedSkill(f.actor,f.target,rate(0.25)),er=[];if(f.target.hp!==83)er.push(`切り捨て不一致:${f.target.hp}`);return{id:'REVIVE-RATE-FLOOR',label:'割合計算は小数切り捨て',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-MIN-ONE','割合計算結果は最低1HP',()=>{const f=prep();f.target.maxHp=3;defeat(f.target);const result=executeTaggedSkill(f.actor,f.target,rate(0.01)),er=[];if(f.target.hp!==1)er.push(`最低HP不一致:${f.target.hp}`);return{id:'REVIVE-RATE-MIN-ONE',label:'割合計算結果は最低1HP',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-FULL-CAP','割合1は最大HPで蘇生',()=>{const f=prep();f.target.maxHp=310;defeat(f.target);const result=executeTaggedSkill(f.actor,f.target,rate(1)),er=[];if(f.target.hp!==310)er.push(`最大HP不一致:${f.target.hp}`);return{id:'REVIVE-RATE-FULL-CAP',label:'割合1は最大HPで蘇生',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-ALL','全体割合蘇生は死亡者のみ',()=>{const f=prep(),living=f.allies[0],d1=f.allies[1],d2=f.allies[2],livingHp=living.hp;d1.maxHp=310;d2.maxHp=500;defeat(d1);defeat(d2);const result=executeTaggedSkill(f.actor,f.actor,rate(0.2,'全体')),er=[];if(d1.hp!==62||d2.hp!==100)er.push(`全体割合不一致:${d1.hp}/${d2.hp}`);if(living.hp!==livingHp)er.push('生存者が変更されました');if(result.targets?.length!==2)er.push(`対象数不一致:${result.targets?.length}`);return{id:'REVIVE-RATE-ALL',label:'全体割合蘇生は死亡者のみ',events:[...battle.validationEvents],result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-LIVING-REJECT','生存対象はINVALID_TARGET',()=>{const f=prep(),before=f.target.hp,result=executeTaggedSkill(f.actor,f.target,rate(0.25)),er=[];if(result.ok||result.stage!=='target')er.push('生存対象が拒否されていません');if(f.target.hp!==before)er.push('生存対象が変更されました');return{id:'REVIVE-RATE-LIVING-REJECT',label:'生存対象はINVALID_TARGET',result,passed:!er.length,errors:er}});
 run('REVIVE-RATE-INVALID-DATA','割合タグ不正データ拒否',()=>{const missing=compileTaggedSkill({id:'BAD-R1',tags:['REVIVE','味方','単体']}),zero=compileTaggedSkill({id:'BAD-R2',tags:['REVIVE','味方','単体','REVIVE_HP_RATE=0']}),over=compileTaggedSkill({id:'BAD-R3',tags:['REVIVE','味方','単体','REVIVE_HP_RATE=1.01']}),both=compileTaggedSkill({id:'BAD-R4',tags:['REVIVE','味方','単体','REVIVE_HP=100','REVIVE_HP_RATE=0.25']}),enemy=compileTaggedSkill({id:'BAD-R5',tags:['REVIVE','敵','単体','REVIVE_HP_RATE=0.25']}),er=[];if(missing.ok||zero.ok||over.ok||both.ok||enemy.ok)er.push('不正データを受理しました');return{id:'REVIVE-RATE-INVALID-DATA',label:'割合タグ不正データ拒否',result:{missing_value:missing,zero_rate:zero,over_rate:over,fixed_and_rate:both,enemy_target:enemy},passed:!er.length,errors:er}});
 const deferredChecks=[];try{const f=prep();defeat(f.target);const result=executeTaggedSkill(f.actor,f.target,fixed(100)),er=[];if(f.target.hp!==100||result.reviveResult?.reviveMode!=='fixed')er.push('固定値蘇生は現行ゲームランタイムで互換動作しません');deferredChecks.push({id:'REVIVE-FIXED-DEFERRED',label:'固定値蘇生（死亡回避基盤への転用候補・合否対象外）',result,passed:!er.length,errors:er,release_gate:false})}catch(e){deferredChecks.push({id:'REVIVE-FIXED-DEFERRED',label:'固定値蘇生（死亡回避基盤への転用候補・合否対象外）',passed:false,errors:[String(e?.message||e)],release_gate:false})}
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
 const add=(row,expectedOk)=>{const result=compileTaggedSkill({id:row.id,name:row.label,tags:row.tags});const er=[];
  if(result.ok!==expectedOk)er.push(expectedOk?'正常系が拒否されました':'異常系が受理されました');
  if(expectedOk&&result.ok){const d=result.definition,p=d.parameters||{};if(!d.logicOrder?.includes('AURA'))er.push('logicOrderにAURAがありません');if(d.target?.side!=='self'||d.target?.range!=='single')er.push(`通常target正規化不一致:${d.target?.side}/${d.target?.range}`);if(p.auraStack!=='highest')er.push(`AURA_STACK不一致:${p.auraStack}`);}
  const c={id:row.id,label:row.label,input:{tags:[...row.tags]},expected:{compiled_ok:expectedOk},result,passed:er.length===0,errors:er};cases.push(c);if(er.length)errors.push(...er.map(x=>`${row.id}: ${x}`));};
 valid.forEach(x=>add(x,true));invalid.forEach(x=>add(x,false));
 const entrypoint=location.pathname.includes('game-tag-test')?'game-tag-test/index.html':'game/index.html';
 const report={schema_version:'1.0.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-AURA-DEVICE-001',mode:'device_validation',entrypoint,trigger:'tagTestRunAuraJson'},current_spec:{task_id:'P01-06',stage:'tag_validation',runtime_application:false,supported_effects:['BUFF','DEBUFF'],supported_stats:['ATK','DEF','AGI','VIT','INT','DEX','LUK'],value_tag:'AURA_VALUE',target_tag:'AURA_TARGET=<ally|enemy>',scope_tag:'AURA_SCOPE=<all|self_and_allies|allies_excluding_self>',stacking:'highest only',status_aura:'deferred',additive:'deferred',unique_source:'deferred'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-aura-device-validation-GA-B486.38-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[AURA DEVICE JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.map(x=>' - '+x).join('\n'):''}\n[JSON] 出力完了`;return report;
}

async function tagTestRunAuraRuntimeJson(){
 pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];
 if(studioSkillBridge.status!=='loaded')await loadStudioSkillDefinitions();
 const errors=[],cases=[];const add=(id,label,fn)=>{try{const row={id,label,...fn()};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(error){const message=String(error?.message||error);cases.push({id,label,passed:false,errors:[message]});errors.push(`${id}: ${message}`)}};
 const requireStudio=id=>{const skill=findTagSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);const c=compileTaggedSkill(skill);if(!c.ok)throw new Error(`${id} compile: ${c.errors.join(', ')}`);return skill};
 const prepare=()=>{resetBattle();battle.validationMode=true;battle.validationEvents=[];const allies=ensureValidationTargets('味方',4),enemies=ensureValidationTargets('敵',2);for(const u of battle.units)u.auraSkillIds=[];return{allies,enemies}};
 const snap=(u)=>({id:u.id,alive:u.alive,buff_atk:effectiveModifierPower(u,'BUFF','ATK'),buff_def:effectiveModifierPower(u,'BUFF','DEF'),debuff_atk:effectiveModifierPower(u,'DEBUFF','ATK'),attack:effectiveAttackValue(u)});
 requireStudio('SKL-AURA-ALLY-ATK-10');requireStudio('SKL-AURA-ALLY-ATK-30');requireStudio('SKL-AURA-ALLY-DEF-15-EX');requireStudio('SKL-AURA-ENEMY-ATK-DOWN-20');
 add('AURA-RUNTIME-ALLY-ATK','味方ATKオーラ適用',()=>{const f=prepare(),source=f.allies[0],ally=f.allies[1],enemy=f.enemies[0];source.auraSkillIds=['SKL-AURA-ALLY-ATK-10'];const ss=snap(source),as=snap(ally),es=snap(enemy),e=[];if(ss.buff_atk!==10||as.buff_atk!==10||es.buff_atk!==0)e.push(`ATK aura mismatch self=${ss.buff_atk} ally=${as.buff_atk} enemy=${es.buff_atk}`);return{source:ss,ally:as,enemy:es,errors:e}});
 add('AURA-RUNTIME-ALLY-DEF-EX','本人除外DEFオーラ適用',()=>{const f=prepare(),source=f.allies[0],ally=f.allies[1];source.auraSkillIds=['SKL-AURA-ALLY-DEF-15-EX'];const ss=snap(source),as=snap(ally),e=[];if(ss.buff_def!==0||as.buff_def!==15)e.push(`DEF aura mismatch self=${ss.buff_def} ally=${as.buff_def}`);return{source:ss,ally:as,errors:e}});
 add('AURA-RUNTIME-ENEMY-DEBUFF','敵全体ATK低下オーラ適用',()=>{const f=prepare(),source=f.allies[0],enemy1=f.enemies[0],enemy2=f.enemies[1],ally=f.allies[1];source.auraSkillIds=['SKL-AURA-ENEMY-ATK-DOWN-20'];const e1=snap(enemy1),e2=snap(enemy2),a=snap(ally),e=[];if(e1.debuff_atk!==20||e2.debuff_atk!==20||a.debuff_atk!==0)e.push(`enemy aura mismatch e1=${e1.debuff_atk} e2=${e2.debuff_atk} ally=${a.debuff_atk}`);return{enemy1:e1,enemy2:e2,ally:a,errors:e}});
 add('AURA-RUNTIME-HIGHEST','複数発生源highest',()=>{const f=prepare(),low=f.allies[0],high=f.allies[1],target=f.allies[2];low.auraSkillIds=['SKL-AURA-ALLY-ATK-10'];high.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];const before=snap(target),e=[];if(before.buff_atk!==30)e.push(`highest=${before.buff_atk}`);return{target:before,active_auras:activeAuraEntries(target,'BUFF','ATK'),errors:e}});
 add('AURA-RUNTIME-SOURCE-DEATH-REVIVE','発生源死亡解除・蘇生再有効',()=>{const f=prepare(),low=f.allies[0],high=f.allies[1],target=f.allies[2],reviver=f.allies[3];low.auraSkillIds=['SKL-AURA-ALLY-ATK-10'];high.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];const before=snap(target);resetCombatantOnDeath(high,{reason:'aura_runtime_validation'});const afterDeath=snap(target);const reviveSkill=requireStudio('SKL-REVIVE-SINGLE-100'),reviveResult=executeTaggedSkill(reviver,high,reviveSkill),afterRevive=snap(target),e=[];if(before.buff_atk!==30||afterDeath.buff_atk!==10||afterRevive.buff_atk!==30)e.push(`transition ${before.buff_atk}->${afterDeath.buff_atk}->${afterRevive.buff_atk}`);if(!reviveResult.ok||!reviveResult.reviveResult?.ok||!high.alive)e.push('発生源蘇生に失敗');return{before,after_source_death:afterDeath,after_source_revive:afterRevive,revive_result:{ok:reviveResult.ok,detail:reviveResult.reviveResult||null,hp:high.hp,alive:high.alive},errors:e}});
 add('AURA-RUNTIME-TARGET-DEATH-REVIVE','対象死亡中無効・蘇生後再評価',()=>{const f=prepare(),source=f.allies[0],target=f.allies[1],reviver=f.allies[2];source.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];const before=snap(target);resetCombatantOnDeath(target,{reason:'aura_target_validation'});const dead=snap(target);const reviveSkill=requireStudio('SKL-REVIVE-SINGLE-100'),reviveResult=executeTaggedSkill(reviver,target,reviveSkill),after=snap(target),e=[];if(before.buff_atk!==30||dead.buff_atk!==0||after.buff_atk!==30)e.push(`target transition ${before.buff_atk}->${dead.buff_atk}->${after.buff_atk}`);if(!reviveResult.ok||!reviveResult.reviveResult?.ok||!target.alive)e.push('対象蘇生に失敗');return{before,dead,after_revive:after,revive_result:{ok:reviveResult.ok,detail:reviveResult.reviveResult||null,hp:target.hp,alive:target.alive},errors:e}});
 const report={schema_version:'1.0.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-AURA-RUNTIME-DEVICE-001',mode:'device_validation',entrypoint:'game/index.html',trigger:'tagTestRunAuraRuntimeJson'},current_spec:{task_id:'P01-06',stage:'runtime_connection_v1',runtime_application:true,source_dependency:true,stacking:'highest',source_death:'immediate_disable',source_revive:'re_evaluate_and_restore',target_death:'inactive_while_dead',target_revive:'re_evaluate',status_aura:'deferred',additive:'deferred',unique_source:'deferred'},source:{studio_status:studioSkillBridge.status,data_version:studioSkillBridge.data_version},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-aura-runtime-device-validation-GA-B486.38-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);$('tagTestResult').textContent=`[AURA RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[STUDIO] ${report.source.data_version||report.source.studio_status}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.map(x=>' - '+x).join('\n'):''}\n[JSON] 出力完了`;return report;
}
function setupTagSkillTestUI(){
 const execute=$('tagTestExecute'),compile=$('tagTestCompile'),actor=$('tagTestActor'),run1000=$('tagTestRun1000'),runStackLimit=$('tagTestRunStackLimit'),runStaggered=$('tagTestRunStaggered'),runDefeat=$('tagTestRunDefeat'),runBuffHighest=$('tagTestRunBuffHighest'),runDebuffHighest=$('tagTestRunDebuffHighest'),runBuffAll=$('tagTestRunBuffAll'),runDebuffAll=$('tagTestRunDebuffAll'),runModifierTargetDeath=$('tagTestRunModifierTargetDeath'),runModifierSourceDeath=$('tagTestRunModifierSourceDeath'),runConditionalFollowUp=$('tagTestRunConditionalFollowUp'),runStudioBridge=$('tagTestRunStudioBridge'),runFormalRegression=$('tagTestRunFormalRegression'),runHealSingle=$('tagTestRunHealSingle'),runHealAll=$('tagTestRunHealAll'),runShieldJson=$('tagTestRunShieldJson'),runStatusJson=$('tagTestRunStatusJson'),runCleanseJson=$('tagTestRunCleanseJson'),runReviveJson=$('tagTestRunReviveJson'),runAuraJson=$('tagTestRunAuraJson'),runAuraRuntimeJson=$('tagTestRunAuraRuntimeJson'),runCounterJson=$('tagTestRunCounterJson'),runCoverJson=$('tagTestRunCoverJson'),runCounterRuntimeJson=$('tagTestRunCounterRuntimeJson'),runCoverRuntimeJson=$('tagTestRunCoverRuntimeJson'),exportJson=$('tagTestExportJson');if(!execute||execute.dataset.bound)return;
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
 if(runHealSingle)runHealSingle.onclick=runHealSingleValidation;
 if(runHealAll)runHealAll.onclick=runHealAllValidation;
 if(runShieldJson)runShieldJson.onclick=tagTestRunShieldJson;
 if(runStatusJson)runStatusJson.onclick=tagTestRunStatusJson;
 if(runCleanseJson)runCleanseJson.onclick=tagTestRunCleanseJson;
 if(runReviveJson)runReviveJson.onclick=tagTestRunReviveJson;
 if(runAuraJson)runAuraJson.onclick=tagTestRunAuraJson;
 if(runCounterJson)runCounterJson.onclick=tagTestRunCounterJson;
 if(runCoverJson)runCoverJson.onclick=tagTestRunCoverJson;
 if(runCounterRuntimeJson)runCounterRuntimeJson.onclick=tagTestRunCounterRuntimeJson;if(runCoverRuntimeJson)runCoverRuntimeJson.onclick=tagTestRunCoverRuntimeJson;
 if(runAuraRuntimeJson)runAuraRuntimeJson.onclick=tagTestRunAuraRuntimeJson;
 if(runFormalRegression)runFormalRegression.onclick=async()=>{if(studioSkillBridge.status!=='loaded')await loadStudioSkillDefinitions();const report=downloadFormalRuntimeRegressionJson();$('tagTestResult').textContent=`[FORMAL REGRESSION] ${report.summary.passed?'PASS':'FAIL'}\n[STATUS] ${report.source.status}\n[PRODUCTION DEFINITIONS] ${report.summary.production_compile_count}/${report.summary.production_definition_count}\n[VALIDATION REJECTIONS] ${report.summary.validation_expected_rejection_count}/${report.summary.validation_definition_count}\n[REQUIRED STUDIO] ${report.summary.required_studio_sourced}/${report.summary.required_count}\n[EMBEDDED PRODUCTION] ${report.summary.production_embedded_count}\n[COUNTER RUNTIME] ${report.summary.counter_runtime_passed_count}/${report.summary.counter_runtime_case_count}\n[COVER RUNTIME] ${report.summary.cover_runtime_passed_count}/${report.summary.cover_runtime_case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`};
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
 const cases=defs.map(d=>{const result=compileTaggedSkill({id:d.id,name:d.label,tags:d.tags}),passed=result.ok===d.expected;return{...d,result,passed,errors:passed?[]:[`期待 ${d.expected?'VALID':'INVALID'} / 実際 ${result.ok?'VALID':'INVALID'}`]}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`)),entrypoint='game/index.html';
 const report={schema_version:'1.1.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-COVER-DEVICE-002',mode:'device_validation',entrypoint,trigger:'tagTestRunCoverJson'},current_spec:{task_id:'P01-08',stage:'runtime_v1',runtime_application:true,target_foundation:['single_ally','all_allies'],initial_formal_skill:'single_ally',area_attack_cover_limit_per_request:1,direct_attack_origins:['base','counter','follow_up'],standalone_dot:false,standalone_status:false,attached_dot_status:'follow_final_target',cover_chain:false,cover_increments_derived_generation:false,counter_after_cover:true,derived_generation_control:'runtime_context_only',removable_tag:'COVER_REMOVABLE=<true|false>',priority_tag:'COVER_PRIORITY=<integer>',priority_order_details:'deferred_P01-12_P01-13',lifetime_tag:'COVER_LIFETIME=<uses|duration|persistent>',lifetime_modes:{uses:'requires COVER_USES positive integer',duration:'requires DURATION positive integer',persistent:'no COVER_USES/DURATION'},lifetime_modes_exclusive:true},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cover-device-validation-GA-B486.38-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COVER JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${errors.length}${errors.length?'\n'+errors.join('\n'):''}`;return report;
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
 for(const x of valid){const result=compileTaggedSkill({id:x.id,name:x.label,tags:x.tags});const errors=[];if(!result.ok)errors.push(...result.errors);if(!result.definition.logicOrder.includes('COUNTER')||!result.definition.logicOrder.includes('ATTACK'))errors.push('COUNTER→ATTACK定義になっていません');if(result.definition.parameters.counterLimit!==1)errors.push('COUNTER_LIMIT=1が保持されていません');cases.push({...x,expected:{compiled_ok:true},result,passed:errors.length===0,errors});}
 for(const x of invalid){const result=compileTaggedSkill({id:x.id,name:x.label,tags:x.tags});const errors=[];if(result.ok)errors.push('拒否されるべき定義がVALIDになりました');cases.push({...x,expected:{compiled_ok:false},result,passed:errors.length===0,errors});}
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));const entrypoint=location.pathname.includes('game-tag-test')?'game-tag-test/index.html':'game/index.html';
 const report={schema_version:'1.1.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-COUNTER-DEVICE-001',mode:'device_validation',entrypoint,trigger:'tagTestRunCounterJson'},current_spec:{task_id:'P01-07',stage:'data_driven_tag_validation',runtime_application:false,trigger_tag:'COUNTER_TRIGGER=hit',target_tag:'COUNTER_TARGET=attacker',limit_tag:'COUNTER_LIMIT=1',priority_tag:'COUNTER_PRIORITY=<integer>',require_alive_tag:'COUNTER_REQUIRE_ALIVE=true',allow_zero_damage_tag:'COUNTER_ALLOW_ZERO_DAMAGE=true',incoming_area_attack:false,attack_definition:'existing ATTACK',critical:'existing ATTACK',passive_effects:'existing ATTACK pipeline',counter_chain:false,derived_origin_trigger:false,multiple_execution:false,duplicate_policy:'skill configuration side',dedicated_counter_damage_formula:false},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-counter-device-validation-GA-B486.38-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COUNTER JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report;
}





function runCoverRuntimeRegression(){
 const cases=[],errors=[];const add=(id,label,fn)=>{try{const out=fn()||{},row={id,label,...out};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(e){const m=String(e?.message||e);cases.push({id,label,passed:false,errors:[m]});errors.push(`${id}: ${m}`)}};
 const req=id=>{const s=findTagSkill(id);if(!s)throw new Error(`${id}がありません`);if(s.source!=='studio_export'||(s.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return s};
 const skills={cover:req('SKL-COVER-SINGLE-ALLY'),all:req('SKL-COVER-TEST-ALL-ALLIES'),uses:req('SKL-COVER-TEST-USES-1'),duration:req('SKL-COVER-TEST-DURATION-300'),dotOnly:req('SKL-COVER-TEST-DOT-ONLY'),attack:req('SKL-TEST-ATTACK'),poison:req('SKL-TEST-POISON'),statusAttack:req('SKL-TEST-ATTACK-STATUS-ACCURACY-DOWN'),statusOnly:req('SKL-TEST-STATUS-ACCURACY-DOWN'),area:req('SKL-COUNTER-TEST-INCOMING-ALL-60'),counter:req('SKL-COUNTER-ATTACK-100'),follow:req('SKL-TEST-FOLLOW-POISON')};
 const prep=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];battle.tick=0;coverEffectSequence=0;const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.hp=u.maxHp;u.alive=true;u.coverEffects=[];u.counterSkillId=null;u.followUpSkillIds=[];u.statusEffects=[];u.dotStacks=[];u.shieldEffects=[]}return{allies,enemies}};
 const ev=t=>battle.validationEvents.filter(x=>x.type===t);
 add('COVER-RUNTIME-BASE','base直接ATTACKの対象差し替え',()=>{const f=prep(),protectedUnit=f.allies[0],coverer=f.allies[1],enemy=f.enemies[0],er=[],ph=protectedUnit.hp,ch=coverer.hp;executeTaggedSkill(coverer,protectedUnit,skills.cover);const r=executeTaggedSkill(enemy,protectedUnit,skills.attack,{origin:'base'});if(protectedUnit.hp!==ph)er.push('保護対象HPが減少');if(coverer.hp>=ch)er.push('かばう側HPが減少していない');if(ev('cover_triggered').length!==1)er.push(`cover_triggered=${ev('cover_triggered').length}`);return{protected_hp_before:ph,protected_hp_after:protectedUnit.hp,coverer_hp_before:ch,coverer_hp_after:coverer.hp,result:r,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-ATTACHED-STATUS','ATTACK付随STATUSはかばう側へ',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeTaggedSkill(c,p,skills.cover);executeTaggedSkill(e,p,skills.statusAttack,{origin:'base'});if(ensureStatusEffects(p).length)er.push('元対象へSTATUSが付与');if(!ensureStatusEffects(c).some(x=>x.statusId==='STATUS-ACCURACY-DOWN'))er.push('かばう側へSTATUSなし');return{protected_statuses:statusSnapshot(p),coverer_statuses:statusSnapshot(c),events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-ATTACHED-DOT','ATTACK付随DOTはかばう側へ',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeTaggedSkill(c,p,skills.cover);executeTaggedSkill(e,p,skills.poison,{origin:'base'});if(ensureDotStackList(p).length)er.push('元対象へDOTが付与');if(!ensureDotStackList(c).length)er.push('かばう側へDOTなし');return{protected_dot_count:ensureDotStackList(p).length,coverer_dot_count:ensureDotStackList(c).length,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-DOT-ONLY-BLOCK','DOT単独はかばわない',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeTaggedSkill(c,p,skills.cover);executeTaggedSkill(e,p,skills.dotOnly);if(!ensureDotStackList(p).length)er.push('元対象へDOTなし');if(ensureDotStackList(c).length)er.push('DOT単独をかばった');if(ev('cover_triggered').length)er.push('DOT単独でCOVER発火');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-STATUS-ONLY-BLOCK','STATUS単独はかばわない',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeTaggedSkill(c,p,skills.cover);executeTaggedSkill(e,p,skills.statusOnly);if(!ensureStatusEffects(p).length)er.push('元対象へSTATUSなし');if(ensureStatusEffects(c).length)er.push('STATUS単独をかばった');if(ev('cover_triggered').length)er.push('STATUS単独でCOVER発火');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-AREA-ONE','範囲ATTACKは1要求につき1人だけかばう',()=>{const f=prep(),coverer=f.allies[2],enemy=f.enemies[0],er=[];executeTaggedSkill(coverer,coverer,skills.all);battle.validationEvents=[];executeTaggedSkill(enemy,f.allies[0],skills.area,{origin:'base'});const covers=ev('cover_triggered');if(covers.length!==1)er.push(`cover_triggered=${covers.length}`);return{cover_count:covers.length,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-USES','uses=1は1回で終了',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[],ph=p.hp;executeTaggedSkill(c,p,skills.uses);executeTaggedSkill(e,p,skills.attack,{origin:'base'});const after1=p.hp;executeTaggedSkill(e,p,skills.attack,{origin:'base'});if(after1!==ph)er.push('1回目で元対象が被弾');if(p.hp>=after1)er.push('2回目もかばわれた');if(ensureCoverEffects(p).length)er.push('uses消費後も関係が残る');return{hp_before:ph,hp_after_first:after1,hp_after_second:p.hp,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-DURATION','duration=300はTick300で終了',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[];executeTaggedSkill(c,p,skills.duration);processTicks(300);if(ensureCoverEffects(p).length)er.push('Tick300で終了していない');const ph=p.hp;executeTaggedSkill(e,p,skills.attack,{origin:'base'});if(p.hp>=ph)er.push('満了後もかばわれた');return{tick:battle.tick,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-SOURCE-DEATH','かばう側死亡で関係終了',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],er=[];executeTaggedSkill(c,p,skills.cover);resetCombatantOnDeath(c,{reason:'cover_test'});if(ensureCoverEffects(p).length)er.push('死亡後もCOVER関係あり');if(!ev('cover_removed').some(x=>x.reason==='SOURCE_DEAD'))er.push('SOURCE_DEADログなし');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-COVERER-DEATH-NO-RESIDUAL','かばう側が死亡しても残余ダメージを元対象へ戻さない',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[],ph=p.hp;c.hp=1;executeTaggedSkill(c,p,skills.cover);executeTaggedSkill(e,p,skills.attack,{origin:'base'});if(p.hp!==ph)er.push('元対象へ残余ダメージ');if(c.alive)er.push('かばう側が死亡していない');return{protected_hp_before:ph,protected_hp_after:p.hp,coverer_hp:c.hp,events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-COUNTER-COVER-COUNTER','反撃をかばい、かばった側が1回だけ反撃',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],enemy=f.enemies[0],er=[];enemy.counterSkillId=skills.counter.id;c.counterSkillId=skills.counter.id;executeTaggedSkill(c,p,skills.cover);battle.validationEvents=[];executeTaggedSkill(p,enemy,skills.attack,{origin:'base'});const covers=ev('cover_triggered').filter(x=>x.origin==='counter'),counters=ev('counter_triggered');if(covers.length!==1)er.push(`counter cover=${covers.length}`);if(counters.length!==2)er.push(`counter_triggered=${counters.length}`);if(!ev('counter_chain_blocked').some(x=>Number(x.derived_generation)===2))er.push('第2派生で打ち切られていない');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-FOLLOW-UP','follow_up直接攻撃もかばえる',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],e=f.enemies[0],er=[],ph=p.hp,ch=c.hp;executeTaggedSkill(c,p,skills.cover);battle.validationEvents=[];executeTaggedSkill(e,p,skills.follow,{origin:'follow_up',derivedGeneration:1});if(p.hp!==ph)er.push('元対象が追撃被弾');if(c.hp>=ch)er.push('かばう側が追撃被弾していない');if(!ev('cover_triggered').some(x=>x.origin==='follow_up'))er.push('follow_up COVERログなし');return{events:[...battle.validationEvents],errors:er}});
 add('COVER-RUNTIME-REMOVABLE','REMOVABLE=trueのみ手動解除対象',()=>{const f=prep(),p=f.allies[0],c=f.allies[1],er=[];executeTaggedSkill(c,p,skills.cover);const removed=removeCoverEffects(p,{reason:'manual_dispel',removableOnly:true});if(removed!==1||ensureCoverEffects(p).length)er.push(`removable解除=${removed}`);executeTaggedSkill(c,c,skills.all);const protectedOther=f.allies[0];const before=ensureCoverEffects(protectedOther).filter(x=>x.sourceId===c.id&&!x.removable).length,blocked=removeCoverEffects(protectedOther,{sourceId:c.id,reason:'manual_dispel',removableOnly:true});if(before<1||blocked!==0)er.push('REMOVABLE=falseが解除された');return{removed_true:removed,removed_false:blocked,events:[...battle.validationEvents],errors:er}});
 return{schema_version:'1.0.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-COVER-RUNTIME-001',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version,cover_skill_id:skills.cover.id,uses_skill_id:skills.uses.id,duration_skill_id:skills.duration.id,dot_only_skill_id:skills.dotOnly.id},current_spec:{task_id:'P01-08',stage:'runtime_v1',direct_attack_origins:['base','counter','follow_up'],standalone_dot:false,standalone_status:false,attached_dot_status:'follow_final_target',area_attack_cover_limit_per_request:1,cover_chain:false,cover_increments_derived_generation:false,counter_after_cover:true,derived_generation_limit:2,lifetime_modes:['uses','duration','persistent'],removable_data_driven:true,priority_tie_order:'deferred_P01-12_P01-13'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunCoverRuntimeJson(){const report=runCoverRuntimeRegression();report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunCoverRuntimeJson'};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-cover-runtime-device-validation-GA-B486.38-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COVER RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${report.summary.errors.length}${report.summary.errors.length?'\n'+report.summary.errors.join('\n'):''}`;return report}

function runCounterRuntimeRegression(){
 if(studioSkillBridge.status!=='loaded')return{schema_version:'1.0.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-COUNTER-RUNTIME-002',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null},current_spec:{task_id:'P01-07',stage:'runtime_v1_1'},cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:[`Studioデータ未読込: ${studioSkillBridge.status}`]}};
 const requireSkill=id=>{const x=findTagSkill(id);if(!x)throw new Error(`Studio正式スキル不足: ${id}`);if(x.source!=='studio_export'||(x.environment||'production')!=='production')throw new Error(`Studio production由来ではありません: ${id}`);return x};
 const counter=requireSkill('SKL-COUNTER-ATTACK-100'),counterStatus=requireSkill('SKL-COUNTER-TEST-ATTACK-STATUS-100'),single=requireSkill('SKL-TEST-ATTACK'),area=requireSkill('SKL-COUNTER-TEST-INCOMING-ALL-60');
 const cases=[];const add=(id,label,run)=>{try{const detail=run(),errors=detail.errors||[];cases.push({id,label,...detail,passed:errors.length===0,errors})}catch(e){cases.push({id,label,passed:false,errors:[String(e?.message||e)]})}};
 const prep=()=>{resetBattle();battle.validationMode=true;battle.validationEvents=[];const allies=ensureValidationTargets('味方',2),enemies=ensureValidationTargets('敵',2);for(const u of battle.units){u.counterSkillId=null;u.counterDisabled=false;u.hp=u.maxHp;u.alive=true;u.shieldEffects=[];u.statusEffects=[]}return{defender:allies[0],ally:allies[1],attacker:enemies[0],enemy2:enemies[1]}};
 add('COUNTER-RUNTIME-BASIC','単体直接ATTACK命中で反撃',()=>{const f=prep();f.defender.counterSkillId=counter.id;const ah=f.attacker.hp;executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length!==1)er.push(`trigger=${ev.length}`);if(f.attacker.hp>=ah)er.push('攻撃者へ反撃ダメージなし');return{attacker_hp_before:ah,attacker_hp_after:f.attacker.hp,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-SHIELD-ZERO','シールド全吸収でも反撃',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.defender.shieldEffects=[{id:'TEST-SHIELD',sequence:1,sourceId:f.defender.id,skillId:'TEST',skillName:'TEST',amount:9999,remaining:9999,appliedAt:0,expiresAt:9999}];const hp=f.defender.hp;executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(f.defender.hp!==hp)er.push('HPが減少');if(ev.length!==1)er.push(`trigger=${ev.length}`);return{defender_hp_before:hp,defender_hp_after:f.defender.hp,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-DEFENDER-DEAD','被弾死亡時は反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.defender.hp=1;executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('死亡後に反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-AREA-BLOCK','範囲攻撃には反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;executeTaggedSkill(f.attacker,f.defender,area,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('範囲攻撃へ反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-DERIVED-BLOCK','派生originには反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;executeTaggedSkill(f.attacker,f.defender,single,{origin:'follow_up',suppressDerived:true});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('派生攻撃へ反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-BATTLE-END','元攻撃で戦闘終了確定ならBATTLE_ENDゲートで反撃しない',()=>{const f=prep();f.defender.side='敵';f.attacker.side='味方';f.defender.counterSkillId=counter.id;f.defender.hp=1;for(const u of battle.units){if(u.side==='敵'&&u.id!==f.defender.id){u.hp=0;u.alive=false}}executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),skip=battle.validationEvents.filter(x=>x.type==='counter_skipped'&&x.reason==='BATTLE_END'),er=[];if(ev.length)er.push('戦闘終了確定後に反撃');if(!battle.pendingResult&&!battle.result)er.push('戦闘終了が確定していません');if(skip.length!==1)er.push(`BATTLE_END gate=${skip.length}`);return{pending_result:battle.pendingResult,result:battle.result,battle_end_gate_count:skip.length,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-ATTACHED-STATUS','反撃ATTACKの付随STATUSも既存パイプラインで適用',()=>{const f=prep();f.defender.counterSkillId=counterStatus.id;const before=ensureStatusEffects(f.attacker).length;executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const triggered=battle.validationEvents.filter(x=>x.type==='counter_triggered'&&x.counter_skill_id===counterStatus.id),applied=battle.validationEvents.filter(x=>x.type==='status_applied'&&x.skill_id===counterStatus.id&&x.target_id===f.attacker.id),after=ensureStatusEffects(f.attacker),matched=after.filter(x=>x.statusId==='STATUS-ACCURACY-DOWN'&&x.skillId===counterStatus.id),er=[];if(triggered.length!==1)er.push(`counter_triggered=${triggered.length}`);if(applied.length!==1)er.push(`status_applied=${applied.length}`);if(matched.length!==1)er.push(`status_effect=${matched.length}`);return{status_count_before:before,status_count_after:after.length,status_id:'STATUS-ACCURACY-DOWN',counter_skill_id:counterStatus.id,status_events:applied,events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-ACTION-DISABLED','行動不能なら反撃しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.defender.counterDisabled=true;executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const ev=battle.validationEvents.filter(x=>x.type==='counter_triggered'),er=[];if(ev.length)er.push('行動不能で反撃');return{events:[...battle.validationEvents],errors:er}});
 add('COUNTER-RUNTIME-NO-CHAIN','反撃から反撃・追撃を連鎖しない',()=>{const f=prep();f.defender.counterSkillId=counter.id;f.attacker.counterSkillId=counter.id;const follower=f.ally;follower.followUpSkillIds=['SKL-TEST-FOLLOW-POISON'];executeTaggedSkill(f.attacker,f.defender,single,{origin:'base'});const triggered=battle.validationEvents.filter(x=>x.type==='counter_triggered'),chain=battle.validationEvents.filter(x=>x.type==='counter_chain_blocked'),er=[];if(triggered.length!==1)er.push(`counter_triggered=${triggered.length}`);if(!chain.length)er.push('counter chain block記録なし');return{events:[...battle.validationEvents],errors:er}});
 const errors=cases.flatMap(x=>x.errors.map(e=>`${x.id}: ${e}`));return{schema_version:'1.0.0',build:'GA-B486.38',generated_at:new Date().toISOString(),test:{id:'TAG-COUNTER-RUNTIME-002',mode:'runtime_regression',entrypoint:'game/index.html'},source:{data_version:studioSkillBridge.data_version||null,counter_skill_id:counter.id,status_counter_skill_id:counterStatus.id,area_fixture_skill_id:area.id},current_spec:{task_id:'P01-07',stage:'runtime_v1_1',trigger:'hit',incoming_direct_single_only:true,shield_zero_damage_counter:true,defender_alive_required:true,battle_end_blocks_counter:true,battle_end_gate_verified:true,counter_target:'attacker',attack_definition:'existing ATTACK pipeline',attached_attack_effects:'existing ATTACK pipeline',counter_and_follow_up_chain:false,action_disabled_blocks_counter:true,critical:'deferred_to_attack_runtime',passive_trigger_pipeline:'deferred_to_attack_runtime'},cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function tagTestRunCounterRuntimeJson(){
 pauseBattle();if(studioSkillBridge.status!=='loaded'){const out=document.getElementById('tagTestResult');if(out)out.textContent='[COUNTER RUNTIME] Studioデータを読み込んでから再実行してください';return null}
 const report=runCounterRuntimeRegression(),errors=report.summary.errors||[];
 report.test={...report.test,mode:'device_runtime_validation',trigger:'tagTestRunCounterRuntimeJson'};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-counter-runtime-device-validation-GA-B486.38-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);const out=document.getElementById('tagTestResult');if(out)out.textContent=`[COUNTER RUNTIME JSON] ${report.summary.passed?'PASS':'FAIL'}\n[CASES] ${report.summary.passed_count}/${report.summary.case_count}\n[ERRORS] ${errors.length}${errors.length?'\n'+errors.join('\n'):''}`;return report;
}
