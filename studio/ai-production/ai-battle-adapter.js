(function(root,factory){
  const Context=typeof module==='object'&&module.exports?require('../../shared/ai/ai-battle-runtime-context.js'):root&&root.GKSAIBattleRuntimeContext;
  const api=factory(Context);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIBattleAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Context){
  'use strict';
  if(!Context)throw new Error('GKSAIBattleRuntimeContext is required');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  function skillDefinition(unit,skillId){return (Array.isArray(unit?.skills)?unit.skills:[]).find(row=>String(typeof row==='string'?row:row?.id||'')===String(skillId||''))||null;}
  function targetContractOf(skill){if(!skill||typeof skill==='string')return null;const tc=skill.runtimeContracts?.targetContract||skill.target;return tc&&typeof tc==='object'&&!Array.isArray(tc)?clone(tc):null;}
  function studioSkillStates(input){
    const rawUnits=Array.isArray(input?.units)?input.units:[],base=Context.snapshot({...input,units:rawUnits.map(unit=>({...unit,aiSkillStates:{}}))}),out={};
    for(const raw of rawUnits){
      const id=String(raw?.id||''),actor=base.units.find(row=>row.id===id);if(!actor)continue;const states={};
      for(const skill of (Array.isArray(raw?.skills)?raw.skills:[])){
        const skillId=String(typeof skill==='string'?skill:skill?.id||'');if(!skillId)continue;const tc=targetContractOf(skill);
        if(!tc){states[skillId]={ready:false,usable:false,target_contract:null,reason:'SKILL_TARGET_CONTRACT_MISSING'};continue;}
        const mpCost=Math.max(0,Number(typeof skill==='string'?0:(skill?.mp_cost??skill?.resource?.mpCost??skill?.runtimeContracts?.resourceContract?.mpCost))||0),readyAt=Number(raw?.cooldowns?.[skillId]||0),ready=actor.mp>=mpCost&&base.tick>=readyAt;
        const ctx={...base,actor_id:id},legal=Context.legalCandidates(ctx,tc);states[skillId]={ready,usable:ready&&legal.length>0,target_contract:tc,reason:ready?(legal.length?null:'NO_VALID_TARGET'):(actor.mp<mpCost?'COST_SHORTAGE':'COOLDOWN')};
      }
      out[id]=states;
    }
    return out;
  }
  function snapshot(input){const states=studioSkillStates(input);return Context.snapshot({...input,units:(input?.units||[]).map(unit=>({...unit,aiSkillStates:states[String(unit?.id||'')]||{}}))});}
  function createHandlers(context){return Context.createHandlers(context);}
  function decide(runtime,battleInput){const context=snapshot(battleInput),trace=requireDecision(runtime,context);return{proposal:clone(trace.outcome),trace};}
  function requireDecision(runtime,context){
    const engine=(typeof module==='object'&&module.exports)?require('../../shared/ai/ai-decision-engine.js'):(globalThis&&globalThis.GKSAIDecisionEngine);
    if(!engine)throw new Error('GKSAIDecisionEngine is required');
    return engine.execute(runtime,context,createHandlers(context));
  }
  return Object.freeze({snapshot,createHandlers,decide,studioSkillStates,skillDefinition,targetContractOf});
});
