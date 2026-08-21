/**
 * Development Project -> validated full Source ZIP builder.
 * GKS-B702
 *
 * Import path only:
 * - Reads the currently served source package using package_manifest.json.
 * - Development Project JSON is packaged, but intentionally excluded from package_manifest.json.
 * - Overlays imported Development Project JSON files.
 * - Rebuilds package_manifest.json only for source-integrity files.
 * - Verifies the rebuilt manifest before downloading a full Source ZIP.
 *
 * This module does not write Git. Git persistence is owned by Development Git Store.
 */
(function(global){
'use strict';
const DATA_ROOT='development-project-data/';
const FALLBACK_URL='./development-source-package/source-fallback-files.json';
const POLICY_PATH='shared/integrity/system-file-policy.json';
const state={busy:false,last:null,fallback:null,policy:null};
function text(v){return String(v??'').trim()}
function safeId(v){return text(v).replace(/[^A-Za-z0-9._-]+/g,'_')||'PROJECT'}
function sourceRoot(){return new URL('../',document.baseURI||location.href)}
function sourceUrl(path){const encoded=String(path||'').split('/').map(encodeURIComponent).join('/');return new URL(encoded,sourceRoot()).toString()}
function setStatus(message,kind=''){
 const el=document.getElementById('developmentSourcePackageStatus');if(!el)return;
 el.className='small dev-data-gateway-status'+(kind?` is-${kind.toLowerCase()}`:'');el.textContent=String(message||'');
}
function bytes(value){return value instanceof Uint8Array?value:new Uint8Array(value||0)}
function utf8(value){return new TextEncoder().encode(String(value??''))}
function decode(value){return new TextDecoder('utf-8',{fatal:false}).decode(bytes(value))}
async function sha256(value){const b=bytes(value);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')}
function projectPath(item){
 const explicit=text(item?.entry?.git_remote?.path||item?.path);
 if(explicit&&explicit.startsWith(DATA_ROOT)&&!explicit.endsWith('/'))return explicit.replace(/^\/+/, '');
 const id=text(item?.project?.workspace?.id||item?.entry?.id);if(!id)throw new Error('Source ZIPへ格納するDevelopment Project IDがありません。');
 return `${DATA_ROOT}${safeId(id)}.json`;
}
function normalizeProjects(items){
 const out=[],seen=new Set();
 for(const item of Array.isArray(items)?items:[]){
  const project=item?.project;if(!project||typeof project!=='object'||Array.isArray(project))continue;
  const path=projectPath(item);if(seen.has(path))throw new Error(`Source ZIP内のDevelopment Project Pathが重複しています: ${path}`);seen.add(path);
  out.push({path,project,entry:item.entry||null});
 }
 if(!out.length)throw new Error('Source ZIPへ反映するDevelopment Projectがありません。');
 return out;
}
function base64Bytes(value){
 const binary=atob(String(value||'').replace(/\s+/g,'')),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
}
async function loadFallbackFiles(){
 if(state.fallback)return state.fallback;
 const res=await fetch(new URL(FALLBACK_URL,document.baseURI||location.href).toString(),{cache:'no-store'});
 if(!res.ok)throw new Error(`Source fallback取得失敗: HTTP ${res.status}`);
 let obj;try{obj=await res.json()}catch(_){throw new Error('Source fallback JSONを解析できません。')}
 if(!obj||typeof obj.files!=='object'||Array.isArray(obj.files))throw new Error('Source fallback: files objectがありません。');
 state.fallback=obj.files;return state.fallback;
}
async function fallbackBytes(path,expected=null){
 const files=await loadFallbackFiles(),row=files?.[path];if(!row)throw new Error(`Source file取得失敗: ${path} / 公開URL 404 / source bundleなし`);
 if(String(row.encoding||'')!=='base64')throw new Error(`Source fallback encoding未対応: ${path}`);
 const b=base64Bytes(row.content||''),hash=await sha256(b);
 if(Number(row.size)!==b.length||String(row.sha256||'').toLowerCase()!==hash)throw new Error(`Source fallback自身の整合性エラー: ${path}`);
 if(expected&&(Number(expected.size)!==b.length||String(expected.sha256||'').toLowerCase()!==hash))throw new Error(`Source fallbackとpackage_manifestが不一致: ${path}`);
 return b;
}
async function fetchBytes(path,expected=null,fallbackRow=null){
 const res=await fetch(sourceUrl(path),{cache:'no-store'});
 if(res.ok){
  const b=new Uint8Array(await res.arrayBuffer()),hash=await sha256(b);
  if(fallbackRow&&(Number(fallbackRow.size)!==b.length||String(fallbackRow.sha256||'').toLowerCase()!==hash))throw new Error(`公開Sourceとsource bundleが不一致: ${path}`);
  return b;
 }
 if(res.status===404)return await fallbackBytes(path,expected);
 throw new Error(`Source file取得失敗: ${path} / HTTP ${res.status}`);
}
async function loadManifest(){
 const res=await fetch(sourceUrl('package_manifest.json'),{cache:'no-store'});if(!res.ok)throw new Error(`package_manifest.json取得失敗: HTTP ${res.status}`);
 let manifest;try{manifest=await res.json()}catch(_){throw new Error('package_manifest.jsonを解析できません。')}
 if(!manifest||!Array.isArray(manifest.files))throw new Error('package_manifest.json: files配列がありません。');
 return manifest;
}
function normalizePolicyPath(value){return String(value||'').replace(/^\/+/, '').replace(/\/{2,}/g,'/')}
function policyGlobMatch(path,pattern){
 const p=normalizePolicyPath(path);
 const escaped=String(pattern||'').replace(/[.+^${}()|[\]\\]/g,'\\$&')
  .replace(/\*\*/g,'§§DOUBLESTAR§§').replace(/\*/g,'[^/]*').replace(/§§DOUBLESTAR§§/g,'.*').replace(/\?/g,'.');
 return new RegExp('^'+escaped+'$').test(p);
}
function classifySourcePath(path,policy){
 const rel=normalizePolicyPath(path),fallback=policy?.default_class||'persistent';
 for(const [name,rule] of Object.entries(policy?.classes||{})){
  if(name===fallback)continue;
  if((rule.exact_paths||[]).map(normalizePolicyPath).includes(rel))return name;
  if((rule.patterns||[]).some(pattern=>policyGlobMatch(rel,pattern)))return name;
 }
 return fallback;
}
async function loadSystemFilePolicy(){
 if(state.policy)return state.policy;
 const res=await fetch(sourceUrl(POLICY_PATH),{cache:'no-store'});if(!res.ok)throw new Error(`system-file-policy取得失敗: HTTP ${res.status}`);
 let policy;try{policy=await res.json()}catch(_){throw new Error('system-file-policy.jsonを解析できません。')}
 if(!policy||typeof policy!=='object')throw new Error('system-file-policy.jsonが不正です。');
 state.policy=policy;return policy;
}
async function mapLimit(rows,limit,worker){
 const result=new Array(rows.length);let next=0;
 async function run(){while(true){const i=next++;if(i>=rows.length)return;result[i]=await worker(rows[i],i)}}
 await Promise.all(Array.from({length:Math.max(1,Math.min(Number(limit)||1,rows.length||1))},run));return result;
}
function buildManifest(records,policy){
 const files=[...records].filter(x=>classifySourcePath(x.path,policy)==='persistent').sort((a,b)=>a.path.localeCompare(b.path)).map(x=>({path:x.path,size:x.bytes.length,sha256:x.sha256}));
 return {schema_version:1,generated_at:new Date().toISOString(),file_count:files.length,files};
}
async function verifyManifest(manifest,recordMap){
 if(Number(manifest.file_count)!==manifest.files.length)throw new Error('生成package_manifest.jsonのfile_countが一致しません。');
 for(const item of manifest.files){
  const rec=recordMap.get(item.path);if(!rec)throw new Error(`生成Manifest対象がSource ZIPにありません: ${item.path}`);
  if(rec.bytes.length!==Number(item.size))throw new Error(`生成Manifest size不一致: ${item.path}`);
  const actual=await sha256(rec.bytes);if(actual!==String(item.sha256||'').toLowerCase())throw new Error(`生成Manifest SHA-256不一致: ${item.path}`);
 }
 return true;
}
async function build(items,options={}){
 if(state.busy)throw new Error('Source ZIP生成中です。');
 if(typeof JSZip==='undefined')throw new Error('ZIP生成ライブラリを読み込めません。');
 state.busy=true;
 try{
  const projects=normalizeProjects(items),overlay=new Map(projects.map(x=>[x.path,utf8(JSON.stringify(x.project,null,2)+'\n')]));
  setStatus('Source ZIP生成: package_manifestを読み込んでいます…');
  const base=await loadManifest(),policy=await loadSystemFilePolicy(),baseByPath=new Map(base.files.map(x=>[String(x.path||''),x])),fallbackFiles=await loadFallbackFiles();
  const baselinePaths=new Set(base.files.map(x=>String(x.path||'')).filter(Boolean));
  const paths=[...new Set([...baselinePaths,...overlay.keys(),...Object.keys(fallbackFiles||{})])].filter(Boolean).sort();
  let loaded=0;const records=await mapLimit(paths,8,async path=>{
   const expected=baseByPath.get(path),fallbackRow=fallbackFiles?.[path]||null,b=overlay.has(path)?overlay.get(path):await fetchBytes(path,expected,fallbackRow),hash=await sha256(b);
   if(expected&&!path.startsWith(DATA_ROOT)){
    if(Number(expected.size)!==b.length||String(expected.sha256||'').toLowerCase()!==hash)throw new Error(`Source baseline不整合を検出しました。Development Project以外は自動正当化しません: ${path}`);
   }
   loaded++;if(loaded===paths.length||loaded%40===0)setStatus(`Source ZIP生成: ${loaded}/${paths.length} files`);
   return {path,bytes:b,sha256:hash};
  });
  const recordMap=new Map(records.map(x=>[x.path,x])),manifest=buildManifest(records,policy),manifestBytes=utf8(JSON.stringify(manifest,null,2)+'\n');
  await verifyManifest(manifest,recordMap);
  const zip=new JSZip(),rootName=text(options.rootName)||'guild-adventure-studio-sub';
  for(const rec of records)zip.file(`${rootName}/${rec.path}`,rec.bytes);
  zip.file(`${rootName}/package_manifest.json`,manifestBytes);
  setStatus(`Source ZIP生成: 圧縮中 ${records.length+1} files…`);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  let buildId='SOURCE';try{const buildRecord=recordMap.get('package-build.json');if(buildRecord)buildId=text(JSON.parse(decode(buildRecord.bytes))?.studio_build)||buildId}catch(_){}
  const fileName=`guild-adventure-studio-sub_${safeId(buildId)}_${stamp}.zip`;
  if(options.download!==false){
   if(global.GKZipCore?.download?.blob)global.GKZipCore.download.blob(blob,fileName,3000);
   else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
  }
  state.last={fileName,manifest,project_paths:[...overlay.keys()],file_count:records.length+1,blob};
  setStatus(`Source ZIP生成完了: ${fileName} / package_manifest再生成済み / ${records.length+1} files`,'OK');
  return state.last;
 }finally{state.busy=false}
}
async function afterImport(items,options={}){
 try{return await build(items,options)}catch(error){setStatus(`JSON取込は完了しましたがSource ZIP生成に失敗: ${error.message}`,'ERROR');throw error}
}
const api={build,afterImport,projectPath,get last(){return state.last},get busy(){return state.busy}};
global.GKSDevelopmentSourcePackage=api;
})(window);
