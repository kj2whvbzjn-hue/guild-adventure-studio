const CACHE_NAME="ga-game-b474";
const CACHE_PREFIX="ga-game-";
const OFFLINE_URL='./index.html?appv=474';
const APP_SHELL=[
  "./",
  "./index.html?appv=474",
  "./manifest.webmanifest?v=474",
  "./icon-192.png?v=474",
  "./icon-512.png?v=474",
  "../Export/skill/skills.json?v=474"
,
  "../assets/shared/config/runtime-config.js?v=474",
  "../assets/shared/js/game-shell-common.js?v=474"
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

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(OFFLINE_URL)));
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(hit=>hit||fetch(event.request))
  );
});
