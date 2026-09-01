'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const Story=require('../assets/shared/js/adventure-story-system.js');
const Encounter=require('../assets/shared/js/adventure-encounter-resolver.js');
const Reward=require('../assets/shared/js/adventure-reward-resolver.js');
const HistoricalBattle=require('./helpers/historical-basic-battle.js');
const ExportCore=require('../studio/export-core.js');

function load(path){return JSON.parse(fs.readFileSync(path,'utf8')).data;}
function byId(rows,id){const row=rows.find(x=>String(x?.id||'')===id);assert(row,`${id} missing`);return row;}
function resourceCount(reward,id){return (reward?.resources||[]).filter(x=>String(x?.resource_id||'')===id).reduce((n,x)=>n+Number(x.count||0),0);}

const quests=load('Export/quest/event_quests.json');
const events=load('Export/event/events.json');
const monsters=load('Export/monster/monsters.json');
const maps=load('Export/world/maps.json');
const dropTables=load('Export/system/drop_tables.json');
const settings=load('Export/system/adventure_settings.json');
const quest=byId(quests,'QST-0002');
const battleEvent=byId(events,'EVT-0005');
const rewardEvent=byId(events,'EVT-0006');
const monster1=byId(monsters,'MON-0001');
const monster2=byId(monsters,'MON-0002');
const map=byId(maps,'MAP-0001');
const reward1=byId(dropTables,'RWD-0001');
const reward2=byId(dropTables,'RWD-0002');
const reward3=byId(dropTables,'RWD-0003');

// Studio source model -> Export payload path remains capable of emitting the live-operation records.
const studioPayload=ExportCore.buildData({
  chapters:[],events:[battleEvent,rewardEvent],flags:[],quests:[quest],ai_templates:[],ai_programs:[],
  masters:{
    stats:[],jobs:[],skills:[],equipment:[],mods:[],monsters:[monster1,monster2],status_effects:[],tablets:[],
    ai_conditions:[],ai_targets:[],ai_actions:[],maps:[map],exploration_outcomes:[],reward_tables:[reward1,reward2,reward3],adventure_settings:settings
  },balance:{},game_settings:{}
});
assert.deepEqual(studioPayload['monster/monsters.json'].map(x=>x.id),['MON-0001','MON-0002']);
assert.deepEqual(studioPayload['world/maps.json'].map(x=>x.id),['MAP-0001']);
assert.deepEqual(studioPayload['system/drop_tables.json'].map(x=>x.id),['RWD-0001','RWD-0002','RWD-0003']);
assert.deepEqual(studioPayload['event/events.json'].map(x=>x.id),['EVT-0005','EVT-0006']);
assert.deepEqual(studioPayload['quest/event_quests.json'].map(x=>x.id),['QST-0002']);
const sourceModel={chapters:[],events:[battleEvent,rewardEvent],quests:[quest],masters:{monsters:[monster1,monster2],maps:[map],exploration_outcomes:[],reward_tables:[reward1,reward2,reward3],adventure_settings:settings,mods:[],equipment:[],jobs:[],status_effects:[],tablets:[],skills:[],ai_conditions:[],ai_targets:[],ai_actions:[]}};
const assessment=ExportCore.formalStoryQuestAssessment(sourceModel,quest);
assert.equal(assessment.ready,true,JSON.stringify(assessment.issues));
assert.equal(assessment.p7_runtime_ready,true,JSON.stringify(assessment.p7_runtime?.issues||[]));

assert.equal(quest.adventure_duration_seconds,30);
assert.equal(quest.base_enemy_budget,3);
assert.equal(quest.context.map_id,'MAP-0001');
assert.equal(battleEvent.usage,'random');
assert.equal(battleEvent.type,'battle');
assert.equal(rewardEvent.usage,'random');
assert.equal(rewardEvent.type,'special');
assert.deepEqual(rewardEvent.reward_table_ids,['RWD-0003']);
assert.deepEqual(monster1.params.drop_table_ids,['RWD-0001']);
assert.deepEqual(monster2.params.drop_table_ids,['RWD-0002']);

const difficulty=Story.resolveAdventureDifficulty({quest,selectedStones:[],tablets:[],adventureSettings:settings});
const party=[{id:'LIVE-OPS-HERO',character_id:'LIVE-OPS-HERO',name:'実機検証冒険者',max_hp:180,attack:24,agi:10}];
const run=Story.simulateQuest({
  quest,events,monsters,tablets:[],adventureSettings:settings,partySnapshot:party,seed:20260816,
  difficultySnapshot:difficulty,rewardScalingSnapshot:difficulty.reward_scaling_snapshot,
  flags:{},startCostResult:{consumed:false,pending:true,cost:{gold:0,resources:{}}},
  checkEventCondition:()=>true,
  resolveEvent:()=>({success:true,reward:{},flags:{}}),
  resolveBattleEncounter:({request})=>Encounter.resolveEncounter({request,monster_master:monsters,map_master:maps,adventure_settings:settings}),
  resolveReward:(args)=>Reward.resolveEventReward({...args,monsters,drop_tables:dropTables}),
  simulateBattle:({formation,seed,encounter_result})=>{
    const master=encounter_result?.battle_scaling?Encounter.applyBattleScaling(monsters,encounter_result.battle_scaling):monsters;
    return HistoricalBattle.simulateBasicBattle({party,formation,monsters:master,seed});
  }
});

assert.equal(run.final_result.success,true,JSON.stringify(run.final_result));
assert.equal(run.random_selections.length,2);
assert.equal(run.random_selections[0].selected_event_id,'EVT-0005');
assert.equal(run.random_selections[1].selected_event_id,'EVT-0006');
assert.deepEqual(run.random_selections[0].candidate_event_ids,['EVT-0005']);
assert.deepEqual(run.random_selections[1].candidate_event_ids,['EVT-0006']);
assert.equal(run.battle_results.length,1);
assert.equal(run.battle_results[0].victory,true);
assert.equal(run.battle_results[0].encounter_result.requested_enemy_budget,3);
assert.equal(run.battle_results[0].encounter_result.remaining_budget,0);
assert.equal(run.battle_results[0].reward.gold,30);
assert.equal(resourceCount(run.battle_results[0].reward,'MAT-OPS-BATTLE-TOKEN'),3);
const rewardResult=run.event_results.find(x=>x.event_id==='EVT-0006');
assert(rewardResult,'EVT-0006 result missing');
assert.equal(rewardResult.success,true);
assert.equal(rewardResult.reward.gold,70);
assert.equal(resourceCount(rewardResult.reward,'MAT-OPS-EVENT-TOKEN'),2);
assert.equal(run.reward_result.gold,100);
assert.equal(resourceCount(run.reward_result,'MAT-OPS-BATTLE-TOKEN'),3);
assert.equal(resourceCount(run.reward_result,'MAT-OPS-EVENT-TOKEN'),2);
assert.equal(run.reward_result.resources.reduce((n,x)=>n+Number(x.count||0),0),5);
assert.deepEqual(run.timeline_result.map(x=>x.at_seconds),[15,30]);
assert.equal(run.reward_history.length,2);

console.log('adventure-live-ops-monster-random-event-e2e PASS: Studio payload -> Export records -> Random Battle -> Reward Event -> Quest aggregate Gold 100 / resources 5');
