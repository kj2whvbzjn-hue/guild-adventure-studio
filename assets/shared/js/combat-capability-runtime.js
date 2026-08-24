(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSCombatCapabilityRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CAPABILITIES=Object.freeze(['DUAL_WIELD']);
  const PASSIVE_CAPABILITY_BY_ID=Object.freeze({
    'PAS-DUAL-WIELD-001':Object.freeze(['DUAL_WIELD'])
  });
  function normalizeCapabilities(value,label='combat_capabilities'){
    if(value==null)return[];
    if(!Array.isArray(value))throw new Error(label+'は配列で指定してください。');
    const out=value.map((x,i)=>{const v=String(x??'').trim().toUpperCase();if(!CAPABILITIES.includes(v))throw new Error(`${label}[${i}]はCurrent combat capabilityではありません: ${v||'(empty)'}`);return v});
    if(new Set(out).size!==out.length)throw new Error(label+'に重複があります。');
    return out;
  }
  function capabilitiesFromPassiveIds(ids){
    const out=new Set();
    for(const id of Array.isArray(ids)?ids:[])for(const cap of PASSIVE_CAPABILITY_BY_ID[String(id)]||[])out.add(cap);
    return [...out];
  }
  function hasCapabilityFromPassiveIds(ids,capability){return capabilitiesFromPassiveIds(ids).includes(String(capability||'').toUpperCase())}
  function activeCapabilitiesFromFormalPassives(rows,activePredicate){
    const out=new Set(),test=typeof activePredicate==='function'?activePredicate:()=>true;
    for(const row of Array.isArray(rows)?rows:[]){if(!test(row))continue;for(const cap of normalizeCapabilities(row?.combat_capabilities||[],'formal_passive.combat_capabilities'))out.add(cap)}
    return [...out];
  }
  return Object.freeze({CAPABILITIES,PASSIVE_CAPABILITY_BY_ID,normalizeCapabilities,capabilitiesFromPassiveIds,hasCapabilityFromPassiveIds,activeCapabilitiesFromFormalPassives});
});
