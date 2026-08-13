/* GKS Trigger Engine foundation — R04-A
 * Registry-backed trigger resolution/validation/event recording only.
 * R04-E1 adds a shared per-action trigger guard for recursion/re-entry and activation caps while preserving runtime effect execution.
 * R04-E2 adds deterministic simultaneous reactive-trigger ordering shared by Formal Game and the retired validation shell.
 * R04-E3 closes R04 with a cross-trigger regression gate; runtime behavior is unchanged.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSTriggerEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='R04-E3';
  const DEFAULT_ACTION_TRIGGER_LIMIT=16;
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
        event:'skill_trigger_resolved',
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
    if(contract.dispatchMode&&!['RESOLVE_ONLY','COUNTER','FOLLOW_UP','AURA'].includes(contract.dispatchMode))return failure('TRIGGER_DISPATCH_MODE_UNSUPPORTED',type,{dispatch_mode:contract.dispatchMode});
    return{ok:true,type,contract:{...contract,type}};
  }
  function createActionContext(options={}){
    const raw=Number(options.maxActivations);
    const maxActivations=Number.isInteger(raw)&&raw>0?raw:DEFAULT_ACTION_TRIGGER_LIMIT;
    return{actionId:String(options.actionId||''),maxActivations,activationCount:0,activeKeys:new Set(),history:[]};
  }
  function tryActivate(context,key,meta={}){
    if(!context||typeof context!=='object')return failure('TRIGGER_ACTION_CONTEXT_REQUIRED','');
    const normalizedKey=String(key||'').trim();
    if(!normalizedKey)return failure('TRIGGER_ACTIVATION_KEY_REQUIRED','');
    if(!(context.activeKeys instanceof Set))context.activeKeys=new Set();
    if(!Array.isArray(context.history))context.history=[];
    const max=Number.isInteger(context.maxActivations)&&context.maxActivations>0?context.maxActivations:DEFAULT_ACTION_TRIGGER_LIMIT;
    const count=Math.max(0,Number(context.activationCount)||0);
    if(count>=max)return failure('TRIGGER_ACTION_LIMIT_REACHED','',{key:normalizedKey,activation_count:count,max_activations:max});
    if(context.activeKeys.has(normalizedKey))return failure('TRIGGER_REENTRY_BLOCKED','',{key:normalizedKey,activation_count:count,max_activations:max});
    context.activationCount=count+1;context.activeKeys.add(normalizedKey);
    const entry=Object.freeze({key:normalizedKey,index:context.activationCount,meta:meta&&typeof meta==='object'?{...meta}:{}});context.history.push(entry);
    let released=false;
    return{ok:true,key:normalizedKey,index:context.activationCount,max_activations:max,release(){if(released)return false;released=true;context.activeKeys.delete(normalizedKey);return true}};
  }

  const REACTIVE_FAMILY_ORDER=Object.freeze({COUNTER:0,FOLLOW_UP:1});
  function normalizeReactiveCandidate(candidate,index){
    const c=candidate&&typeof candidate==='object'?candidate:{};
    const kind=String(c.kind||'').trim().toUpperCase();
    const priority=Number.isInteger(Number(c.priority))?Number(c.priority):0;
    const sequence=Number.isInteger(Number(c.sequence))?Number(c.sequence):index;
    const familyRank=Object.prototype.hasOwnProperty.call(REACTIVE_FAMILY_ORDER,kind)?REACTIVE_FAMILY_ORDER[kind]:99;
    return{...c,kind,priority,sequence,familyRank};
  }
  function orderSimultaneousCandidates(candidates){
    if(!Array.isArray(candidates))return[];
    return candidates.map((candidate,index)=>normalizeReactiveCandidate(candidate,index)).sort((a,b)=>a.familyRank-b.familyRank||b.priority-a.priority||a.sequence-b.sequence);
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
  return Object.freeze({VERSION,SUPPORTED,BOUNDARY,DEFAULT_ACTION_TRIGGER_LIMIT,REACTIVE_FAMILY_ORDER,create,createActionContext,tryActivate,orderSimultaneousCandidates,validateCompiledContract,dispatchCompiled});
});
