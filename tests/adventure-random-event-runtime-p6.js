'use strict';
const assert=require('node:assert/strict');
const S=require('../assets/shared/js/adventure-story-system.js');

const zones=(before=[])=>({event_zone_before_pre:before,event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]});
const fixed=(event_id,order=1,failure_policy='continue')=>({kind:'fixed_event',event_id,order,failure_policy});
const slot=(over={})=>({kind:'random_event',order:1,failure_policy:'continue',filter:{event_type:null,group:null,tags:[]},allow_none:true,required:false,box_side_individual_probability_override:false,...over});
const quest=(id,rows,{scene=null,context={map_ref:'MAP-X',difficulty:3,tags:['night']}}={})=>({id,adventure_duration_seconds:30,context,boxes:[{box_id:'BOX-1',order:1,pre_scene_id:scene,mid_scene_id:null,post_scene_id:null,...zones(rows)}]});

// usage=random, type/group/all-tags, enabled and positive weight are required for the candidate set.
const filterEvents=[
 {id:'R-GOOD',usage:'random',type:'special',group:'ruins',tags:['rare','night'],random_base_weight:5,enabled:true},
 {id:'R-STORY',usage:'story',type:'special',group:'ruins',tags:['rare','night'],random_base_weight:100,enabled:true},
 {id:'R-TYPE',usage:'random',type:'choice',group:'ruins',tags:['rare','night'],random_base_weight:100,enabled:true},
 {id:'R-GROUP',usage:'random',type:'special',group:'forest',tags:['rare','night'],random_base_weight:100,enabled:true},
 {id:'R-TAG',usage:'random',type:'special',group:'ruins',tags:['rare'],random_base_weight:100,enabled:true},
 {id:'R-ZERO',usage:'random',type:'special',group:'ruins',tags:['rare','night'],random_base_weight:0,enabled:true},
 {id:'R-OFF',usage:'random',type:'special',group:'ruins',tags:['rare','night'],random_base_weight:100,enabled:false}
];
const filterRun=S.simulateQuest({quest:quest('Q-FILTER',[slot({filter:{event_type:'special',group:'ruins',tags:['rare','night']}})]),events:filterEvents,seed:6001,resolveEvent:()=>({success:true})});
assert.equal(filterRun.final_result.success,true);
assert.equal(filterRun.random_selections.length,1);
assert.deepEqual(filterRun.random_selections[0].candidate_event_ids,['R-GOOD']);
assert.equal(filterRun.random_selections[0].selected_event_id,'R-GOOD');
assert.equal(filterRun.timeline_result[0].placement_kind,'random_event');
assert.equal(filterRun.event_results[0].random_selection_index,0);
assert.deepEqual(filterRun.random_selections[0].context_snapshot.quest_context,{map_ref:'MAP-X',difficulty:3,tags:['night']});

// Required flags are the P6 machine-readable Event condition. They are evaluated at slot arrival after earlier Event results.
const flagEvents=[
 {id:'E-SET',usage:'story',type:'special'},
 {id:'R-LOCKED',usage:'random',type:'special',required_flags:['OPEN'],random_base_weight:1},
 {id:'R-NEVER',usage:'random',type:'special',required_flags:['MISSING'],random_base_weight:100}
];
const flagRun=S.simulateQuest({quest:quest('Q-FLAG',[fixed('E-SET',1),slot({order:2})]),events:flagEvents,seed:6002,resolveEvent:({event})=>event.id==='E-SET'?{success:true,flags:{OPEN:true}}:{success:true}});
assert.equal(flagRun.final_result.success,true);
assert.equal(flagRun.random_selections[0].selected_event_id,'R-LOCKED');
assert.deepEqual(flagRun.random_selections[0].context_snapshot.flags,{OPEN:true});
assert.deepEqual(flagRun.timeline_result.map(x=>x.ref_id),['E-SET','R-LOCKED']);

// Free/unfinished conditions are deliberately not interpreted by P6; required_flags remains the only built-in condition contract.
const freeConditionRun=S.simulateQuest({quest:quest('Q-FREE',[slot()]),events:[{id:'R-FREE',usage:'random',type:'special',conditions:'night only',random_base_weight:1}],seed:6003});
assert.equal(freeConditionRun.final_result.success,true);
assert.equal(freeConditionRun.random_selections[0].selected_event_id,'R-FREE');

// A callback may add a machine-readable project-specific condition without making free text executable.
const callbackRun=S.simulateQuest({quest:quest('Q-CHECK',[slot()]),events:[{id:'R-A',usage:'random',type:'special',random_base_weight:10},{id:'R-B',usage:'random',type:'special',random_base_weight:1}],seed:6004,checkEventCondition:event=>event.id==='R-B'});
assert.deepEqual(callbackRun.random_selections[0].candidate_event_ids,['R-B']);
assert.equal(callbackRun.random_selections[0].selected_event_id,'R-B');

