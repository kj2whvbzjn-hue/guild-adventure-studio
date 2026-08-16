'use strict';
const assert=require('node:assert/strict');
const S=require('../assets/shared/js/adventure-story-system.js');
const W=require('../assets/shared/js/adventure-reward-resolver.js');

const settings=[{id:'ADV-0001',enabled:true,params:{reward_scaling:{bonus_per_budget:.02,min_multiplier:1,max_multiplier:null,amount_rounding:'floor',rarity_weight_bonus_per_budget:{common:0,rare:.1,epic:.2}}}}];
const difficulty=S.resolveAdventureDifficulty({quest:{id:'Q',base_enemy_budget:100},selectedStones:[{stone_id:'STONE-BUDGET',count:1},{stone_id:'STONE-REWARD',count:1}],tablets:[{id:'STONE-BUDGET',params:{stone_level:25}},{id:'STONE-REWARD',params:{stone_level:0,reward_multiplier_bonus:.2}}],adventureSettings:settings});
assert.equal(difficulty.stone_budget_delta,25);
assert.equal(difficulty.reward_scaling_snapshot.difficulty_reward_multiplier,1.5);
assert.equal(difficulty.reward_scaling_snapshot.reward_modifier_multiplier,1.2);
assert(Math.abs(difficulty.reward_scaling_snapshot.reward_multiplier-1.8)<1e-12);

// Amount scaling is data driven: Budget scaling and an explicit reward-stone modifier are separate factors.
const amountTable={id:'RWD-AMOUNT',groups:[{id:'G',rolls:1,entries:[{kind:'gold',weight:1,amount:10,scaling_mode:'amount'}]}]};
const base=W.resolveRewardTable({table:amountTable,seed:1,reward_scaling_snapshot:{budget_reward_multiplier:1,reward_modifier_multiplier:1,budget_delta:0,amount_rounding:'floor'}});
const hard=W.resolveRewardTable({table:amountTable,seed:1,reward_scaling_snapshot:difficulty.reward_scaling_snapshot});
assert.equal(base.reward.gold,10);
assert.equal(hard.reward.gold,18,'10 x Budget 1.5 x explicit reward modifier 1.2');

// Exploration already receives difficulty through Outcome rarity, so normal Budget amount scaling is not applied again.
const explorationAmount=W.resolveRewardTable({table:amountTable,seed:1,reward_scaling_snapshot:difficulty.reward_scaling_snapshot,apply_difficulty_scaling:false});
assert.equal(explorationAmount.reward.gold,12,'Exploration ignores Budget amount multiplier but keeps explicit reward modifier');

// Quality scaling raises high-rarity selection weight instead of increasing item quantity.
const qualityTable={id:'RWD-QUALITY',groups:[{id:'LOOT',rolls:1,entries:[
 {kind:'equipment',equipment_id:'EQ-C',rarity:'common',weight:10,amount:1,scaling_mode:'quality'},
 {kind:'equipment',equipment_id:'EQ-R',rarity:'rare',weight:10,amount:1,scaling_mode:'quality'}
]}]};
let lowRare=0,highRare=0;
for(let i=1;i<=300;i++){
 const seed=W.hashSeed(`quality-${i}`);
 const low=W.resolveRewardTable({table:qualityTable,seed,reward_scaling_snapshot:{budget_reward_multiplier:1,reward_modifier_multiplier:1,budget_delta:0,rarity_weight_bonus_per_budget:{common:0,rare:.1}}});
 const high=W.resolveRewardTable({table:qualityTable,seed,reward_scaling_snapshot:{budget_reward_multiplier:2,reward_modifier_multiplier:1,budget_delta:10,rarity_weight_bonus_per_budget:{common:0,rare:.1}}});
 if(low.reward.items?.[0]==='EQ-R')lowRare++;
 if(high.reward.items?.[0]==='EQ-R')highRare++;
 assert.equal((high.reward.items||[]).length,1,'quality scaling must not increase equipment quantity');
}
assert(highRare>lowRare,`Rare selection must increase with Budget: low=${lowRare}, high=${highRare}`);

