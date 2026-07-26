(function(){
'use strict';
const STORAGE_KEY='gkstudio.bootstrap.context.v1';
const MAX_FILE_BYTES=2*1024*1024;
let context=null;
const Core=window.GKBootstrapCore;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function loadStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch(_){return null}}
function saveStored(v){localStorage.setItem(STORAGE_KEY,JSON.stringify(v));}
function issueCard(title,items){return `<div class="card"><h2>${esc(title)}</h2>${items.length?`<div class="list">${items.map(x=>`<div class="bootstrap-issue"><b>${esc(x.code||x.id||'ITEM')}</b><span>${esc(x.message||x.description||x)}</span></div>`).join('')}</div>`:'<p class="small">なし</p>'}</div>`}
function render(){
 const host=document.getElementById('bootstrapContent');if(!host)return;
 if(!context){host.innerHTML='<div class="card"><h2>Bootstrap Context未読込</h2><p class="small">生成済みbootstrap-context.jsonを選択してください。</p></div>';return;}
 const s=Core.summary(context),bs=Core.blockers(context),ws=Core.warnings(context);
 host.innerHTML=`<div class="bootstrap-kpis">
 <div class="kpi"><span class="small">起動レベル</span><b>${esc(s.level)}</b></div><div class="kpi"><span class="small">Blocking</span><b>${s.blocking_count}</b></div><div class="kpi"><span class="small">Warnings</span><b>${s.warning_count}</b></div><div class="kpi"><span class="small">Validation</span><b>${s.valid?'PASS':'FAIL'}</b></div></div>
 <div class="card"><h2>基準情報</h2><dl class="bootstrap-grid"><dt>Project</dt><dd>${esc(context.project?.name||context.project?.id||'-')}</dd><dt>Version / Build</dt><dd>${esc(context.project?.version||'-')} / ${esc(context.project?.build||'-')}</dd><dt>Repository write</dt><dd>${esc(context.authority?.repository_write||context.authority?.deployment_authority||'-')}</dd><dt>Session</dt><dd>${esc(context.session?.session_id||'-')}</dd></dl></div>
 ${issueCard('Blocking Issues',bs)}${issueCard('Warnings',ws)}${issueCard('Validation Errors',s.errors)}`;
}
function importFile(file){
 if(file.size>MAX_FILE_BYTES){alert('ファイルサイズが上限（2 MiB）を超えています。');return;}
 const r=new FileReader();r.onload=()=>{try{const v=JSON.parse(r.result);const errors=Core.validate(v);if(errors.length&&!confirm('検証エラーがあります。読込みを続けますか？\n'+errors.map(x=>x.code+': '+x.message).join('\n')))return;context=v;saveStored(v);render();}catch(e){alert('Bootstrap Contextを読み込めません: '+e.message)}};r.onerror=()=>alert('ファイル読込みに失敗しました。');r.readAsText(file,'utf-8');
}
function exportContext(){if(!context)return alert('Contextがありません。');const blob=new Blob([JSON.stringify(context,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='bootstrap-context.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearContext(){if(confirm('保存済みBootstrap Contextを削除しますか？')){localStorage.removeItem(STORAGE_KEY);context=null;render();}}
function install(){
 if(!Core){console.error('GKBootstrapCore is required');return;}
 const nav=document.getElementById('nav'),workspace=document.querySelector('main.workspace');if(!nav||!workspace)return;
 if(!document.querySelector('[data-view="bootstrap"]')){const b=document.createElement('button');b.type='button';b.dataset.view='bootstrap';b.textContent='Bootstrap';nav.appendChild(b);}
 if(!document.getElementById('view-bootstrap')){const s=document.createElement('section');s.id='view-bootstrap';s.className='view hidden';s.innerHTML=`<h1>Bootstrap</h1><div class="card"><div class="toolbar"><label class="bootstrap-file button-like">Context読込<input id="bootstrapFile" type="file" accept="application/json,.json"></label><button type="button" id="bootstrapExport">Context出力</button><button type="button" id="bootstrapClear">保存削除</button></div></div><div id="bootstrapContent"></div>`;workspace.appendChild(s);s.querySelector('#bootstrapFile').addEventListener('change',e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value='';});s.querySelector('#bootstrapExport').addEventListener('click',exportContext);s.querySelector('#bootstrapClear').addEventListener('click',clearContext);}
 context=loadStored();render();
}
window.GKBootstrap={install,render,exportContext,clearContext,validate:Core.validate,readiness:Core.readiness};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
