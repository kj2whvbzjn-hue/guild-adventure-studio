const CACHE_NAME="gks-studio-b814";
const CACHE_PREFIX="gks-studio-";
const OFFLINE_URL='./index.html?appv=814';
const APP_SHELL=[
  "./",
  "./index.html?appv=814",
  "./manifest.webmanifest?v=583",
  "./icon-192.png?v=550",
  "./icon-512.png?v=550",
  "../assets/shared/config/skill-registry.json",
  "../assets/shared/config/skill-budget-rules.json",
  "../assets/shared/config/skill-ai-generation-rules.json",
  "./ai-production/ai-production.css?v=1",
  "./development-architecture/architecture-explorer.css?v=1",
  "./development-workspace-ui.css?v=3",
  "./development-workflow/development-workflow.css?v=1",
  "./development-ai-publish/development-ai-publish.css?v=1",
  "./development-git-store/development-git-store.css?v=1",
  "./development-spec-candidate/development-spec-candidate.css?v=2",
  "./development-system-structure/development-system-structure.css?v=1",
  "./development-system-state/development-system-state.css?v=1",
  "./development-system-impact/development-system-impact.css?v=1",
  "./development-architecture/architecture-explorer.js?v=1",
  "./development-workflow/development-workflow.js?v=1",
  "./development-ai-publish/development-ai-publish.js?v=8",
  "./development-git-store/development-git-store.js?v=8",
  "./development-system-impact/development-system-impact.js?v=1",
  "./development-system-state/development-system-state.js?v=2",
  "./development-spec-candidate/development-spec-candidate.js?v=3",
  "./development-system-structure/development-system-structure.js?v=2",
  "../shared/ai/ai-program-model.js?v=1",
  "../shared/ai/ai-layout-model.js?v=1",
  "../shared/ai/ai-master-adapter.js?v=1",
  "../shared/ai/ai-connection-resolver.js?v=1",
  "../shared/ai/ai-program-validator.js?v=1",
  "../shared/ai/ai-program-compiler.js?v=1",
  "../shared/ai/ai-program-trace.js?v=1",
  "../shared/ai/ai-decision-engine.js?v=1",
  "./ai-production/ai-program-store.js?v=1",
  "./ai-production/ai-program-editor.js?v=1",
  "./ai-production/ai-battle-adapter.js?v=1",
  "./ai-production/ai-simulation-runner.js?v=1",
  "./ai-production/ai-export-adapter.js?v=1",
  "./ai-production/ai-production-ui.js?v=1",
  "./layer-controller.js?v=814",
  "./data-exchange/schemas/ai_program-dataset.schema.json",
  "./data-exchange/full-import-gate.js?v=1",
  "./data-exchange/data-exchange-integrity-validator.js?v=4",
  "./data-exchange/data-exchange-core.js?v=18",
  "./data-exchange/data-exchange-transaction.js?v=3",
  "./data-exchange/data-exchange-audit.js?v=5",
  "./data-exchange/data-exchange-ui.js?v=24",
  "../assets/shared/js/adventure-story-system.js?v=11",
  "./adventure-entity-json-import.js?v=583"
];

async function precacheFreshAppShell(){
  const cache=await caches.open(CACHE_NAME);
  for(const entry of APP_SHELL){
    const url=new URL(entry,self.location.href).href;
    const request=new Request(url,{method:'GET',cache:'no-store'});
    const response=await fetch(request,{cache:'no-store'});
    if(!response || !response.ok){
      throw new Error(`Studio precache failed: ${entry}`);
    }
    await cache.put(request,response.clone());
  }
}

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(precacheFreshAppShell());
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data && event.data.type==='SKIP_WAITING'){
    self.skipWaiting();
  }
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response && response.ok){
      const cache=await caches.open(CACHE_NAME);
      await cache.put(request,response.clone());
    }
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate'){
      return caches.match(OFFLINE_URL);
    }
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  if(url.origin===self.location.origin){
    // Studio code/data freshness is never keyed to hand-maintained ?v= values.
    // Online: fetch the current file. Offline/network failure: use the last proven cache.
    event.respondWith(networkFirst(request));
  }
});
