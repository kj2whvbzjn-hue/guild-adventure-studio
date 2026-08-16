/* Developer mode, UI event binding and application bootstrap extracted without logic changes — GA-B477 */
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
$('baseDepart').onclick=$('baseDepartSide').onclick=async()=>{if(!data.partyIds.length){notify('遠征パーティを1人以上選んでください。','bad');return}await beginSelectedAdventure()};
$('eventBackBase').onclick=$('eventRetreat').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('battleAbort').onclick=()=>{setPhase('base');setBaseView('home',{instant:true})};
$('resultToEvent').onclick=launchStandaloneBattle;
$('resultToBase').onclick=()=>{setPhase('base',{keepBattle:true});setBaseView('home',{instant:true})};
document.querySelectorAll('#phaseDevNav [data-phase]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.phase==='battle'){launchStandaloneBattle();return}setPhase(btn.dataset.phase,{keepBattle:true})});

try{const raw=localStorage.getItem(SAVE_KEY);if(raw){data=normalize(JSON.parse(raw));selectedId=data.characters[0]?.id||null}}catch(e){notify(`自動読込失敗: ${e.message}`,'bad')}render();resetBattle();setPhase('title',{keepBattle:true});if(typeof setupR06GameE2EUI==='function')setupR06GameE2EUI();
