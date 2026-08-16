'use strict';
const assert=require('node:assert/strict');
const S=require('../assets/shared/js/adventure-story-system.js');

const emptyZones=()=>({event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]});
const fixed=(event_id,order=1,failure_policy='continue')=>({kind:'fixed_event',event_id,order,failure_policy});

// Split 1: simulateQuest is Quest Box only; the retired legacy simulator is absent.
assert.equal(typeof S.simulateLegacySectionQuest,'undefined');
const noFallback=S.simulateQuest({quest:{id:'Q-NO-BOX',adventure_duration_seconds:20,boxes:[]},scenes:[],seed:1});
assert.equal(noFallback.timeline_result.length,0);
assert.equal(noFallback.section_id,'');
assert.equal(noFallback.chapter_id,'');
assert.equal(noFallback.adventure_duration_seconds,20);

// Formal Quest Box simulation: snapshot + fixed Event + reward/flag aggregation.
const scenes=[{id:'SC-1',chapter_id:'CH-1',section_id:'SEC-1',dialogues:[{speaker:'A',text:'snapshot text'}]}];
const quest={id:'Q1',adventure_duration_seconds:100,boxes:[{
  box_id:'BOX-1',order:1,pre_scene_id:'SC-1',mid_scene_id:null,post_scene_id:null,
  event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[fixed('E1')]
}]};
const run=S.simulateQuest({quest,scenes,events:[{id:'E1',type:'special'}],partySnapshot:[{id:'P1'}],seed:7,resolveEvent:()=>({success:true,reward:{gold:5},flags:{F1:true}})});
assert.equal(run.timeline_result.length,2);
assert.equal(run.timeline_result.at(-1).at_seconds,100);
assert.equal(run.event_results[0].event_id,'E1');
assert.equal(run.reward_result.gold,5);
assert.equal(run.flag_result.F1,true);
assert.equal(run.scene_snapshots[0].dialogues[0].text,'snapshot text');
assert.equal(run.chapter_id,'CH-1');
assert.equal(run.section_id,'SEC-1');
scenes[0].dialogues[0].text='changed master';
assert.equal(run.scene_snapshots[0].dialogues[0].text,'snapshot text');

// Playback and one-shot commit use the stored QuestRun result only.
const complete=S.playbackState(run,Date.parse(run.playback_started_at)+101000);
assert.equal(complete.complete,true);
assert.equal(complete.visible_timeline.length,2);
const save={};
assert.equal(S.commitQuestRun(run,save,{applyReward:(s,r)=>s.gold=r.gold,applyFlags:(s,f)=>s.flags=f}).success,true);
assert.equal(save.gold,5);
assert.equal(save.flags.F1,true);
assert.equal(S.commitQuestRun(run,save,{}).reason,'already_applied');

// quest_fail stops later formal steps and suppresses reward commit while preserving flag observations.
const failedQuest={id:'Q2',adventure_duration_seconds:40,boxes:[
  {box_id:'A',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[fixed('E2',1,'quest_fail')],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]},
  {box_id:'B',order:2,pre_scene_id:'SC-1',mid_scene_id:null,post_scene_id:null,...emptyZones()}
]};
const failed=S.simulateQuest({quest:failedQuest,events:[{id:'E2',type:'special'}],scenes,seed:8,resolveEvent:()=>({success:false,failed:true,reason:'trap',reward:{gold:20},flags:{'F-TRAP-SEEN':true}})});
assert.equal(failed.final_result.success,false);
assert.equal(failed.timeline_result.length,1);
assert.deepEqual(failed.final_result.final_state,{status:'failure',processed_box_count:1,last_processed_box_id:'A'});
assert.deepEqual(failed.reward_result,{});
assert.equal(failed.reward_history[0].gold,20);
assert.equal(failed.flag_result['F-TRAP-SEEN'],true);
const failedSave={gold:100,flags:{}};
const failedCommit=S.commitQuestRun(failed,failedSave,{applyReward:(target,reward)=>{target.gold+=(reward.gold||0);},applyFlags:(target,flags)=>Object.assign(target.flags,flags),applyQuestProgress:()=>{throw new Error('failed Quest must not complete progress');}});
assert.equal(failedCommit.applied,true);assert.equal(failedCommit.success,false);assert.equal(failedSave.gold,100);assert.equal(failedSave.flags['F-TRAP-SEEN'],true);

// Battle playback event contract remains intact for formal QuestRun Battle results.
assert.equal(S.validatePlaybackEvents([{type:'battle_start'},{type:'damage'},{type:'battle_end'}]),true);
assert.equal(S.validatePlaybackEvents([{type:'debug_line'}]),false);

