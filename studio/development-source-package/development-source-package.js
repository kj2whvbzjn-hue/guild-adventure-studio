/**
 * Development Project -> validated full Source ZIP builder.
 * GKS-B688
 *
 * Import path only:
 * - Reads the currently served source package using package_manifest.json.
 * - Allows pre-existing manifest drift only under development-project-data/.
 * - Overlays imported Development Project JSON files.
 * - Rebuilds package_manifest.json from actual output bytes.
 * - Verifies the rebuilt manifest before downloading a full Source ZIP.
 *
 * This module does not write Git. Git persistence is owned by Development Git Store.
 */
(function(global){
'use strict';
const DATA_ROOT='development-project-data/';
const state={busy:false,last:null};
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
async function fetchBytes(path){
 const res=await fetch(sourceUrl(path),{cache:'no-store'});if(!res.ok)throw new Error(`Source file取得失敗: ${path} / HTTP ${res.status}`);return new Uint8Array(await res.arrayBuffer());
}
async function loadManifest(){
 const res=await fetch(sourceUrl('package_manifest.json'),{cache:'no-store'});if(!res.ok)throw new Error(`package_manifest.json取得失敗: HTTP ${res.status}`);
 let manifest;try{manifest=await res.json()}catch(_){throw new Error('package_manifest.jsonを解析できません。')}
 if(!manifest||!Array.isArray(manifest.files))throw new Error('package_manifest.json: files配列がありません。');
 return manifest;
}
async function mapLimit(rows,limit,worker){
 const result=new Array(rows.length);let next=0;
 async function run(){while(true){const i=next++;if(i>=rows.length)return;result[i]=await worker(rows[i],i)}}
 await Promise.all(Array.from({length:Math.max(1,Math.min(Number(limit)||1,rows.length||1))},run));return result;
}
function buildManifest(records){
 const files=[...records].sort((a,b)=>a.path.localeCompare(b.path)).map(x=>({path:x.path,size:x.bytes.length,sha256:x.sha256}));
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
  const base=await loadManifest(),baseByPath=new Map(base.files.map(x=>[String(x.path||''),x]));
  const paths=[...new Set([...base.files.map(x=>String(x.path||'')),...overlay.keys()])].filter(Boolean).sort();
  let loaded=0;const records=await mapLimit(paths,8,async path=>{
   const b=overlay.has(path)?overlay.get(path):await fetchBytes(path),hash=await sha256(b),expected=baseByPath.get(path);
   if(expected&&!path.startsWith(DATA_ROOT)){
    if(Number(expected.size)!==b.length||String(expected.sha256||'').toLowerCase()!==hash)throw new Error(`Source baseline不整合を検出しました。Development Project以外は自動正当化しません: ${path}`);
   }
   loaded++;if(loaded===paths.length||loaded%40===0)setStatus(`Source ZIP生成: ${loaded}/${paths.length} files`);
   return {path,bytes:b,sha256:hash};
  });
  const recordMap=new Map(records.map(x=>[x.path,x])),manifest=buildManifest(records),manifestBytes=utf8(JSON.stringify(manifest,null,2)+'\n');
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
