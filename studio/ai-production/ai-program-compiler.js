(function(root,factory){
  const api=typeof module==='object'&&module.exports?require('../../shared/ai/ai-program-compiler.js'):root&&root.GKSAIProgramCompiler;
  factory(api,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(api,root){
  'use strict';
  if(!api)throw new Error('shared GKSAIProgramCompiler is required');
  if(root)root.GKSAIProgramCompiler=api;
  return api;
});
