'use strict';
const assert=require('node:assert/strict');
const S=require('../assets/shared/js/adventure-story-system.js');

const emptyZones=()=>({event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]});
const fixed=(id,order=1,failure_policy='continue')=>({kind:'fixed_event',event_id:id,order,failure_policy});

// D-02: Quest owns duration; D-01: first referenced Scene supplies QuestRun chapter/section snapshot.
const q3={id:'Q-P5-SCENE',adventure_duration_seconds:120,boxes:[
  {box_id:'BOX-2',order:2,pre_scene_id:'SC-4',mid_scene_id:null,post_scene_id:null,...emptyZones()},
  {box_id:'BOX-1',order:1,pre_scene_id:'SC-1',mid_scene_id:'SC-2',post_scene_id:'SC-3',...emptyZones()}
]};
const scenes=[
  {id:'SC-1',chapter_id:'CH-A',section_id:'SEC-A',dialogues:[{text:'one'}]},
  {id:'SC-2',chapter_id:'CH-A',section_id:'SEC-A',dialogues:[{text:'two'}]},
  {id:'SC-3',chapter_id:'CH-B',section_id:'SEC-B',dialogues:[{text:'three'}]},
  {id:'SC-4',chapter_id:'CH-C',section_id:'SEC-C',dialogues:[{text:'four'}]}
];
const sceneRun=S.simulateQuest({quest:q3,section:{id:'LEGACY',adventure_duration_seconds:999,boxes:[{id:'OLD',type:'scene',ref_id:'SC-X'}]},chapter:{id:'OLD-CH'},scenes,seed:101});
assert.deepEqual(sceneRun.timeline_result.map(x=>x.ref_id),['SC-1','SC-2','SC-3','SC-4']);
assert.deepEqual(sceneRun.timeline_result.map(x=>x.scene_position),['pre','mid','post','pre']);
assert.equal(sceneRun.adventure_duration_seconds,120);
assert.equal(sceneRun.chapter_id,'CH-A');
assert.equal(sceneRun.section_id,'SEC-A');
assert.equal(sceneRun.timeline_result.at(-1).at_seconds,120);
assert(!sceneRun.timeline_result.some(x=>x.ref_id==='SC-X'),'P5 path must not execute Section.boxes when Quest.boxes exist');

// Full P5 order including three Events in one zone and all four Event zones.
const events=['E-A1','E-A2','E-A3','E-B','E-C','E-D'].map(id=>({id,type:'special'}));
const fullQuest={id:'Q-P5-FULL',adventure_duration_seconds:70,boxes:[{
  box_id:'BOX-FULL',order:1,pre_scene_id:'SC-1',mid_scene_id:'SC-2',post_scene_id:'SC-3',
  event_zone_before_pre:[fixed('E-A1',1),fixed('E-A2',2),fixed('E-A3',3)],
  event_zone_pre_to_mid:[fixed('E-B')],event_zone_mid_to_post:[fixed('E-C')],event_zone_after_post:[fixed('E-D')]
}]};
const callOrder=[];
const fullRun=S.simulateQuest({quest:fullQuest,scenes,events,seed:102,resolveEvent:({event})=>{callOrder.push(event.id);return{success:true,flags:{['F-'+event.id]:true}};}});
assert.deepEqual(fullRun.timeline_result.map(x=>x.ref_id),['E-A1','E-A2','E-A3','SC-1','E-B','SC-2','E-C','SC-3','E-D']);
assert.deepEqual(callOrder,['E-A1','E-A2','E-A3','E-B','E-C','E-D']);
assert.equal(fullRun.final_result.success,true);
assert.equal(fullRun.timeline_result.at(-1).at_seconds,70);

