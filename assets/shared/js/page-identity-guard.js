/* Page identity and Safari restoration guard — GA-B481 */
(()=>{'use strict';
const meta=document.querySelector('meta[name="ga-page-kind"]');
const declared=meta?.content||'';
const cleanPath=()=>location.pathname.replace(/\/index\.html$/,'/');
const expectedKind=()=>cleanPath().endsWith('/game-tag-test/')?'tag-test':cleanPath().endsWith('/game/')?'game':'';
const revision='481';
async function clearRuntimeCaches(){
 const jobs=[];
 if('serviceWorker' in navigator)jobs.push(navigator.serviceWorker.getRegistrations().then(list=>Promise.all(list.filter(r=>/\/(?:game|game-tag-test)\/$/.test(new URL(r.scope).pathname)).map(r=>r.unregister()))));
 if('caches' in window)jobs.push(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ga-game-')||k.startsWith('ga-tag-test-')).map(k=>caches.delete(k)))));
 return Promise.allSettled(jobs);
}
async function recover(reason){
 const path=cleanPath(),expected=expectedKind(),key=`ga-page-recover:${path}`,count=Number(sessionStorage.getItem(key)||0);
 if(count>=2){document.documentElement.dataset.pageIdentityError=reason;console.error('[PAGE_IDENTITY] recovery stopped',{path,expected,declared,reason});return;}
 sessionStorage.setItem(key,String(count+1));await clearRuntimeCaches();
 const url=new URL(location.href);url.searchParams.set('appv',revision);url.searchParams.set('page',expected||declared||'unknown');url.searchParams.set('recover',Date.now());location.replace(url.href);
}
const expected=expectedKind();
if(expected&&declared&&expected!==declared){recover('url-document-mismatch');return;}
document.documentElement.dataset.pageKind=declared;sessionStorage.removeItem(`ga-page-recover:${cleanPath()}`);
addEventListener('pageshow',event=>{
 const currentExpected=expectedKind(),currentDeclared=document.querySelector('meta[name="ga-page-kind"]')?.content||'';
 if(currentExpected&&currentExpected!==currentDeclared)recover('pageshow-mismatch');
 else if(event.persisted){const url=new URL(location.href);if(url.searchParams.get('restore')!=='1'){url.searchParams.set('restore','1');url.searchParams.set('appv',revision);location.replace(url.href);}}
},{passive:true});
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');if(!link)return;
 const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
 if(url.pathname.endsWith('/game/')||url.pathname.endsWith('/game-tag-test/')){event.preventDefault();url.searchParams.set('appv',revision);url.searchParams.set('page',url.pathname.endsWith('/game-tag-test/')?'tag-test':'game');location.assign(url.href);}
});
if('serviceWorker' in navigator&&declared)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=481',{scope:'./',updateViaCache:'none'}).then(r=>r.update()).catch(e=>console.warn('[PAGE_IDENTITY] service worker registration failed',e)),{once:true});
})();
