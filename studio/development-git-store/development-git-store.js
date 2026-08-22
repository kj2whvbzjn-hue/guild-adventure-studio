/* Development Git Store — simplified canonical project I/O.
 * Git is the persistent authority.
 * Project list uses development-project-data/index.json (title + id only).
 * Project body is fetched only after the user confirms opening a title.
 * The browser keeps exactly one current project body in the Studio host.
 * Concurrent updates are guarded only by the Git blob SHA loaded with the project.
 */
(function(global){
'use strict';

const DATA_ROOT='development-project-data/';
const INDEX_PATH=DATA_ROOT+'index.json';
const API_VERSION='2022-11-28';
const CONNECTION_SETTINGS_KEY='gks_development_git_connection_v2';
const DEFAULT_CONNECTION=Object.freeze({owner:'kj2whvbzjn-hue',repo:'guild-adventure-studio',branch:'sub'});
const state={host:null,loaded:new Set(),dirty:new Set(),busy:false,indexRows:[],indexRemote:null,indexRefreshAt:0,indexPromise:null};

const byId=id=>document.getElementById(id);
const text=v=>String(v??'').trim();
const safeId=v=>text(v).replace(/[^A-Za-z0-9._-]+/g,'_');
const canonicalPath=id=>`${DATA_ROOT}${safeId(id)}.json`;

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object'){
    const out={};
    Object.keys(value).sort().forEach(k=>{out[k]=stable(value[k]);});
    return out;
  }
  return value;
}
function equalProject(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function currentEntry(){return state.host?.getActiveEntry?.()||null;}
function currentWorkspace(){return state.host?.getCurrentWorkspace?.()||null;}
function commonGitValue(id){return text(byId(id)?.value);}
function rememberedConnection(){try{const x=JSON.parse(localStorage.getItem(CONNECTION_SETTINGS_KEY)||'{}');return {owner:text(x.owner),repo:text(x.repo),branch:text(x.branch)}}catch(_){return {owner:'',repo:'',branch:''}}}

function connectionFor(projectId='',requireToken=false,{index=false}={}){
  const id=text(projectId);
  const entry=id?state.host?.getRegistryEntry?.(id):null;
  const fallback=state.host?.getDefaultGitRemote?.(id)||{};
  const remote=entry?.git_remote||fallback||{},remembered=rememberedConnection();
  const owner=text(remote.owner)||remembered.owner||commonGitValue('ghOwner')||DEFAULT_CONNECTION.owner;
  const repo=text(remote.repo)||remembered.repo||commonGitValue('ghRepo')||DEFAULT_CONNECTION.repo;
  const branch=text(remote.branch)||remembered.branch||DEFAULT_CONNECTION.branch||commonGitValue('ghBranch');
  const token=commonGitValue('ghToken');
  const path=index?INDEX_PATH:canonicalPath(id);
  if(!owner||!repo||!branch)throw new Error('StudioのGitHub接続設定でOwner / Repository / Branchを設定してください。');
  if(!index&&!id)throw new Error('Project IDがありません。');
  if(requireToken&&!token)throw new Error('StudioのGitHub接続設定でPATを入力してください。');
  return {owner,repo,branch,path,token};
}
function headers(token,accept='application/vnd.github+json'){
  const h={'Accept':accept,'X-GitHub-Api-Version':API_VERSION};
  if(token)h.Authorization=`Bearer ${token}`;
  return h;
}
function contentsUrl(c,withRef=true){
  const p=c.path.split('/').map(encodeURIComponent).join('/');
  const base=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${p}`;
  return withRef?`${base}?ref=${encodeURIComponent(c.branch)}`:base;
}
async function failure(res,label){throw new Error(`${label}: HTTP ${res.status} ${await res.text()}`);}
function responseSha(res){
  const etag=text(res.headers.get('etag')).replace(/^W\//,'').replace(/^"|"$/g,'');
  return /^[0-9a-f]{40}$/i.test(etag)?etag:'';
}
async function remoteFile(c,{requireSha=false}={}){
  const res=await fetch(contentsUrl(c,true),{headers:headers(c.token,'application/vnd.github.raw+json'),cache:'no-store'});
  if(res.status===404)return {exists:false,sha:'',raw:''};
  if(!res.ok)return failure(res,'GitHub取得失敗');
  const raw=await res.text();let sha=responseSha(res);
  if(requireSha&&!sha){
    const meta=await fetch(contentsUrl(c,true),{headers:headers(c.token,'application/vnd.github.object+json'),cache:'no-store'});
    if(!meta.ok)return failure(meta,'GitHub metadata取得失敗');
    sha=text((await meta.json()).sha);
  }
  return {exists:true,sha,raw};
}
function utf8Base64(value){
  const bytes=new TextEncoder().encode(String(value));let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
async function putFile(c,content,message,expectedSha=''){
  const body={message:text(message)||'Update Development Project',content:utf8Base64(content),branch:c.branch};
  if(expectedSha)body.sha=expectedSha;
  const res=await fetch(contentsUrl(c,false),{method:'PUT',headers:{...headers(c.token),'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok)return failure(res,'GitHub保存失敗');
  const out=await res.json();
  return {file_sha:text(out?.content?.sha),commit_sha:text(out?.commit?.sha)};
}
async function deleteFile(c,sha,message){
  const res=await fetch(contentsUrl(c,false),{method:'DELETE',headers:{...headers(c.token),'Content-Type':'application/json'},body:JSON.stringify({message,sha,branch:c.branch})});
  if(!res.ok)return failure(res,'GitHub削除失敗');
  return res.json();
}
function parseProject(raw){
  const obj=JSON.parse(raw);
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('Development Project JSONではありません。');
  return state.host.normalizeProject(obj);
}
function assertSameProject(remote,local){
  const rid=text(remote?.workspace?.id),lid=text(local?.workspace?.id);
  if(rid!==lid)throw new Error(`workspace.id競合: remote=${rid} / local=${lid}`);
  const ri=text(remote?.authority?.instance_id),li=text(local?.authority?.instance_id);
  if(ri!==li)throw new Error(`Project instance競合: remote=${ri} / local=${li}`);
}

function render(){
  const entry=currentEntry();
  const dirty=!!entry&&state.dirty.has(entry.id);
  byId('developmentDirtyIndicator')?.classList.toggle('hidden',!dirty);
  const save=byId('devProjectSaveButton');if(save)save.disabled=state.busy||!dirty;
}
function isLoaded(id){return state.loaded.has(text(id));}
function isDirty(id){return state.dirty.has(text(id));}
function isRegistryVerified(){return true;}
function markDirty(id){const key=text(id);if(!key||!state.loaded.has(key))return;state.dirty.add(key);render();}
function markClean(id){state.dirty.delete(text(id));render();}
function discardCurrent(){const id=text(currentEntry()?.id);if(id){state.loaded.delete(id);state.dirty.delete(id);}render();}

function normalizeIndex(raw){
  const rows=Array.isArray(raw?.projects)?raw.projects:[];
  const seen=new Set(),out=[];
  for(const row of rows){
    const id=text(row?.id),title=text(row?.title||row?.name);
    if(!id||!title||seen.has(id))continue;
    seen.add(id);out.push({id,title});
  }
  return out.sort((a,b)=>a.title.localeCompare(b.title,'ja'));
}
function localIndexSeed(){
  return normalizeIndex({projects:state.host?.getProjectIndexSeed?.()||[]});
}
async function refreshProjectIndex({quiet=false,force=false}={}){
  const now=Date.now();
  if(!force&&state.indexPromise)return state.indexPromise;
  if(!force&&now-state.indexRefreshAt<5000)return state.indexRows;
  state.indexRefreshAt=now;
  state.indexPromise=(async()=>{
    try{
      const c=connectionFor('',false,{index:true});
      let rows=[];const file=await remoteFile(c,{requireSha:true});
      if(!file.exists){state.indexRows=localIndexSeed();return state.indexRows;}
      const raw=JSON.parse(file.raw);rows=normalizeIndex(raw);
      state.indexRemote={...c,sha:file.sha};
      state.indexRows=rows;
      state.host?.replaceProjectIndex?.(rows,{owner:c.owner,repo:c.repo,branch:c.branch,path:INDEX_PATH,sha:file.sha||''});
      return rows;
    }catch(e){if(!quiet)alert('案件一覧をGitから取得できません: '+e.message);return state.indexRows;}
    finally{state.indexPromise=null;render();}
  })();
  return state.indexPromise;
}
async function writeIndex(rows,c){
  const ic={...c,path:INDEX_PATH};
  const current=await remoteFile(ic,{requireSha:true});
  const normalized=normalizeIndex({projects:rows});
  const payload=JSON.stringify({schema_version:1,projects:normalized.map(x=>({id:x.id,title:x.title}))},null,2)+'\n';
  const out=await putFile(ic,payload,'Update Development Project index',current.sha||'');
  state.indexRows=normalized;state.indexRemote={...ic,sha:out.file_sha};
  state.host?.replaceProjectIndex?.(normalized,{owner:c.owner,repo:c.repo,branch:c.branch,path:INDEX_PATH,sha:out.file_sha});
  return out;
}
async function syncIndexEntry(project,c){
  const id=text(project?.workspace?.id),title=text(project?.workspace?.name);if(!id||!title)return;
  let rows=await refreshProjectIndex({quiet:true,force:true});
  const merged=new Map(localIndexSeed().map(x=>[x.id,x]));
  for(const row of rows||[])merged.set(row.id,row);
  rows=[...merged.values()];
  const i=rows.findIndex(x=>x.id===id);if(i>=0)rows[i]={id,title};else rows.push({id,title});
  await writeIndex(rows,c);
}

async function openFromGit(options={}){
  try{
    state.busy=true;render();
    const id=text(options.expectedProjectId);if(!id)throw new Error('Project IDがありません。');
    const c=connectionFor(id,false),file=await remoteFile(c,{requireSha:true});
    if(!file.exists)throw new Error(`Gitに案件がありません: ${c.path}`);
    const project=parseProject(file.raw);
    if(text(project.workspace.id)!==id)throw new Error(`Project ID不一致: expected=${id} / actual=${project.workspace.id}`);
    if(text(project.authority.canonical_path)!==c.path)throw new Error('canonical_pathがGit Pathと一致しません。');
    state.loaded.clear();state.dirty.clear();state.loaded.add(id);
    state.host.openGitProject(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:file.sha});
    return true;
  }catch(e){alert('案件を開けませんでした: '+e.message);return false;}
  finally{state.busy=false;render();}
}

async function saveCurrent(){
  const entry=currentEntry();
  if(!entry||!isLoaded(entry.id))return alert('案件を開いてください。');
  if(!isDirty(entry.id))return;
  try{
    state.busy=true;render();
    const local=state.host.normalizeProject(currentWorkspace());
    const c=connectionFor(entry.id,true),file=await remoteFile(c,{requireSha:true});
    if(!file.exists)throw new Error('Git上の案件が見つかりません。');
    const remote=parseProject(file.raw);assertSameProject(remote,local);
    const loadedSha=text(entry.git_remote?.sha);
    if(!loadedSha)throw new Error('Git読込時のSHAがありません。案件を開き直してください。');
    if(!file.sha||loadedSha!==file.sha)throw new Error('案件を開いた後にGit側が更新されています。案件を開き直してください。');
    local.workspace.updated_at=new Date().toISOString();
    const normalized=state.host.normalizeProject(local);
    const out=await putFile(c,JSON.stringify(normalized,null,2)+'\n',`Save Development Project ${entry.id}`,file.sha);
    const verify=await remoteFile(c,{requireSha:true});if(!verify.exists)throw new Error('保存後の再取得に失敗しました。');
    const verified=parseProject(verify.raw);if(!equalProject(verified,normalized))throw new Error('保存後にGitから再取得した内容が一致しません。');
    state.host.replaceGitWorkspace(verified,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:verify.sha||out.file_sha});
    markClean(entry.id);
    try{await syncIndexEntry(verified,c);}catch(e){console.warn('[Development index]',e);}
    const status=byId('developmentStoreStatus');if(status)status.textContent='Gitに保存しました';
  }catch(e){alert('保存できませんでした: '+e.message);}
  finally{state.busy=false;render();state.host?.refresh?.();}
}

async function reloadCurrent(){
  const entry=currentEntry();if(!entry)return false;
  if(isDirty(entry.id)&&!confirm('未保存の変更を破棄してGitから読み直しますか？'))return false;
  return openFromGit({expectedProjectId:entry.id});
}

async function createProject(title){
  try{
    state.busy=true;render();
    await refreshProjectIndex({quiet:true,force:true});
    const id=state.host.nextProjectId();
    const project=state.host.createBlankProject(id,text(title));
    const c=connectionFor(id,true),existing=await remoteFile(c,{requireSha:true});
    if(existing.exists)throw new Error(`同じIDの案件がGitにあります: ${id}`);
    const normalized=state.host.normalizeProject(project);
    const out=await putFile(c,JSON.stringify(normalized,null,2)+'\n',`Create Development Project ${id}`,'');
    const verify=await remoteFile(c,{requireSha:true});const verified=parseProject(verify.raw);
    if(!equalProject(verified,normalized))throw new Error('新規案件の保存後検証に失敗しました。');
    state.loaded.clear();state.dirty.clear();state.loaded.add(id);
    state.host.openGitProject(verified,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:verify.sha||out.file_sha});
    await syncIndexEntry(verified,c);
    return true;
  }catch(e){alert('新規案件を作成できませんでした: '+e.message);return false;}
  finally{state.busy=false;render();state.host?.refresh?.();}
}

async function deleteCurrentProjectCompletely(){
  const entry=currentEntry();if(!entry)return;
  const name=entry.name||entry.id;
  if(!confirm(`「${name}」を削除しますか？\nGit上の案件JSONも削除されます。`))return;
  const typed=prompt(`削除を確定するには案件名を入力してください。\n${name}`,'');if(typed!==name)return;
  try{
    state.busy=true;render();
    const c=connectionFor(entry.id,true),file=await remoteFile(c,{requireSha:true});
    if(file.exists)await deleteFile(c,file.sha,`Delete Development Project ${entry.id}`);
    let rows=await refreshProjectIndex({quiet:true,force:true});rows=rows.filter(x=>x.id!==entry.id);
    await writeIndex(rows,c);
    state.loaded.delete(entry.id);state.dirty.delete(entry.id);state.host.removeProjectMetadata(entry.id);
  }catch(e){alert('案件を削除できませんでした: '+e.message);}
  finally{state.busy=false;render();state.host?.refresh?.();}
}

async function testConnection(){
  try{const c=connectionFor('',false,{index:true});const res=await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`,{headers:headers(c.token),cache:'no-store'});if(!res.ok)return failure(res,'GitHub接続失敗');return true;}catch(e){alert(e.message);return false;}
}
function fillFromEntry(){render();}
function focus(){
  const gitNav=byId('nav-github');if(gitNav?.click)gitNav.click();
}
function init(host){
  if(!host||typeof host.normalizeProject!=='function'||typeof host.openGitProject!=='function'||typeof host.getActiveEntry!=='function')throw new Error('Development Git Store host API is invalid.');
  state.host=host;
  global.addEventListener('beforeunload',e=>{if(state.dirty.size){e.preventDefault();e.returnValue='';}});
  setTimeout(()=>refreshProjectIndex({quiet:true}),0);
  render();return api;
}

const api={init,render,focus,fillFromEntry,isLoaded,isDirty,isRegistryVerified,markDirty,markClean,discardCurrent,refreshProjectIndex,openFromGit,saveCurrent,reloadCurrent,createProject,deleteCurrentProjectCompletely,testConnection};
global.GKSDevelopmentGitStore=api;
})(window);
