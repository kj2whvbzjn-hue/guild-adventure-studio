const assert=require('assert');
const S=require('../assets/shared/js/adventure-story-system.js');

// Compatibility: existing sections do not receive five boxes, new sections do.
const existing=S.normalizeSection({id:'SEC-1'});
assert.equal(existing.adventure_duration_seconds,300);
assert.deepEqual(existing.boxes,[]);
assert.equal(S.normalizeSection({id:'SEC-NEW'},{isNew:true}).boxes.length,5);
assert.equal(S.defaultBoxes().length,5);

// Chapter encounter candidates and budget battle generation.
const chapter=S.normalizeChapter({available_monster_ids:['M1','M2'],random_event_candidates:[{event_id:'E1',weight:2}]});
const gen=S.generateRandomBattle({budget:5,monsterIds:chapter.available_monster_ids,monsters:[{id:'M1',enemy_budget_cost:2},{id:'M2',enemy_budget_cost:3}],random:S.rng(1)});
assert(gen.remaining_budget>=0&&gen.remaining_budget<2);
assert(gen.formation.length>0);
// Weight 0 is preserved as an explicit disabled candidate; missing weight defaults to 1.
const weightedChapter=S.normalizeChapter({random_event_candidates:[{event_id:'E-OFF',weight:0},{event_id:'E-DEFAULT'}]});
assert.equal(weightedChapter.random_event_candidates[0].weight,0);
assert.equal(weightedChapter.random_event_candidates[1].weight,1);

// Complete simulation: scene snapshot, weighted random event, reward/flag aggregation and deterministic timeline.
const baseOpts={quest:{id:'Q1'},section:{id:'S1',adventure_duration_seconds:100,boxes:[{id:'B1',type:'scene',ref_id:'SC1'},{id:'B2',type:'random_event'}]},chapter:{id:'C1',random_event_candidates:[{event_id:'E0',weight:100},{event_id:'E1',weight:1}]},scenes:[{id:'SC1',dialogues:[{speaker:'A',text:'snapshot text'}]}],events:[{id:'E0'},{id:'E1'}],partySnapshot:[{id:'P1'}],seed:7,checkEventCondition:(event)=>event.id!=='E0',resolveEvent:({event})=>({success:true,reward:{gold:event.id==='E1'?5:99},flags:{F1:true}})};
const run=S.simulateQuest(baseOpts);
assert.equal(run.timeline_result.length,2);
assert.equal(run.timeline_result[0].at_seconds,50);
assert.equal(run.timeline_result[1].at_seconds,100);
assert.equal(run.event_results[0].event_id,'E1');
assert.equal(run.reward_result.gold,5);
assert.equal(run.flag_result.F1,true);
assert.equal(run.scene_snapshots[0].dialogues[0].text,'snapshot text');
// A prior Box flag change participates in the eligibility check of a later random_event.
const flagDriven=S.simulateQuest({quest:{id:'Q-FLAG'},section:{id:'S-FLAG',boxes:[{id:'SET',type:'event',ref_id:'E-SET'},{id:'RAND',type:'random_event'}]},chapter:{id:'C-FLAG',random_event_candidates:[{event_id:'E-LOCKED',weight:100},{event_id:'E-OPEN',weight:1}]},events:[{id:'E-SET'},{id:'E-LOCKED',required_flags:['OPEN']},{id:'E-OPEN'}],seed:17,resolveEvent:({event})=>event.id==='E-SET'?{success:true,flags:{OPEN:true}}:{success:true},checkEventCondition:(event,flags)=>!(event.required_flags||[]).some(id=>!flags[id])});
assert.equal(flagDriven.event_results[1].event_id,'E-LOCKED');

// Master edits after simulation cannot mutate snapshots.
baseOpts.scenes[0].dialogues[0].text='changed master';
assert.equal(run.scene_snapshots[0].dialogues[0].text,'snapshot text');

// Start-time-based playback and catch-up.
const complete=S.playbackState(run,Date.parse(run.playback_started_at)+101000);
assert.equal(complete.complete,true);
assert.equal(complete.visible_timeline.length,2);

