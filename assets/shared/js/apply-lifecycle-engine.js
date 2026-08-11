/* GKS APPLY Lifecycle Engine facade — R03-F4
 * Central API for lifecycle policy operations. Effect-specific algorithms stay in tag runtimes
 * until later R03-F phases; this facade only normalizes invocation and failure handling.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSApplyLifecycleEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='R03-F4';
  const OPERATIONS=Object.freeze(['resolve','apply','expire','cleanup','consume','effective']);
  const APPLY_KINDS=Object.freeze(['STATUS','DOT','BUFF','DEBUFF','SHIELD']);
  const BOUNDARY=Object.freeze({
    scope:'APPLY_LIFECYCLE_ONLY',
    owns:OPERATIONS,
    kinds:APPLY_KINDS,
    excludes:Object.freeze(['TRIGGER_DISPATCH','TARGET_RESOLUTION','DAMAGE_FORMULA','HEAL_FORMULA','RESOURCE_COST','COVER_ROUTING','COUNTER_CHAIN','FOLLOW_UP_CHAIN','AURA_TRIGGER'])
  });
  function normalizeKind(kind){return String(kind||'').trim().toUpperCase()}
  function failure(code,kind,operation,extra={}){return{ok:false,reason:code,kind:normalizeKind(kind),operation,...extra}}
  function create(handlers={}){
    const table={};
    for(const [kind,value] of Object.entries(handlers||{})){const key=normalizeKind(kind);if(APPLY_KINDS.includes(key)&&value&&typeof value==='object')table[key]=value}
    function invoke(operation,kind,payload={}){
      const key=normalizeKind(kind);
      if(!OPERATIONS.includes(operation))return failure('LIFECYCLE_ENGINE_OPERATION_UNKNOWN',key,operation);
      const handler=table[key];if(!handler)return failure('LIFECYCLE_ENGINE_KIND_UNREGISTERED',key,operation);
      const fn=handler[operation];if(typeof fn!=='function')return failure('LIFECYCLE_ENGINE_OPERATION_UNAVAILABLE',key,operation);
      try{return fn(payload)}catch(error){return failure('LIFECYCLE_ENGINE_HANDLER_ERROR',key,operation,{message:String(error&&error.message||error)})}
    }
    return Object.freeze({version:VERSION,boundary:BOUNDARY,kinds:Object.freeze(Object.keys(table)),resolve:(kind,payload)=>invoke('resolve',kind,payload),apply:(kind,payload)=>invoke('apply',kind,payload),expire:(kind,payload)=>invoke('expire',kind,payload),cleanup:(kind,payload)=>invoke('cleanup',kind,payload),consume:(kind,payload)=>invoke('consume',kind,payload),effective:(kind,payload)=>invoke('effective',kind,payload)});
  }
  return Object.freeze({VERSION,OPERATIONS,APPLY_KINDS,BOUNDARY,create});
});
