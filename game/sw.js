const CACHE_NAME="ga-game-b486120";
const CACHE_PREFIX="ga-game-";
const OFFLINE_URL='./index.html?appv=486120';
const APP_SHELL=[
  "./",
  "./index.html?appv=486120",
  "./manifest.webmanifest?v=486120",
  "./icon-192.png?v=486120",
  "./icon-512.png?v=486120",
  "../Export/skill/skills.json?v=486120"
,
  "../assets/shared/config/runtime-config.js?v=486120",
  "../assets/shared/js/game-shell-common.js?v=486120",
  "../assets/shared/js/apply-lifecycle-engine.js?v=486120",
  "../assets/shared/js/trigger-engine.js?v=486120",
  "../assets/shared/js/condition-engine.js?v=486120",
  "../assets/shared/js/generic-skill-compiler.js?v=486120",
  "../assets/shared/js/generic-skill-bridge.js?v=486120",
  "../assets/shared/js/device-test-harness.js?v=486120",
  "../assets/shared/config/skill-generic-registry.json?v=486120"
,
  "./assets/js/app-runtime.js?v=486120"
,
  "./assets/js/tag-skill-runtime.js?v=486120",
  "./assets/js/studio-skill-bridge.js?v=486120"
,
  "./assets/js/battle-control.js?v=486120",
  "./assets/js/ui-bootstrap.js?v=486120"
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
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
  if(event.data && event.data.type==='SKIP_WAITING')self.skipWaiting();
});


async function networkFirst(request){
  try{
    return await fetch(request,{cache:'no-store'});
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate')return caches.match(OFFLINE_URL);
    throw error;
  }
}

async function networkOnlyWithOfflineFallback(request){
  try{
    return await fetch(request,{cache:'no-store'});
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    throw error;
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(networkOnlyWithOfflineFallback(request));
});
