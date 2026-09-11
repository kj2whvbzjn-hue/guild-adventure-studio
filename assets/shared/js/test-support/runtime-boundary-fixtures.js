(function(root,factory){
  const Boundary=typeof module==='object'&&module.exports?require('../runtime-boundary-contracts.js'):root?.GKRuntimeBoundaryContracts;
  const api=factory(Boundary);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKRuntimeBoundaryFixtures=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Boundary){
  'use strict';
  if(!Boundary)throw new Error('Runtime Boundary Contracts are required');
  const FIXED_SEED=424242;
  const FIXED_PLAYBACK_STARTED_AT='2026-01-02T03:04:05.000Z';
  const FIXED_QUEST_RUN_ID='QR-F02-FIXTURE-0001';
  const DEFAULT_RNG_SEQUENCES=Object.freeze({
    QUEST_SELECTION:Object.freeze([0.125,0.625,0.375]),
    ENCOUNTER_SEED:Object.freeze([0.25]),
    BATTLE_SEED:Object.freeze([0.5]),
    EXPLORATION_SEED:Object.freeze([0.75]),
    REWARD:Object.freeze([0.2,0.8,0.4,0.6]),
    BATTLE_ORDER:Object.freeze([0.1,0.9,0.3,0.7]),
    HIT:Object.freeze([0.15,0.85]),
    CRITICAL:Object.freeze([0.05,0.95]),
    TARGET_SELECTION:Object.freeze([0.4,0.6]),
    AI_TIE_SELECTION:Object.freeze([0.2,0.8]),
    GROWTH:Object.freeze([0.3,0.7])
  });
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  function createFixture({sequences=DEFAULT_RNG_SEQUENCES,failOnWriteIndices=[]}={}){
    const metrics=Boundary.createMetrics(),rngProbe=Boundary.createRngProbe({sequences:clone(sequences),metrics}),persistenceProbe=Boundary.createPersistenceProbe({metrics,failOnWriteIndices});
    return Object.freeze({seed:FIXED_SEED,playbackStartedAt:FIXED_PLAYBACK_STARTED_AT,questRunId:FIXED_QUEST_RUN_ID,metrics,rngProbe,persistenceProbe,install(){return Boundary.installInstrumentation({rngProbe,persistenceProbe});}});
  }
  function createMemoryStorage(initial={}){const values=new Map(Object.entries(initial).map(([key,value])=>[String(key),String(value)]));return Object.freeze({getItem(key){const id=String(key);return values.has(id)?values.get(id):null;},setItem(key,value){values.set(String(key),String(value));},removeItem(key){values.delete(String(key));},snapshot(){return Object.fromEntries([...values.entries()].sort(([a],[b])=>a.localeCompare(b)));}});}
  return Object.freeze({FIXED_SEED,FIXED_PLAYBACK_STARTED_AT,FIXED_QUEST_RUN_ID,DEFAULT_RNG_SEQUENCES,createFixture,createMemoryStorage});
});
