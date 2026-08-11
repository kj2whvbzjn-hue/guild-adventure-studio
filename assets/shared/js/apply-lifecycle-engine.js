/* GKS APPLY Lifecycle Engine facade — R03-F3b
 * Central API for lifecycle policy operations. Effect-specific algorithms stay in tag runtimes
 * until later R03-F phases; this facade only normalizes invocation and failure handling.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSApplyLifecycleEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='R03-F3b';
  const OPERATIONS=Object.freeze(['resolve','apply','expire','cleanup','consume','effective']);
  function normalizeKind(kind){return String(kind||'').trim().toUpperCase()}
  function failure(code,kind,operation,extra={}){return{ok:false,reason:code,kind:normalizeKind(kind),operation,...extra}}
  function create(handlers={}){
    const table={};
    for(const [kind,value] of Object.entries(handlers||{})){const key=normalizeKind(kind);if(key&&value&&typeof value==='object')table[key]=value}
    function invoke(operation,kind,payload={}){
      const key=normalizeKind(kind);
      if(!OPERATIONS.includes(operation))return failure('LIFECYCLE_ENGINE_OPERATION_UNKNOWN',key,operation);
      const handler=table[key];if(!handler)return failure('LIFECYCLE_ENGINE_KIND_UNREGISTERED',key,operation);
      const fn=handler[operation];if(typeof fn!=='function')return failure('LIFECYCLE_ENGINE_OPERATION_UNAVAILABLE',key,operation);
      try{return fn(payload)}catch(error){return failure('LIFECYCLE_ENGINE_HANDLER_ERROR',key,operation,{message:String(error&&error.message||error)})}
    }
    return Object.freeze({version:VERSION,kinds:Object.freeze(Object.keys(table)),resolve:(kind,payload)=>invoke('resolve',kind,payload),apply:(kind,payload)=>invoke('apply',kind,payload),expire:(kind,payload)=>invoke('expire',kind,payload),cleanup:(kind,payload)=>invoke('cleanup',kind,payload),consume:(kind,payload)=>invoke('consume',kind,payload),effective:(kind,payload)=>invoke('effective',kind,payload)});
  }
  return Object.freeze({VERSION,OPERATIONS,create});
});
