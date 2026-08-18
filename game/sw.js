const CACHE_NAME="ga-game-b486211-b644";
const CACHE_PREFIX="ga-game-";
const OFFLINE_URL='./index.html?appv=486211b644';
const APP_SHELL=[
  "./",
  "./index.html?appv=486211b644",
  "./manifest.webmanifest?v=486211",
  "./icon-192.png?v=486211",
  "./icon-512.png?v=486211",
  "../Export/skill/skills.json?v=486211b644",
  "../Export/equipment/equipment.json?v=486211b644",
  "../Export/master/jobs.json?v=486211b644",
  "../Export/system/adventure_settings.json?v=486211b644",
  "../Export/ai/ai_nodes.json?v=486211b644",
  "../Export/ai/ai_templates.json?v=486211b644",
  "../shared/ai/ai-program-model.js?v=486211b644",
  "../shared/ai/ai-layout-model.js?v=486211b644",
  "../shared/ai/ai-master-adapter.js?v=486211b644",
  "../shared/ai/ai-connection-resolver.js?v=486211b644",
  "../shared/ai/ai-program-validator.js?v=486211b644",
  "../shared/ai/ai-program-compiler.js?v=486211b644",
  "../shared/ai/ai-program-trace.js?v=486211b644",
  "../shared/ai/ai-decision-engine.js?v=486211b644",
  "./assets/js/ai-catalog-loader.js?v=486211b644",
  "./assets/js/ai-save-bridge.js?v=486211b644",
  "./assets/js/ai-battle-bridge.js?v=486211b644",
  "./assets/js/ai-editor-ui.js?v=486211b644",
  "./assets/js/skill-loadout-runtime.js?v=486211b644",
  "../assets/shared/config/runtime-config.js?v=486211b644",
  "../assets/shared/js/game-shell-common.js?v=486211",
  "../assets/shared/js/apply-lifecycle-engine.js?v=486211",
  "../assets/shared/js/trigger-engine.js?v=486211",
  "../assets/shared/js/condition-engine.js?v=486211",
  "../assets/shared/js/adventure-story-system.js?v=11",
  "../assets/shared/js/adventure-encounter-resolver.js?v=3",
  "../assets/shared/js/adventure-reward-resolver.js?v=1",
  "../assets/shared/js/adventure-battle-core.js?v=5",
  "../assets/shared/js/skill-compiler.js?v=486211",
  "../assets/shared/js/skill-compile-service.js?v=486211",
  "../assets/shared/js/device-game-test-harness.js?v=486211",
  "../assets/shared/config/skill-registry.json?v=486211",
  "./assets/js/app-runtime.js?v=486211b644",
  "./assets/js/tag-skill-runtime.js?v=486211b644",
  "./assets/js/studio-skill-bridge.js?v=486211b644",
  "./assets/js/battle-control.js?v=486211b644",
  "./assets/js/ui-bootstrap.js?v=486211"
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
