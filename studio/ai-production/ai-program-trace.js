(function(root,factory){
  const api=typeof module==='object'&&module.exports?require('../../shared/ai/ai-program-trace.js'):root&&root.GKSAIProgramTrace;
  factory(api,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(api,root){
  'use strict';
  if(!api)throw new Error('shared GKSAIProgramTrace is required');
  if(root)root.GKSAIProgramTrace=api;
  return api;
});