const dropTables=[
 amountTable,
 {id:'RWD-MON',groups:[{id:'DROP',rolls:1,entries:[{kind:'material',resource_id:'MAT-FANG',weight:1,amount:1,scaling_mode:'none'}]}]},
 {id:'RWD-EVENT',groups:[{id:'EVENT',rolls:1,entries:[{kind:'stone',stone_id:'STONE-X',weight:1,amount:1,scaling_mode:'none'}]}]},
 {id:'RWD-EXP',groups:[{id:'EXP',rolls:1,entries:[{kind:'material',resource_id:'MAT-HERB',weight:1,amount:2,scaling_mode:'amount'}]}]}
];
const monsters=[{id:'MON-A',params:{drop_table_ids:['RWD-MON']}}];
const battleReward=W.resolveEventReward({source_type:'battle',event:{id:'EV-B'},battle_result:{victory:true},formation:[{monster_id:'MON-A',count:2}],monsters,drop_tables:dropTables,reward_seed:99,reward_scaling_snapshot:difficulty.reward_scaling_snapshot,difficulty_snapshot:difficulty});
assert.deepEqual(battleReward.result.resources,[{resource_id:'MAT-FANG',count:2,resource_kind:'material'}]);
const battleLoss=W.resolveEventReward({source_type:'battle',event:{id:'EV-B'},battle_result:{victory:false},formation:[{monster_id:'MON-A',count:2}],monsters,drop_tables:dropTables,reward_seed:99,reward_scaling_snapshot:difficulty.reward_scaling_snapshot,difficulty_snapshot:difficulty});
assert.deepEqual(battleLoss.result,{},'lost battle grants no formal drop reward');

const explorationReward=W.resolveEventReward({source_type:'exploration',event:{id:'EV-X'},exploration_result:{selected_outcome_id:'OUT-X',reward_table_ids:['RWD-EXP']},drop_tables:dropTables,reward_seed:7,reward_scaling_snapshot:difficulty.reward_scaling_snapshot,difficulty_snapshot:difficulty,apply_difficulty_scaling:false});
assert.deepEqual(explorationReward.result.resources,[{resource_id:'MAT-HERB',count:2,resource_kind:'material'}],'Budget must not multiply Exploration quantity');

function rewardAdapter(args){return W.resolveEventReward({...args,monsters,drop_tables:dropTables});}
const quest={id:'Q-RWD',base_enemy_budget:100,adventure_duration_seconds:20,boxes:[{box_id:'BOX-1',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[
 {kind:'fixed_event',event_id:'EV-S',order:1,failure_policy:'continue'},
 {kind:'fixed_event',event_id:'EV-X',order:2,failure_policy:'continue'}
],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]};
const events=[{id:'EV-S',usage:'story',type:'special',reward_table_ids:['RWD-EVENT']},{id:'EV-X',usage:'story',type:'exploration'}];
const successRun=S.simulateQuest({quest,events,difficultySnapshot:difficulty,rewardScalingSnapshot:difficulty.reward_scaling_snapshot,resolveEvent:()=>({success:true,reward:{}}),resolveExploration:()=>({success:true,selected_outcome_id:'OUT-X',reward_table_ids:['RWD-EXP']}),resolveReward:rewardAdapter,seed:123});
assert.equal(successRun.final_result.success,true);
assert.equal(successRun.reward_history.length,2);
assert.deepEqual(successRun.reward_history.map(x=>x.source_type),['special','exploration']);
assert(successRun.reward_history.every(x=>Number.isInteger(x.reward_seed)));
assert.deepEqual(successRun.reward_result.resources,[
 {resource_id:'STONE-X',count:1,resource_kind:'stone'},
 {resource_id:'MAT-HERB',count:2,resource_kind:'material'}
]);

// Return/commit applies only the already-saved aggregate, and only once.
const save={};let applied=null;
const c1=S.commitQuestRun(successRun,save,{applyReward:(_save,reward)=>{applied=reward;}});
assert.equal(c1.applied,true);assert.deepEqual(applied,successRun.reward_result);
const c2=S.commitQuestRun(successRun,save,{applyReward:()=>assert.fail('double commit')});
assert.deepEqual(c2,{applied:false,reason:'already_applied'});

// Failure keeps trace history for diagnostics/playback, but all pending rewards are lost and never committed.
const failQuest={...quest,id:'Q-FAIL',boxes:[{...quest.boxes[0],event_zone_before_pre:[
 {kind:'fixed_event',event_id:'EV-S',order:1,failure_policy:'continue'},
 {kind:'fixed_event',event_id:'EV-F',order:2,failure_policy:'quest_fail'}
]}]};
const failEvents=[events[0],{id:'EV-F',usage:'story',type:'special',reward_table_ids:['RWD-EVENT']}];
const failRun=S.simulateQuest({quest:failQuest,events:failEvents,difficultySnapshot:difficulty,rewardScalingSnapshot:difficulty.reward_scaling_snapshot,resolveEvent:({event})=>event.id==='EV-F'?{success:false,failed:true,reward:{}}:{success:true,reward:{}},resolveReward:rewardAdapter,seed:321});
assert.equal(failRun.final_result.success,false);
assert.equal(failRun.reward_history.length,2,'reward trace remains available even though the Quest failed');
assert.deepEqual(failRun.reward_result,{},'failed Quest loses all uncommitted Event rewards');
let failApplied=false;
S.commitQuestRun(failRun,{}, {applyReward:()=>{failApplied=true;}});
assert.equal(failApplied,false,'Return Commit must not apply rewards on failure');

console.log('adventure-event-reward-runtime-p7c PASS');
