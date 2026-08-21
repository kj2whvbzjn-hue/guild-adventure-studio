/* GKS-B720 Development Git Store
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
const CONNECTION_SETTINGS_KEY='gks_development_git_connection_v1';
const state={host:null,loaded:new Set(),dirty:new Set(),busy:false,pathEditing:false,registryRefreshing:false,registryChecked:new Set(),registryVerified:new Set()};
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
function entryPath(entry){
 const registered=normalizePath(entry?.git_remote?.path||'');
 if(entry?.storage_mode==='git'&&registered.startsWith(DATA_ROOT)&&registered.endsWith('.json'))return registered;
 return defaultPathForProjectId(entry?.id||'');
}
function setPathEditing(){
 state.pathEditing=false;
 const input=byId('devGitPath'),button=byId('devGitPathEdit');
 if(input){input.readOnly=true;input.setAttribute('aria-readonly','true');}
 if(button)button.hidden=true;
}
function refreshPathFromEntry(entry,{force=false}={}){
 const input=byId('devGitPath');if(!input)return;
 const next=entryPath(entry);
 if(force||!state.pathEditing||!normalizePath(input.value))input.value=next;
 input.placeholder=defaultPathForProjectId(entry?.id||'DEV-PROJ-0001')||`${DATA_ROOT}DEV-PROJ-0001.json`;
}
function togglePathEditing(){refreshPathFromEntry(currentEntry(),{force:true});setPathEditing(false);}
function rememberedConnection(){
 try{const raw=JSON.parse(localStorage.getItem(CONNECTION_SETTINGS_KEY)||'{}');return {owner:text(raw.owner),repo:text(raw.repo),branch:text(raw.branch)||'main'};}catch(_){return {owner:'',repo:'',branch:'main'}}
}
function saveRememberedConnection(){
 const owner=text(byId('devGitOwner')?.value),repo=text(byId('devGitRepo')?.value),branch=text(byId('devGitBranch')?.value)||'main';
 try{localStorage.setItem(CONNECTION_SETTINGS_KEY,JSON.stringify({owner,repo,branch}));}catch(_){}
}
function loadRememberedConnection(){
 let saved=rememberedConnection();
 if(!saved.owner&&!saved.repo){
  try{const shared=JSON.parse(localStorage.getItem('gas_v4_github_settings_v050')||'{}');saved={owner:text(shared.owner),repo:text(shared.repo),branch:text(shared.branch)||'main'};}catch(_){}
 }
 if(saved.owner)byId('devGitOwner').value=saved.owner;if(saved.repo)byId('devGitRepo').value=saved.repo;if(saved.branch)byId('devGitBranch').value=saved.branch;
}
function connection(requireToken=false){
 const owner=text(byId('devGitOwner')?.value),repo=text(byId('devGitRepo')?.value),branch=text(byId('devGitBranch')?.value)||'main',path=normalizePath(byId('devGitPath')?.value),token=text(byId('devGitToken')?.value);
 saveRememberedConnection();
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
function responseRateLimit(res,body=''){
 const remaining=text(res.headers.get('x-ratelimit-remaining')),reset=text(res.headers.get('x-ratelimit-reset'));
 const limited=res.status===403&&(remaining==='0'||/rate limit/i.test(String(body||'')));
 return {limited,remaining,reset};
}
function rateLimitResetLabel(epoch){
 const n=Number(epoch);if(!Number.isFinite(n)||n<=0)return '';
 try{return new Date(n*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch(_){return ''}
}
async function githubFailure(res,label){
 const body=await res.text(),rate=responseRateLimit(res,body);
 if(rate.limited){const at=rateLimitResetLabel(rate.reset);throw new Error(`${label}: GitHub API rate limitに到達しました。${at?` ${at}頃まで待つか、`:''}PAT認証を確認してから再実行してください。
HTTP 403 / Registryは変更していません。`);}
 throw new Error(`${label}: HTTP ${res.status} ${body}`);
}
function responseBlobSha(res){
 const etag=text(res.headers.get('etag')).replace(/^W\//,'').replace(/^"|"$/g,'');
 return /^[0-9a-f]{40}$/i.test(etag)?etag:'';
}
async function remoteFile(c,{requireSha=false}={}){
 // GKS-B720: one authenticated raw Contents request is the normal read path.
 // The same response supplies Project JSON and, when GitHub exposes the blob ETag, the blob SHA.
 const res=await fetch(apiUrl(c,true),{headers:headers(c.token,'application/vnd.github.raw+json'),cache:'no-store'});
 if(res.status===404)return {exists:false,sha:'',size:0,raw:''};
 if(!res.ok)return await githubFailure(res,'GitHub JSON取得失敗');
 const raw=await res.text(),size=new TextEncoder().encode(raw).length;let sha=responseBlobSha(res);
 if(requireSha&&!sha){
  // Explicit save/conflict flows may require the Git blob SHA. Only then pay for one metadata call.
  const metaRes=await fetch(apiUrl(c,true),{headers:headers(c.token,'application/vnd.github.object+json'),cache:'no-store'});
  if(metaRes.status===404)return {exists:false,sha:'',size:0,raw:''};
  if(!metaRes.ok)return await githubFailure(metaRes,'GitHub metadata取得失敗');
  const obj=await metaRes.json();if(obj.type!=='file')throw new Error('指定Git Pathはfileではありません。');
  sha=text(obj.sha);return {exists:true,sha,size:Number(obj.size)||size,raw};
 }
 return {exists:true,sha,size,raw};
}
async function remoteMeta(c){const file=await remoteFile(c,{requireSha:true});return {exists:file.exists,sha:file.sha,size:file.size};}
async function remoteText(c){const file=await remoteFile(c);if(!file.exists)throw new Error('GitHub JSON取得失敗: 指定Git PathにJSONがありません。');return file.raw;}
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
async function duplicateProjectPaths(c,entries,jsonText){
 let projectId='';try{projectId=text(JSON.parse(jsonText)?.workspace?.id);}catch(_){}
 if(!projectId)return [];
 // A registered legacy path is authoritative for an existing Git project. Never delete a
 // canonical/sibling JSON while saving through that legacy path; doing so can discard a newer
 // copy created by an earlier path-mapping bug. Duplicate cleanup is allowed only when the
 // current save target is already the canonical path for this workspace.id.
 if(normalizePath(c.path)!==defaultPathForProjectId(projectId))return [];
 const candidates=entries.filter(x=>x.type==='blob'&&x.path.startsWith(DATA_ROOT)&&x.path.endsWith('.json')&&x.path!==c.path);
 const duplicates=[];
 for(const item of candidates){
  try{const raw=await gitBlobText(c,item.sha),obj=JSON.parse(raw);if(text(obj?.workspace?.id)===projectId)duplicates.push(item.path);}catch(_){}
 }
 return duplicates;
}
async function commitProjectOnly(c,jsonText,message,expectedProjectSha=''){
 const ref=await gitApi(c,`/git/ref/heads/${branchRefPath(c.branch)}`),headSha=text(ref?.object?.sha);if(!headSha)throw new Error(`Branch HEADを取得できません: ${c.branch}`);
 const commit=await gitApi(c,`/git/commits/${encodeURIComponent(headSha)}`),baseTree=text(commit?.tree?.sha);if(!baseTree)throw new Error('Branch HEADのTreeを取得できません。');
 const tree=await gitApi(c,`/git/trees/${encodeURIComponent(baseTree)}?recursive=1`),entries=Array.isArray(tree?.tree)?tree.tree:[];
 const projectEntry=entries.find(x=>x.type==='blob'&&x.path===c.path)||null;
 if(expectedProjectSha&&text(projectEntry?.sha)!==text(expectedProjectSha))throw new Error(`Remoteが読込後に更新されています。再読込してください。\nloaded=${expectedProjectSha}\nremote=${text(projectEntry?.sha)||'(missing)'}`);
 const duplicatePaths=await duplicateProjectPaths(c,entries,jsonText);
 const projectSha256=await sha256Text(jsonText),projectSize=new TextEncoder().encode(jsonText).length;
 const projectBlob=await gitApi(c,'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:utf8Base64(jsonText),encoding:'base64'})});
 const treeChanges=[{path:c.path,mode:'100644',type:'blob',sha:projectBlob.sha},...duplicatePaths.map(path=>({path,mode:'100644',type:'blob',sha:null}))];
 const newTree=await gitApi(c,'/git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:baseTree,tree:treeChanges})});
 const newCommit=await gitApi(c,'/git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text(message)||'Update Development Project',tree:newTree.sha,parents:[headSha]})});
 await gitApi(c,`/git/refs/heads/${branchRefPath(c.branch)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:newCommit.sha,force:false})});
 return {file_sha:text(projectBlob.sha),commit_sha:text(newCommit.sha),project_sha256:projectSha256,project_size:projectSize,removed_duplicate_paths:duplicatePaths};
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
 const r=entry?.git_remote||{},saved=rememberedConnection();
 byId('devGitOwner').value=r.owner||saved.owner||byId('devGitOwner').value||'';
 byId('devGitRepo').value=r.repo||saved.repo||byId('devGitRepo').value||'';
 byId('devGitBranch').value=r.branch||saved.branch||byId('devGitBranch').value||'main';
 refreshPathFromEntry(entry,{force:true});
 setPathEditing(false);saveRememberedConnection();
 render();
}
function currentEntry(){return state.host?.getActiveEntry?.()||null;}
function currentWorkspace(){return state.host?.getCurrentWorkspace?.()||null;}
async function fetchProjectAtPath(baseConnection,path){
 const c={...baseConnection,path:normalizePath(path)},file=await remoteFile(c,{requireSha:true});if(!file.exists)return {exists:false,c,meta:{exists:false,sha:'',size:0},project:null,id:''};
 const project=parseProject(file.raw),id=text(project?.workspace?.id),meta={exists:true,sha:file.sha,size:file.size};return {exists:true,c,meta,project,id};
}
function remoteRecord(c,meta){return {owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:text(meta?.sha)};}
async function repairRegistryMismatch(expectedProjectId,currentConnection,encounteredProject,encounteredMeta){
 const expected=text(expectedProjectId),actual=text(encounteredProject?.workspace?.id),canonical=defaultPathForProjectId(expected);
 if(!expected||!canonical)return {ok:false,reason:'EXPECTED_PROJECT_ID_MISSING'};
 // If the canonical path itself contains another workspace.id, Git data is ambiguous/corrupt.
 // Never rename or overwrite Git data automatically in that case.
 if(normalizePath(currentConnection.path)===canonical)return {ok:false,reason:'CANONICAL_PATH_ID_MISMATCH',actual_id:actual,path:canonical};
 const resolved=await fetchProjectAtPath(currentConnection,canonical);
 if(!resolved.exists)return {ok:false,reason:'CANONICAL_PROJECT_NOT_FOUND',actual_id:actual,path:canonical};
 if(resolved.id!==expected)return {ok:false,reason:'CANONICAL_PROJECT_ID_MISMATCH',actual_id:resolved.id,path:canonical};
 // The selected registry entry is proven stale: rebuild it from the canonical Git Project JSON.
 state.host?.syncGitRegistryProject?.(resolved.project,remoteRecord(resolved.c,resolved.meta),{upsert:true});
 state.registryVerified.add(expected);state.registryChecked.clear();
 // If the stale path is itself the canonical path of the encountered workspace, also rebuild
 // that project's registry entry from the same Git object. This separates e.g. 018 and 019.
 if(actual&&normalizePath(currentConnection.path)===defaultPathForProjectId(actual)){
  state.host?.syncGitRegistryProject?.(encounteredProject,remoteRecord(currentConnection,encounteredMeta),{upsert:true});
  state.registryVerified.add(actual);
 }
 return {ok:true,project:resolved.project,remote:remoteRecord(resolved.c,resolved.meta),repaired_path:canonical,actual_id:actual};
}
function render(){
 const entry=currentEntry(),mode=entry?.storage_mode==='git'?'Git':'ブラウザ',loaded=entry?state.loaded.has(entry.id):false,dirty=entry?state.dirty.has(entry.id):false;
 refreshPathFromEntry(entry);setPathEditing(state.pathEditing);
 const el=byId('devGitCurrent');if(el){
  if(!entry)el.textContent='現在案件なし';
  else el.innerHTML=`<b>${esc(entry.name||entry.id)}</b><br>ID: ${esc(entry.id)} / 保存方式: ${mode}${entry.storage_mode==='git'?` / Session読込: ${loaded?'済':'未'} / Git未保存: ${dirty?'あり':'なし'}`:''}`;
 }
 const save=byId('devGitSaveCurrent');if(save)save.disabled=state.busy||!entry||(entry.storage_mode==='git'&&!loaded);
 const reload=byId('devGitReloadCurrent');if(reload)reload.disabled=state.busy||!entry||entry.storage_mode!=='git';
}
function isLoaded(id){return state.loaded.has(String(id||''));}
function isDirty(id){return state.dirty.has(String(id||''));}
function isRegistryVerified(id){return state.registryVerified.has(String(id||''));}
function markDirty(id){const key=String(id||'');if(!key||!state.loaded.has(key))return;state.dirty.add(key);render();setStatus('現在案件にGit未保存の変更があります。','WARN');}
function markClean(id){state.dirty.delete(String(id||''));render();}
async function openFromGit(options={}){
 try{
  setBusy(true);const c=connection(false),expectedProjectId=text(options?.expectedProjectId);
  setStatus('GitHubからDevelopment Projectを取得しています…');const file=await remoteFile(c,{requireSha:true});if(!file.exists)throw new Error('指定Git PathにJSONがありません。');
  const meta={exists:true,sha:file.sha,size:file.size},project=parseProject(file.raw),id=text(project?.workspace?.id);if(!id)throw new Error('workspace.idがありません。');
  if(expectedProjectId&&id!==expectedProjectId){
   state.registryVerified.delete(expectedProjectId);
   const repaired=await repairRegistryMismatch(expectedProjectId,c,project,meta);
   if(repaired.ok){
    const repairedId=text(repaired.project?.workspace?.id);state.loaded.add(repairedId);state.dirty.delete(repairedId);state.registryVerified.add(repairedId);
    state.host.openGitProject(repaired.project,repaired.remote);fillFromEntry(state.host.getActiveEntry());
    setStatus(`Git案件Registryを自動修復してSessionへ読込: ${repairedId}\n修復Path ${repaired.repaired_path}\nRemote SHA ${repaired.remote.sha}`,'OK');return true;
   }
   state.host?.markGitRegistryMismatch?.(expectedProjectId,{actual_id:id,path:c.path,sha:meta.sha,reason:repaired.reason});
   throw new Error(`選択案件とGit JSONのworkspace.idが一致しません。\n選択案件: ${expectedProjectId}\nGit JSON: ${id}\nGit Path: ${c.path}\n標準Path: ${defaultPathForProjectId(expectedProjectId)}\n復旧結果: ${repaired.reason}\n\n標準Pathとworkspace.idを照合できないため案件は切り替えていません。`);
  }
  const current=currentEntry();if(current&&current.id!==id&&isDirty(current.id)&&!confirm(`現在のGit案件 ${current.id} にGit未保存の変更があります。\n破棄して ${id} を開きますか？`))return false;
  state.loaded.add(id);state.dirty.delete(id);state.registryVerified.add(id);state.host.openGitProject(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:meta.sha});fillFromEntry(state.host.getActiveEntry());setStatus(`Git案件をSessionへ読込: ${id}\nRemote SHA ${meta.sha}`,'OK');return true;
 }catch(e){setStatus('読込失敗: '+e.message,'ERROR');return false;}
 finally{setBusy(false);render();}
}
async function refreshRegistry(entries=[]){
 // GKS-B720: project-list rendering must not fan out GitHub API requests.
 // Git registry is a cache and remains unverified until an explicit Open / Remote reload / save flow.
 // This prevents one list render from consuming one or more API calls per project and triggering
 // shared-IP unauthenticated rate limits. Unverified Git projects are excluded from in-progress lists.
 return false;
}

async function uploadFile(file){
 if(!file)return;
 try{setBusy(true);const raw=await file.text(),project=parseProject(raw),id=text(project?.workspace?.id);if(!id)throw new Error('workspace.idがありません。');if(!state.pathEditing||!normalizePath(byId('devGitPath')?.value))byId('devGitPath').value=defaultPathForProjectId(id);const c=connection(true);
 const meta=await remoteMeta(c);if(meta.exists&&!confirm(`Remoteに既存JSONがあります。\n${c.path}\nSHA ${meta.sha}\n\n新しいCommitで更新しますか？`)){setStatus('Git保存をキャンセルしました。');return;}
 const current=currentEntry();if(current&&current.id!==id&&isDirty(current.id)&&!confirm(`現在のGit案件 ${current.id} にGit未保存の変更があります。\n破棄して ${id} を開きますか？`))return;setStatus('Project JSONをGit保存しています…');const out=await commitProjectOnly(c,JSON.stringify(project,null,2)+'\n',`Store Development Project ${id}`,meta.sha);
 state.loaded.add(id);state.dirty.delete(id);state.registryVerified.add(id);state.host.openGitProject(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:out.file_sha});fillFromEntry(state.host.getActiveEntry());setStatus(`Git保存・案件読込完了: ${id}\nProject data commit ${out.commit_sha}${out.removed_duplicate_paths?.length?`\n同一workspace.idの旧Git JSONを整理: ${out.removed_duplicate_paths.join(', ')}`:''}\npackage_manifestは変更しません。Source ZIPは出力していません。`,'OK');}
 catch(e){setStatus('Git保存失敗: '+e.message,'ERROR');}
 finally{byId('devGitFile').value='';setBusy(false);render();}
}
async function saveCurrent(){
 try{
  setBusy(true);
  const entry=currentEntry();if(!entry)throw new Error('現在案件を開いてください。');
  const wasGit=entry.storage_mode==='git';
  if(wasGit&&!isLoaded(entry.id))throw new Error('Git案件をSessionへ読み込んでください。');
  const ws=currentWorkspace();if(!ws)throw new Error('現在案件データを取得できません。');
  fillFromEntry(entry);const c=connection(true),remote=entry.git_remote||{};
  if(wasGit){
   if(c.owner!==remote.owner||c.repo!==remote.repo||c.branch!==remote.branch||c.path!==remote.path)throw new Error('現在案件の登録済みGit接続先と入力欄が一致しません。接続先変更はJSONファイル→Git保存から新しい案件として行ってください。');
   setStatus('現在案件をGit保存しています…');
   const out=await commitProjectOnly(c,JSON.stringify(ws,null,2)+'\n',`Update Development Project ${entry.id}`,text(remote.sha));
   state.host.updateGitRemote(entry.id,{...remote,sha:out.file_sha});markClean(entry.id);
   setStatus(`Git保存完了\nProject data commit ${out.commit_sha}${out.removed_duplicate_paths?.length?`\n同一workspace.idの旧Git JSONを整理: ${out.removed_duplicate_paths.join(', ')}`:''}\npackage_manifestは変更しません。Source ZIPは出力していません。`,'OK');
   return;
  }
  const meta=await remoteMeta(c);
  if(meta.exists)throw new Error(`指定Git Pathには既にファイルがあります。既存案件を上書きせず「Gitから案件を開く」で読み込んでください。\n${c.path}\nSHA ${meta.sha}`);
  setStatus('現在案件をGitへ新規保存しています…');
  const out=await commitProjectOnly(c,JSON.stringify(ws,null,2)+'\n',`Store Development Project ${entry.id}`,'');
  state.loaded.add(entry.id);state.dirty.delete(entry.id);state.registryVerified.add(entry.id);
  state.host.openGitProject(ws,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:out.file_sha});
  fillFromEntry(state.host.getActiveEntry());
  setStatus(`Git新規保存完了: ${entry.id}\nProject data commit ${out.commit_sha}${out.removed_duplicate_paths?.length?`\n同一workspace.idの旧Git JSONを整理: ${out.removed_duplicate_paths.join(', ')}`:''}\npackage_manifestは変更しません。Source ZIPは出力していません。`,'OK');
 }
 catch(e){setStatus('Git保存失敗: '+e.message,'ERROR');}
 finally{setBusy(false);render();}
}
async function reloadCurrent(){
 try{setBusy(true);const entry=currentEntry();if(!entry||entry.storage_mode!=='git')throw new Error('Git案件を選択してください。');if(isDirty(entry.id)&&!confirm('現在案件にGit未保存の変更があります。Remote内容で破棄して再読込しますか？'))return;fillFromEntry(entry);const c=connection(false);setStatus('Remoteから現在案件を再読込しています…');const file=await remoteFile(c,{requireSha:true});if(!file.exists)throw new Error('Remote JSONがありません。');const meta={exists:true,sha:file.sha,size:file.size},project=parseProject(file.raw),actualId=text(project?.workspace?.id);
  if(actualId!==entry.id){
   state.registryVerified.delete(entry.id);const repaired=await repairRegistryMismatch(entry.id,c,project,meta);
   if(!repaired.ok){state.host?.markGitRegistryMismatch?.(entry.id,{actual_id:actualId,path:c.path,sha:meta.sha,reason:repaired.reason});throw new Error(`workspace.idが一致しません: ${actualId} / 標準Path復旧失敗: ${repaired.reason}`);}
   state.loaded.add(entry.id);state.dirty.delete(entry.id);state.registryVerified.add(entry.id);state.host.replaceGitWorkspace(repaired.project,repaired.remote);fillFromEntry(state.host.getActiveEntry());setStatus(`Registry自動修復・再読込完了\n修復Path ${repaired.repaired_path}\nRemote SHA ${repaired.remote.sha}`,'OK');return;
  }
  state.loaded.add(entry.id);state.dirty.delete(entry.id);state.registryVerified.add(entry.id);state.host.replaceGitWorkspace(project,{owner:c.owner,repo:c.repo,branch:c.branch,path:c.path,sha:meta.sha});setStatus(`再読込完了\nRemote SHA ${meta.sha}`,'OK');}
 catch(e){setStatus('再読込失敗: '+e.message,'ERROR');}
 finally{setBusy(false);render();}
}
async function testConnection(){
 try{setBusy(true);const c=connection(false);setStatus('接続確認中…');const file=await remoteFile(c);setStatus(file.exists?`接続OK / fileあり${file.sha?` / SHA ${file.sha}`:''}`:'接続OK / fileなし（新規保存可能）','OK');}
 catch(e){setStatus('接続失敗: '+e.message,'ERROR');}
 finally{setBusy(false);render();}
}
function init(host){
 if(!host||typeof host.normalizeProject!=='function'||typeof host.openGitProject!=='function'||typeof host.getActiveEntry!=='function')throw new Error('Development Git Store host API is invalid.');
 state.host=host;loadRememberedConnection();
 byId('devGitFile')?.addEventListener('change',e=>uploadFile(e.target.files?.[0]));
 ['devGitOwner','devGitRepo','devGitBranch'].forEach(id=>{byId(id)?.addEventListener('change',saveRememberedConnection);byId(id)?.addEventListener('blur',saveRememberedConnection);});
 global.addEventListener('beforeunload',e=>{if(state.dirty.size){e.preventDefault();e.returnValue='';}});
 refreshPathFromEntry(currentEntry(),{force:true});setPathEditing(false);render();return api;
}
function focus(){const entry=currentEntry();fillFromEntry(entry);const card=byId('developmentGitStoreCard');card?.scrollIntoView({behavior:'smooth',block:'start'});byId('devGitOwner')?.focus();}
const api={init,render,focus,fillFromEntry,togglePathEditing,defaultPathForProjectId,isLoaded,isDirty,isRegistryVerified,markDirty,markClean,openFromGit,refreshRegistry,saveCurrent,reloadCurrent,testConnection};
global.GKSDevelopmentGitStore=api;
})(window);
