(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKAdventureRuntimeConfig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return Object.freeze({
    adventure_settings_canonical_id:'ADV-0001',
    quest_run_history_limit:20
  });
});
