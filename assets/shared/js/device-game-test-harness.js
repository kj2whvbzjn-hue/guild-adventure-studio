/* Guild Adventure real-device acceptance harness — Production Game / Formal Runtime only. */
(function(){
'use strict';
const BUILD=(window.GA_PROJECT_CONFIG&&window.GA_PROJECT_CONFIG.gameBuild)||'UNKNOWN';
const STUDIO_BUILD=(window.GA_PROJECT_CONFIG&&window.GA_PROJECT_CONFIG.studioBuild)||'UNKNOWN';
const context='game';
const $=id=>document.getElementById(id);
const nowIso=()=>new Date().toISOString();
const storageKey=`ga-device-acceptance:${BUILD}:${context}`;
const state={startedAt:nowIso(),lastRun:null,checks:[],manual:{},notes:''};
try{Object.assign(state.manual,JSON.parse(localStorage.getItem(storageKey)||'{}').manual||{});}catch(_e){}
const manualCases=[
 ['launch','画面起動','Gameが白画面にならず、タイトル/拠点へ移動できる'],
 ['battle','通常戦闘','依頼→イベント→戦闘開始→決着まで操作できる'],
 ['controls','戦闘操作','一時停止・1行動・再戦がタップで動作する'],
 ['reactive','反応スキル','COUNTER / FOLLOW_UPが表示上も異常連鎖せず動作する'],
 ['aura','AURA','AURAの生存/死亡/復活による有効・無効を確認する'],
 ['result','結果保存','戦闘結果から拠点へ戻り、資金/戦績が維持される'],
 ['reload','再読込','再読込/PWA再起動後も同じBuildが表示される']
];
function classify(ok,optional){return ok?'pass':optional?'warn':'fail'}
function addCheck(id,label,ok,detail,optional=false){state.checks.push({id,label,status:classify(ok,optional),detail:String(detail??''),at:nowIso()});}
async function probeFetch(id,label,url,optional=false){try{const r=await fetch(`${url}${url.includes('?')?'&':'?'}device_test=${Date.now()}`,{cache:'no-store'});addCheck(id,label,r.ok,`HTTP ${r.status} / ${r.headers.get('content-type')||'content-type不明'}`,optional);}catch(e){addCheck(id,label,false,e.message||e,optional)}}
async function runChecks(){
 state.checks=[]; state.startedAt=nowIso();
 addCheck('dom','DOM起動',document.readyState==='interactive'||document.readyState==='complete',document.readyState);
 addCheck('build','Build識別',/^GA-B/.test(BUILD)&&/^GKS-B/.test(STUDIO_BUILD),`${BUILD} / ${STUDIO_BUILD}`);
 addCheck('secure','Secure Context',window.isSecureContext===true,window.isSecureContext?'有効':'無効（HTTP接続では一部PWA APIが制限されます）',true);
 addCheck('online','ネットワーク',navigator.onLine!==false,navigator.onLine?'online':'offline',true);
 addCheck('touch','タッチ入力',('ontouchstart' in window)||(navigator.maxTouchPoints||0)>0,`maxTouchPoints=${navigator.maxTouchPoints||0}`,true);
 addCheck('viewport','Viewport',innerWidth>0&&innerHeight>0,`${innerWidth}×${innerHeight} / DPR ${devicePixelRatio||1}`);
 try{localStorage.setItem('__ga_device_probe__','1');localStorage.removeItem('__ga_device_probe__');addCheck('localStorage','localStorage',true,'read/write OK');}catch(e){addCheck('localStorage','localStorage',false,e.message||e)}
 if('indexedDB' in window){await new Promise(resolve=>{let done=false;try{const req=indexedDB.open('__ga_device_probe__',1);req.onerror=()=>{if(!done){done=true;addCheck('indexedDB','IndexedDB',false,req.error?.message||'open failed',true);resolve()}};req.onsuccess=()=>{try{req.result.close();indexedDB.deleteDatabase('__ga_device_probe__')}catch(_e){}if(!done){done=true;addCheck('indexedDB','IndexedDB',true,'open/delete OK',true);resolve()}};}catch(e){addCheck('indexedDB','IndexedDB',false,e.message||e,true);resolve()}})}else addCheck('indexedDB','IndexedDB',false,'APIなし',true);
 const swAvailable='serviceWorker' in navigator; addCheck('sw-api','Service Worker API',swAvailable,swAvailable?'利用可能':'APIなし',true);
 if(swAvailable){try{const reg=await navigator.serviceWorker.getRegistration();addCheck('sw-registration','Service Worker登録',!!reg,reg?`scope=${reg.scope} / controller=${navigator.serviceWorker.controller?'YES':'NO'}`:'未登録',true);}catch(e){addCheck('sw-registration','Service Worker登録',false,e.message||e,true)}}
 const requiredGlobals=['compileSkillRuntime','executeSkillRuntime','GKSTriggerEngine','GKSSkillRuntimeMode','GKSSkillRuntimeDiagnostics'];
 const missing=requiredGlobals.filter(n=>n==='GKSTriggerEngine'||n==='GKSSkillRuntimeMode'?!window[n]:typeof window[n]!=='function'); addCheck('runtime-globals','主要Runtime API',missing.length===0,missing.length?`不足: ${missing.join(', ')}`:'主要API検出');
 const formalMode=window.GKSSkillRuntimeMode?.production==='runtimeContracts_only';
 addCheck('formal-runtime-mode','本番Skill Runtime',formalMode,formalMode?'runtimeContracts only':'正式Runtime modeを確認できません');
 const runtimeDiag=typeof window.GKSSkillRuntimeDiagnostics==='function'?window.GKSSkillRuntimeDiagnostics():null,missingContracts=runtimeDiag?.invalidProductionSkillIds||[];
 const formalReady=!!runtimeDiag&&runtimeDiag.productionSkills>0&&runtimeDiag.productionSkills===runtimeDiag.formalProductionSkills&&runtimeDiag.studioProductionSkills>0&&missingContracts.length===0;
 addCheck('production-skill-contracts','本番Skill契約',formalReady,!runtimeDiag?'Runtime診断APIなし':missingContracts.length?`runtimeContracts不足: ${missingContracts.join(', ')}`:runtimeDiag.productionSkills===0?'Production Skillが0件です':runtimeDiag.studioProductionSkills===0?'Studio正式Production Skillが未読込です':`${runtimeDiag.productionSkills}件すべて正式契約 / Studio正式 ${runtimeDiag.studioProductionSkills}件`);
 const requiredDom=['sceneAuto','sceneStep','sceneReset','tagSkillTestPanel','tagTestResult'];
 const missingDom=requiredDom.filter(id=>!$(id)); addCheck('runtime-dom','主要操作DOM',missingDom.length===0,missingDom.length?`不足: ${missingDom.join(', ')}`:'主要DOM検出');
 await probeFetch('self-fetch','現在ページ再取得','./');
 await probeFetch('manifest-fetch','PWA manifest取得','./manifest.webmanifest',true);
 await probeFetch('build-fetch','Build正本取得','../package-build.json');
 await probeFetch('skill-fetch','Studio正式skillデータ取得','../Export/skill/skills.json',true);
 if(navigator.storage?.estimate){try{const est=await navigator.storage.estimate();addCheck('storage-estimate','保存容量',true,`usage=${est.usage||0} / quota=${est.quota||0}`,true)}catch(e){addCheck('storage-estimate','保存容量',false,e.message||e,true)}}
 state.lastRun=nowIso(); render(); return getReport();
}
function getSummary(){const counts={pass:0,warn:0,fail:0};state.checks.forEach(c=>counts[c.status]++);return {...counts,passed:counts.fail===0,total:state.checks.length}}
function deviceInfo(){return {userAgent:navigator.userAgent,platform:navigator.platform||'',language:navigator.language||'',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},touchPoints:navigator.maxTouchPoints||0,standalone:!!(navigator.standalone||matchMedia('(display-mode: standalone)').matches),online:navigator.onLine!==false,secureContext:!!window.isSecureContext,url:location.href};}
function getReport(){return {schema_version:1,kind:'real_device_acceptance',context,game_build:BUILD,studio_build:STUDIO_BUILD,generated_at:nowIso(),device:deviceInfo(),automated:{summary:getSummary(),checks:state.checks},manual:{cases:manualCases.map(([id,label,expectation])=>({id,label,expectation,status:state.manual[id]||'unverified'})),notes:state.notes||''}}}
function saveManual(){try{localStorage.setItem(storageKey,JSON.stringify({manual:state.manual,updatedAt:nowIso()}))}catch(_e){}}
function setManual(id,status){state.manual[id]=status;saveManual();render()}
async function copyReport(){const text=JSON.stringify(getReport(),null,2);try{await navigator.clipboard.writeText(text);setMessage('結果JSONをクリップボードへコピーしました。','pass')}catch(_e){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();setMessage(ok?'結果JSONをコピーしました。':'コピーできませんでした。下のJSON保存を使用してください。',ok?'pass':'warn')}}
function downloadReport(){const report=getReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`device-acceptance-${context}-${BUILD}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);setMessage('結果JSONの保存を開始しました。','pass')}
function setMessage(text,status=''){const el=$('gaDeviceTestMessage');if(el){el.textContent=text;el.dataset.status=status}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){const host=$('gaDeviceTestBody');if(!host)return;const summary=getSummary();const checks=state.checks.length?state.checks.map(c=>`<div class="ga-dt-row ${c.status}"><b>${esc(c.label)}</b><span>${c.status.toUpperCase()}</span><small>${esc(c.detail)}</small></div>`).join(''):'<p class="ga-dt-muted">「自動診断を実行」を押してください。</p>';
 const manual=manualCases.map(([id,label,expectation])=>{const s=state.manual[id]||'unverified';return `<div class="ga-dt-manual"><div><b>${esc(label)}</b><small>${esc(expectation)}</small></div><div class="ga-dt-choice" data-case="${esc(id)}"><button data-status="pass" class="${s==='pass'?'selected pass':''}">PASS</button><button data-status="fail" class="${s==='fail'?'selected fail':''}">FAIL</button><button data-status="unverified" class="${s==='unverified'?'selected':''}">未確認</button></div></div>`}).join('');
 host.innerHTML=`<div class="ga-dt-summary ${summary.fail?'fail':state.checks.length?'pass':''}"><strong>${state.checks.length?(summary.passed?'自動診断 PASS':'自動診断 FAIL'):'実機テスト未実行'}</strong><span>PASS ${summary.pass} / WARN ${summary.warn} / FAIL ${summary.fail}</span></div><div class="ga-dt-grid">${checks}</div><h4>手動受入チェック</h4>${manual}<label class="ga-dt-note">端末メモ<textarea id="gaDeviceTestNotes" rows="3" placeholder="機種・OS・再現手順など">${esc(state.notes||'')}</textarea></label>`;
 host.querySelectorAll('.ga-dt-choice button').forEach(btn=>btn.onclick=()=>setManual(btn.parentElement.dataset.case,btn.dataset.status));const notes=$('gaDeviceTestNotes');if(notes)notes.oninput=()=>{state.notes=notes.value};
}
function inject(){const panel=$('developerPanel')||document.body;if($('gaDeviceTestPanel'))return;const style=document.createElement('style');style.textContent=`#gaDeviceTestPanel{margin:12px 0;border:2px solid #4b6f91}#gaDeviceTestPanel h3{margin-top:0}.ga-dt-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.ga-dt-summary{display:flex;justify-content:space-between;gap:8px;padding:10px;border-radius:10px;background:#20344e}.ga-dt-summary.pass{outline:2px solid #5b9}.ga-dt-summary.fail{outline:2px solid #d66}.ga-dt-grid{display:grid;gap:6px;margin:10px 0}.ga-dt-row{display:grid;grid-template-columns:minmax(130px,1fr) auto;gap:4px 8px;padding:8px;border-radius:8px;background:rgba(0,0,0,.16)}.ga-dt-row small{grid-column:1/-1;word-break:break-word}.ga-dt-row.pass span{color:#8fd6aa}.ga-dt-row.warn span{color:#f5c451}.ga-dt-row.fail span{color:#ff9292}.ga-dt-manual{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.12)}.ga-dt-manual small{display:block}.ga-dt-choice{display:flex;gap:5px}.ga-dt-choice button{padding:7px 9px;font-size:12px}.ga-dt-choice .selected{outline:2px solid #fff}.ga-dt-choice .pass{background:#2f7253}.ga-dt-choice .fail{background:#8a3e46}.ga-dt-note{display:block;margin-top:12px}.ga-dt-note textarea{width:100%;margin-top:6px}.ga-dt-muted{opacity:.75}#gaDeviceTestMessage[data-status=pass]{color:#8fd6aa}#gaDeviceTestMessage[data-status=warn]{color:#f5c451}@media(max-width:680px){.ga-dt-manual{grid-template-columns:1fr}.ga-dt-choice{justify-content:flex-start}.ga-dt-summary{flex-direction:column}}`;document.head.appendChild(style);
 const section=document.createElement('section');section.id='gaDeviceTestPanel';section.className='card';section.innerHTML=`<h3>実機受入テスト <small>Game Formal Runtime</small></h3><p class="small">端末上で自動診断＋手動チェックを行い、結果をJSONとして持ち出します。自動診断PASSだけでは戦闘操作の合格にはなりません。</p><div class="ga-dt-actions"><button class="primary" id="gaDeviceTestRun">自動診断を実行</button><button id="gaDeviceTestCopy">結果JSONをコピー</button><button id="gaDeviceTestDownload">結果JSONを保存</button></div><div id="gaDeviceTestMessage" class="small"></div><div id="gaDeviceTestBody"></div>`;
 const summary=panel.querySelector('summary'); if(summary)summary.insertAdjacentElement('afterend',section); else panel.prepend(section);
 $('gaDeviceTestRun').onclick=()=>{setMessage('診断中…');runChecks()};$('gaDeviceTestCopy').onclick=copyReport;$('gaDeviceTestDownload').onclick=downloadReport;render();
 if(new URLSearchParams(location.search).get('deviceTest')==='1'){panel.classList.remove('hidden');if(panel.tagName==='DETAILS')panel.open=true;setTimeout(()=>section.scrollIntoView({block:'start'}),50)}
}
window.GADeviceTest=Object.freeze({run:runChecks,report:getReport,context,build:BUILD});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
