/* GKS Condition Engine — R04-C2. Validates compiled predicate contracts; battle-specific evaluation stays in runtime handlers. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSConditionEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='R04-C2';
  const SUPPORTED=Object.freeze(['TARGET_POISONED']);
  function normalize(v){return String(v||'').trim().toUpperCase()}
  function failure(reason,property,extra={}){return{ok:false,reason,property:normalize(property),...extra}}
  function validateCompiledContract(contract){
    if(!contract||typeof contract!=='object'||Array.isArray(contract))return failure('CONDITION_CONTRACT_REQUIRED','');
    const property=normalize(contract.property);
    if(!SUPPORTED.includes(property))return failure('CONDITION_PROPERTY_UNSUPPORTED',property);
    if(String(contract.scope||'').toUpperCase()!=='TARGET')return failure('CONDITION_SCOPE_UNSUPPORTED',property,{scope:contract.scope});
    if(String(contract.enginePredicate||'')!=='target_poisoned')return failure('CONDITION_PREDICATE_MISMATCH',property,{engine_predicate:contract.enginePredicate});
    if(contract.expected!==true)return failure('CONDITION_EXPECTED_UNSUPPORTED',property,{expected:contract.expected});
    return{ok:true,property,contract:{...contract,property,scope:'TARGET'}};
  }
  function evaluateCompiled(contract,payload={},handler){
    const checked=validateCompiledContract(contract);
    if(!checked.ok)return checked;
    if(typeof handler!=='function')return failure('CONDITION_EVALUATOR_REQUIRED',checked.property);
    try{
      const passed=handler({property:checked.property,contract:checked.contract,payload:payload&&typeof payload==='object'?payload:{}})===true;
      return{ok:true,property:checked.property,passed};
    }catch(error){return failure('CONDITION_EVALUATOR_ERROR',checked.property,{message:String(error&&error.message||error)})}
  }
  return Object.freeze({VERSION,SUPPORTED,validateCompiledContract,evaluateCompiled});
});
