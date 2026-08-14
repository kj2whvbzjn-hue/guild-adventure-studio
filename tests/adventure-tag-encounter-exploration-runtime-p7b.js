'use strict';
const assert=require('node:assert/strict');
const S=require('../assets/shared/js/adventure-story-system.js');
const R=require('../assets/shared/js/adventure-encounter-resolver.js');

const settings=[{id:'ADV-DEFAULT',enabled:true,params:{encounter:{default_spawn_weight:1,max_units:20},reward_scaling:{bonus_per_budget:.01,min_multiplier:1,max_multiplier:null},exploration:{default_base_weight:1,default_success_rate:1,min_success_rate:0,max_success_rate:1,rarity_budget_reference:0,rarity_weight_bonus_per_budget:{common:0,rare:.1,epic:.2}},fixed_formation_scaling:{hp_per_ratio:1,attack_per_ratio:.5,agi_per_ratio:0,min_multiplier:1,max_multiplier:3}}}];
const maps=[{id:'MAP-GRASS',name:'Grass',tags:['grassland','outdoor']},{id:'MAP-DESERT',name:'Desert',tags:['desert','outdoor']}];
const monsters=[
 {id:'M-GRASS',name:'Grass',tags:['BEAST'],params:{enemy_budget_cost:5,spawn_weight:2,spawn_tags:{any:['grassland'],all:[],none:[]},maxHp:100,attack:10,agi:10}},
 {id:'M-DESERT',name:'Desert',tags:['BEAST'],params:{enemy_budget_cost:5,spawn_weight:10,spawn_tags:{any:['desert'],all:[],none:[]},maxHp:100,attack:10,agi:10}},
 {id:'M-NIGHT',name:'Night',params:{enemy_budget_cost:5,spawn_tags:{all:['grassland','night'],none:['town']},maxHp:100,attack:10,agi:10}},
 {id:'M-GLOBAL',name:'Global',params:{enemy_budget_cost:5,spawn_weight:1,maxHp:100,attack:10,agi:10}},
 {id:'M-BOSS',name:'Boss',params:{enemy_budget_cost:20,maxHp:200,attack:20,agi:8,spawn_tags:{any:['desert']}}}
];
const tablets=[{id:'STONE-5',params:{stone_level:5}},{id:'STONE-ENV',params:{stone_level:2,environment_tags_add:['night']}}];

const difficulty=S.resolveAdventureDifficulty({quest:{id:'Q',enemy_budget:10},selectedStones:[{stone_id:'STONE-5',count:2},{stone_id:'STONE-ENV',count:1}],tablets,adventureSettings:settings});
assert.equal(difficulty.base_enemy_budget,10);
assert.equal(difficulty.stone_budget_delta,12);
assert.equal(difficulty.effective_enemy_budget,22);
assert.equal(difficulty.reward_scaling_snapshot.bonus_per_budget,.01);
assert.equal(difficulty.reward_scaling_snapshot.difficulty_reward_multiplier,1.12);
assert.deepEqual(difficulty.stone_modifiers.environment_tags_add,['night']);
assert.deepEqual(S.stoneResourceCost([{stone_id:'STONE-5',count:2}]),{'STONE-5':2});
assert.deepEqual(S.mergeQuestStartCosts({gold:3,resources:{ORE:1}},{'STONE-5':2}),{gold:3,resources:{ORE:1,'STONE-5':2}});

const baseReq={quest_context:{map_id:'MAP-GRASS'},effective_enemy_budget:10,base_enemy_budget:10,encounter_seed:123,stone_modifiers:{}};
const enc=R.resolveEncounter({request:baseReq,monster_master:monsters,map_master:maps,adventure_settings:settings});
assert(enc.candidate_monster_ids.includes('M-GRASS'));
assert(enc.candidate_monster_ids.includes('M-GLOBAL'));
assert(!enc.candidate_monster_ids.includes('M-DESERT'));
assert(!enc.candidate_monster_ids.includes('M-NIGHT'));
assert(enc.formation.length>0);
assert(enc.formation.every(row=>['M-GRASS','M-GLOBAL'].includes(row.monster_id)));

const night=R.resolveEncounter({request:{...baseReq,stone_modifiers:{environment_tags_add:['night']}},monster_master:monsters,map_master:maps,adventure_settings:settings});
assert(night.candidate_monster_ids.includes('M-NIGHT'));

// required_monsters bypasses Map tags, while leftover budget still uses the normal map-tag candidate pool.
const story=R.resolveEncounter({request:{...baseReq,effective_enemy_budget:30,encounter_override:{mode:'required_monsters',required_monsters:[{monster_id:'M-BOSS',count:1}]}},monster_master:monsters,map_master:maps,adventure_settings:settings});
assert(story.formation.some(x=>x.monster_id==='M-BOSS'&&x.count===1));
assert.equal(story.required_monster_budget,20);
assert(story.candidate_monster_ids.includes('M-GRASS'));
assert(!story.candidate_monster_ids.includes('M-DESERT'));

