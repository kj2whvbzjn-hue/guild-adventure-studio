/* GKS Trigger Engine foundation — R04-A
 * Registry-backed trigger resolution/validation/event recording only.
 * R04-D2 dispatches Generic COUNTER/FOLLOW_UP/AURA through validated compiled contracts; effect execution remains in battle runtimes.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSTriggerEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='R04-D2';
  const SUPPORTED=Object.freeze([
    'ON_USE','ON_HIT_RECEIVED','ON_ALLY_ATTACK','ON_DAMAGE_DEALT',
    'ON_TURN_START','ON_TURN_END','ON_DEATH','ON_STATUS_APPLIED','WHILE_SOURCE_ALIVE'
  ]);
  const BOUNDARY=Object.freeze({
    scope:'TRIGGER_RESOLUTION_ONLY',
    owns:Object.freeze(['resolve','validate','record']),
    excludes:Object.freeze([
      'APPLY_LIFECYCLE','TARGET_RESOLUTION','DAMAGE_FORMULA','HEAL_FORMULA',
      'RESOURCE_COST','COVER_ROUTING','COUNTER_CHAIN','FOLLOW_UP_CHAIN','AURA_EFFECT'
    ])
  });
  function normalize(type){return String(type||'').trim().toUpperCase()}
  function failure(code,type,extra={}){return{ok:false,reason:code,type:normalize(type),...extra}}
  function create(registry={},options={}){
    const defs=(registry&&registry.triggers&&typeof registry.triggers==='object')?registry.triggers:{};
    const sink=typeof options.eventSink==='function'?options.eventSink:null;
    function resolve(type){
      const key=normalize(type);
      if(!key)return failure('TRIGGER_TYPE_REQUIRED',key);
      if(!SUPPORTED.includes(key))return failure('TRIGGER_TYPE_UNSUPPORTED',key);
      const def=defs[key];
      if(!def||typeof def!=='object')return failure('TRIGGER_REGISTRY_ENTRY_MISSING',key);
      if(def.enabled===false)return failure('TRIGGER_DISABLED',key);
      return{ok:true,type:key,definition:{...def}};
    }
    function validate(trigger){
      if(!trigger||typeof trigger!=='object'||Array.isArray(trigger))return failure('TRIGGER_OBJECT_REQUIRED','');
      const result=resolve(trigger.type);
      if(!result.ok)return result;
      const allowed=Array.isArray(result.definition.allowed_scopes)?result.definition.allowed_scopes:null;
      if(trigger.scope!=null&&allowed&&!allowed.includes(trigger.scope)){
        return failure('TRIGGER_SCOPE_UNSUPPORTED',result.type,{scope:trigger.scope,allowed_scopes:[...allowed]});
      }
      return{ok:true,type:result.type,definition:result.definition,trigger:{...trigger,type:result.type}};
    }
    function record(type,payload={}){
      const result=resolve(type);
      if(!result.ok)return result;
      const event=Object.freeze({
        event:'generic_trigger_resolved',
        triggerType:result.type,
        phase:registry.phase||null,
        payload:payload&&typeof payload==='object'?{...payload}:{}
      });
      if(sink){
        try{sink(event)}catch(error){return failure('TRIGGER_EVENT_SINK_ERROR',result.type,{message:String(error&&error.message||error)})}
      }
      return{ok:true,type:result.type,event};
    }
    return Object.freeze({
      version:VERSION,
      boundary:BOUNDARY,
      supported:SUPPORTED,
      resolve,
      validate,
      record
    });
  }
  function validateCompiledContract(contract,eventType){
    if(!contract||typeof contract!=='object'||Array.isArray(contract))return failure('TRIGGER_CONTRACT_REQUIRED','');
    const type=normalize(contract.type);
    if(!SUPPORTED.includes(type))return failure('TRIGGER_TYPE_UNSUPPORTED',type);
    const expected=String(contract.engineEvent||'').trim();
    const actual=String(eventType||'').trim();
    if(!expected)return failure('TRIGGER_ENGINE_EVENT_REQUIRED',type);
    if(actual!==expected)return failure('TRIGGER_ENGINE_EVENT_MISMATCH',type,{expected_event:expected,actual_event:actual});
    if(contract.dispatchMode&&!['LEGACY_COUNTER_ADAPTER','LEGACY_FOLLOW_UP_ADAPTER','LEGACY_AURA_ADAPTER'].includes(contract.dispatchMode))return failure('TRIGGER_DISPATCH_MODE_UNSUPPORTED',type,{dispatch_mode:contract.dispatchMode});
    return{ok:true,type,contract:{...contract,type}};
  }
  function dispatchCompiled(contract,eventType,payload={},handler){
    const checked=validateCompiledContract(contract,eventType);
    if(!checked.ok)return checked;
    if(typeof handler!=='function')return failure('TRIGGER_DISPATCH_HANDLER_REQUIRED',checked.type);
    try{
      const result=handler({type:checked.type,contract:checked.contract,eventType,payload:payload&&typeof payload==='object'?payload:{}});
      return{ok:true,triggered:true,type:checked.type,eventType,result};
    }catch(error){
      return failure('TRIGGER_DISPATCH_HANDLER_ERROR',checked.type,{message:String(error&&error.message||error)});
    }
  }
  return Object.freeze({VERSION,SUPPORTED,BOUNDARY,create,validateCompiledContract,dispatchCompiled});
});
