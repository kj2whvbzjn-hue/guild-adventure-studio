/* GKS-B704 Development Git Store
 * Development Project data I/O only.
 * - Does not call Studio's existing GitHub sync / Development AI publish modules.
 * - Does not persist Project JSON or PAT in browser storage.
 * - Writes only under development-project-data/ in the selected repository.
 * - Development Project data is intentionally outside package_manifest.json so data-only saves cannot invalidate the source-code gate.
 */
(function(global){
'use strict';
const DATA_ROOT='development-project-data/';
const API_VERSION='2022-11-28';
const state={host:null,loaded:new Set(),dirty:new Set(),busy:false,pathEditing:false};
const byId=id=>document.getElementById(id);
const text=v=>String(v??'').trim();
const safeId=v=>text(v).replace(/[^A-Za-z0-9._-]+/g,'_')||'development-project';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setStatus(message,kind=''){
 const el=byId('devGitStatus');if(!el)return;
 el.className='dev-git-status'+(kind?` is-${kind.toLowerCase()}`:'');
 el.textContent=message;
}
function setBusy(flag){state.busy=!!flag;document.querySelectorAll('[data-dev-git-busy]').forEach(el=>{el.disabled=state.busy});}
function normalizePath(value){return text(value).replace(/^\/+/, '').replace(/\/{2,}/g,'/');}
function defaultPathForProjectId(id){const key=safeId(id);return key?`${DATA_ROOT}${key}.json`:'';}
function entryPath(entry){const saved=normalizePath(entry?.git_remote?.path||'');return saved||defaultPathForProjectId(entry?.id||'');}
function setPathEditing(flag){
 state.pathEditing=!!flag;
 const input=byId('devGitPath'),button=byId('devGitPathEdit');
 if(input){input.readOnly=!state.pathEditing;input.setAttribute('aria-readonly',state.pathEditing?'false':'true');}
 if(button)button.textContent=state.pathEditing?'Path編集を終了':'Git Pathを編集';
}
function refreshPathFromEntry(entry,{force=false}={}){
 const input=byId('devGitPath');if(!input)return;
 const next=entryPath(entry);
 if(force||!state.pathEditing||!normalizePath(input.value))input.value=next;
 input.placeholder=defaultPathForProjectId(entry?.id||'DEV-PROJ-0001')||`${DATA_ROOT}DEV-PROJ-0001.json`;
}
function togglePathEditing(){
 const entry=currentEntry();
 if(state.pathEditing){
  const value=normalizePath(byId('devGitPath')?.value);
  if(!value)refreshPathFromEntry(entry,{force:true});
  else if(!value.startsWith(DATA_ROOT)){alert(`Git Pathは ${DATA_ROOT} 配下にしてください。`);return;}
  setPathEditing(false);
 }else{
  refreshPathFromEntry(entry,{force:true});setPathEditing(true);byId('devGitPath')?.focus();byId('devGitPath')?.select();
 }
}
function connection(requireToken=false){
 const owner=text(byId('devGitOwner')?.value),repo=text(byId('devGitRepo')?.value),branch=text(byId('devGitBranch')?.value)||'main',path=normalizePath(byId('devGitPath')?.value),token=text(byId('devGitToken')?.value);
 if(!owner||!repo||!branch)throw new Error('Owner / Repository / Branchを入力してください。');
 if(!path)throw new Error('Git Pathを入力してください。');
 if(!path.startsWith(DATA_ROOT))throw new Error(`Development Git Storeの入出力先は ${DATA_ROOT} 配下だけです。`);
 if(path.endsWith('/'))throw new Error('Git PathはJSONファイルまで指定してください。');
 if(requireToken&&!token)throw new Error('GitHub PATを入力してください。');
 return {owner,repo,branch,path,token};
}
function headers(token,accept='application/vnd.github+json'){
 const h={'Accept':accept,'X-GitHub-Api-Version':API_VERSION};if(token)h.Authorization=`Bearer ${token}`;return h;
}
function apiUrl(c,withRef=true){
 const p=c.path.split('/').map(encodeURIComponent).join('/');
 const base=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${p}`;
 return withRef?`${base}?ref=${encodeURIComponent(c.branch)}`:base;
}
async function remoteMeta(c){
 const res=await fetch(apiUrl(c,true),{headers:headers(c.token,'application/vnd.github.object+json'),cache:'no-store'});
 if(res.status===404)return {exists:false,sha:'',size:0};
 if(!res.ok)throw new Error(`GitHub metadata取得失敗: HTTP ${res.status} ${await res.text()}`);
 const obj=await res.json();if(obj.type!=='file')throw new Error('指定Git Pathはfileではありません。');
 return {exists:true,sha:text(obj.sha),size:Number(obj.size)||0};
}
async function remoteText(c){
 const res=await fetch(apiUrl(c,true),{headers:headers(c.token,'application/vnd.github.raw+json'),cache:'no-store'});
 if(!res.ok)throw new Error(`GitHub JSON取得失敗: HTTP ${res.status} ${await res.text()}`);
 return await res.text();
}
function utf8Base64(value){
 const bytes=new TextEncoder().encode(String(value));let binary='';const step=0x8000;
 for(let i=0;i<bytes.length;i+=step)binary+=String.fromCharCode(...bytes.subarray(i,i+step));
 return btoa(binary);
}
function base64Utf8(value){
 const binary=atob(String(value||'').replace(/\s+/g,'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder('utf-8',{fatal:false}).decode(bytes);
}
async function sha256Text(value){const bytes=new TextEncoder().encode(String(value??'')),hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}
function repoApi(c,path=''){return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`}
function branchRefPath(branch){return String(branch||'main').split('/').map(encodeURIComponent).join('/')}
async function gitApi(c,path,options={}){
 const res=await fetch(repoApi(c,path),{...options,headers:{...headers(c.token),...(options.headers||{})}});
 if(!res.ok)throw new Error(`GitHub Git API失敗: ${options.method||'GET'} ${path} / HTTP ${res.status} ${await res.text()}`);
 return res.status===204?null:await res.json();
}
async function gitBlobText(c,sha){
 const blob=await gitApi(c,`/git/blobs/${encodeURIComponent(sha)}`);if(blob?.encoding!=='base64')throw new Error('GitHub blobがbase64ではありません。');return base64Utf8(blob.content||'');
}
async function commitProjectOnly(c,jsonText,message,expectedProjectSha=''){
 const ref=await gitApi(c,`/git/ref/heads/${branchRefPath(c.branch)}`),headSha=text(ref?.object?.sha);if(!headSha)throw new Error(`Branch HEADを取得できません: ${c.branch}`);
 const commit=await gitApi(c,`/git/commits/${encodeURIComponent(headSha)}`),baseTree=text(commit?.tree?.sha);if(!baseTree)throw new Error('Branch HEADのTreeを取得できません。');
 const tree=await gitApi(c,`/git/trees/${encodeURIComponent(baseTree)}?recursive=1`),entries=Array.isArray(tree?.tree)?tree.tree:[];
 const projectEntry=entries.find(x=>x.type==='blob'&&x.path===c.path)||null;
 if(expectedProjectSha&&text(projectEntry?.sha)!==text(expectedProjectSha))throw new Error(`Remoteが読込後に更新されています。再読込してください。\nloaded=${expectedProjectSha}\nremote=${text(projectEntry?.sha)||'(missing)'}`);
 const projectSha256=await sha256Text(jsonText),projectSize=new TextEncoder().encode(jsonText).length;
 const projectBlob=await gitApi(c,'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:utf8Base64(jsonText),encoding:'base64'})});
 const newTree=await gitApi(c,'/git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:baseTree,tree:[{path:c.path,mode:'100644',type:'blob',sha:projectBlob.sha}]})});
 const newCommit=await gitApi(c,'/git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text(message)||'Update Development Project',tree:newTree.sha,parents:[headSha]})});
 await gitApi(c,`/git/refs/heads/${branchRefPath(c.branch)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:newCommit.sha,force:false})});
 return {file_sha:text(projectBlob.sha),commit_sha:text(newCommit.sha),project_sha256:projectSha256,project_size:projectSize};
}
async function commitJson(c,jsonText,message,expectedSha=''){
 const latest=await remoteMeta(c);
 if(expectedSha&&latest.exists&&latest.sha!==expectedSha)throw new Error(`Remoteが読込後に更新されています。再読込してください。\nloaded=${expectedSha}\nremote=${latest.sha}`);
 const body={message:text(message)||'Update Development Project',content:utf8Base64(jsonText),branch:c.branch};
 if(latest.exists)body.sha=latest.sha;
 const res=await fetch(apiUrl(c,false),{method:'PUT',headers:{...headers(c.token),'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!res.ok)throw new Error(`GitHub Commit失敗: HTTP ${res.status} ${await res.text()}`);
 const out=await res.json();return {file_sha:text(out?.content?.sha),commit_sha:text(out?.commit?.sha)};
}
function parseProject(raw){
 const obj=JSON.parse(raw);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('Development Project JSON objectではありません。');
 return state.host.normalizeProject(obj);
}
function fillFromEntry(entry){
 const r=entry?.git_remote||{};
 if(r.owner)byId('devGitOwner').value=r.owner;
 if(r.repo)byId('devGitRepo').value=r.repo;
 if(r.branch)byId('devGitBranch').value=r.branch;
 refreshPathFromEntry(entry,{force:true});
 setPathEditing(false);
 render();
}
function currentEntry(){return state.host?.getActiveEntry?.()||null;}
function currentWorkspace(){return state.host?.getCurrentWorkspace?.()||null;}
function render(){
 const entry=currentEntry(),mode=entry?.storage_mode==='git'?'Git':'ブラウザ',loaded=entry?state.loaded.has(entry.id):false,dirty=entry?state.dirty.has(entry.id):false;
 refreshPathFromEntry(entry);setPathEditing(state.pathEditing);
 const el=byId('devGitCurrent');if(el){
  if(!entry)el.textContent='現在案件なし';
  else el.innerHTML=`<b>${esc(entry.name||entry.id)}</b><br>ID: ${esc(entry.id)} / 保存方式: ${mode}${entry.storage_mode==='git'?` / Session読込: ${loaded?'済':'未'} / Git未保存: ${dirty?'あり':'なし'}`:''}`;
 }
 const save=byId('devGitSaveCurrent');if(save)save.disabled=state.busy||!entry||entry.storage_mode!=='git'||!loaded;
 const reload=byId('devGitReloadCurrent');if(reload)reload.disabled=state.busy||!entry||entry.storage_mode!=='git';
}
function isLoaded(id){return state.loaded.has(String(id||''));}
function isDirty(id){return state.dirty.has(String(id||''));}
function markDirty(id){const key=String(id||'');if(!key||!state.loaded.has(key))return;state.dirty.add(key);render();setStatus('現在案件にGit未保存の変更があります。','WARN');}
function markClean(id){state.dirty.delete(String(id||''));render();}
async function openFromGit(){
 try{setBusy(true);const c=connection(false);setStatus('GitHubからDevelopment Projectを取得しています…');const meta=await remoteMeta(c);if(!meta.exists)throw new Error('指定Git PathにJSONがありません。');const raw=await remoteText(c),project=parseProject(raw);const id=text(project?.workspace?.id);if(!id)throw new Error('workspace.idがありません。');const current=currentEntry();if(current&&current.id!==id&&isDirty(current.id)&&!confirm(`現在のGit案件 ${current.id} にGit未保存の変更があります。\n破棄して ${id} を開きますか？`))return;state.loaded.add(id);state.dirty.delete(id);state.host.openGitProject(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:meta.sha});fillFromEntry(state.host.getActiveEntry());setStatus(`Git案件をSessionへ読込: ${id}\nRemote SHA ${meta.sha}`,'OK');return true;}
 catch(e){setStatus('読込失敗: '+e.message,'ERROR');return false;}
 finally{setBusy(false);render();}
}
async function uploadFile(file){
 if(!file)return;
 try{setBusy(true);const raw=await file.text(),project=parseProject(raw),id=text(project?.workspace?.id);if(!id)throw new Error('workspace.idがありません。');if(!state.pathEditing||!normalizePath(byId('devGitPath')?.value))byId('devGitPath').value=defaultPathForProjectId(id);const c=connection(true);
 const meta=await remoteMeta(c);if(meta.exists&&!confirm(`Remoteに既存JSONがあります。\n${c.path}\nSHA ${meta.sha}\n\n新しいCommitで更新しますか？`)){setStatus('Git保存をキャンセルしました。');return;}
 const current=currentEntry();if(current&&current.id!==id&&isDirty(current.id)&&!confirm(`現在のGit案件 ${current.id} にGit未保存の変更があります。\n破棄して ${id} を開きますか？`))return;setStatus('Project JSONをGit保存しています…');const out=await commitProjectOnly(c,JSON.stringify(project,null,2)+'\n',`Store Development Project ${id}`,meta.sha);
 state.loaded.add(id);state.dirty.delete(id);state.host.openGitProject(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:out.file_sha});fillFromEntry(state.host.getActiveEntry());setStatus(`Git保存・案件読込完了: ${id}\nProject data commit ${out.commit_sha}\npackage_manifestは変更しません。Source ZIPは出力していません。`,'OK');}
 catch(e){setStatus('Git保存失敗: '+e.message,'ERROR');}
 finally{byId('devGitFile').value='';setBusy(false);render();}
}
async function saveCurrent(){
 try{setBusy(true);const entry=currentEntry();if(!entry||entry.storage_mode!=='git'||!isLoaded(entry.id))throw new Error('Sessionへ読み込まれたGit案件を開いてください。');const ws=currentWorkspace();if(!ws)throw new Error('現在案件データを取得できません。');fillFromEntry(entry);const c=connection(true),remote=entry.git_remote||{};
 if(c.owner!==remote.owner||c.repo!==remote.repo||c.branch!==remote.branch||c.path!==remote.path)throw new Error('現在案件の登録済みGit接続先と入力欄が一致しません。接続先変更はJSONファイル→Git保存から新しい案件として行ってください。');
 setStatus('現在案件をGit保存しています…');const out=await commitProjectOnly(c,JSON.stringify(ws,null,2)+'\n',`Update Development Project ${entry.id}`,text(remote.sha));state.host.updateGitRemote(entry.id,{...remote,sha:out.file_sha});markClean(entry.id);setStatus(`Git保存完了\nProject data commit ${out.commit_sha}\npackage_manifestは変更しません。Source ZIPは出力していません。`,'OK');}
 catch(e){setStatus('Git保存失敗: '+e.message,'ERROR');}
 finally{setBusy(false);render();}
}
async function reloadCurrent(){
 try{setBusy(true);const entry=currentEntry();if(!entry||entry.storage_mode!=='git')throw new Error('Git案件を選択してください。');if(isDirty(entry.id)&&!confirm('現在案件にGit未保存の変更があります。Remote内容で破棄して再読込しますか？'))return;fillFromEntry(entry);const c=connection(false);setStatus('Remoteから現在案件を再読込しています…');const meta=await remoteMeta(c);if(!meta.exists)throw new Error('Remote JSONがありません。');const raw=await remoteText(c),project=parseProject(raw);if(text(project?.workspace?.id)!==entry.id)throw new Error(`workspace.idが一致しません: ${project?.workspace?.id}`);state.loaded.add(entry.id);state.dirty.delete(entry.id);state.host.replaceGitWorkspace(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:meta.sha});setStatus(`再読込完了\nRemote SHA ${meta.sha}`,'OK');}
 catch(e){setStatus('再読込失敗: '+e.message,'ERROR');}
 finally{setBusy(false);render();}
}
async function testConnection(){
 try{setBusy(true);const c=connection(false);setStatus('接続確認中…');const meta=await remoteMeta(c);setStatus(meta.exists?`接続OK / fileあり / SHA ${meta.sha}`:'接続OK / fileなし（新規保存可能）','OK');}
 catch(e){setStatus('接続失敗: '+e.message,'ERROR');}
 finally{setBusy(false);render();}
}
function init(host){
 if(!host||typeof host.normalizeProject!=='function'||typeof host.openGitProject!=='function'||typeof host.getActiveEntry!=='function')throw new Error('Development Git Store host API is invalid.');
 state.host=host;
 byId('devGitFile')?.addEventListener('change',e=>uploadFile(e.target.files?.[0]));
 global.addEventListener('beforeunload',e=>{if(state.dirty.size){e.preventDefault();e.returnValue='';}});
 refreshPathFromEntry(currentEntry(),{force:true});setPathEditing(false);render();return api;
}
function focus(){const entry=currentEntry();fillFromEntry(entry);const card=byId('developmentGitStoreCard');card?.scrollIntoView({behavior:'smooth',block:'start'});byId('devGitOwner')?.focus();}
const api={init,render,focus,fillFromEntry,togglePathEditing,defaultPathForProjectId,isLoaded,isDirty,markDirty,markClean,openFromGit,saveCurrent,reloadCurrent,testConnection};
global.GKSDevelopmentGitStore=api;
})(window);