// Required story monsters are never removed merely because their cost exceeds the requested budget.
const over=R.resolveEncounter({request:{...baseReq,effective_enemy_budget:5,encounter_override:{mode:'required_monsters',required_monsters:[{monster_id:'M-BOSS',count:1}]}},monster_master:monsters,map_master:maps,adventure_settings:settings});
assert.equal(over.effective_encounter_budget,20);
assert.deepEqual(over.formation,[{monster_id:'M-BOSS',count:1}]);

// Fixed formation keeps identities/counts and applies data-driven Battle scaling instead of adding units.
const fixed=R.resolveEncounter({request:{...baseReq,base_enemy_budget:10,effective_enemy_budget:20,encounter_override:{mode:'fixed_formation',formation:[{monster_id:'M-BOSS',count:1}]}},monster_master:monsters,map_master:maps,adventure_settings:settings});
assert.deepEqual(fixed.formation,[{monster_id:'M-BOSS',count:1}]);
assert.equal(fixed.battle_scaling.difficulty_ratio,2);
assert.equal(fixed.battle_scaling.hp_multiplier,2);
assert.equal(fixed.battle_scaling.attack_multiplier,1.5);
const scaled=R.applyBattleScaling(monsters,fixed.battle_scaling).find(x=>x.id==='M-BOSS');
assert.equal(scaled.params.maxHp,400);assert.equal(scaled.params.attack,30);assert.equal(scaled.params.agi,8);

const outcomes=[
 {id:'EXP-C',name:'Common',params:{environment_tags:{any:['grassland']},rarity:'common',base_weight:10,success:{base_rate:1},on_success:{text:'common',reward:{herb:1}}}},
 {id:'EXP-R',name:'Rare',params:{environment_tags:{any:['grassland']},rarity:'rare',base_weight:10,success:{base_rate:1},on_success:{text:'rare',reward:{rare_herb:1}}}},
 {id:'EXP-D',name:'Desert',params:{environment_tags:{any:['desert']},rarity:'epic',base_weight:100,success:{base_rate:1}}}
];
const low=R.resolveExploration({request:{quest_context:{map_id:'MAP-GRASS'},effective_enemy_budget:0,exploration_seed:77,stone_modifiers:{}},outcome_master:outcomes,map_master:maps,adventure_settings:settings});
const high=R.resolveExploration({request:{quest_context:{map_id:'MAP-GRASS'},effective_enemy_budget:20,exploration_seed:77,stone_modifiers:{}},outcome_master:outcomes,map_master:maps,adventure_settings:settings});
assert.deepEqual(low.candidate_outcome_ids,['EXP-C','EXP-R']);
assert(!low.candidate_outcome_ids.includes('EXP-D'));
const lowRare=low.candidate_weights.find(x=>x.outcome_id==='EXP-R'),highRare=high.candidate_weights.find(x=>x.outcome_id==='EXP-R');
assert.equal(lowRare.adjusted_weight,10);
assert.equal(highRare.adjusted_weight,30,'higher Quest Budget must increase rare outcome weight, not quantity');
assert.equal(high.candidate_weights.find(x=>x.outcome_id==='EXP-C').adjusted_weight,10);

// Quest runtime snapshots Battle and Exploration results and never applies encounter_override to random slots.
const events=[{id:'E-B',usage:'story',type:'battle',intensity:'normal'},{id:'E-X',usage:'story',type:'exploration',intensity:'normal'}];
const quest={id:'Q-RUN',enemy_budget:10,adventure_duration_seconds:20,context:{map_id:'MAP-GRASS'},boxes:[{box_id:'B1',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[{kind:'fixed_event',event_id:'E-B',order:1,failure_policy:'quest_fail',encounter_override:{mode:'required_monsters',required_monsters:[{monster_id:'M-BOSS',count:1}]}},{kind:'fixed_event',event_id:'E-X',order:2,failure_policy:'continue'}],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]};
const run=S.simulateQuest({quest,events,tablets,maps,explorationOutcomes:outcomes,adventureSettings:settings,difficultySnapshot:difficulty,resolveBattleEncounter:({request})=>R.resolveEncounter({request,monster_master:monsters,map_master:maps,adventure_settings:settings}),resolveExploration:({request})=>R.resolveExploration({request,outcome_master:outcomes,map_master:maps,adventure_settings:settings}),simulateBattle:({formation,seed,encounter_result})=>({victory:true,seed,formation,encounter_result,reward:{},playback_events:[{type:'battle_start'},{type:'battle_end'}]})});
assert.equal(run.final_result.success,true);
assert.equal(run.battle_results.length,1);
assert.equal(run.exploration_results.length,1);
assert.equal(run.event_results[1].exploration_result_index,0);
assert.equal(run.difficulty_snapshot.effective_enemy_budget,22);
assert.equal(run.reward_scaling_snapshot.difficulty_reward_multiplier,1.12);
assert.equal(run.battle_results[0].encounter_request.encounter_override.mode,'required_monsters');

console.log('adventure-tag-encounter-exploration-runtime-p7b PASS');