// Result commit is one-shot and does not recalculate.
const save={};
assert.equal(S.commitQuestRun(run,save,{applyReward:(s,r)=>s.gold=r.gold,applyFlags:(s,f)=>s.flags=f}).success,true);
assert.equal(save.gold,5);
assert.equal(save.flags.F1,true);
assert.equal(S.commitQuestRun(run,save,{}).reason,'already_applied');

// Failure terminates later boxes and removes all formal rewards.
const failed=S.simulateQuest({quest:{id:'Q2'},section:{id:'S2',boxes:[{id:'A',type:'event',ref_id:'E2'},{id:'B',type:'scene',ref_id:'SC2'}]},chapter:{id:'C2'},events:[{id:'E2'}],scenes:[{id:'SC2',dialogues:[]}],seed:8,resolveEvent:()=>({success:false,failed:true,reason:'trap',reward:{gold:20}})});
assert.equal(failed.final_result.success,false);
assert.equal(failed.timeline_result.length,1);
assert.deepEqual(failed.reward_result,{});
assert.equal(failed.reward_history[0].gold,20);


// Fixed battle Event uses the same formation-based Battle Core entry as random battle.
let fixedCalls=0, eventResolverCalls=0;
const fixed=S.simulateQuest({quest:{id:'QF'},section:{id:'SF',boxes:[{id:'FB',type:'event',ref_id:'EB'}]},chapter:{id:'CF'},events:[{id:'EB',type:'battle',battle_formation:[{monster_id:'M1',count:2}]}],seed:9,resolveEvent:()=>{eventResolverCalls++;return{success:true}},simulateBattle:({formation,seed,event})=>{fixedCalls++;assert.deepEqual(formation,[{monster_id:'M1',count:2}]);assert.equal(event.id,'EB');assert(Number.isInteger(seed));return{victory:true,reward:{gold:12},playback_events:[{type:'battle_start'},{type:'battle_end'}]}}});
assert.equal(fixedCalls,1);
assert.equal(eventResolverCalls,0);
assert.equal(fixed.battle_results.length,1);
assert.equal(fixed.event_results[0].type,'battle');
assert.equal(fixed.reward_result.gold,12);
assert.equal(fixed.timeline_result[0].battle_result_index,0);

const fixedFail=S.simulateQuest({quest:{id:'QF2'},section:{id:'SF2',boxes:[{id:'FB',type:'event',ref_id:'EB'},{id:'AFTER',type:'scene',ref_id:'SC'}]},chapter:{id:'CF2'},events:[{id:'EB',type:'battle',battle_formation:[{monster_id:'M1',count:1}]}],scenes:[{id:'SC',dialogues:[]}],seed:10,simulateBattle:()=>({victory:false,reason:'boss_lost',reward:{gold:999},playback_events:[]})});
assert.equal(fixedFail.final_result.success,false);
assert.equal(fixedFail.final_result.failure.reason,'boss_lost');
assert.equal(fixedFail.timeline_result.length,1);
assert.deepEqual(fixedFail.reward_result,{});

// Fixed battle normalization and playback event contract.
assert.deepEqual(S.normalizeEvent({type:'battle',battle_formation:[{monster_id:'M1',count:2.8}]}).battle_formation,[{monster_id:'M1',count:2}]);
assert.equal(S.validatePlaybackEvents([{type:'battle_start'},{type:'damage'},{type:'battle_end'}]),true);
assert.equal(S.validatePlaybackEvents([{type:'debug_line'}]),false);
const invalidPlayback=S.simulateQuest({quest:{id:'Q-INVALID-PLAYBACK'},section:{id:'S-INVALID-PLAYBACK',boxes:[{id:'B-INVALID',type:'event',ref_id:'E-INVALID'}]},chapter:{id:'C-INVALID-PLAYBACK'},events:[{id:'E-INVALID',type:'battle',battle_formation:[{monster_id:'M1',count:1}]}],seed:11,simulateBattle:()=>({victory:true,reward:{gold:999},playback_events:[{type:'debug_line'}]})});
assert.equal(invalidPlayback.final_result.success,false);
assert.equal(invalidPlayback.final_result.failure.reason,'simulation_error');
assert(invalidPlayback.final_result.failure.message.includes('Invalid Battle Playback Event type: debug_line'));
assert.equal(invalidPlayback.timeline_result.length,0);
assert.deepEqual(invalidPlayback.reward_result,{});

