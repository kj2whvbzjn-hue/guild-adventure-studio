(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSCombatCapabilityRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CAPABILITIES=Object.freeze(['DUAL_WIELD']);
  function normalizeCapabilities(value,label='combat_capabilities'){
    if(value==null)return[];
    if(!Array.isArray(value))throw new Error(label+'は配列で指定してください。');
    const out=value.map((x,i)=>{const v=String(x??'').trim().toUpperCase();if(!CAPABILITIES.includes(v))throw new Error(`${label}[${i}]はCurrent combat capabilityではありません: ${v||'(empty)'}`);return v});
    if(new Set(out).size!==out.length)throw new Error(label+'に重複があります。');
    return out;
  }
  function activeCapabilitiesFromFormalPassives(rows,activePredicate){
    const out=new Set(),test=typeof activePredicate==='function'?activePredicate:()=>true;
    for(const row of Array.isArray(rows)?rows:[]){if(!test(row))continue;const caps=row?.runtimeContracts?.modifierRefs?.combatCapabilities??row?.combat_capabilities??[];for(const cap of normalizeCapabilities(caps,'formal_passive.runtimeContracts.modifierRefs.combatCapabilities'))out.add(cap)}
    return [...out];
  }
  return Object.freeze({CAPABILITIES,normalizeCapabilities,activeCapabilitiesFromFormalPassives});
});
