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

// Fixed battle normalization and playback event contract.
assert.deepEqual(S.normalizeEvent({type:'battle',battle_formation:[{monster_id:'M1',count:2.8}]}).battle_formation,[{monster_id:'M1',count:2}]);
assert.equal(S.validatePlaybackEvents([{type:'battle_start'},{type:'damage'},{type:'battle_end'}]),true);
assert.equal(S.validatePlaybackEvents([{type:'debug_line'}]),false);
console.log('adventure-story-system PASS');