// Quest start gate and cost: prerequisite/flag checks are deterministic and consumption is one-shot at start.
const gate=S.questStartRequirements({prerequisite_ids:['Q-PREV'],required_flags:['F-OPEN']},{completedQuestIds:['Q-PREV'],flags:{'F-OPEN':true}});
assert.equal(gate.ok,true);
assert.equal(S.questStartRequirements({prerequisite_ids:['Q-PREV'],required_flags:['F-OPEN']},{completedQuestIds:[],flags:{}}).ok,false);
const startCost=S.normalizeQuestStartCost({start_cost:{gold:30,resources:{'TBL-RED':2}}});
assert.deepEqual(startCost,{gold:30,resources:{'TBL-RED':2}});
const startSave={guild:{gold:100},quest_resources:{'TBL-RED':3}};
assert.equal(S.canAffordQuestStartCost(startSave,startCost).ok,true);
const consumed=S.consumeQuestStartCost(startSave,startCost);
assert.equal(consumed.consumed,true);assert.equal(startSave.guild.gold,70);assert.equal(startSave.quest_resources['TBL-RED'],1);
assert.equal(S.consumeQuestStartCost(startSave,startCost).reason,'insufficient_start_cost');
const progress=S.questProgressResult({id:'Q-NOW',next_quest_ids:['Q-NEXT'],set_flags:['F-DONE']},true);
assert.deepEqual(progress,{complete_quest_id:'Q-NOW',unlock_quest_ids:['Q-NEXT'],set_flags:{'F-DONE':true}});
const progressedRun=S.simulateQuest({quest:{id:'Q-PROG',next_quest_ids:['Q-2'],set_flags:['F-Q']},section:{id:'S-PROG',boxes:[]},chapter:{id:'C-PROG'},startCostResult:{consumed:true,cost:{gold:10,resources:{}}}});
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
assert.equal(S.resumeQuestRun(saveStore,Date.parse('2026-08-11T00:02:00.000Z')).playback.complete,true);
const committed=S.commitStoredQuestRun(saveStore,'QR-STORE-1',{applyReward:(s,r)=>s.guild.gold+=r.gold||0,applyFlags:(s,f)=>Object.assign(s.flags,f)});
assert.equal(committed.applied,true);
assert.equal(saveStore.guild.gold,15);
assert.equal(saveStore.flags.F1,true);
assert.equal(S.activeQuestRun(saveStore),null);
assert.equal(S.commitStoredQuestRun(saveStore,'QR-STORE-1',{}).reason,'already_applied');
const progressSave={guild:{gold:0},flags:{},quest_progress:{completed_quest_ids:[],unlocked_quest_ids:[]}};
const progressRun={...run,quest_run_id:'QR-PROGRESS',results_applied:false,final_result:{success:true},reward_result:{},flag_result:{},quest_progress_result:{complete_quest_id:'Q-DONE',unlock_quest_ids:['Q-NEXT','Q-NEXT'],set_flags:{'F-QUEST':true}}};
const progressCommit=S.commitQuestRun(progressRun,progressSave,{applyQuestProgress:(save,p)=>{save.quest_progress.completed_quest_ids.push(p.complete_quest_id);save.quest_progress.unlocked_quest_ids.push(...new Set(p.unlock_quest_ids));Object.assign(save.flags,p.set_flags);}});
assert.equal(progressCommit.applied,true);assert.deepEqual(progressSave.quest_progress.completed_quest_ids,['Q-DONE']);assert.deepEqual(progressSave.quest_progress.unlocked_quest_ids,['Q-NEXT']);assert.equal(progressSave.flags['F-QUEST'],true);
assert.equal(S.commitQuestRun(progressRun,progressSave,{}).reason,'already_applied');
const bounded={};for(let i=0;i<25;i++)S.saveQuestRun(bounded,{...run,quest_run_id:`QR-${i}`},{activate:false,historyLimit:20});
assert.equal(S.questRunHistory(bounded).length,20);
assert.equal(S.questRunHistory(bounded).at(-1).quest_run_id,'QR-5');
console.log('adventure-quest-run-store PASS');
