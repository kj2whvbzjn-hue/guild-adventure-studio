(function(){
'use strict';

const GATEWAY_VERSION='1.0.0';
const MANIFEST_URL='./ai-gateway-manifest.json';
const FALLBACK_SEMANTIC_ENTRYPOINT='AI_START.md';
const FALLBACK_OPERATING_POLICY='shared/integrity/ai-operating-policy.json';
const FALLBACK_MACHINE_PRELOAD=['package-build.json',FALLBACK_OPERATING_POLICY];
let manifestCache=null;
let sourceIndexCache=null;

function clone(value){return JSON.parse(JSON.stringify(value));}
function count(value){return Array.isArray(value)?value.length:0;}
function timestamp(){return new Date().toISOString();}
function normalizePath(path){
  const value=String(path||'').replace(/\\/g,'/').replace(/^\.\//,'');
  if(!value||value.startsWith('/')||value.includes('../'))throw new Error('Invalid AI Gateway path.');
  return value;
}

async function loadManifest(){
  if(manifestCache)return manifestCache;
  const response=await fetch(MANIFEST_URL,{cache:'no-store'});
  if(!response.ok)throw new Error('AI Gateway manifest could not be loaded: '+response.status);
  manifestCache=await response.json();
  return manifestCache;
}

function currentProject(){
  if(typeof window.data==='undefined')throw new Error('GK Studio project data is not initialized.');
  return clone(window.data);
}

function validationResult(){
  if(typeof window.runValidation==='function')window.runValidation();
  const rows=Array.isArray(window.validation)?window.validation:[];
  const normalize=(entry)=>({
    level:String(entry.level||entry.severity||entry.type||'error').toLowerCase(),
    code:entry.code||'',
    target:entry.target||entry.id||entry.path||'',
    message:entry.message||String(entry)
  });
  const items=rows.map(normalize);
  return {
    valid:!items.some(item=>item.level==='error'),
    errorCount:items.filter(item=>item.level==='error').length,
    warningCount:items.filter(item=>item.level==='warning'||item.level==='warn').length,
    items
  };
}

function projectSummary(project){
  const masters=project.masters||{};
  return {
    chapters:count(project.chapters),
    sections:(project.chapters||[]).reduce((n,c)=>n+count(c.sections),0),
    scenes:(project.chapters||[]).reduce((n,c)=>n+(c.sections||[]).reduce((m,s)=>m+count(s.scenes),0),0),
    characters:count(project.characters),
    quests:count(project.quests),
    events:count(project.events),
    flags:count(project.flags),
    decisions:count(project.decisions),
    entities:count(project.entities),
    masterRecords:Object.values(masters).reduce((n,rows)=>n+count(rows),0)
  };
}

async function loadGovernance(){
  const manifest=await loadManifest();
  const semanticEntrypoint=String(manifest.aiSemanticEntrypoint||FALLBACK_SEMANTIC_ENTRYPOINT);
  const operatingPolicyFile=String(manifest.operatingPolicyFile||FALLBACK_OPERATING_POLICY);
  const machinePreload=Array.isArray(manifest.gatewayMachinePreloadFiles)?manifest.gatewayMachinePreloadFiles:FALLBACK_MACHINE_PRELOAD;
  const required=[semanticEntrypoint,...machinePreload];
  for(const path of required){
    if(!manifest.allowedFiles.includes(path))throw new Error('Governance file is not allowlisted: '+path);
  }
  const entrypoint=await getFile(semanticEntrypoint);
  if(!entrypoint.content.trim())throw new Error('AI semantic entrypoint is empty: '+semanticEntrypoint);
  const preloadFiles=[];
  const preloadJson={};
  for(const path of machinePreload){
    const item=await getFile(path);
    if(!item.content.trim())throw new Error('Machine preload file is empty: '+path);
    preloadFiles.push(item);
    if(path.endsWith('.json')){
      try{preloadJson[path]=JSON.parse(item.content);}catch(error){throw new Error('Machine preload JSON is invalid: '+path+' ('+error.message+')');}
    }
  }
  const policy=preloadJson[operatingPolicyFile];
  if(!policy||policy.authority?.normative!==true)throw new Error('Canonical AI operating policy is unavailable or non-normative: '+operatingPolicyFile);
  if(policy.authority?.canonical_source!==operatingPolicyFile)throw new Error('Canonical AI operating policy path mismatch.');
  if(policy.authority?.fail_closed_when_unavailable!==true)throw new Error('Canonical AI operating policy must fail closed.');
  return {
    status:'required',
    loaded:true,
    semanticEntrypoint,
    machinePreloadFiles:clone(machinePreload),
    conditionalFiles:Array.isArray(manifest.conditionalGovernanceFiles)?clone(manifest.conditionalGovernanceFiles):[],
    conditionalMachinePolicyFiles:Array.isArray(manifest.conditionalMachinePolicyFiles)?clone(manifest.conditionalMachinePolicyFiles):[],
    files:[entrypoint,...preloadFiles],
    policySource:operatingPolicyFile,
    policy:clone(policy),
    artifactSubmission:clone(policy.artifact_submission||{}),
    acknowledgementRequired:true,
    operatingContract:{
      authority:clone(policy.authority||{}),
      startup:clone(policy.startup||{}),
      workModes:clone(policy.work_modes||{}),
      workTypes:clone(policy.work_types||{}),
      deletion:clone(policy.deletion||{}),
      testAndGateIntegrity:clone(policy.test_and_gate_integrity||{}),
      completion:clone(policy.completion||{})
    }
  };
}

async function buildContext(profile){
  const manifest=await loadManifest();
  const project=currentProject();
  const selectedProfile=String(profile||'standard');
  const context={
    schemaVersion:'1.1.0',
    gatewayVersion:GATEWAY_VERSION,
    generatedAt:timestamp(),
    build:manifest.build,
    phase:manifest.mode,
    profile:selectedProfile,
    authority:{humanApprovalRequired:true,aiMayApprove:false},
    project:{
      metadata:clone(project.project||{}),
      schemaVersion:project.schema_version||'',
      summary:projectSummary(project)
    },
    validation:validationResult(),
    availableRoutes:clone(manifest.routes),
    availableFiles:clone(manifest.allowedFiles),
    capabilities:clone(manifest.capabilities||[]),
    governance:await loadGovernance()
  };
  if(selectedProfile==='minimal'){
    delete context.availableFiles;
    context.validation={valid:context.validation.valid,errorCount:context.validation.errorCount,warningCount:context.validation.warningCount};
  }else if(selectedProfile==='development'){
    context.sourceIndex=await buildSourceIndex();
  }
  return context;
}

async function getFile(path){
  const manifest=await loadManifest();
  const normalized=normalizePath(path);
  if(!manifest.allowedFiles.includes(normalized))throw new Error('File is not permitted by AI Gateway: '+normalized);
  const response=await fetch('./'+normalized,{cache:'no-store'});
  if(!response.ok)throw new Error('File could not be loaded: '+normalized+' ('+response.status+')');
  const content=await response.text();
  return {path:normalized,bytes:new Blob([content]).size,content};
}


async function getFileRange(path,start,end){
  const item=await getFile(path);
  const lines=item.content.split(/\r?\n/);
  const from=Math.max(1,Number(start)||1);
  const to=Math.min(lines.length,Math.max(from,Number(end)||from+199));
  if(to-from>499)throw new Error('AI Gateway line range is limited to 500 lines.');
  return {path:item.path,start:from,end:to,totalLines:lines.length,content:lines.slice(from-1,to).join('\n')};
}

function classify(path){
  if(path.endsWith('.php'))return 'source';
  if(path.endsWith('.json'))return 'data';
  if(path.endsWith('.md')||path.endsWith('.txt'))return 'document';
  return 'other';
}

async function buildSourceIndex(force){
  if(sourceIndexCache&&!force)return clone(sourceIndexCache);
  const manifest=await loadManifest();
  const files=[];
  for(const path of manifest.allowedFiles){
    try{
      const item=await getFile(path);
      files.push({path:item.path,type:classify(item.path),bytes:item.bytes,lines:item.content.split(/\r?\n/).length});
    }catch(error){
      files.push({path,type:classify(path),error:error.message});
    }
  }
  sourceIndexCache={generatedAt:timestamp(),total:files.length,files};
  return clone(sourceIndexCache);
}

async function searchFiles(query,limit){
  const term=String(query||'').trim().toLowerCase();
  if(!term)throw new Error('Search query is required.');
  const max=Math.max(1,Math.min(Number(limit)||20,100));
  const manifest=await loadManifest();
  const results=[];
  for(const path of manifest.allowedFiles){
    if(results.length>=max)break;
    try{
      const item=await getFile(path);
      const lower=item.content.toLowerCase();
      const pathMatch=path.toLowerCase().includes(term);
      const position=lower.indexOf(term);
      if(pathMatch||position>=0){
        const start=Math.max(0,position-120);
        const end=position<0?0:Math.min(item.content.length,position+term.length+240);
        results.push({path,type:classify(path),pathMatch,excerpt:position<0?'':item.content.slice(start,end)});
      }
    }catch(_error){}
  }
  return {query:String(query),limit:max,count:results.length,results};
}

async function getHandover(){
  const manifest=await loadManifest();
  const preferred=manifest.handoverFiles||['README.md','studio-update.json','package-build.json'];
  const files=[];
  for(const path of preferred){
    if(manifest.allowedFiles.includes(path))files.push(await getFile(path));
  }
  return {generatedAt:timestamp(),build:manifest.build,files};
}



function bridgeSettings(){
  return {
    baseUrl:localStorage.getItem('gk.aiGateway.baseUrl')||'http://127.0.0.1:8765',
    token:localStorage.getItem('gk.aiGateway.token')||''
  };
}
function saveBridgeSettings(baseUrl,token){
  const clean=String(baseUrl||'').replace(/\/$/,'');
  localStorage.setItem('gk.aiGateway.baseUrl',clean);
  localStorage.setItem('gk.aiGateway.token',String(token||''));
  return {baseUrl:clean,token:String(token||'')};
}
async function bridgeRequest(path,options){
  const settings=bridgeSettings();
  if(!settings.token)throw new Error('AI Gateway接続トークンが未設定です。');
  const response=await fetch(settings.baseUrl+path,Object.assign({
    cache:'no-store',
    headers:{'Authorization':'Bearer '+settings.token,'Content-Type':'application/json'}
  },options||{}));
  const text=await response.text();
  let payload;try{payload=JSON.parse(text);}catch(_e){payload={error:text||('HTTP '+response.status)};}
  if(!response.ok)throw new Error(payload.error||('HTTP '+response.status));
  return payload;
}
async function bridgeHealth(){return bridgeRequest('/ai/health');}
async function syncBridgeSnapshot(){
  const context=await buildContext('development');
  return bridgeRequest('/bridge/snapshot',{method:'POST',body:JSON.stringify(context)});
}

async function request(route){
  const url=new URL(route,'https://gk-studio.local');
  switch(url.pathname){
    case '/ai/context':return buildContext(url.searchParams.get('profile')||'standard');
    case '/ai/project':return currentProject();
    case '/ai/validation':return validationResult();
    case '/ai/handover':return getHandover();
    case '/ai/manifest':return loadManifest();
    case '/ai/files':return buildSourceIndex(url.searchParams.get('refresh')==='1');
    case '/ai/search':return searchFiles(url.searchParams.get('q')||'',url.searchParams.get('limit'));
    case '/ai/file':return getFile(url.searchParams.get('path')||'');
    case '/ai/file-range':return getFileRange(url.searchParams.get('path')||'',url.searchParams.get('start'),url.searchParams.get('end'));
    case '/ai/status':return {ok:true,gatewayVersion:GATEWAY_VERSION,build:(await loadManifest()).build,mode:'read-only',snapshot:'browser-live'};
    default:throw new Error('Unknown AI Gateway route: '+url.pathname);
  }
}

function downloadText(name,text,type){
  const blob=new Blob([text],{type:type||'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function exportContext(){
  const context=await buildContext('development');
  downloadText('GKStudio_AI_Context_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',JSON.stringify(context,null,2));
  return context;
}

async function exportBundle(){
  if(typeof window.JSZip==='undefined')throw new Error('JSZip is not available.');
  const manifest=await loadManifest();
  const zip=new window.JSZip();
  zip.file('ai-context.json',JSON.stringify(await buildContext('development'),null,2));
  zip.file('source-index.json',JSON.stringify(await buildSourceIndex(),null,2));
  zip.file('project.json',JSON.stringify(currentProject(),null,2));
  zip.file('validation.json',JSON.stringify(validationResult(),null,2));
  zip.file('ai-gateway-manifest.json',JSON.stringify(manifest,null,2));
  const handover=zip.folder('handover');
  for(const item of (await getHandover()).files)handover.file(item.path,item.content);
  const governance=zip.folder('governance');
  for(const item of (await loadGovernance()).files)governance.file(item.path,item.content);
  const source=zip.folder('source');
  const failures=[];
  for(const path of manifest.allowedFiles){
    try{const item=await getFile(path);source.file(path,item.content);}catch(error){failures.push({path,error:error.message});}
  }
  zip.file('fetch-errors.json',JSON.stringify(failures,null,2));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='GKStudio_AI_Gateway_Bundle_'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return {files:manifest.allowedFiles.length,failures};
}

async function renderPanel(){
  const status=document.getElementById('aiGatewayStatus');
  const output=document.getElementById('aiGatewayOutput');
  if(!status||!output)return;
  try{
    const context=await buildContext('standard');
    status.textContent='稼働中 / Gateway v'+GATEWAY_VERSION+' / '+context.build+' / 許可ファイル '+context.availableFiles.length+'件';
    output.textContent=JSON.stringify(context,null,2);
  }catch(error){status.textContent='エラー';output.textContent=error.stack||error.message;}
}

window.GKStudioAIGateway={version:GATEWAY_VERSION,request,buildContext,loadGovernance,getFile,getFileRange,getHandover,buildSourceIndex,searchFiles,exportContext,exportBundle,renderPanel,bridgeSettings,saveBridgeSettings,bridgeRequest,bridgeHealth,syncBridgeSnapshot};
window.aiGatewayRefresh=renderPanel;
window.aiGatewayExportContext=async()=>{try{await exportContext();}catch(e){alert(e.message);}};
window.aiGatewayExportBundle=async()=>{try{const r=await exportBundle();alert('AI取得用パッケージを出力しました。取得失敗: '+r.failures.length+'件');}catch(e){alert(e.message);}};
window.aiGatewaySearch=async()=>{
  const input=document.getElementById('aiGatewaySearchInput');
  const output=document.getElementById('aiGatewayOutput');
  try{output.textContent=JSON.stringify(await searchFiles(input?input.value:'',20),null,2);}catch(e){alert(e.message);}
};

window.aiGatewayBridgeSave=()=>{
  const base=document.getElementById('aiGatewayBridgeUrl');
  const token=document.getElementById('aiGatewayBridgeToken');
  saveBridgeSettings(base?base.value:'',token?token.value:'');
  alert('接続設定を保存しました。トークンはこのブラウザ内にのみ保存されます。');
};
window.aiGatewayBridgeHealth=async()=>{
  const output=document.getElementById('aiGatewayBridgeOutput');
  try{const r=await bridgeHealth();if(output)output.textContent=JSON.stringify(r,null,2);}catch(e){if(output)output.textContent=e.message;}
};
window.aiGatewayBridgeSync=async()=>{
  const output=document.getElementById('aiGatewayBridgeOutput');
  try{const r=await syncBridgeSnapshot();if(output)output.textContent=JSON.stringify(r,null,2);}catch(e){if(output)output.textContent=e.message;}
};
window.addEventListener('load',()=>{
  renderPanel();
  const settings=bridgeSettings();
  const base=document.getElementById('aiGatewayBridgeUrl');
  const token=document.getElementById('aiGatewayBridgeToken');
  if(base)base.value=settings.baseUrl;
  if(token)token.value=settings.token;
});
})();
