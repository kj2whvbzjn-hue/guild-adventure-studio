/* GKS-B662 Development AI Publish
 * Development-only read interface for GitHub Pages.
 * Does not reuse Game Project GitHub sync data/model/handlers.
 */
(function(){
'use strict';

const SETTINGS_KEY='gk_development_ai_publish_settings_v1';
const LAST_PUBLISH_KEY='gk_development_ai_publish_last_v1';
const DEFAULT_BASE_PATH='docs/ai-development';
const ROOT_GATEWAY_START='<!-- GKS_DEVELOPMENT_AI_GATEWAY_START -->';
const ROOT_GATEWAY_END='<!-- GKS_DEVELOPMENT_AI_GATEWAY_END -->';
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
 const failedChecks=checks.filter(x=>String(x?.status||'')==='Failed');
 const openTasks=tasks.filter(x=>String(x?.status||'Todo')!=='Done');
 const openDiscussions=discussions.filter(x=>['Open','Pending'].includes(String(x?.status||'Open')));
 const pendingDiscussions=discussions.filter(x=>String(x?.status||'')==='Pending');
 const status=String(w?.workspace?.status||'');
 const stage=workflowStage(w);
 const lifecycle=['Active','Paused','Completed','Superseded','Archived'].includes(String(w?.lifecycle?.status||''))?String(w.lifecycle.status):'Active';
 const attentionMode=['Auto','Include','Exclude'].includes(String(w?.workspace?.ai_attention||'Auto'))?String(w?.workspace?.ai_attention||'Auto'):'Auto';
 const counts={
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
 };
 const contentCount=counts.discussions+counts.architecture_nodes+counts.work_boxes+counts.tasks+counts.checks+counts.decisions+counts.specifications;
 const isEmpty=contentCount===0;
 const isFinished=lifecycle==='Completed'||lifecycle==='Superseded'||lifecycle==='Archived';
 const autoEligible=lifecycle==='Active';
 const unresolved=autoEligible&&(pendingChecks.length>0||openTasks.length>0||openDiscussions.length>0||oq.length>0||stage!=='Completed');
 const reasons=[];
 if(failedChecks.length)reasons.push(`Failed確認 ${failedChecks.length}件`);
 if(pendingChecks.length)reasons.push(`確認待ち/FAIL ${pendingChecks.length}件`);
 if(lifecycle==='Paused')reasons.push('Lifecycle Paused');
 if(lifecycle==='Completed')reasons.push('Lifecycle Completed');
 if(lifecycle==='Superseded')reasons.push(`Lifecycle Superseded${w?.lifecycle?.superseded_by?' → '+w.lifecycle.superseded_by:''}`);
 if(lifecycle==='Archived')reasons.push('Lifecycle Archived');
 if(['Specifying','Implementing','Validating'].includes(status))reasons.push(`案件状態 ${status}`);
 if(['Planning','Implementing','Verifying'].includes(stage))reasons.push(`Workflow ${stage}`);
 if(pendingDiscussions.length)reasons.push(`保留Discussion ${pendingDiscussions.length}件`);
 let attentionRequired=false;
 if(attentionMode==='Include')attentionRequired=true;
 else if(attentionMode==='Exclude')attentionRequired=false;
 else attentionRequired=!isEmpty&&autoEligible&&(pendingChecks.length>0||['Specifying','Implementing','Validating'].includes(status)||['Planning','Implementing','Verifying'].includes(stage)||pendingDiscussions.length>0);
 if(attentionMode==='Include')reasons.unshift('Human指定: 常に対象');
 if(attentionMode==='Exclude')reasons.unshift('Human指定: 対象外');
 const classification=isFinished?lifecycle:isEmpty?'Empty':lifecycle!=='Active'?lifecycle:attentionRequired?'HumanAttention':'Background';
 return {
  id:String(w?.workspace?.id||''),
  name:String(w?.workspace?.name||''),
  status,
  workflow_stage:stage,
  lifecycle_status:lifecycle,
  superseded_by:String(w?.lifecycle?.superseded_by||''),
  updated_at:String(w?.workspace?.updated_at||''),
  unresolved,
  attention_required:attentionRequired,
  attention_mode:attentionMode,
  attention_reasons:reasons,
  classification,
  counts,
  implementation_approval:String(w?.workflow?.implementation_approval?.status||''),
  completion_approval:String(w?.workflow?.completion_approval?.status||''),
  pending_checks:pendingChecks.map(x=>({id:String(x.id||''),title:String(x.title||''),gate:String(x.gate||'General'),status:String(x.status||'Pending'),target_type:String(x.target_type||''),target_id:String(x.target_id||'')})),
  open_tasks:openTasks.map(x=>({id:String(x.id||''),box_id:String(x.box_id||''),title:String(x.title||''),status:String(x.status||'Todo')})),
  open_discussions:openDiscussions.map(x=>({id:String(x.id||''),title:String(x.title||''),status:String(x.status||'Open')})),
  open_questions:oq
 };
}
function buildVersions(){
 const studio=typeof DISTRIBUTION_BUILD!=='undefined'?String(DISTRIBUTION_BUILD||''):String(globalThis.DISTRIBUTION_BUILD||globalThis.GA_PROJECT_CONFIG?.studioBuild||'');
 const game=typeof DISTRIBUTION_GAME_BUILD!=='undefined'?String(DISTRIBUTION_GAME_BUILD||''):String(globalThis.GA_PROJECT_CONFIG?.gameBuild||'');
 return {studio_build:studio,game_build:game};
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
function encodeSegments(v){return String(v||'').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function publicSiteRoot(c){
 if(!c.owner||!c.repo)return '';
 return c.repo.toLowerCase()===`${c.owner}.github.io`.toLowerCase()?`https://${c.owner}.github.io/`:`https://${c.owner}.github.io/${encodeURIComponent(c.repo)}/`;
}
function publicRepoBase(c){
 if(!c.owner||!c.repo)return '';
 const root=c.repo.toLowerCase()===`${c.owner}.github.io`.toLowerCase()?`https://${c.owner}.github.io/`:`https://${c.owner}.github.io/${encodeURIComponent(c.repo)}/`;
 return root+encodeSegments(cleanPath(c.base_path))+'/';
}
function rawRepoBase(c){
 if(!c.owner||!c.repo)return '';
 return `https://raw.githubusercontent.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${encodeSegments(c.branch||'main')}/${encodeSegments(cleanPath(c.base_path))}/`;
}
function githubRepoBase(c){
 if(!c.owner||!c.repo)return '';
 return `https://github.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/blob/${encodeSegments(c.branch||'main')}/${encodeSegments(cleanPath(c.base_path))}/`;
}
function publicBases(c){return {pages:publicRepoBase(c),raw:rawRepoBase(c),github:githubRepoBase(c)}}
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
function makeRevision(generatedAt,builds){
 const stamp=String(generatedAt||iso()).replace(/[^0-9A-Za-z]+/g,'').slice(0,18);
 const bytes=new Uint8Array(4);try{crypto.getRandomValues(bytes)}catch(_){bytes.set([Date.now()&255,(Date.now()>>8)&255,17,91])}
 const nonce=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
 return `${builds.studio_build||'GKS'}-${stamp}-${nonce}`;
}
function revisionUrl(url,revision){
 if(!url)return '';
 const sep=String(url).includes('?')?'&':'?';
 return String(url)+sep+'rev='+encodeURIComponent(String(revision||''));
}
function buildDataset(config){
 const generatedAt=iso(),bases=publicBases(config),base=bases.pages,workspaces=getProjectWorkspaces(config.scope),builds=buildVersions(),publishRevision=makeRevision(generatedAt,builds);
 const endpointUrls={
  pages:{base:bases.pages,projects:bases.pages?revisionUrl(bases.pages+'projects.json',publishRevision):'',pending:bases.pages?revisionUrl(bases.pages+'pending.json',publishRevision):''},
  raw:{base:bases.raw,projects:bases.raw?revisionUrl(bases.raw+'projects.json',publishRevision):'',pending:bases.raw?revisionUrl(bases.raw+'pending.json',publishRevision):''},
  github:{base:bases.github,projects:bases.github?revisionUrl(bases.github+'projects.json',publishRevision):'',pending:bases.github?revisionUrl(bases.github+'pending.json',publishRevision):''}
 };
 const details=[],summaries=[];
 for(const w of workspaces){
  const summary=summarizeProject(w),filename=safeId(summary.id)+'.json',detailPath=`projects/${filename}`;
  summary.detail_path=detailPath;
  summary.detail_url=bases.pages?revisionUrl(bases.pages+detailPath,publishRevision):'';
  summary.detail_raw_url=bases.raw?revisionUrl(bases.raw+detailPath,publishRevision):'';
  summary.detail_github_url=bases.github?revisionUrl(bases.github+detailPath,publishRevision):'';
  summaries.push(summary);
  details.push({path:detailPath,data:{format:'gk-development-ai-public-project',version:'1.2',generated_at:generatedAt,publish_revision:publishRevision,studio_build:builds.studio_build,game_build:builds.game_build,read_endpoints:{pages:summary.detail_url,raw:summary.detail_raw_url,github:summary.detail_github_url},summary:clone(summary),project:deepRedact(w)}});
 }
 summaries.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||String(a.id).localeCompare(String(b.id)));
 const pending=summaries.filter(x=>x.attention_required);
 const projectsDoc={format:'gk-development-ai-public-projects',version:'1.3',generated_at:generatedAt,publish_revision:publishRevision,studio_build:builds.studio_build,game_build:builds.game_build,scope:config.scope,project_count:summaries.length,read_endpoints:endpointUrls,projects:summaries};
 const pendingDoc={format:'gk-development-ai-public-pending',version:'1.3',generated_at:generatedAt,publish_revision:publishRevision,studio_build:projectsDoc.studio_build,game_build:projectsDoc.game_build,scope:config.scope,pending_semantics:'Human attention only. Auto evaluates Active lifecycle projects; Paused / Completed / Superseded / Archived are excluded unless ai_attention=Include. Per-project ai_attention can Include or Exclude.',pending_project_count:pending.length,read_endpoints:{pages:endpointUrls.pages.pending,raw:endpointUrls.raw.pending,github:endpointUrls.github.pending},projects:pending};
 const rootGatewayUrl=publicSiteRoot(config);
 const manifest={format:'gk-development-ai-public-manifest',version:'1.4',generated_at:generatedAt,publish_revision:publishRevision,publish_transport:'git-data-atomic-v3-root-gateway',studio_build:projectsDoc.studio_build,game_build:projectsDoc.game_build,scope:config.scope,project_count:summaries.length,pending_project_count:pending.length,pending_semantics:'Human attention only. Auto evaluates Active lifecycle projects; Paused / Completed / Superseded / Archived are excluded unless ai_attention=Include. Per-project ai_attention can Include or Exclude.',entrypoints:{root_gateway:'/',projects:'projects.json',pending:'pending.json'},public_urls:{root_gateway:rootGatewayUrl,base:bases.pages,projects:endpointUrls.pages.projects,pending:endpointUrls.pages.pending,pages:endpointUrls.pages,raw:endpointUrls.raw,github:endpointUrls.github},privacy:'Public read-only data. Secrets are redacted by key name; review content before publishing.'};
 return {generated_at:generatedAt,publish_revision:publishRevision,base,bases,rootGatewayUrl,endpointUrls,manifest,projectsDoc,pendingDoc,details,summaries,pending};
}
function buildRootGatewayData(dataset){
 const detailById=new Map(dataset.details.map(row=>[String(row.data?.summary?.id||''),row.data]));
 const projects=[];
 for(const sourceSummary of dataset.pending){
  const detail=detailById.get(String(sourceSummary.id||'')),project=detail?.project||{};
  const pendingChecks=(project.checks||[]).filter(x=>['Pending','Failed'].includes(String(x?.status||'Pending'))).map(x=>deepRedact(x));
  const targetIds={Architecture:new Set(),WorkBox:new Set(),Task:new Set(),Discussion:new Set()};
  for(const check of pendingChecks){const type=String(check.target_type||''),id=String(check.target_id||'');if(targetIds[type]&&id)targetIds[type].add(id)}
  const openDiscussionIds=new Set((sourceSummary.open_discussions||[]).map(x=>String(x.id||'')));
  for(const id of openDiscussionIds)targetIds.Discussion.add(id);
  const summary={
   id:String(sourceSummary.id||''),name:String(sourceSummary.name||''),status:String(sourceSummary.status||''),workflow_stage:String(sourceSummary.workflow_stage||''),lifecycle_status:String(sourceSummary.lifecycle_status||'Active'),superseded_by:String(sourceSummary.superseded_by||''),updated_at:String(sourceSummary.updated_at||''),
   attention_mode:String(sourceSummary.attention_mode||''),attention_reasons:clone(sourceSummary.attention_reasons||[]),counts:clone(sourceSummary.counts||{}),implementation_approval:String(sourceSummary.implementation_approval||''),completion_approval:String(sourceSummary.completion_approval||''),open_questions:clone(sourceSummary.open_questions||[])
  };
  projects.push({
   summary,
   workspace:deepRedact(project.workspace||{}),
   workflow:deepRedact(project.workflow||{}),
   pending_checks:pendingChecks,
   current_state:deepRedact({project_context:project.project_context||null,current_focus:project.current_focus||null,project_rules:project.project_rules||null,source_baseline:project.source_baseline||null,lifecycle:project.lifecycle||null,latest_implementation_record:[...(project.implementation_records||[])].sort((a,b)=>String(b.recorded_at||'').localeCompare(String(a.recorded_at||'')))[0]||null}),
   review_targets:{
    architecture_nodes:(project.architecture_nodes||[]).filter(x=>targetIds.Architecture.has(String(x.id||''))).map(x=>deepRedact(x)),
    work_boxes:(project.work_boxes||[]).filter(x=>targetIds.WorkBox.has(String(x.id||''))).map(x=>deepRedact(x)),
    tasks:(project.tasks||[]).filter(x=>targetIds.Task.has(String(x.id||''))).map(x=>deepRedact(x)),
    discussions:(project.discussions||[]).filter(x=>targetIds.Discussion.has(String(x.id||''))).map(x=>deepRedact(x)),
    decisions:deepRedact(project.decisions||[]),
    specifications:deepRedact(project.specifications||[])
   }
  });
 }
 return {format:'gk-development-ai-human-review-gateway',version:'1.0',generated_at:dataset.generated_at,publish_revision:dataset.publish_revision,studio_build:dataset.projectsDoc.studio_build,game_build:dataset.projectsDoc.game_build,pending_project_count:projects.length,projects};
}
function rootGatewayBlock(dataset){
 const data=buildRootGatewayData(dataset);
 const json=JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return `${ROOT_GATEWAY_START}\n<script id="gks-development-ai-human-review-data" type="application/json" data-publish-revision="${escapeHtml(dataset.publish_revision)}">${json}</script>\n${ROOT_GATEWAY_END}`;
}
function injectRootGatewayHtml(html,dataset){
 const source=String(html||''),block=rootGatewayBlock(dataset),a=source.indexOf(ROOT_GATEWAY_START),b=source.indexOf(ROOT_GATEWAY_END);
 if(a>=0&&b>a)return source.slice(0,a)+block+source.slice(b+ROOT_GATEWAY_END.length);
 const close=source.toLowerCase().lastIndexOf('</body>');
 if(close<0)throw new Error('root index.htmlに</body>がありません。固定AI入口を安全に挿入できません。');
 return source.slice(0,close)+block+'\n'+source.slice(close);
}
function status(message,level='INFO'){
 const node=el('daipStatus');if(!node)return;node.dataset.level=level;node.textContent=message;
}
function setBusy(v){busy=!!v;for(const b of document.querySelectorAll('[data-daip-busy]'))b.disabled=busy}
function renderPreview(dataset){
 const p=el('daipPreview');if(!p)return;
 if(!dataset){p.innerHTML='<div class="small">まだプレビューしていません。</div>';return}
 const pending=dataset.pending;
 p.innerHTML=`<div class="item"><div class="daip-preview-head"><div><b>公開予定 ${dataset.summaries.length}案件</b><div class="small">Human確認対象 ${pending.length}案件 / 全案件 ${dataset.summaries.length} / 詳細JSON ${dataset.details.length}件</div></div></div><div class="daip-counts"><span class="badge">projects.json</span><span class="badge warn">pending.json</span><span class="badge">projects/&lt;ID&gt;.json</span></div></div>`+
  (pending.length?pending.map(x=>`<div class="item"><b>${escapeHtml(x.name||x.id)}</b><div class="small">${escapeHtml(x.id)} / ${escapeHtml(x.workflow_stage||x.status)} / 確認待ち・FAIL ${x.counts.pending_or_failed_checks} / 理由 ${escapeHtml((x.attention_reasons||[]).join('・')||'Human確認対象')}</div></div>`).join(''):'<div class="item">Human確認対象の案件はありません。</div>');
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 const pane=el('developmentPane-aipublish');if(!pane)return;
 const s=readSettings();
 for(const [id,val] of [['daipOwner',s.owner],['daipRepo',s.repo],['daipBranch',s.branch],['daipBasePath',s.base_path]]){const n=el(id);if(n&&document.activeElement!==n)n.value=val}
 if(el('daipScope')&&document.activeElement!==el('daipScope'))el('daipScope').value=s.scope;
 let c=s,bases={pages:'',raw:'',github:''};try{c=configFromForm(false);bases=publicBases(c)}catch(_){c=s;bases=publicBases(s)}
 const baseEl=el('daipPublicBase');if(baseEl)baseEl.textContent=bases.pages||'Owner / Repositoryを設定すると表示します。';
 const rootEl=el('daipRootGatewayUrl');if(rootEl)rootEl.textContent=publicSiteRoot(c)||'—';
 let last=null;try{last=JSON.parse(localStorage.getItem(LAST_PUBLISH_KEY)||'null')}catch(_){last=null}
 const pendingEl=el('daipPendingUrl');if(pendingEl)pendingEl.textContent=last?.pending_url|| (bases.pages?bases.pages+'pending.json':'—');
 const rawEl=el('daipPendingRawUrl');if(rawEl)rawEl.textContent=last?.pending_raw_url|| (bases.raw?bases.raw+'pending.json':'—');
 const githubEl=el('daipPendingGithubUrl');if(githubEl)githubEl.textContent=last?.pending_github_url|| (bases.github?bases.github+'pending.json':'—');
 const lastEl=el('daipLastPublish');if(lastEl){
  if(!last?.published_at)lastEl.textContent='未公開';
  else lastEl.textContent=`${last.published_at} / ${last.project_count||0}案件 / Human確認対象 ${last.pending_project_count||0}件 / Commit ${String(last.commit_sha||'').slice(0,12)||'—'} / Revision ${last.publish_revision||'—'} / Git read-back ${last.git_readback||'未確認'} / Root ${last.root_gateway_reflection||'未確認'} / Raw ${last.raw_reflection||'未確認'} / Pages ${last.pages_reflection||'未確認'}`;
 }
 if(lastDataset)renderPreview(lastDataset);
}
function preview(){
 try{const c=configFromForm(false);localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:c.owner,repo:c.repo,branch:c.branch,base_path:c.base_path,scope:c.scope}));lastDataset=buildDataset(c);renderPreview(lastDataset);status(`公開内容を生成しました。\n案件 ${lastDataset.summaries.length} / Human確認対象 ${lastDataset.pending.length}\n${lastDataset.base||''}`,'OK');render()}catch(e){status('プレビュー失敗: '+e.message,'ERROR')}
}
function utf8ToBase64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
function base64ToUtf8(value){const binary=atob(String(value||'').replace(/\s+/g,'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder('utf-8').decode(bytes)}
function jsonText(obj){return JSON.stringify(obj,null,2)+'\n'}
async function sha256Text(text){const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function github(c,url,options={}){
 const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})};
 const res=await fetch(url,{...options,headers});const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch(_){body={message:text}}
 if(!res.ok){const err=new Error(`HTTP ${res.status}: ${body?.message||'GitHub API error'}`);err.status=res.status;throw err}return body;
}
function apiRepo(c){return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`}
function branchPath(branch){return String(branch||'main').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function apiContent(c,path){return apiRepo(c)+'/contents/'+cleanPath(path).split('/').map(encodeURIComponent).join('/')}
async function getRemoteAtRef(c,path,ref){try{return await github(c,apiContent(c,path)+`?ref=${encodeURIComponent(ref)}`)}catch(e){if(e.status===404)return null;throw e}}
async function readRemoteTextAt(c,path,refSha){
 const remote=await getRemoteAtRef(c,path,refSha);if(!remote?.content)throw new Error(`GitHub Sourceの${path}を読めません。`);
 return base64ToUtf8(remote.content);
}
async function readGitHead(c){
 const ref=await github(c,apiRepo(c)+`/git/ref/heads/${branchPath(c.branch)}`),headSha=String(ref?.object?.sha||'');
 if(!headSha)throw new Error('GitHub Branch HEADを取得できません。');
 const commit=await github(c,apiRepo(c)+`/git/commits/${encodeURIComponent(headSha)}`),treeSha=String(commit?.tree?.sha||'');
 if(!treeSha)throw new Error('GitHub HEAD Treeを取得できません。');
 return {head_sha:headSha,tree_sha:treeSha};
}
async function readRemotePackageManifestAt(c,refSha){
 const remote=await getRemoteAtRef(c,'package_manifest.json',refSha);if(!remote?.content)throw new Error('GitHub Sourceのpackage_manifest.jsonを読めません。AI共有はSource Package整合性を維持できないため停止しました。');
 let manifest;try{manifest=JSON.parse(base64ToUtf8(remote.content))}catch(_){throw new Error('GitHub Sourceのpackage_manifest.jsonを解析できません。')}
 if(!Array.isArray(manifest.files))throw new Error('GitHub Sourceのpackage_manifest.json: files がありません。');
 return manifest;
}
function manifestPolicyGlobMatch(path,pattern){
 const p=cleanPath(path);
 const escaped=String(pattern||'').replace(/[.+^${}()|[\]\\]/g,'\\$&')
  .replace(/\*\*/g,'§§DOUBLESTAR§§').replace(/\*/g,'[^/]*').replace(/§§DOUBLESTAR§§/g,'.*').replace(/\?/g,'.');
 return new RegExp('^'+escaped+'$').test(p);
}
function manifestFileClass(path,policy){
 const rel=cleanPath(path),fallback=policy?.default_class||'persistent';
 for(const [name,rule] of Object.entries(policy?.classes||{})){
  if(name===fallback)continue;
  if((rule.exact_paths||[]).map(cleanPath).includes(rel))return name;
  if((rule.patterns||[]).some(pattern=>manifestPolicyGlobMatch(rel,pattern)))return name;
 }
 return fallback;
}
async function readRemoteSystemFilePolicyAt(c,refSha){
 const raw=await readRemoteTextAt(c,'shared/integrity/system-file-policy.json',refSha);
 let policy;try{policy=JSON.parse(raw)}catch(_){throw new Error('GitHub Sourceのsystem-file-policy.jsonを解析できません。')}
 if(!policy||typeof policy!=='object')throw new Error('GitHub Sourceのsystem-file-policy.jsonが不正です。');
 return policy;
}
async function readRemoteCriticalRuntimeManifestAt(c,refSha){
 const path='shared/integrity/critical-runtime-manifest.json',remote=await getRemoteAtRef(c,path,refSha);if(!remote?.content)throw new Error(`GitHub Sourceの${path}を読めません。root index.html更新時のIntegrity同期を維持できないため停止しました。`);
 let manifest;try{manifest=JSON.parse(base64ToUtf8(remote.content))}catch(_){throw new Error(`GitHub Sourceの${path}を解析できません。`)}
 if(!Array.isArray(manifest.files))throw new Error(`GitHub Sourceの${path}: files がありません。`);
 return manifest;
}
async function makeCriticalRuntimeManifestText(manifest,published){
 const next=clone(manifest),byPath=new Map(published.map(row=>[String(row.path||''),row])),synced=[];
 for(const entry of next.files||[]){
  const path=String(entry?.path||''),row=byPath.get(path);if(!row)continue;
  const bytes=new TextEncoder().encode(row.text);entry.size=bytes.length;entry.sha256=await sha256Text(row.text);synced.push(path);
 }
 if(!synced.includes('index.html'))throw new Error('critical-runtime-manifest.jsonにindex.html entryがありません。root index.htmlを安全にAtomic更新できません。');
 return {text:jsonText(next),synced_paths:synced};
}
async function makePackageManifestText(manifest,published,policy){
 const next=clone(manifest),byPath=new Map((next.files||[]).filter(row=>manifestFileClass(String(row?.path||''),policy)==='persistent').map(row=>[String(row.path||''),row]));
 for(const row of published){
  if(manifestFileClass(row.path,policy)!=='persistent')continue;
  const bytes=new TextEncoder().encode(row.text);byPath.set(row.path,{path:row.path,size:bytes.length,sha256:await sha256Text(row.text)});
 }
 next.files=Array.from(byPath.values()).filter(row=>row.path).sort((a,b)=>String(a.path).localeCompare(String(b.path)));next.file_count=next.files.length;next.generated_at=iso();
 return jsonText(next);
}
function buildPublicFiles(dataset,root){
 const rows=[];
 for(const row of dataset.details)rows.push({path:`${root}/${row.path}`,text:jsonText(row.data),kind:'detail',project_id:String(row.data?.summary?.id||'')});
 rows.push({path:`${root}/projects.json`,text:jsonText(dataset.projectsDoc),kind:'projects'});
 rows.push({path:`${root}/pending.json`,text:jsonText(dataset.pendingDoc),kind:'pending'});
 rows.push({path:`${root}/manifest.json`,text:jsonText(dataset.manifest),kind:'manifest'});
 return rows;
}
async function createTextBlob(c,text){return github(c,apiRepo(c)+'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,encoding:'utf-8'})})}
async function readBlobText(c,sha){const blob=await github(c,apiRepo(c)+`/git/blobs/${encodeURIComponent(sha)}`);if(blob?.encoding!=='base64')throw new Error('GitHub blob encodingが想定外です。');return base64ToUtf8(blob.content||'')}
async function atomicCommit(c,dataset){
 const root=cleanPath(c.base_path),head=await readGitHead(c),remoteManifest=await readRemotePackageManifestAt(c,head.head_sha),systemFilePolicy=await readRemoteSystemFilePolicyAt(c,head.head_sha),remoteCriticalManifest=await readRemoteCriticalRuntimeManifestAt(c,head.head_sha),publicFiles=buildPublicFiles(dataset,root);
 const remoteRootIndex=await readRemoteTextAt(c,'index.html',head.head_sha),rootGatewayText=injectRootGatewayHtml(remoteRootIndex,dataset);
 publicFiles.push({path:'index.html',text:rootGatewayText,kind:'root_gateway'});
 const criticalSync=await makeCriticalRuntimeManifestText(remoteCriticalManifest,publicFiles),criticalManifestFile={path:'shared/integrity/critical-runtime-manifest.json',text:criticalSync.text,kind:'critical_runtime_manifest'};
 const packageManifestText=await makePackageManifestText(remoteManifest,[...publicFiles,criticalManifestFile],systemFilePolicy),allFiles=[...publicFiles,criticalManifestFile,{path:'package_manifest.json',text:packageManifestText,kind:'package_manifest'}];
 const blobs=[];
 for(let i=0;i<allFiles.length;i++){
  const row=allFiles[i];status(`Atomic Commit準備 ${i+1}/${allFiles.length}\nBlob: ${row.path}`);
  const blob=await createTextBlob(c,row.text);if(!blob?.sha)throw new Error(`Blob作成失敗: ${row.path}`);blobs.push({...row,sha:String(blob.sha)});
 }
 status('Atomic Commit準備\n1つのTreeを作成中…');
 const tree=await github(c,apiRepo(c)+'/git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:head.tree_sha,tree:blobs.map(row=>({path:row.path,mode:'100644',type:'blob',sha:row.sha}))})});
 if(!tree?.sha)throw new Error('Git Tree作成に失敗しました。');
 status('Atomic Commit準備\n1つのCommitを作成中…');
 const message=`Publish Development AI read data ${dataset.publish_revision}`;
 const commit=await github(c,apiRepo(c)+'/git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,tree:tree.sha,parents:[head.head_sha]})});
 if(!commit?.sha)throw new Error('Git Commit作成に失敗しました。');
 status('Atomic Commit実行\nBranch参照を1回だけ更新中…');
 await github(c,apiRepo(c)+`/git/refs/heads/${branchPath(c.branch)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:commit.sha,force:false})});
 return {root,head,commit_sha:String(commit.sha),tree_sha:String(tree.sha),files:blobs};
}
async function verifyGitReadback(c,dataset,publishResult){
 status('GitHub read-back検証中…\nBranch / Tree / pending / detailを確認します。');
 const current=await readGitHead(c);if(current.head_sha!==publishResult.commit_sha)throw new Error(`read-back: Branch HEADが公開Commitと一致しません (${current.head_sha.slice(0,12)} != ${publishResult.commit_sha.slice(0,12)})`);
 const tree=await github(c,apiRepo(c)+`/git/trees/${encodeURIComponent(current.tree_sha)}?recursive=1`);if(tree?.truncated)throw new Error('read-back: Git Treeがtruncatedです。');
 const map=new Map((tree?.tree||[]).filter(x=>x.type==='blob').map(x=>[String(x.path||''),String(x.sha||'')]));
 for(const row of publishResult.files){if(map.get(row.path)!==row.sha)throw new Error(`read-back: Blob不一致 ${row.path}`)}
 const pendingPath=`${publishResult.root}/pending.json`,pendingFile=publishResult.files.find(x=>x.path===pendingPath);if(!pendingFile)throw new Error('read-back: pending.jsonがCommit対象にありません。');
 let pending;try{pending=JSON.parse(await readBlobText(c,pendingFile.sha))}catch(e){throw new Error('read-back: pending.jsonを解析できません: '+e.message)}
 if(String(pending.publish_revision||'')!==dataset.publish_revision)throw new Error('read-back: pending.json publish_revision不一致');
 if(String(pending.studio_build||'')!==String(dataset.pendingDoc.studio_build||'')||String(pending.game_build||'')!==String(dataset.pendingDoc.game_build||''))throw new Error('read-back: pending.json Build不一致');
 if(Number(pending.pending_project_count)!==dataset.pending.length)throw new Error('read-back: pending_project_count不一致');
 const pendingIds=new Set((pending.projects||[]).map(x=>String(x.id||'')));
 for(const summary of dataset.pending){
  if(!pendingIds.has(String(summary.id||'')))throw new Error(`read-back: pending案件不足 ${summary.id}`);
  const detailPath=`${publishResult.root}/${summary.detail_path}`,detailFile=publishResult.files.find(x=>x.path===detailPath);if(!detailFile)throw new Error(`read-back: detail Commit不足 ${summary.id}`);
  let detail;try{detail=JSON.parse(await readBlobText(c,detailFile.sha))}catch(e){throw new Error(`read-back: detail解析失敗 ${summary.id}: ${e.message}`)}
  if(String(detail.publish_revision||'')!==dataset.publish_revision||String(detail.summary?.id||'')!==String(summary.id||''))throw new Error(`read-back: detail内容不一致 ${summary.id}`);
 }
 const rootFile=publishResult.files.find(x=>x.path==='index.html');if(!rootFile)throw new Error('read-back: root index.htmlがCommit対象にありません。');
 const rootText=await readBlobText(c,rootFile.sha);if(!rootText.includes(ROOT_GATEWAY_START)||!rootText.includes(`data-publish-revision="${dataset.publish_revision}"`))throw new Error('read-back: root AI入口 Revision不一致');
 for(const summary of dataset.pending)if(!rootText.includes(`&quot;id&quot;: &quot;${escapeHtml(summary.id)}&quot;`))throw new Error(`read-back: root AI入口に案件不足 ${summary.id}`);
 return {status:'Passed',checked_at:iso(),commit_sha:publishResult.commit_sha,pending_project_count:dataset.pending.length,root_gateway:true};
}
async function fetchPublicJson(url,revision){
 const target=revisionUrl(String(url||'').replace(/([?&])rev=[^&]*/,'$1').replace(/[?&]$/,''),revision)+'&cb='+encodeURIComponent(Date.now());
 const res=await fetch(target,{method:'GET',cache:'no-store',headers:{'Accept':'application/json'}});if(!res.ok)throw new Error(`HTTP ${res.status}`);return res.json();
}
async function verifyPublicEndpointOnce(label,pendingUrl,revision,detailField){
 const pending=await fetchPublicJson(pendingUrl,revision);if(String(pending.publish_revision||'')!==String(revision||''))throw new Error(`${label} pending revision=${pending.publish_revision||'なし'}`);
 const details=[];
 for(const summary of pending.projects||[]){
  const detailUrl=String(summary?.[detailField]||'');if(!detailUrl)throw new Error(`${label} ${detailField}なし: ${summary.id||'unknown'}`);
  const detail=await fetchPublicJson(detailUrl,revision);if(String(detail.publish_revision||'')!==String(revision||'')||String(detail.summary?.id||'')!==String(summary.id||''))throw new Error(`${label} detail不一致: ${summary.id||'unknown'}`);details.push(String(summary.id||''));
 }
 return {status:'Passed',checked_at:iso(),pending_project_count:Number(pending.pending_project_count||0),detail_ids:details};
}
async function waitForPublicReflection(label,pendingUrl,revision,detailField,{attempts=12,intervalMs=5000}={}){
 let lastError=null;
 for(let i=1;i<=attempts;i++){
  try{status(`${label}反映確認 ${i}/${attempts}\nRevision ${revision}`);return await verifyPublicEndpointOnce(label,pendingUrl,revision,detailField)}catch(e){lastError=e;if(i<attempts)await sleep(intervalMs)}
 }
 return {status:'Pending',checked_at:iso(),message:lastError?.message||`${label}反映を確認できませんでした。`};
}
async function waitForRawReflection(pendingUrl,revision,options={}){return waitForPublicReflection('GitHub Raw',pendingUrl,revision,'detail_raw_url',{attempts:6,intervalMs:2000,...options})}
async function waitForPagesReflection(pendingUrl,revision,options={}){return waitForPublicReflection('GitHub Pages',pendingUrl,revision,'detail_url',{attempts:12,intervalMs:5000,...options})}
async function verifyRootGatewayOnce(url,revision,pendingIds=[]){
 const sep=String(url||'').includes('?')?'&':'?',target=String(url||'')+sep+'dev_ai_revision='+encodeURIComponent(revision)+'&cb='+encodeURIComponent(Date.now());
 const res=await fetch(target,{method:'GET',cache:'no-store',headers:{'Accept':'text/html'}});if(!res.ok)throw new Error(`HTTP ${res.status}`);const text=await res.text();
 if(!text.includes(ROOT_GATEWAY_START)||!text.includes(`data-publish-revision="${revision}"`))throw new Error('root gateway Revision未反映');
 for(const id of pendingIds)if(!text.includes(`&quot;id&quot;: &quot;${escapeHtml(id)}&quot;`))throw new Error(`root gateway 案件不足 ${id}`);
 return {status:'Passed',checked_at:iso(),pending_project_count:pendingIds.length};
}
async function waitForRootGateway(url,revision,pendingIds,{attempts=12,intervalMs=5000}={}){
 let lastError=null;
 for(let i=1;i<=attempts;i++){
  try{status(`固定AI入口反映確認 ${i}/${attempts}\nRevision ${revision}`);return await verifyRootGatewayOnce(url,revision,pendingIds)}catch(e){lastError=e;if(i<attempts)await sleep(intervalMs)}
 }
 return {status:'Pending',checked_at:iso(),message:lastError?.message||'固定AI入口の反映を確認できませんでした。'};
}
async function testConnection(){
 if(busy)return;try{setBusy(true);const c=configFromForm(true);status('Development AI公開用の接続を確認中…');const head=await readGitHead(c);localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:c.owner,repo:c.repo,branch:c.branch,base_path:c.base_path,scope:c.scope}));status(`接続できました: ${c.owner}/${c.repo} (${c.branch})\nHEAD ${head.head_sha.slice(0,12)}`,'OK');render()}catch(e){status('接続失敗: '+e.message,'ERROR')}finally{setBusy(false)}
}
async function publish(){
 if(busy)return;
 try{
  const c=configFromForm(true),dataset=buildDataset(c);
  if(!dataset.summaries.length)throw new Error('公開できるDevelopment Projectがありません。');
  const warning=`Development ProjectのHuman確認対象を公開します。\n\n固定AI入口: ${dataset.rootGatewayUrl}\nPages JSON: ${dataset.endpointUrls.pages.pending}\nRaw JSON: ${dataset.endpointUrls.raw.pending}\n案件: ${dataset.summaries.length}\nHuman確認対象: ${dataset.pending.length}\nRevision: ${dataset.publish_revision}\n\n固定AI入口ではHuman確認対象だけの判断用Contextをroot index.htmlへ読み取り専用で埋め込みます。公開JSON・root index.html・critical-runtime-manifest.json・package_manifest.jsonは1つのAtomic Commitで更新します。公開してよい内容か確認しましたか？`;
  if(!confirm(warning))return;
  setBusy(true);localStorage.setItem(SETTINGS_KEY,JSON.stringify({owner:c.owner,repo:c.repo,branch:c.branch,base_path:c.base_path,scope:c.scope}));
  const publishResult=await atomicCommit(c,dataset),gitReadback=await verifyGitReadback(c,dataset,publishResult);
  const pendingUrl=dataset.endpointUrls.pages.pending,pendingRawUrl=dataset.endpointUrls.raw.pending,pendingGithubUrl=dataset.endpointUrls.github.pending,rootGatewayUrl=dataset.rootGatewayUrl;
  const rootGateway=await waitForRootGateway(rootGatewayUrl,dataset.publish_revision,dataset.pending.map(x=>String(x.id||''))),raw=await waitForRawReflection(pendingRawUrl,dataset.publish_revision),pages=await waitForPagesReflection(pendingUrl,dataset.publish_revision);
  const last={published_at:iso(),owner:c.owner,repo:c.repo,branch:c.branch,base_path:publishResult.root,project_count:dataset.summaries.length,pending_project_count:dataset.pending.length,root_gateway_url:rootGatewayUrl,pending_url:pendingUrl,pending_raw_url:pendingRawUrl,pending_github_url:pendingGithubUrl,publish_revision:dataset.publish_revision,source_parent_sha:publishResult.head.head_sha,commit_sha:publishResult.commit_sha,git_readback:gitReadback.status,root_gateway_reflection:rootGateway.status,root_gateway_checked_at:rootGateway.checked_at,root_gateway_message:rootGateway.message||'',raw_reflection:raw.status,raw_checked_at:raw.checked_at,raw_message:raw.message||'',pages_reflection:pages.status,pages_checked_at:pages.checked_at,pages_message:pages.message||''};
  localStorage.setItem(LAST_PUBLISH_KEY,JSON.stringify(last));lastDataset=dataset;
  if(rootGateway.status==='Passed'&&raw.status==='Passed'&&pages.status==='Passed')status(`公開完了。Atomic Commit / read-back / 固定AI入口 / Raw / Pages反映を確認しました。\nCommit: ${last.commit_sha.slice(0,12)}\nRevision: ${last.publish_revision}\n固定AI入口: ${last.root_gateway_url}`,'OK');
  else status(`GitHub公開は完了しました。Atomic Commit / read-backはPASSです。\nCommit: ${last.commit_sha.slice(0,12)}\nRevision: ${last.publish_revision}\n固定AI入口: ${rootGateway.status}${rootGateway.message?' / '+rootGateway.message:''}\nRaw: ${raw.status}${raw.message?' / '+raw.message:''}\nPages: ${pages.status}${pages.message?' / '+pages.message:''}\n「公開状態を再検証」で再確認できます。`,'WARNING');
  render();
 }catch(e){status('公開失敗: '+e.message,'ERROR')}finally{setBusy(false)}
}
async function verifyLastPublish(){
 if(busy)return;
 try{
  let last=null;try{last=JSON.parse(localStorage.getItem(LAST_PUBLISH_KEY)||'null')}catch(_){last=null}
  if(!last?.publish_revision)throw new Error('再検証できる公開履歴がありません。');
  setBusy(true);
  const c={owner:last.owner||'',repo:last.repo||'',branch:last.branch||'main',base_path:last.base_path||DEFAULT_BASE_PATH},bases=publicBases(c),rootUrl=last.root_gateway_url||publicSiteRoot(c);
  last.pending_url=last.pending_url||revisionUrl(bases.pages+'pending.json',last.publish_revision);last.pending_raw_url=last.pending_raw_url||revisionUrl(bases.raw+'pending.json',last.publish_revision);last.pending_github_url=last.pending_github_url||revisionUrl(bases.github+'pending.json',last.publish_revision);last.root_gateway_url=rootUrl;
  let pendingIds=[];try{const p=await fetchPublicJson(last.pending_raw_url,last.publish_revision);pendingIds=(p.projects||[]).map(x=>String(x.id||''))}catch(_){pendingIds=[]}
  const rootGateway=await waitForRootGateway(rootUrl,last.publish_revision,pendingIds,{attempts:3,intervalMs:3000}),raw=await waitForRawReflection(last.pending_raw_url,last.publish_revision,{attempts:3,intervalMs:2000}),pages=await waitForPagesReflection(last.pending_url,last.publish_revision,{attempts:3,intervalMs:3000});
  last.root_gateway_reflection=rootGateway.status;last.root_gateway_checked_at=rootGateway.checked_at;last.root_gateway_message=rootGateway.message||'';last.raw_reflection=raw.status;last.raw_checked_at=raw.checked_at;last.raw_message=raw.message||'';last.pages_reflection=pages.status;last.pages_checked_at=pages.checked_at;last.pages_message=pages.message||'';localStorage.setItem(LAST_PUBLISH_KEY,JSON.stringify(last));
  if(rootGateway.status==='Passed')status(`固定AI入口再検証PASS。\nRevision: ${last.publish_revision}\nHuman確認対象 ${rootGateway.pending_project_count}件\nRaw: ${raw.status} / Pages: ${pages.status}`,'OK');
  else status(`固定AI入口はまだ確認できません。\nRoot: ${rootGateway.message||rootGateway.status}\nRaw: ${raw.status}${raw.message?' / '+raw.message:''}\nPages: ${pages.status}${pages.message?' / '+pages.message:''}`,'WARNING');render();
 }catch(e){status('再検証失敗: '+e.message,'ERROR')}finally{setBusy(false)}
}
async function exportZip(){
 try{
  const c=configFromForm(false),dataset=buildDataset(c),root=cleanPath(c.base_path);
  if(typeof GKZipCore==='undefined'||!GKZipCore.writer)throw new Error('ZIPライブラリを読み込めません。');
  const writer=GKZipCore.writer.create();
  for(const row of dataset.details)writer.addJson(`${root}/${row.path}`,row.data);
  writer.addJson(`${root}/projects.json`,dataset.projectsDoc);writer.addJson(`${root}/pending.json`,dataset.pendingDoc);writer.addJson(`${root}/manifest.json`,dataset.manifest);
  writer.addText('README_AI_PUBLIC.txt',`Development AI Public Read Data

公開先Path: ${root}/
入口: pending.json
生成: ${dataset.generated_at}
Revision: ${dataset.publish_revision}
案件: ${dataset.summaries.length}
Human確認対象: ${dataset.pending.length}
Pages: ${dataset.endpointUrls.pages.pending}
Raw: ${dataset.endpointUrls.raw.pending}
GitHub: ${dataset.endpointUrls.github.pending}

AIはPagesを取得できない場合、同じRevisionのRaw、それでも不可ならGitHub表示を利用できます。Project詳細もdetail_url / detail_raw_url / detail_github_urlの順でフォールバックできます。
このZIPは公開用読み取りデータです。Project詳細にはDiscussion / Work Box / Confirmation等が含まれます。
`);
  await writer.download(`GK_Development_AI_Public_${new Date().toISOString().replace(/[:.]/g,'-')}.zip`);
  lastDataset=dataset;status('公開用JSON ZIPを出力しました。GitHubへ手動配置する場合に使用できます。','OK');renderPreview(dataset);
 }catch(e){status('ZIP出力失敗: '+e.message,'ERROR')}
}
function lastPublish(){try{return JSON.parse(localStorage.getItem(LAST_PUBLISH_KEY)||'null')}catch(_){return null}}
function openPending(kind='pages'){
 try{const c=configFromForm(false),last=lastPublish(),bases=publicBases(c),urls={root:last?.root_gateway_url||publicSiteRoot(c),pages:last?.pending_url||bases.pages+'pending.json',raw:last?.pending_raw_url||bases.raw+'pending.json',github:last?.pending_github_url||bases.github+'pending.json'},url=urls[kind]||urls.pages;if(!url)throw new Error('公開URLを設定してください。');window.open(url,'_blank','noopener')}catch(e){status('公開URLを開けません: '+e.message,'ERROR')}
}
async function copyPrompt(){
 try{
  const c=configFromForm(false),last=lastPublish(),revision=String(last?.publish_revision||''),rootUrl=last?.root_gateway_url||publicSiteRoot(c);
  const text=`Development Studioが公開した固定AI入口を確認してください。\npublish_revision: ${revision||'未公開'}\n固定AI入口: ${rootUrl}\n\n1. 固定AI入口を実取得してください。\n2. ページ内の id="gks-development-ai-human-review-data" のapplication/jsonデータだけを公開データとして使用してください。\n3. JSON内のpublish_revisionが ${revision||'指定Revision'} と完全一致することを確認してください。一致しない場合は古いキャッシュとして扱い、その内容を使わないでください。\n4. JSONに含まれるHuman確認対象Projectだけを読み、Humanが判断すべき点を日本語で整理してください。過去データ・記憶・他URLから推測で補完しないでください。\n5. 最後に「固定AI入口の取得可否」「Revision一致/不一致」「確認できたProject ID」を報告してください。`;
  await navigator.clipboard.writeText(text);status('ChatGPTへ渡す固定AI入口テスト文をコピーしました。','OK')
 }catch(e){status('コピー失敗: '+e.message,'ERROR')}
}

window.GKSDevelopmentAIPublish={render,preview,saveSettings,testConnection,publish,verifyLastPublish,exportZip,openPending,copyPrompt,_test:{deepRedact,summarizeProject,buildDataset,buildRootGatewayData,rootGatewayBlock,injectRootGatewayHtml,buildVersions,publicSiteRoot,publicRepoBase,rawRepoBase,githubRepoBase,publicBases,cleanPath,safeId,revisionUrl,makeRevision,verifyPublicEndpointOnce,verifyRootGatewayOnce}};
window.addEventListener('DOMContentLoaded',render);
})();