// Quest start gate and cost remain formal Quest-owned behavior.
const gate=S.questStartRequirements({prerequisite_ids:['Q-PREV'],required_flags:['F-OPEN']},{completedQuestIds:['Q-PREV'],flags:{'F-OPEN':true}});
assert.equal(gate.ok,true);
assert.equal(S.questStartRequirements({prerequisite_ids:['Q-PREV'],required_flags:['F-OPEN']},{completedQuestIds:[],flags:{}}).ok,false);
const startCost=S.normalizeQuestStartCost({start_cost:{gold:30,resources:{'TBL-RED':2}}});
assert.deepEqual(startCost,{gold:30,resources:{'TBL-RED':2}});
const startSave={guild:{gold:100},quest_resources:{'TBL-RED':3}};
assert.equal(S.canAffordQuestStartCost(startSave,startCost).ok,true);
const consumed=S.consumeQuestStartCost(startSave,startCost);
assert.equal(consumed.consumed,true);assert.equal(startSave.guild.gold,70);assert.equal(startSave.quest_resources['TBL-RED'],1);
const progressedRun=S.simulateQuest({quest:{id:'Q-PROG',adventure_duration_seconds:10,next_quest_ids:['Q-2'],set_flags:['F-Q'],boxes:[]},startCostResult:{consumed:true,cost:{gold:10,resources:{}}}});
assert.equal(progressedRun.quest_progress_result.complete_quest_id,'Q-PROG');
assert.equal(progressedRun.quest_progress_result.unlock_quest_ids[0],'Q-2');
assert.equal(progressedRun.quest_progress_result.set_flags['F-Q'],true);
assert.equal(progressedRun.start_cost_result.cost.gold,10);

console.log('adventure-story-system PASS');

// QuestRun persistence: active run survives save normalization, history is bounded and commit is one-shot.
const saveStore={guild:{gold:10},flags:{}};
const stored=S.startQuestRunPlayback(saveStore,{...run,quest_run_id:'QR-STORE-1',results_applied:false},{startedAt:'2026-08-11T00:00:00.000Z'});
assert.equal(stored.playback_started_at,'2026-08-11T00:00:00.000Z');
assert.equal(S.activeQuestRun(saveStore).quest_run_id,'QR-STORE-1');
const earlyCommit=S.commitStoredQuestRun(saveStore,'QR-STORE-1',{},Date.parse('2026-08-11T00:00:30.000Z'));
assert.equal(earlyCommit.applied,false);
assert.equal(earlyCommit.reason,'playback_incomplete');
assert.equal(S.resumeQuestRun(saveStore,Date.parse('2026-08-11T00:02:00.000Z')).playback.complete,true);
const committed=S.commitStoredQuestRun(saveStore,'QR-STORE-1',{applyReward:(target,reward)=>target.guild.gold+=reward.gold||0,applyFlags:(target,flags)=>Object.assign(target.flags,flags)},Date.parse('2026-08-11T00:02:00.000Z'));
assert.equal(committed.applied,true);
assert.equal(saveStore.guild.gold,15);
assert.equal(saveStore.flags.F1,true);
assert.equal(S.activeQuestRun(saveStore),null);
assert.equal(S.commitStoredQuestRun(saveStore,'QR-STORE-1',{}).reason,'already_applied');
const failedStoredSave={guild:{gold:50},flags:{}};
S.startQuestRunPlayback(failedStoredSave,{...failed,quest_run_id:'QR-FAILED-RETURN',results_applied:false},{startedAt:'2026-08-11T00:00:00.000Z'});
const failedStoredCommit=S.commitStoredQuestRun(failedStoredSave,'QR-FAILED-RETURN',{applyReward:(target,reward)=>{target.guild.gold+=reward.gold||999;},applyFlags:(target,flags)=>Object.assign(target.flags,flags),applyQuestProgress:()=>{throw new Error('failed Quest must not commit quest progress');}},Date.parse('2026-08-11T00:06:00.000Z'));
assert.equal(failedStoredCommit.applied,true);assert.equal(failedStoredCommit.success,false);assert.equal(failedStoredSave.guild.gold,50);assert.equal(failedStoredSave.flags['F-TRAP-SEEN'],true);assert.equal(S.activeQuestRun(failedStoredSave),null);
const normalizedOldRun=S.normalizeQuestRun({quest_run_id:'QR-OLD',timeline_result:[{box_id:'OLD-1'}],final_result:{success:false,failure:{reason:'old_saved_run'}}});
assert.deepEqual(normalizedOldRun.final_result.final_state,{status:'failure',processed_box_count:1,last_processed_box_id:'OLD-1'});
const bounded={};for(let i=0;i<25;i++)S.saveQuestRun(bounded,{...run,quest_run_id:`QR-${i}`},{activate:false,historyLimit:20});
assert.equal(S.questRunHistory(bounded).length,20);
assert.equal(S.questRunHistory(bounded).at(-1).quest_run_id,'QR-5');
console.log('adventure-quest-run-store PASS');
