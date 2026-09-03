(function(root,factory){
  const Context=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-battle-runtime-context.js'):root?.GKSAIBattleRuntimeContext;
  const api=factory(Context);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAIBattleBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Context){
  'use strict';
  if(!Context)throw new Error('Formal AI Battle Runtime Context is required');
  return Object.freeze({
    EFFECT_SCOPE_MAP:Context.EFFECT_SCOPE_MAP,
    canonicalEffect:Context.canonicalEffect,
    snapshot:Context.snapshot,
    compareNumber:Context.compareNumber,
    effectRows:Context.effectRows,
    predicate:Context.predicate,
    legalCandidates:Context.legalCandidates,
    action:Context.action,
    createDecisionRng:Context.createDecisionRng,
    createHandlers:Context.createHandlers,
    decide:Context.decide
  });
});
