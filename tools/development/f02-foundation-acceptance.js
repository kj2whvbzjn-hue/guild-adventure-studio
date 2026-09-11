'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const Boundary=require(path.join(root,'assets/shared/js/runtime-boundary-contracts.js'));
const Fixtures=require(path.join(root,'assets/shared/js/test-support/runtime-boundary-fixtures.js'));
const Story=require(path.join(root,'assets/shared/js/adventure-story-system.js'));
const Reward=require(path.join(root,'assets/shared/js/adventure-reward-resolver.js'));

const zones=rows=>({event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:rows});
const quest={id:'Q-F02',adventure_duration_seconds:30,context:{difficulty:1},boxes:[{box_id:'BOX-F02',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,...zones([{kind:'random_event',order:1,failure_policy:'continue',filter:{event_type:'special',group:null,tags:[]},allow_none:false,required:true,box_side_individual_probability_override:false}])}]};
const events=[{id:'R-F02-A',usage:'random',type:'special',random_base_weight:1,enabled:true},{id:'R-F02-B',usage:'random',type:'special',random_base_weight:3,enabled:true}];

function runDeterministic(){
  const fixture=Fixtures.createFixture();
  const run=Story.simulateQuest({quest,events,seed:Fixtures.FIXED_SEED,questRunId:Fixtures.FIXED_QUEST_RUN_ID,playbackStartedAt:Fixtures.FIXED_PLAYBACK_STARTED_AT,settingsVersion:'F02-SETTINGS-1',rngProbe:fixture.rngProbe,partySnapshot:[{id:'P-F02'}],resolveEvent:()=>({success:true,reward:{gold:1}})});
  const snapshot=Boundary.createQuestRunSnapshot(run,{settingsVersion:'F02-SETTINGS-1'});
  return {run,snapshot,metrics:fixture.metrics.snapshot()};
}
const first=runDeterministic(),second=runDeterministic();
assert.equal(Boundary.stableEqual(first.run,second.run),true,'same state/settings/seed must produce identical QuestRun');
assert.equal(Boundary.stableEqual(first.snapshot,second.snapshot),true,'same state/settings/seed must produce identical C04 snapshot');
assert(first.metrics.rng_total>0,'RNG consumption must be measured');
assert((first.metrics.rng_by_purpose.QUEST_SELECTION||0)>0,'Quest selection RNG must be classified');
assert.equal(first.snapshot.contract,'C04');
assert.equal(first.snapshot.run_id,Fixtures.FIXED_QUEST_RUN_ID);

const rewardMetrics=Boundary.createMetrics(),rewardProbe=Boundary.createRngProbe({sequences:{REWARD:[0.1,0.1,0.1,0.1]},metrics:rewardMetrics});
const restoreReward=Boundary.installInstrumentation({rngProbe:rewardProbe});
try{Reward.resolveRewardTable({table:{id:'DROP-F02',entries:[{resource_id:'MAT-F02',count:1,chance:1}]},seed:Fixtures.FIXED_SEED});}finally{restoreReward();}
assert((rewardMetrics.snapshot().rng_by_purpose.REWARD||0)>0,'Reward RNG must be classified');

const battle=Boundary.createBattleSnapshot({battleId:'B-F02',settingsVersion:'F02-SETTINGS-1',seed:Fixtures.FIXED_SEED,actors:[{id:'A1',selected_skill_ids:['SKL-1']},{id:'E1',selected_skill_ids:[]}],formation:[],fixedOrder:['E1','A1']});
assert.deepEqual(battle.fixed_order,['E1','A1']);
assert.equal(battle.contract,'C01');
const reservation=Boundary.createActionReservation({reservationId:'AR-F02',actorId:'A1',skillId:'SKL-1',startTick:10,completeTick:12,fixedTargetIds:['E1'],usageConditions:{selected:true}});
assert.equal(reservation.contract,'C02');
const hit=Boundary.createResolvedHit({actionId:'ACT-F02',hitIndex:0,sourceId:'A1',targetId:'E1',judgement:'hit',perHitDamage:12,committedHp:88,actualHpLoss:12});
assert.equal(hit.contract,'C03');
const descriptor=Boundary.createSaveDescriptor({saveId:'guildAdventureV10.save.v4',saveVersion:4,schemaRevision:'1.6.0',gameVersion:'GA-F02'});
const tx=Boundary.createSaveTransaction({transactionId:'ST-F02',descriptor,sourceVersion:4,proposedState:{v:1},validationResult:{ok:true},committedState:{v:1},recoverablePreviousState:{v:0}});
assert.equal(tx.contract,'C05');
assert.equal(Boundary.createMasterValidationResult({schemaVersion:'1',masterId:'M-F02',ok:true}).contract,'C06');
for(const id of Object.keys(Boundary.CONTRACTS))for(const owner of Boundary.DOMAIN_OWNERS[id])assert.equal(Boundary.assertDomainOwner(id,owner),true);

