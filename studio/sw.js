const CACHE_NAME="gks-studio-b527";
const CACHE_PREFIX="gks-studio-";
const OFFLINE_URL='./index.html?appv=527';
const APP_SHELL=[
  "./",
  "./index.html?appv=527",
  "./manifest.webmanifest?v=527",
  "./icon-192.png?v=485",
  "./icon-512.png?v=485",
  "./ai-production/ai-production.css?v=1",
  "./ai-production/ai-program-model.js?v=1",
  "./ai-production/ai-program-store.js?v=1",
  "./ai-production/ai-program-editor.js?v=1",
  "./ai-production/ai-master-adapter.js?v=1",
  "./ai-production/ai-program-validator.js?v=1",
  "./ai-production/ai-program-compiler.js?v=1",
  "./ai-production/ai-program-trace.js?v=1",
  "./ai-production/ai-decision-engine.js?v=1",
  "./ai-production/ai-battle-adapter.js?v=1",
  "./ai-production/ai-simulation-runner.js?v=1",
  "./ai-production/ai-export-adapter.js?v=1",
  "./ai-production/ai-production-ui.js?v=1",
  "./data-exchange/data-exchange-integrity-validator.js?v=3",
  "./data-exchange/data-exchange-core.js?v=14",
  "./data-exchange/data-exchange-transaction.js?v=3",
  "./data-exchange/data-exchange-audit.js?v=5",
  "./data-exchange/data-exchange-ui.js?v=22",
  "./data-exchange/dataset-registry.json",
  "./data-exchange/schemas/ai_program-dataset.schema.json"
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
