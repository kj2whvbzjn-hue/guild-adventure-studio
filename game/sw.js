const CACHE_NAME='guild-adventure-ga-b469';
const OFFLINE_URL='./index.html?appv=469';
const APP_SHELL=[
  './',
  './index.html?appv=469',
  './manifest.webmanifest?v=469',
  './icon-192.png?v=469',
  './icon-512.png?v=469',
  '../Export/skill/skills.json?v=469'
];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('guild-adventure-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE_URL)));return}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)))});
