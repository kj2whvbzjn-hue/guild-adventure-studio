/* Exact shared shell runtime extracted from the Formal Game and retired validation shell — GA-B473 */
/* BUILD424: preserve user-selected developer mode and keep mobile runtime orientation-independent. */
try{if(localStorage.getItem('ga_developer_mode')==='1')document.documentElement.classList.add('dev-mode-boot')}catch(e){}

(function(){
 function applyMobileState(){
  var mobile=(window.visualViewport?window.visualViewport.width:window.innerWidth)<=900;
  document.documentElement.classList.toggle('build423-mobile',mobile);
  document.body && document.body.classList.toggle('build423-mobile',mobile);
 }
 applyMobileState();
 addEventListener('resize',applyMobileState,{passive:true});
 addEventListener('orientationchange',function(){setTimeout(applyMobileState,100)},{passive:true});
 if(window.visualViewport)visualViewport.addEventListener('resize',applyMobileState,{passive:true});
 document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.global-orientation,.orientation-guide').forEach(function(el){el.remove()});
  var link=document.getElementById('studioBackLink');
  if(link){
   var here=new URL('.',location.href);
   var isNested=/\/(formal-v03|formal-v03-legacy|game|legacy-home|formal-v0[129]-phase-a?)\/$/.test(here.pathname);
   link.href='../studio/';
  }
  var dev=document.getElementById('devStudioLink');if(dev&&link)dev.href=link.href;
 });
})();

(function(){
  const goBattle=document.getElementById('mobileGoBattle');
  const autoStart=document.getElementById('mobileAutoStart');
  if(goBattle){
    goBattle.addEventListener('click',function(){
      if(typeof resetBattle==='function') resetBattle();
      if(typeof setPhase==='function') setPhase('battle');
    });
  }
  if(autoStart){
    autoStart.addEventListener('click',function(){
      if(document.body.dataset.phase!=='battle' && typeof setPhase==='function') setPhase('battle');
      if(typeof startBattle==='function') startBattle();
    });
  }
})();

/* BUILD424 runtime cleanup */
(function(){
  function normalizeMobile(){
    document.documentElement.classList.remove('dev-mode-boot','dev-portrait-boot');
    document.body&&document.body.classList.remove('dev-portrait');
    document.querySelectorAll('.global-orientation,.orientation-guide').forEach(function(el){el.remove();});
    document.documentElement.style.removeProperty('--game-scale');
  }
  normalizeMobile();
  addEventListener('pageshow',normalizeMobile,{passive:true});
  addEventListener('resize',normalizeMobile,{passive:true});
  addEventListener('orientationchange',function(){setTimeout(normalizeMobile,80)},{passive:true});
})();

(function(){
 function bindMobileBaseNav(){
  document.querySelectorAll('#baseMobileNav [data-base-tab]').forEach(function(btn){
   btn.onclick=function(){ if(typeof setBaseView==='function') setBaseView(btn.dataset.baseTab); };
  });
  document.querySelectorAll('[data-open-base-view]').forEach(function(btn){
   btn.onclick=function(){ if(typeof setBaseView==='function') setBaseView(btn.dataset.openBaseView); };
  });
  var depart=document.getElementById('mobileDepart');
  if(depart) depart.onclick=function(){
   if(!window.data || !Array.isArray(data.partyIds) || !data.partyIds.length){
    if(typeof notify==='function') notify('遠征パーティを1人以上選んでください。','bad');
    if(typeof setBaseView==='function') setBaseView('party');
    return;
   }
   if(typeof beginSelectedAdventure==='function') beginSelectedAdventure();
  };
 }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindMobileBaseNav); else bindMobileBaseNav();
})();
