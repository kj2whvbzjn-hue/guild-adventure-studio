const CACHE_NAME="ga-tag-test-b479";
const CACHE_PREFIX="ga-tag-test-";
const OFFLINE_URL='./index.html?appv=479';
const APP_SHELL=[
  "./",
  "./index.html?appv=479",
  "./manifest.webmanifest?v=479",
  "./icon-192.png?v=479",
  "./icon-512.png?v=479"
,
  "../assets/shared/config/runtime-config.js?v=479",
  "../assets/shared/js/game-shell-common.js?v=479"
,
  "./assets/js/validation-runtime.js?v=479"
,
  "./assets/js/tag-skill-runtime.js?v=479"
,
  "./assets/js/battle-control.js?v=479",
  "./assets/js/ui-bootstrap.js?v=479"
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
