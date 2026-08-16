'use strict';
const assert=require('node:assert/strict');
const S=require('../assets/shared/js/adventure-story-system.js');

const zones=(before=[])=>({event_zone_before_pre:before,event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]});
const fixed=(event_id,{order=1,failure_policy='quest_fail'}={})=>({kind:'fixed_event',event_id,order,failure_policy});
const slot=(over={})=>({kind:'random_event',order:1,failure_policy:'quest_fail',filter:{event_type:'battle',group:null,tags:[]},allow_none:false,required:true,box_side_individual_probability_override:false,...over});
const quest=(id,placement,{enemy_budget=8,context={map_id:'MAP-PENDING',area_id:'AREA-PENDING',difficulty:4,budget:{policy:'standard'}}}={})=>({id,enemy_budget,adventure_duration_seconds:30,context,boxes:[{box_id:'BOX-1',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,...zones([placement])}]});
const battleEvent={id:'EVT-BATTLE',name:'Battle',usage:'story',type:'battle',intensity:'high',generation_profile_ref:'GEN-P1'};
const tablets=[{id:'TBL-BONUS',params:{enemy_budget_bonus:3}}];
let capturedRequest=null,capturedBattle=null;
const run=S.simulateQuest({
  quest:quest('Q-P7',fixed('EVT-BATTLE')),
  events:[battleEvent],seed:7001,
  startCostResult:{consumed:true,cost:{resources:{'TBL-BONUS':2}}},tablets,
  resolveBattleEncounter:({request,event})=>{capturedRequest=request;assert.equal(event.id,'EVT-BATTLE');return{resolver_id:'TEST-P7',formation:[{monster_id:'M-RESOLVED',count:2}],metadata:{pool:'test-double'}};},
  simulateBattle:args=>{capturedBattle=args;return{victory:true,seed:args.seed,reward:{gold:7},playback_events:[{type:'battle_start'},{type:'battle_end'}]};}
});
assert.equal(run.final_result.success,true);
assert.equal(run.battle_results.length,1);
assert.equal(run.event_results[0].battle_result_index,0);
assert.equal(run.event_results[0].success,true);
assert.deepEqual(run.reward_result,{gold:7});
assert.deepEqual(capturedBattle.formation,[{monster_id:'M-RESOLVED',count:2}]);
assert.equal(capturedRequest.contract,'adventure_battle_encounter_request');
assert.equal(capturedRequest.contract_version,1);
assert.equal(capturedRequest.quest_id,'Q-P7');
assert.equal(capturedRequest.event_id,'EVT-BATTLE');
assert.deepEqual(capturedRequest.quest_context,{map_id:'MAP-PENDING',area_id:'AREA-PENDING',difficulty:4,budget:{policy:'standard'}});
assert.equal(capturedRequest.quest_difficulty,8,'P7-B uses explicit selectedStones for difficulty; fixed start-cost resources no longer raise Budget');
assert.equal(capturedRequest.event_intensity,'high');
assert.equal(capturedRequest.generation_profile_ref,'GEN-P1');
assert.equal(capturedRequest.enemy_budget,8,'Legacy fixed start-cost resources no longer change P7-B Quest difficulty');
assert.deepEqual(capturedRequest.budget_policy,{policy:'standard'});
assert(Number.isInteger(capturedRequest.encounter_seed));
assert.equal(run.battle_results[0].encounter_request.encounter_seed,capturedRequest.encounter_seed);
assert.equal(run.battle_results[0].encounter_result.resolver_id,'TEST-P7');

// Numeric Quest difficulty is the effective Enemy Budget; Event intensity remains a separate input.
const req=S.buildBattleResolverRequest({quest:{id:'Q-SEP',enemy_budget:5,context:{difficulty:9}},event:{id:'E-SEP',type:'battle',intensity:'low'},encounterSeed:123});
assert.equal(req.quest_difficulty,5);assert.equal(req.event_intensity,'low');assert.equal(req.enemy_budget,5);assert.equal(req.encounter_seed,123);

