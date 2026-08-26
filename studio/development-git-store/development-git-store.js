/* Development Git Store — canonical Git I/O.
 * Git is the persistent authority.
 * Project list uses development-project-data/index.json (title + id only).
 * Project body is fetched only after the user confirms opening a title.
 * Development read operations resolve the repository default branch once at operation start.
 * New-project and JSON merge-save writes use the branch selected in the operation UI; write PAT comes from the operation UI.
 * Owner / Repository come from the Studio Git connection.
 * Concurrent updates are guarded by Git blob SHA; no Project revision is used.
 */
(function(global){
'use strict';

const DATA_ROOT='development-project-data/';
const INDEX_PATH=DATA_ROOT+'index.json';
const API_VERSION='2022-11-28';
const DEFAULT_CONNECTION=Object.freeze({owner:'kj2whvbzjn-hue',repo:'guild-adventure-studio'});
const WRITE_BRANCH_HINT='sub';
const state={host:null,loaded:new Set(),dirty:new Set(),busy:false,indexRows:[],indexRemote:null,indexRefreshAt:0,indexPromise:null,base:null};

const byId=id=>document.getElementById(id);
const text=v=>String(v??'').trim();
const safeId=v=>text(v).replace(/[^A-Za-z0-9._-]+/g,'_');
const canonicalPath=id=>`${DATA_ROOT}${safeId(id)}.json`;
const clone=value=>value==null?value:structuredClone(value);

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

function repositoryConnection(projectId='',{index=false,token=''}={}){
  const id=text(projectId),entry=id?state.host?.getRegistryEntry?.(id):null;
  const remote=entry?.git_remote||{};
  const owner=commonGitValue('ghOwner')||text(remote.owner)||DEFAULT_CONNECTION.owner;
  const repo=commonGitValue('ghRepo')||text(remote.repo)||DEFAULT_CONNECTION.repo;
  const selectedToken=text(token)||commonGitValue('ghToken');
  const path=index?INDEX_PATH:canonicalPath(id);
  if(!owner||!repo)throw new Error('StudioのGitHub接続先がありません。');
  if(!index&&!id)throw new Error('Project IDがありません。');
  return {owner,repo,path,token:selectedToken};
}
async function resolveRepositoryDefaultBranch(c){
  const url=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
  const res=await fetch(url,{headers:headers(c.token),cache:'no-store'});
  if(!res.ok)return failure(res,'GitHub repository取得失敗');
  const branch=text((await res.json())?.default_branch);
  if(!branch)throw new Error('GitHub repositoryのdefault branchを取得できません。');
  return branch;
}
async function operationConnection(projectId='',{index=false,token='',requireToken=false}={}){
  const base=repositoryConnection(projectId,{index,token});
  if(requireToken&&!base.token)throw new Error('PATを入力してください。');
  const branch=await resolveRepositoryDefaultBranch(base);
  return Object.freeze({...base,branch,path:index?INDEX_PATH:canonicalPath(projectId)});
}
function selectedWriteConnection(projectId='',{branch='',token='',requireToken=false}={}){
  const base=repositoryConnection(projectId,{token});
  if(requireToken&&!base.token)throw new Error('PATを入力してください。');
  const selectedBranch=text(branch);
  if(!selectedBranch)throw new Error('保存先Branchを入力してください。');
  return Object.freeze({...base,branch:selectedBranch,path:canonicalPath(projectId)});
}
function defaultWriteBranch(){return commonGitValue('ghBranch')||WRITE_BRANCH_HINT;}

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
  const entry=currentEntry(),dirty=!!entry&&state.dirty.has(entry.id);
  byId('developmentDirtyIndicator')?.classList.toggle('hidden',!dirty);
  const save=byId('devProjectSaveButton');if(save)save.disabled=state.busy||!dirty;
}
function isLoaded(id){return state.loaded.has(text(id));}
function isDirty(id){return state.dirty.has(text(id));}
function isRegistryVerified(){return true;}
function markDirty(id){const key=text(id);if(!key||!state.loaded.has(key))return;state.dirty.add(key);render();}
function markClean(id){state.dirty.delete(text(id));render();}
function discardCurrent(){const id=text(currentEntry()?.id);if(id){state.loaded.delete(id);state.dirty.delete(id);}state.base=null;render();}

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
async function readIndex(c){
  const ic={...c,path:INDEX_PATH};
  const file=await remoteFile(ic,{requireSha:true});
  if(!file.exists)return {rows:[],sha:'',connection:ic,exists:false};
  return {rows:normalizeIndex(JSON.parse(file.raw)),sha:file.sha,connection:ic,exists:true};
}
async function refreshProjectIndex({quiet=false,force=false}={}){
  const now=Date.now();
  if(!force&&state.indexPromise)return state.indexPromise;
  if(!force&&now-state.indexRefreshAt<5000)return state.indexRows;
  state.indexRefreshAt=now;
  state.indexPromise=(async()=>{
    try{
      const c=await operationConnection('',{index:true}),index=await readIndex(c);
      state.indexRows=index.rows;state.indexRemote={...index.connection,sha:index.sha};
      state.host?.replaceProjectIndex?.(index.rows,{owner:c.owner,repo:c.repo,branch:c.branch,path:INDEX_PATH,sha:index.sha});
      return state.indexRows;
    }catch(e){if(!quiet)alert('案件一覧をGitから取得できません: '+e.message);return state.indexRows;}
    finally{state.indexPromise=null;render();}
  })();
  return state.indexPromise;
}
async function writeIndexRows(c,rows,sha){
  const ic={...c,path:INDEX_PATH},normalized=normalizeIndex({projects:rows});
  const payload=JSON.stringify({schema_version:1,projects:normalized.map(x=>({id:x.id,title:x.title}))},null,2)+'\n';
  const out=await putFile(ic,payload,'Update Development Project index',sha||'');
  state.indexRows=normalized;state.indexRemote={...ic,sha:out.file_sha};
  state.host?.replaceProjectIndex?.(normalized,{owner:c.owner,repo:c.repo,branch:c.branch,path:INDEX_PATH,sha:out.file_sha});
  return out;
}
async function addIndexEntry(project,c){
  const id=text(project?.workspace?.id),title=text(project?.workspace?.name);
  const index=await readIndex(c),rows=index.rows.slice(),pos=rows.findIndex(x=>x.id===id);
  if(pos>=0)rows[pos]={id,title};else rows.push({id,title});
  return writeIndexRows(c,rows,index.sha);
}
async function removeIndexEntry(projectId,c){
  const index=await readIndex(c),rows=index.rows.filter(x=>x.id!==projectId);
  if(!index.exists)return true;
  await writeIndexRows(c,rows,index.sha);return true;
}

async function openFromGit(options={}){
  try{
    state.busy=true;render();
    const id=text(options.expectedProjectId);if(!id)throw new Error('Project IDがありません。');
    const c=await operationConnection(id),file=await remoteFile(c,{requireSha:true});
    if(!file.exists)throw new Error(`Gitに案件がありません: ${c.path}`);
    const project=parseProject(file.raw);
    if(text(project.workspace.id)!==id)throw new Error(`Project ID不一致: expected=${id} / actual=${project.workspace.id}`);
    if(text(project.authority.canonical_path)!==c.path)throw new Error('canonical_pathがGit Pathと一致しません。');
    state.loaded.clear();state.dirty.clear();state.loaded.add(id);
    state.base={id,branch:c.branch,sha:file.sha,project:clone(project)};
    state.host.openGitProject(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:file.sha});
    return true;
  }catch(e){alert('案件を開けませんでした: '+e.message);return false;}
  finally{state.busy=false;render();}
}

