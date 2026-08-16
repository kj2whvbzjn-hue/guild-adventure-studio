(function(root,factory){
  const api=typeof module==='object'&&module.exports?require('../../shared/ai/ai-decision-engine.js'):root&&root.GKSAIDecisionEngine;
  factory(api,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(api,root){
  'use strict';
  if(!api)throw new Error('shared GKSAIDecisionEngine is required');
  if(root)root.GKSAIDecisionEngine=api;
  return api;
});
