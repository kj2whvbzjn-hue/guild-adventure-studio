(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKAdventureRuntimeConfig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return Object.freeze({
    adventure_settings_canonical_id:'ADV-0001',
    quest_run_history_limit:20,
    // Keep QuestRun persistence below a conservative localStorage share because Auto Save also keeps one full backup slot.
    quest_run_storage_budget_bytes:1572864
  });
});