async function expectedShaForWrite(c,project,{forceRemoteCheck=false}={}){
  const base=state.base;
  if(!forceRemoteCheck&&base&&base.id===text(project?.workspace?.id)&&base.branch===c.branch&&base.sha)return base.sha;
  const file=await remoteFile(c,{requireSha:true});
  if(!file.exists)throw new Error(`Git repositoryの選択Branchに案件がありません: ${c.branch}`);
  const remote=parseProject(file.raw);assertSameProject(remote,project);
  if(base?.project&&base.branch===c.branch&&!equalProject(remote,base.project))throw new Error(`Git repositoryのBranch ${c.branch} 上の案件が、開いた時点の案件内容と一致しません。上書きしません。`);
  return file.sha;
}
async function saveProject(project,{branch,token,message='',selectedBranch=false,forceRemoteCheck=false}={}){
  const entry=currentEntry();
  if(!entry||!isLoaded(entry.id))throw new Error('案件を開いてください。');
  const local=state.host.normalizeProject(project),c=selectedBranch?selectedWriteConnection(entry.id,{branch,token,requireToken:true}):await operationConnection(entry.id,{token,requireToken:true});
  const expectedSha=await expectedShaForWrite(c,local,{forceRemoteCheck});
  local.workspace.updated_at=new Date().toISOString();
  const normalized=state.host.normalizeProject(local);
  const out=await putFile(c,JSON.stringify(normalized,null,2)+'\n',message||`Save Development Project ${entry.id}`,expectedSha);
  const newSha=out.file_sha||expectedSha;
  state.base={id:entry.id,branch:c.branch,sha:newSha,project:clone(normalized)};
  state.host.replaceGitWorkspace(normalized,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:newSha});
  markClean(entry.id);
  const status=byId('developmentStoreStatus');if(status)status.textContent=`Gitに保存しました / ${c.branch}`;
  return normalized;
}
async function saveCurrent(credentials={}){
  const entry=currentEntry();
  if(!entry||!isLoaded(entry.id))return alert('案件を開いてください。');
  if(!isDirty(entry.id))return true;
  try{state.busy=true;render();await saveProject(currentWorkspace(),credentials);return true;}
  catch(e){alert('保存できませんでした: '+e.message);return false;}
  finally{state.busy=false;render();state.host?.refresh?.();}
}
async function saveCandidate(project,credentials={}){
  try{state.busy=true;render();await saveProject(project,{...credentials,selectedBranch:true,forceRemoteCheck:true});return true;}
  catch(e){alert('保存できませんでした: '+e.message);return false;}
  finally{state.busy=false;render();state.host?.refresh?.();}
}

