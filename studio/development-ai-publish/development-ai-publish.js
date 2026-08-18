/* GKS-B657 Development AI Publish
 * Development-only read interface for GitHub Pages.
 * Does not reuse Game Project GitHub sync data/model/handlers.
 */
(function(){
'use strict';

const SETTINGS_KEY='gk_development_ai_publish_settings_v1';
const LAST_PUBLISH_KEY='gk_development_ai_publish_last_v1';
const DEFAULT_BASE_PATH='docs/ai-development';
let busy=false;
let lastDataset=null;

function el(id){return document.getElementById(id)}
function iso(){return new Date().toISOString()}
function cleanPath(v){return String(v||'').trim().replace(/^\/+|\/+$/g,'').replace(/\/{2,}/g,'/')||DEFAULT_BASE_PATH}
function safeId(v){return String(v||'project').trim().replace(/[^A-Za-z0-9._-]+/g,'_')||'project'}
function clone(v){return JSON.parse(JSON.stringify(v))}
function deepRedact(value){
 if(Array.isArray(value))return value.map(deepRedact);
 if(!value||typeof value!=='object')return value;
 const out={};
 for(const [k,v] of Object.entries(value)){
  if(/token|password|secret|credential|authorization|api[_-]?key|(^|_)pat($|_)/i.test(k))continue;
  out[k]=deepRedact(v);
 }
 return out;
}
function workflowStage(w){return String(w?.workflow?.stage||w?.workspace?.status||'')}
function openQuestions(w){
 const rows=[];
 for(const d of w?.discussions||[]){
  for(const text of String(d?.open_questions||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))rows.push({discussion_id:String(d.id||''),text});
 }
 return rows;
}
function summarizeProject(w){
 const checks=Array.isArray(w?.checks)?w.checks:[];
 const tasks=Array.isArray(w?.tasks)?w.tasks:[];
 const discussions=Array.isArray(w?.discussions)?w.discussions:[];
 const oq=openQuestions(w);
 const pendingChecks=checks.filter(x=>['Pending','Failed'].includes(String(x?.status||'Pending')));
 const openTasks=tasks.filter(x=>String(x?.status||'Todo')!=='Done');
 const openDiscussions=discussions.filter(x=>['Open','Pending'].includes(String(x?.status||'Open')));
 const status=String(w?.workspace?.status||'');
 const stage=workflowStage(w);
 const unresolved=status!=='Completed'||stage!=='Completed'||pendingChecks.length>0||openTasks.length>0||openDiscussions.length>0||oq.length>0;
 return {
  id:String(w?.workspace?.id||''),
  name:String(w?.workspace?.name||''),
  status,
  workflow_stage:stage,
  updated_at:String(w?.workspace?.updated_at||''),
  unresolved,
  counts:{
   discussions:discussions.length,
   architecture_nodes:(w?.architecture_nodes||[]).length,
   work_boxes:(w?.work_boxes||[]).length,
   tasks:tasks.length,
   open_tasks:openTasks.length,
   checks:checks.length,
   pending_or_failed_checks:pendingChecks.length,
   decisions:(w?.decisions||[]).length,
   specifications:(w?.specifications||[]).length,
   open_questions:oq.length
  },
  implementation_approval:String(w?.workflow?.implementation_approval?.status||''),
  completion_approval:String(w?.workflow?.completion_approval?.status||''),
  pending_checks:pendingChecks.map(x=>({id:String(x.id||''),title:String(x.title||''),gate:String(x.gate||'General'),status:String(x.status||'Pending'),target_type:String(x.target_type||''),target_id:String(x.target_id||'')})),
  open_tasks:openTasks.map(x=>({id:String(x.id||''),box_id:String(x.box_id||''),title:String(x.title||''),status:String(x.status||'Todo')})),
  open_discussions:openDiscussions.map(x=>({id:String(x.id||''),title:String(x.title||''),status:String(x.status||'Open')})),
  open_questions:oq
 };
}
function readSettings(){
 let s={};try{s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}}catch(_){s={}}
 const inferred=inferGitHubPages();
 return {
  owner:String(s.owner||inferred.owner||''),
  repo:String(s.repo||inferred.repo||''),
  branch:String(s.branch||'main'),
  base_path:cleanPath(s.base_path||DEFAULT_BASE_PATH),
  scope:String(s.scope||'all')==='current'?'current':'all'
 };
}
function inferGitHubPages(){
 try{
  const host=String(location.hostname||'');
  if(!host.endsWith('.github.io'))return {};
  const owner=host.slice(0,-'.github.io'.length);
  const seg=String(location.pathname||'').split('/').filter(Boolean);
  return {owner,repo:seg[0]||`${owner}.github.io`};
 }catch(_){return {}}
}
function saveSettings(){
 const s=configFromForm(false);localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:s.owner,repo:s.repo,branch:s.branch,base_path:s.base_path,scope:s.scope}));
 status('接続先を端末へ保存しました。PATは保存していません。','OK');render();
}
function publicRepoBase(c){
 if(!c.owner||!c.repo)return '';
 const root=c.repo.toLowerCase()===`${c.owner}.github.io`.toLowerCase()?`https://${c.owner}.github.io/`:`https://${c.owner}.github.io/${encodeURIComponent(c.repo)}/`;
 return root+cleanPath(c.base_path).split('/').map(encodeURIComponent).join('/')+'/';
}
function configFromForm(requireToken=true){
 const c={
  owner:String(el('daipOwner')?.value||'').trim(),repo:String(el('daipRepo')?.value||'').trim(),branch:String(el('daipBranch')?.value||'main').trim()||'main',
  base_path:cleanPath(el('daipBasePath')?.value||DEFAULT_BASE_PATH),scope:String(el('daipScope')?.value||'all')==='current'?'current':'all',token:String(el('daipToken')?.value||'').trim()
 };
 if(!c.owner||!c.repo||!c.base_path||(requireToken&&!c.token))throw new Error(requireToken?'Owner、Repository、公開Path、PATを入力してください。':'Owner、Repository、公開Pathを入力してください。');
 if(!/^docs(?:\/|$)/i.test(c.base_path))throw new Error('AI公開PathはSource PackageとGame Exportを分離するため docs/ 配下を指定してください。');
 return c;
}
function getProjectWorkspaces(scope){
 if(typeof ensureDevelopmentProjectRegistry==='function')ensureDevelopmentProjectRegistry();
 const rows=[];
 const registry=Array.isArray(developmentProjectRegistry)?developmentProjectRegistry:[];
 const targets=scope==='current'?registry.filter(x=>x.id===activeDevelopmentProjectId):registry;
 for(const entry of targets){
  try{
   let raw=null;
   if(entry.id===activeDevelopmentProjectId&&typeof loadDevelopmentWorkspace==='function')raw=loadDevelopmentWorkspace();
   else raw=JSON.parse(localStorage.getItem(developmentProjectStoreKey(entry.id))||'null');
   if(!raw)continue;
   const w=typeof normalizeDevelopmentWorkspace==='function'?normalizeDevelopmentWorkspace(raw):raw;
   if(w?.workspace){w.workspace.id=String(entry.id||w.workspace.id||'');w.workspace.name=String(w.workspace.name||entry.name||entry.id)}
   rows.push(w);
  }catch(_){/* Skip malformed local copy; preview reports actual count. */}
 }
 return rows;
}
function buildDataset(config){
 const generatedAt=iso(),base=publicRepoBase(config),workspaces=getProjectWorkspaces(config.scope);
 const details=[],summaries=[];
 for(const w of workspaces){
  const summary=summarizeProject(w),filename=safeId(summary.id)+'.json',detailPath=`projects/${filename}`;
  summary.detail_path=detailPath;summary.detail_url=base?base+detailPath:'';
  summaries.push(summary);
  details.push({path:detailPath,data:{format:'gk-development-ai-public-project',version:'1.0',generated_at:generatedAt,studio_build:String(globalThis.DISTRIBUTION_BUILD||globalThis.GA_PROJECT_CONFIG?.studioBuild||''),game_build:String(globalThis.GA_PROJECT_CONFIG?.gameBuild||''),summary:clone(summary),project:deepRedact(w)}});
 }
 summaries.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||String(a.id).localeCompare(String(b.id)));
 const pending=summaries.filter(x=>x.unresolved);
 const projectsDoc={format:'gk-development-ai-public-projects',version:'1.0',generated_at:generatedAt,studio_build:String(globalThis.DISTRIBUTION_BUILD||globalThis.GA_PROJECT_CONFIG?.studioBuild||''),game_build:String(globalThis.GA_PROJECT_CONFIG?.gameBuild||''),scope:config.scope,project_count:summaries.length,projects:summaries};
 const pendingDoc={format:'gk-development-ai-public-pending',version:'1.0',generated_at:generatedAt,studio_build:projectsDoc.studio_build,game_build:projectsDoc.game_build,scope:config.scope,pending_project_count:pending.length,projects:pending};
 const manifest={format:'gk-development-ai-public-manifest',version:'1.0',generated_at:generatedAt,studio_build:projectsDoc.studio_build,game_build:projectsDoc.game_build,scope:config.scope,project_count:summaries.length,pending_project_count:pending.length,entrypoints:{projects:'projects.json',pending:'pending.json'},public_urls:{base,projects:base?base+'projects.json':'',pending:base?base+'pending.json':''},privacy:'Public read-only data. Secrets are redacted by key name; review content before publishing.'};
 return {generated_at:generatedAt,base,manifest,projectsDoc,pendingDoc,details,summaries,pending};
}
function status(message,level='INFO'){
 const node=el('daipStatus');if(!node)return;node.dataset.level=level;node.textContent=message;
}
function setBusy(v){busy=!!v;for(const b of document.querySelectorAll('[data-daip-busy]'))b.disabled=busy}
function renderPreview(dataset){
 const p=el('daipPreview');if(!p)return;
 if(!dataset){p.innerHTML='<div class="small">まだプレビューしていません。</div>';return}
 const pending=dataset.pending;
 p.innerHTML=`<div class="item"><div class="daip-preview-head"><div><b>公開予定 ${dataset.summaries.length}案件</b><div class="small">未確定 ${pending.length}案件 / 詳細JSON ${dataset.details.length}件</div></div></div><div class="daip-counts"><span class="badge">projects.json</span><span class="badge warn">pending.json</span><span class="badge">projects/&lt;ID&gt;.json</span></div></div>`+
  (pending.length?pending.map(x=>`<div class="item"><b>${escapeHtml(x.name||x.id)}</b><div class="small">${escapeHtml(x.id)} / ${escapeHtml(x.workflow_stage||x.status)} / 未完了Task ${x.counts.open_tasks} / 確認待ち・FAIL ${x.counts.pending_or_failed_checks} / 未決 ${x.counts.open_questions}</div></div>`).join(''):'<div class="item">未確定案件はありません。</div>');
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 const pane=el('developmentPane-aipublish');if(!pane)return;
 const s=readSettings();
 for(const [id,val] of [['daipOwner',s.owner],['daipRepo',s.repo],['daipBranch',s.branch],['daipBasePath',s.base_path]]){const n=el(id);if(n&&document.activeElement!==n)n.value=val}
 if(el('daipScope')&&document.activeElement!==el('daipScope'))el('daipScope').value=s.scope;
 let base='';try{base=publicRepoBase(configFromForm(false))}catch(_){base=publicRepoBase(s)}
 const baseEl=el('daipPublicBase');if(baseEl)baseEl.textContent=base||'Owner / Repositoryを設定すると表示します。';
 const pendingEl=el('daipPendingUrl');if(pendingEl)pendingEl.textContent=base?base+'pending.json':'—';
 let last=null;try{last=JSON.parse(localStorage.getItem(LAST_PUBLISH_KEY)||'null')}catch(_){last=null}
 const lastEl=el('daipLastPublish');if(lastEl)lastEl.textContent=last?.published_at?`${last.published_at} / ${last.project_count||0}案件 / 未確定 ${last.pending_project_count||0}件`:'未公開';
 if(lastDataset)renderPreview(lastDataset);
}
function preview(){
 try{const c=configFromForm(false);localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:c.owner,repo:c.repo,branch:c.branch,base_path:c.base_path,scope:c.scope}));lastDataset=buildDataset(c);renderPreview(lastDataset);status(`公開内容を生成しました。\n案件 ${lastDataset.summaries.length} / 未確定 ${lastDataset.pending.length}\n${lastDataset.base||''}`,'OK');render()}catch(e){status('プレビュー失敗: '+e.message,'ERROR')}
}
function utf8ToBase64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
function base64ToUtf8(value){const binary=atob(String(value||'').replace(/\s+/g,'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder('utf-8').decode(bytes)}
function jsonText(obj){return JSON.stringify(obj,null,2)+'\n'}
async function sha256Text(text){const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function github(c,url,options={}){
 const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})};
 const res=await fetch(url,{...options,headers});const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch(_){body={message:text}}
 if(!res.ok){const err=new Error(`HTTP ${res.status}: ${body?.message||'GitHub API error'}`);err.status=res.status;throw err}return body;
}
function apiRepo(c){return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`}
function apiContent(c,path){return apiRepo(c)+'/contents/'+cleanPath(path).split('/').map(encodeURIComponent).join('/')}
async function getRemote(c,path){try{return await github(c,apiContent(c,path)+`?ref=${encodeURIComponent(c.branch)}`)}catch(e){if(e.status===404)return null;throw e}}
async function putText(c,path,text,message,knownRemote=null){
 const remote=knownRemote||await getRemote(c,path),payload={message,content:utf8ToBase64(text),branch:c.branch};if(remote?.sha)payload.sha=remote.sha;
 return github(c,apiContent(c,path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
async function putFile(c,path,obj,message){return putText(c,path,jsonText(obj),message)}
async function readRemotePackageManifest(c){
 const remote=await getRemote(c,'package_manifest.json');if(!remote?.content)throw new Error('GitHub Sourceのpackage_manifest.jsonを読めません。AI共有はSource Package整合性を維持できないため停止しました。');
 let manifest;try{manifest=JSON.parse(base64ToUtf8(remote.content))}catch(_){throw new Error('GitHub Sourceのpackage_manifest.jsonを解析できません。')}
 if(!Array.isArray(manifest.files))throw new Error('GitHub Sourceのpackage_manifest.json: files がありません。');
 return {remote,manifest};
}
async function syncSourcePackageManifest(c,published,message){
 const state=await readRemotePackageManifest(c),manifest=state.manifest,byPath=new Map((manifest.files||[]).map(row=>[String(row.path||''),row]));
 for(const row of published){const text=jsonText(row.data),bytes=new TextEncoder().encode(text);byPath.set(row.path,{path:row.path,size:bytes.length,sha256:await sha256Text(text)})}
 manifest.files=Array.from(byPath.values()).filter(row=>row.path).sort((a,b)=>String(a.path).localeCompare(String(b.path)));manifest.file_count=manifest.files.length;manifest.generated_at=iso();
 await putText(c,'package_manifest.json',jsonText(manifest),message+' / package_manifest sync',state.remote);
}
async function testConnection(){
 if(busy)return;try{setBusy(true);const c=configFromForm(true);status('Development AI公開用の接続を確認中…');await github(c,apiRepo(c));localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:c.owner,repo:c.repo,branch:c.branch,base_path:c.base_path,scope:c.scope}));status(`接続できました: ${c.owner}/${c.repo} (${c.branch})`,'OK');render()}catch(e){status('接続失敗: '+e.message,'ERROR')}finally{setBusy(false)}
}
async function publish(){
 if(busy)return;
 try{
  const c=configFromForm(true),dataset=buildDataset(c);
  if(!dataset.summaries.length)throw new Error('公開できるDevelopment Projectがありません。');
  const warning=`Development Projectの内容を公開GitHub Pagesから読めるJSONとして配置します。\n\n公開先: ${dataset.base}\n案件: ${dataset.summaries.length}\n未確定: ${dataset.pending.length}\n\nDiscussion / Work Box / Confirmation等の内容もProject詳細JSONへ含まれます。公開してよい内容か確認しましたか？`;
  if(!confirm(warning))return;
  setBusy(true);localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:c.owner,repo:c.repo,branch:c.branch,base_path:c.base_path,scope:c.scope}));
  await readRemotePackageManifest(c);
  const root=cleanPath(c.base_path),messageBase=`Publish Development AI read data ${dataset.generated_at}`,published=[];
  let done=0,total=dataset.details.length+4;
  for(const row of dataset.details){const path=`${root}/${row.path}`;status(`GitHubへ公開中 ${++done}/${total}\n${path}`);await putFile(c,path,row.data,messageBase);published.push({path,data:row.data})}
  let path=`${root}/projects.json`;status(`GitHubへ公開中 ${++done}/${total}\n${path}`);await putFile(c,path,dataset.projectsDoc,messageBase);published.push({path,data:dataset.projectsDoc});
  path=`${root}/pending.json`;status(`GitHubへ公開中 ${++done}/${total}\n${path}`);await putFile(c,path,dataset.pendingDoc,messageBase);published.push({path,data:dataset.pendingDoc});
  // AI manifest is committed after all read documents.
  path=`${root}/manifest.json`;status(`GitHubへ公開中 ${++done}/${total}\n${path}`);await putFile(c,path,dataset.manifest,messageBase);published.push({path,data:dataset.manifest});
  // Public read JSON lives in the source branch, so synchronize package_manifest last.
  status(`GitHubへ公開中 ${++done}/${total}\npackage_manifest.json 整合性同期`);await syncSourcePackageManifest(c,published,messageBase);
  const last={published_at:iso(),owner:c.owner,repo:c.repo,branch:c.branch,base_path:root,project_count:dataset.summaries.length,pending_project_count:dataset.pending.length,pending_url:dataset.base+'pending.json'};
  localStorage.setItem(LAST_PUBLISH_KEY,JSON.stringify(last));lastDataset=dataset;
  status(`公開完了。Source package_manifestも同期しました。\n未確定案件入口: ${last.pending_url}\n\nChatGPTへこのURLを渡して「未確定案件を見て」と依頼できます。`,'OK');render();
 }catch(e){status('公開失敗: '+e.message,'ERROR')}finally{setBusy(false)}
}
async function exportZip(){
 try{
  const c=configFromForm(false),dataset=buildDataset(c),root=cleanPath(c.base_path);
  if(typeof GKZipCore==='undefined'||!GKZipCore.writer)throw new Error('ZIPライブラリを読み込めません。');
  const writer=GKZipCore.writer.create();
  for(const row of dataset.details)writer.addJson(`${root}/${row.path}`,row.data);
  writer.addJson(`${root}/projects.json`,dataset.projectsDoc);writer.addJson(`${root}/pending.json`,dataset.pendingDoc);writer.addJson(`${root}/manifest.json`,dataset.manifest);
  writer.addText('README_AI_PUBLIC.txt',`Development AI Public Read Data\n\n公開先Path: ${root}/\n入口: pending.json\n生成: ${dataset.generated_at}\n案件: ${dataset.summaries.length}\n未確定: ${dataset.pending.length}\n\nこのZIPは公開用読み取りデータです。Project詳細にはDiscussion / Work Box / Confirmation等が含まれます。\n`);
  await writer.download(`GK_Development_AI_Public_${new Date().toISOString().replace(/[:.]/g,'-')}.zip`);
  lastDataset=dataset;status('公開用JSON ZIPを出力しました。GitHubへ手動配置する場合に使用できます。','OK');renderPreview(dataset);
 }catch(e){status('ZIP出力失敗: '+e.message,'ERROR')}
}
function openPending(){
 try{const c=configFromForm(false),url=publicRepoBase(c)+'pending.json';if(!url)throw new Error('公開URLを設定してください。');window.open(url,'_blank','noopener')}catch(e){status('公開URLを開けません: '+e.message,'ERROR')}
}
async function copyPrompt(){
 try{const c=configFromForm(false),url=publicRepoBase(c)+'pending.json';const text=`${url}\nこのURLを読み、未確定のDevelopment Projectを確認して。必要な案件だけdetail_urlを辿って、Humanが判断すべき点を日本語で整理して。`;await navigator.clipboard.writeText(text);status('ChatGPTへ渡す文をコピーしました。','OK')}catch(e){status('コピー失敗: '+e.message,'ERROR')}
}

window.GKSDevelopmentAIPublish={render,preview,saveSettings,testConnection,publish,exportZip,openPending,copyPrompt,_test:{deepRedact,summarizeProject,buildDataset,publicRepoBase,cleanPath,safeId}};
window.addEventListener('DOMContentLoaded',render);
})();