const persistenceMetrics=Boundary.createMetrics(),memory=Fixtures.createMemoryStorage(),persistenceProbe=Boundary.createPersistenceProbe({metrics:persistenceMetrics,failOnWriteIndices:[2]});
const restorePersistence=Boundary.installInstrumentation({persistenceProbe});
let injected=null;
try{
  Boundary.persistenceWrite(memory,{operation:'set',key:'save',value:'one',phase:'main',owner:'game/assets/js/app-runtime.js'});
  try{Boundary.persistenceWrite(memory,{operation:'set',key:'save',value:'two',phase:'main',owner:'game/assets/js/app-runtime.js'});}catch(error){injected=error;}
}finally{restorePersistence();}
assert.equal(injected?.code,'TEST_PERSISTENCE_WRITE_FAILURE','persistence failure injection must be available');
const pm=persistenceMetrics.snapshot();
assert.equal(pm.persistence_write_attempts,2);
assert.equal(pm.persistence_write_successes,1);
assert.equal(memory.getItem('save'),'one','failed write must not mutate storage');

const gameIndex=fs.readFileSync(path.join(root,'game/index.html'),'utf8');
assert(gameIndex.includes('runtime-boundary-contracts.js'),'production boundary module must load before runtime');
assert(!gameIndex.includes('runtime-boundary-fixtures.js'),'test fixture must not load in public Game');
const studioIndex=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
assert(!studioIndex.includes('runtime-boundary-fixtures.js'),'test fixture must not load in public Studio');
const exportDir=path.join(root,'Export');
if(fs.existsSync(exportDir)){
  const stack=[exportDir];
  while(stack.length){const p=stack.pop();for(const ent of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,ent.name);if(ent.isDirectory())stack.push(q);else assert.notEqual(ent.name,'runtime-boundary-fixtures.js','test fixture must not enter Export');}}
}
const battleSource=fs.readFileSync(path.join(root,'game/assets/js/battle-control.js'),'utf8');
const processTicks=battleSource.slice(battleSource.indexOf('function processTicks('),battleSource.indexOf('function requiredFormalCombatNumber'));
assert(battleSource.includes('RNG_PURPOSES.BATTLE_ORDER'),'battle-start order RNG must be classified');
assert(!processTicks.includes('RNG_PURPOSES.BATTLE_ORDER'),'Tick processing must not consume battle-order RNG');
assert(!processTicks.includes('initializeBattleTieRolls('),'Tick processing must not reinitialize battle order');
const appSource=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
assert(appSource.includes('RNG_PURPOSES.GROWTH'),'growth RNG must be classified');
assert(appSource.includes("boundary:'C05'"),'persistent writes must pass C05 boundary instrumentation');

const runtimeBoundary=JSON.parse(fs.readFileSync(path.join(root,'shared/dependencies/runtime-boundary.json'),'utf8'));
assert.deepEqual(Object.keys(runtimeBoundary.domain_contracts).sort(),['C01','C02','C03','C04','C05','C06']);
assert.equal(runtimeBoundary.domain_write_policy.display_layer_direct_domain_write,'forbidden');
assert.equal(runtimeBoundary.test_fixture_policy.loaded_by_public_entrypoints,false);

console.log(JSON.stringify({ok:true,task:'TASK-NIP-F02',same_seed_reproducible:true,rng_metrics:first.metrics,persistence_metrics:pm,contracts:Object.keys(Boundary.CONTRACTS),fixture_public_entrypoint:false,battle_order_rng_in_tick:false},null,2));