async function reloadCurrent(){
  const entry=currentEntry();if(!entry)return false;
  if(isDirty(entry.id)&&!confirm('未保存の変更を破棄してGitから読み直しますか？'))return false;
  return openFromGit({expectedProjectId:entry.id});
}

async function registerNewProject(project,{branch,token,messagePrefix='Create Development Project'}={}){
  const normalized=state.host.normalizeProject(project);
  const id=text(normalized?.workspace?.id),title=text(normalized?.workspace?.name);
  if(!id||!title)throw new Error('workspace.id / workspace.nameがありません。');
  const c=selectedWriteConnection(id,{branch,token,requireToken:true});
  if(text(normalized?.authority?.canonical_path)!==c.path)throw new Error(`authority.canonical_pathが正規Pathと一致しません: ${normalized?.authority?.canonical_path||'(missing)'}`);
  const out=await putFile(c,JSON.stringify(normalized,null,2)+'\n',`${messagePrefix} ${id}`,'');
  const newSha=out.file_sha;
  state.loaded.clear();state.dirty.clear();state.loaded.add(id);
  state.base={id,branch:c.branch,sha:newSha,project:clone(normalized)};
  state.host.openGitProject(normalized,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:newSha});
  try{await addIndexEntry(normalized,c);}
  catch(e){const err=new Error(`案件本文はGitへ保存されましたが案件一覧の更新に失敗しました。${e.message}`);err.partial=true;throw err;}
  return true;
}
async function createProject(title,credentials={}){
  try{state.busy=true;render();const id=state.host.nextProjectId();return await registerNewProject(state.host.createBlankProject(id,text(title)),credentials);}
  catch(e){alert((e.partial?'一部保存済み: ':'新規案件を作成できませんでした: ')+e.message);return false;}
  finally{state.busy=false;render();state.host?.refresh?.();}
}
async function importProjectFile(file,credentials={}){
  if(!file)return false;
  try{
    state.busy=true;render();
    const raw=JSON.parse(await file.text()),normalized=state.host.normalizeProject(raw);
    const id=text(normalized?.workspace?.id),title=text(normalized?.workspace?.name);
    if(!id||!title)throw new Error('workspace.id / workspace.nameがありません。');
    const ok=await registerNewProject(normalized,{...credentials,messagePrefix:'Import Development Project'});
    if(ok)alert(`新規案件として登録しました。\n${title}`);
    return ok;
  }catch(e){alert((e.partial?'一部保存済み: ':'新規案件JSONを登録できませんでした: ')+e.message);return false;}
  finally{state.busy=false;render();state.host?.refresh?.();}
}

async function deleteCurrentProjectCompletely(credentials={}){
  const entry=currentEntry();if(!entry)return false;
  try{
    state.busy=true;render();
    const c=await operationConnection(entry.id,{token:credentials.token,requireToken:true}),project=state.host.normalizeProject(currentWorkspace());
    const sha=await expectedShaForWrite(c,project);
    await deleteFile(c,sha,`Delete Development Project ${entry.id}`);
    try{await removeIndexEntry(entry.id,c);}
    catch(e){state.loaded.delete(entry.id);state.dirty.delete(entry.id);state.base=null;state.host.removeProjectMetadata(entry.id);const err=new Error(`案件本体はGitから削除されましたが案件一覧の更新に失敗しました。${e.message}`);err.partial=true;throw err;}
    state.loaded.delete(entry.id);state.dirty.delete(entry.id);state.base=null;state.host.removeProjectMetadata(entry.id);return true;
  }catch(e){alert((e.partial?'一部削除済み: ':'案件を削除できませんでした: ')+e.message);return false;}
  finally{state.busy=false;render();state.host?.refresh?.();}
}

async function testConnection(){
  try{await operationConnection('',{index:true});return true;}catch(e){alert(e.message);return false;}
}
function fillFromEntry(){render();}
function focus(){const gitNav=byId('nav-github');if(gitNav?.click)gitNav.click();}
function init(host){
  if(!host||typeof host.normalizeProject!=='function'||typeof host.openGitProject!=='function'||typeof host.getActiveEntry!=='function')throw new Error('Development Git Store host API is invalid.');
  state.host=host;
  global.addEventListener('beforeunload',e=>{if(state.dirty.size){e.preventDefault();e.returnValue='';}});
  setTimeout(()=>refreshProjectIndex({quiet:true}),0);
  render();return api;
}

const api={init,render,focus,fillFromEntry,isLoaded,isDirty,isRegistryVerified,markDirty,markClean,discardCurrent,refreshProjectIndex,openFromGit,saveCurrent,saveCandidate,reloadCurrent,createProject,importProjectFile,deleteCurrentProjectCompletely,testConnection,defaultWriteBranch};
global.GKSDevelopmentGitStore=api;
})(window);
