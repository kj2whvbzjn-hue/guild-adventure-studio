const CACHE_NAME="gks-studio-b579";
const CACHE_PREFIX="gks-studio-";
const OFFLINE_URL='./index.html?appv=579';
const APP_SHELL=[
  "./",
  "./index.html?appv=579",
  "./manifest.webmanifest?v=579",
  "./icon-192.png?v=550",
  "./icon-512.png?v=550",
  "../assets/shared/config/skill-registry.json",
  "../assets/shared/config/skill-budget-rules.json",
  "../assets/shared/config/skill-ai-generation-rules.json",
  "./ai-production/ai-production.css?v=1",
  "./ai-production/ai-program-model.js?v=1",
  "./ai-production/ai-program-store.js?v=1",
  "./ai-production/ai-program-editor.js?v=1",
  "./ai-production/ai-master-adapter.js?v=2",
  "./ai-production/ai-program-validator.js?v=1",
  "./ai-production/ai-program-compiler.js?v=1",
  "./ai-production/ai-program-trace.js?v=1",
  "./ai-production/ai-decision-engine.js?v=1",
  "./ai-production/ai-battle-adapter.js?v=1",
  "./ai-production/ai-simulation-runner.js?v=1",
  "./ai-production/ai-export-adapter.js?v=1",
  "./ai-production/ai-production-ui.js?v=1",
  "./data-exchange/schemas/ai_program-dataset.schema.json",
  "../assets/shared/js/adventure-story-system.js?v=10",
  "./adventure-entity-json-import.js?v=579"
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL))
  );
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
      cache.put(request,response.clone());
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

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request,{cache:'no-cache'});
  if(response && response.ok){
    const cache=await caches.open(CACHE_NAME);
    cache.put(request,response.clone());
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);

  if(
    request.mode==='navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.endsWith('/manifest.webmanifest')
  ){
    event.respondWith(networkFirst(request));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(cacheFirst(request));
  }
});
