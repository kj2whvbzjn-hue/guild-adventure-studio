(function(root){
  'use strict';
  if(typeof module==='object'&&module.exports){module.exports=require('../../shared/ai/ai-master-adapter.js');return;}
  if(!root||!root.GKSAIMasterAdapter)throw new Error('GKSAIMasterAdapter shared module is required');
})(typeof globalThis!=='undefined'?globalThis:this);