// Battle failure follows the placement-level continue / quest_fail policy.
const losingBattle=()=>({victory:false,reason:'defeat',reward:{gold:999},playback_events:[{type:'battle_start'},{type:'battle_end'}]});
const soft=S.simulateQuest({quest:quest('Q-SOFT',fixed('EVT-BATTLE',{failure_policy:'continue'})),events:[battleEvent],seed:7002,resolveBattleEncounter:()=>({formation:[{monster_id:'M',count:1}]}),simulateBattle:losingBattle});
assert.equal(soft.event_results[0].success,false);assert.equal(soft.final_result.success,true,'continue must keep Quest alive after a lost Battle Event');
const hard=S.simulateQuest({quest:quest('Q-HARD',fixed('EVT-BATTLE',{failure_policy:'quest_fail'})),events:[battleEvent],seed:7003,resolveBattleEncounter:()=>({formation:[{monster_id:'M',count:1}]}),simulateBattle:losingBattle});
assert.equal(hard.final_result.success,false);assert.equal(hard.final_result.failure.reason,'defeat');

// Random Event -> Battle uses the same resolver boundary and freezes generated payload in QuestRun selection data.
const randomBattle={...battleEvent,id:'R-BATTLE',usage:'random',random_base_weight:1};
const randomQuest=quest('Q-RANDOM',slot());
const randomRun=S.simulateQuest({quest:randomQuest,events:[randomBattle],seed:7004,resolveBattleEncounter:({request})=>({resolver_id:'RANDOM-TEST',formation:[{monster_id:'MR',count:1}],request_seed:request.encounter_seed}),simulateBattle:({formation,seed})=>({victory:true,seed,formation,reward:{},playback_events:[{type:'battle_start'},{type:'battle_end'}]})});
assert.equal(randomRun.random_selections.length,1);assert.equal(randomRun.random_selections[0].selected_event_id,'R-BATTLE');
assert.equal(randomRun.random_selections[0].generated_payload.kind,'battle');
assert.deepEqual(randomRun.random_selections[0].generated_payload.formation,[{monster_id:'MR',count:1}]);
assert.equal(randomRun.random_selections[0].generated_payload.battle_result_index,0);
assert.equal(randomRun.event_results[0].random_selection_index,0);

// Same Quest seed yields the same encounter/battle seeds; playback persistence never calls the resolver again.
const determinism=()=>S.simulateQuest({quest:randomQuest,events:[randomBattle],seed:7010,resolveBattleEncounter:({request})=>({formation:[{monster_id:'MR',count:1}],seed:request.encounter_seed}),simulateBattle:({seed})=>({victory:true,seed,reward:{},playback_events:[{type:'battle_start'},{type:'battle_end'}]})});
const d1=determinism(),d2=determinism();
assert.equal(d1.battle_results[0].encounter_request.encounter_seed,d2.battle_results[0].encounter_request.encounter_seed);
assert.equal(d1.battle_results[0].seed,d2.battle_results[0].seed);
const save={};S.startQuestRunPlayback(save,{...d1,quest_run_id:'QR-P7-PERSIST'},{startedAt:'2026-08-15T00:00:00.000Z'});const stored=S.activeQuestRun(save);assert.deepEqual(stored.battle_results,d1.battle_results);S.resumeQuestRun(save,Date.parse('2026-08-15T00:00:05.000Z'));assert.deepEqual(S.activeQuestRun(save).battle_results,d1.battle_results);

// Resolver failures become deterministic QuestRun failure data instead of silently falling back to a fixed Event roster.
const empty=S.simulateQuest({quest:quest('Q-EMPTY',fixed('EVT-BATTLE')),events:[battleEvent],seed:7020,resolveBattleEncounter:()=>({formation:[]}),simulateBattle:()=>{throw new Error('must not run Battle Core for empty formation')}});
assert.equal(empty.final_result.success,false);assert.equal(empty.final_result.failure.reason,'simulation_error');assert.match(empty.final_result.failure.message,/empty Formation/);

console.log('adventure-battle-resolver-runtime-p7a PASS');
