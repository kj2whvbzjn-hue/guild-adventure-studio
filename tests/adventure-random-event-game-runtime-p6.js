'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const Core=require('../export-core.js');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const story=fs.readFileSync('assets/shared/js/adventure-story-system.js','utf8');
const studio=fs.readFileSync('studio/index.html','utf8');

for(const token of [
 'function adventureRandomStaticCandidates(content,placement)',
 "code:'FORMAL_QUEST_RANDOM_EVENT_NO_CANDIDATES'",
 "code:'FORMAL_QUEST_RANDOM_EVENT_RESOLVER_PENDING'",
 "FORMAL_QUEST_RANDOM_EVENT_RESOLVER_PENDING:'Random Event候補に未対応ResolverのEventがあります'",
 'P7-Bで実行可能なStory Questがありません。',
 'function adventureEventCondition(event,flags)',
 'checkEventCondition:adventureEventCondition',
 'resolveEvent:adventureEventResult'
])assert(app.includes(token),`P6 Game integration missing: ${token}`);
assert(!app.includes("FORMAL_QUEST_RANDOM_EVENT_PENDING:'Random EventはP6で実行対応'"),'P5 Random Event pending import block must be retired');

for(const token of [
 'function randomEventCandidates(events,placement,flags={},check,questContext={})',
 "eventUsageValues(event).includes('random')",
 'const selectionSeed=Math.floor(random()*0x100000000)>>>0',
 'random_selections=[]',
 "reason:'random_event_required_no_candidates'",
 "reason:'random_event_no_candidates'",
 'context_snapshot:{quest_context:clone(quest.context||{}),flags:clone(workingFlags)}',
 'r.random_selections=Array.isArray(r.random_selections)?r.random_selections:[];'
])assert(story.includes(token),`P6 Story Runtime integration missing: ${token}`);

const baseBox={box_id:'BOX-1',order:1,pre_scene_id:null,mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]};
const randomPlacement={kind:'random_event',order:1,failure_policy:'continue',filter:{event_type:'special',group:null,tags:[]},allow_none:true,required:false,box_side_individual_probability_override:false};
const quest={id:'Q-P6',name:'P6',adventure_duration_seconds:60,context:{},boxes:[{...baseBox,event_zone_before_pre:[randomPlacement]}]};
let data={chapters:[],quests:[quest],events:[{id:'R-SAFE',name:'safe',usage:'random',type:'special',random_base_weight:1,enabled:true}],masters:{}};
let assessment=Core.formalStoryQuestAssessment(data,quest);
assert.equal(assessment.ready,true);assert.equal(assessment.p5_runtime_ready,false);assert.equal(assessment.p6_runtime_ready,true);
assert.equal(Core.summarizeFormalStoryQuests(data).p6_runtime_ready_count,1);
assert(!Core.collectFormalQuestExportIssues(data).issues.some(x=>x.code==='FORMAL_QUEST_P6_RANDOM_EVENT_PENDING'));

const p7Quest={...quest,boxes:[{...quest.boxes[0],event_zone_before_pre:[{...randomPlacement,filter:{event_type:null,group:null,tags:[]}}]}]};
const p7={...data,quests:[p7Quest],events:[{id:'R-BATTLE',name:'battle',usage:'random',type:'battle',random_base_weight:1,enabled:true}]};
assessment=Core.formalStoryQuestAssessment(p7,p7Quest);
assert.equal(assessment.ready,true);assert.equal(assessment.p6_runtime_ready,false);assert(assessment.p6_runtime.issues.some(x=>x.code==='FORMAL_QUEST_P7_RANDOM_EVENT_RESOLVER_PENDING'));

for(const token of ['P7-B 実行可能Quest','P7-B 正式Quest / Game Runtime','3. P7-B Game Runtime','P7-B実行可'])assert(studio.includes(token),`Studio P7-B workflow label missing: ${token}`);
console.log('adventure-random-event-game-runtime-p6 PASS');