// Event failure_policy=continue keeps the Quest moving; quest_fail stops all remaining steps/boxes.
const continueQuest={id:'Q-CONT',adventure_duration_seconds:30,boxes:[{box_id:'BOX-C',order:1,pre_scene_id:'SC-1',mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[fixed('E-FAIL',1,'continue')],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]};
const continueRun=S.simulateQuest({quest:continueQuest,scenes,events:[{id:'E-FAIL',type:'special'}],seed:103,resolveEvent:()=>({success:false,failed:true,reason:'soft_fail',flags:{SEEN:true}})});
assert.equal(continueRun.final_result.success,true);
assert.deepEqual(continueRun.timeline_result.map(x=>x.ref_id),['E-FAIL','SC-1']);
assert.equal(continueRun.event_results[0].success,false);
assert.equal(continueRun.flag_result.SEEN,true);

const failQuest={id:'Q-STOP',adventure_duration_seconds:40,boxes:[
  {box_id:'BOX-1',order:1,pre_scene_id:'SC-1',mid_scene_id:'SC-2',post_scene_id:null,event_zone_before_pre:[],event_zone_pre_to_mid:[fixed('E-STOP',1,'quest_fail')],event_zone_mid_to_post:[],event_zone_after_post:[]},
  {box_id:'BOX-2',order:2,pre_scene_id:'SC-3',mid_scene_id:null,post_scene_id:null,...emptyZones()}
]};
const failRun=S.simulateQuest({quest:failQuest,scenes,events:[{id:'E-STOP',type:'special'}],seed:104,resolveEvent:()=>({success:false,failed:true,reason:'hard_fail'})});
assert.equal(failRun.final_result.success,false);
assert.equal(failRun.final_result.failure.reason,'hard_fail');
assert.deepEqual(failRun.timeline_result.map(x=>x.ref_id),['SC-1','E-STOP']);
assert.deepEqual(failRun.final_result.final_state,{status:'failure',processed_box_count:2,last_processed_box_id:'BOX-1'});

// Event-only Quest stores empty chapter/section snapshots.
const eventOnly=S.simulateQuest({quest:{id:'Q-EVENT-ONLY',adventure_duration_seconds:15,boxes:[{box_id:'BOX-E',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[fixed('E-ONLY')],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]},events:[{id:'E-ONLY',type:'special'}],seed:105});
assert.equal(eventOnly.chapter_id,'');
assert.equal(eventOnly.section_id,'');
assert.equal(eventOnly.adventure_duration_seconds,15);

// P5 must not revive legacy fixed battle_formation. Battle/Exploration Resolver is P7.
let resolverCalls=0;
const battleAsEvent=S.simulateQuest({quest:{id:'Q-BATTLE-BOUNDARY',adventure_duration_seconds:10,boxes:[{box_id:'BOX-B',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[fixed('E-BATTLE')],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]},events:[{id:'E-BATTLE',type:'battle',battle_formation:[{monster_id:'OLD',count:9}]}],seed:106,resolveEvent:()=>{resolverCalls++;return{success:true}},simulateBattle:()=>{throw new Error('P5 Quest Box path must not call legacy battle_formation Battle Core');}});
assert.equal(resolverCalls,1);
assert.equal(battleAsEvent.battle_results.length,0);
assert.equal(battleAsEvent.final_result.success,true);

// P6 owns Random Event execution; this P5 regression remains focused on ordered fixed Event/Scene execution and P7 battle boundary.

// Resolver/snapshot callback exceptions become a deterministic failed QuestRun rather than escaping after start cost consumption.
const resolverError=S.simulateQuest({quest:{id:'Q-RESOLVER-ERROR',adventure_duration_seconds:10,boxes:[{box_id:'BOX-X',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[fixed('E-X')],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]},events:[{id:'E-X',type:'special'}],seed:108,resolveEvent:()=>{throw new Error('resolver exploded')}});
assert.equal(resolverError.final_result.success,false);
assert.equal(resolverError.final_result.failure.reason,'simulation_error');
assert.match(resolverError.final_result.failure.message,/resolver exploded/);
assert.equal(resolverError.final_result.failure.event_id,'E-X');

const snapshotError=S.simulateQuest({quest:{id:'Q-SNAPSHOT-ERROR',adventure_duration_seconds:10,boxes:[{box_id:'BOX-S',order:1,pre_scene_id:'SC-1',mid_scene_id:null,post_scene_id:null,...emptyZones()}]},scenes,seed:109,snapshotScene:()=>{throw new Error('snapshot exploded')}});
assert.equal(snapshotError.final_result.success,false);
assert.equal(snapshotError.final_result.failure.reason,'simulation_error');
assert.match(snapshotError.final_result.failure.message,/snapshot exploded/);
assert.equal(snapshotError.final_result.failure.scene_id,'SC-1');

console.log('adventure-quest-box-runtime-p5 PASS');