// Same Quest seed + same reached slots produces the same per-slot seed and selected Event sequence. Weight 0 never participates.
const weightedEvents=[{id:'R-A',usage:'random',type:'special',random_base_weight:1},{id:'R-B',usage:'random',type:'special',random_base_weight:4},{id:'R-0',usage:'random',type:'special',random_base_weight:0}];
const weightedQuest={id:'Q-WEIGHT',adventure_duration_seconds:40,context:{difficulty:1},boxes:[{box_id:'BOX-W',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,...zones([slot({order:1}),slot({order:2}),slot({order:3}),slot({order:4})])}]};
const weighted1=S.simulateQuest({quest:weightedQuest,events:weightedEvents,seed:6010});
const weighted2=S.simulateQuest({quest:weightedQuest,events:weightedEvents,seed:6010});
assert.deepEqual(weighted1.random_selections.map(x=>({seed:x.seed,id:x.selected_event_id})),weighted2.random_selections.map(x=>({seed:x.seed,id:x.selected_event_id})));
assert(weighted1.random_selections.every(x=>!x.candidate_event_ids.includes('R-0')));
assert(weighted1.random_selections.every(x=>x.selected_event_id!=='R-0'));

// Optional + allow_none is the explicit zero-eligible fallback. No virtual "none weight" is invented when positive candidates exist.
const scene={id:'SC-A',chapter_id:'CH-A',section_id:'SEC-A',dialogues:[]};
const noneRun=S.simulateQuest({quest:quest('Q-NONE',[slot({filter:{event_type:'special',group:'missing',tags:[]},allow_none:true,required:false})],{scene:'SC-A'}),events:weightedEvents,scenes:[scene],seed:6020});
assert.equal(noneRun.final_result.success,true);
assert.equal(noneRun.random_selections[0].selected_event_id,'');
assert.equal(noneRun.random_selections[0].outcome,'none');
assert.equal(noneRun.random_selections[0].reason,'no_eligible_candidates');
assert.deepEqual(noneRun.timeline_result.map(x=>x.ref_id),['SC-A']);

const noNoneRun=S.simulateQuest({quest:quest('Q-NO-NONE',[slot({filter:{group:'missing'},allow_none:false,required:false})],{scene:'SC-A'}),events:weightedEvents,scenes:[scene],seed:6021});
assert.equal(noNoneRun.final_result.success,false);
assert.equal(noNoneRun.final_result.failure.reason,'random_event_no_candidates');
assert.equal(noNoneRun.random_selections.length,1);
assert.equal(noNoneRun.timeline_result.length,0);

const requiredRun=S.simulateQuest({quest:quest('Q-REQUIRED',[slot({filter:{group:'missing'},allow_none:true,required:true})]),events:weightedEvents,seed:6022});
assert.equal(requiredRun.final_result.success,false);
assert.equal(requiredRun.final_result.failure.reason,'random_event_required_no_candidates');
assert.equal(requiredRun.random_selections.length,1);

// Slots are drawn only when reached. A prior quest_fail Event prevents later Random Event seed consumption/selection.
const stopQuest=quest('Q-ARRIVAL',[fixed('E-STOP',1,'quest_fail'),slot({order:2})]);
const stopped=S.simulateQuest({quest:stopQuest,events:[{id:'E-STOP',usage:'story',type:'special'},...weightedEvents],seed:6030,resolveEvent:({event})=>event.id==='E-STOP'?{success:false,failed:true,reason:'stop_here'}:{success:true}});
assert.equal(stopped.final_result.success,false);
assert.equal(stopped.final_result.failure.reason,'stop_here');
assert.equal(stopped.random_selections.length,0);

// A selected Random Event obeys the placement failure policy and stores the completed selection before stopping.
const randomFail=S.simulateQuest({quest:quest('Q-RFAIL',[slot({failure_policy:'quest_fail'})],{scene:'SC-A'}),events:[{id:'R-FAIL',usage:'random',type:'special',random_base_weight:1}],scenes:[scene],seed:6031,resolveEvent:()=>({success:false,failed:true,reason:'random_failed'})});
assert.equal(randomFail.final_result.success,false);
assert.equal(randomFail.final_result.failure.reason,'random_failed');
assert.equal(randomFail.random_selections[0].selected_event_id,'R-FAIL');
assert.equal(randomFail.random_selections[0].event_result_index,0);
assert.deepEqual(randomFail.timeline_result.map(x=>x.ref_id),['R-FAIL']);

// QuestRun persistence/playback is selection-only: normalization, save/resume and playback never call the selector again.
const persisted={...weighted1,quest_run_id:'QR-P6-PERSIST',results_applied:false};
const save={};
S.startQuestRunPlayback(save,persisted,{startedAt:'2026-08-15T00:00:00.000Z'});
const stored=S.activeQuestRun(save);
assert.deepEqual(stored.random_selections,persisted.random_selections);
const before=JSON.stringify(stored.random_selections);
S.resumeQuestRun(save,Date.parse('2026-08-15T00:00:05.000Z'));
S.playbackState(stored,Date.parse('2026-08-15T00:00:10.000Z'));
assert.equal(JSON.stringify(S.activeQuestRun(save).random_selections),before);
assert.deepEqual(S.normalizeQuestRun({quest_run_id:'QR-P6-EMPTY'}).random_selections,[]);

console.log('adventure-random-event-runtime-p6 PASS');
