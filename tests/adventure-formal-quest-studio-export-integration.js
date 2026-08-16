const assert=require('node:assert/strict');
const fs=require('node:fs');
const Export=require('../studio/export-core.js');
const section={id:'SEC-1',no:1,title:'節1',boxes:[{type:'scene',ref_id:'SCN-1'}],scenes:[{id:'SCN-1',no:1,title:'Scene'}]};
const data={chapters:[{id:'CH-1',no:1,title:'章1',sections:[section]}],quests:[],events:[],masters:{}};

let q={id:'Q-NORMAL',name:'通常',adventure_duration_seconds:300,links:{chapter_id:'',section_id:''}};
let a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,false);assert.equal(a.ready,false);assert.equal(a.legacy_runtime_ready,false);assert.equal(a.p5_runtime_ready,false);assert.equal(a.p6_runtime_ready,false);assert.equal(a.p7_runtime_ready,false);assert.equal(a.p7_runtime_ready,false);

q={id:'Q-LEGACY',name:'旧互換',adventure_duration_seconds:300,links:{chapter_id:'CH-1',section_id:'SEC-1'}};
a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,false);assert.equal(a.ready,false);assert.equal(a.legacy_runtime_ready,true);assert.equal(a.p5_runtime_ready,false);assert.equal(a.p6_runtime_ready,false);

q={id:'Q-P5',name:'P5正式',adventure_duration_seconds:300,boxes:[{box_id:'BOX-1',name:'Box',order:1,event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}],links:{chapter_id:'',section_id:''}};
a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,true);assert.equal(a.ready,true);assert.equal(a.p5_runtime_ready,true);assert.equal(a.p6_runtime_ready,true);assert.equal(a.p7_runtime_ready,true);assert.equal(a.legacy_runtime_ready,false);

const ready={id:'Q-READY',name:'正式',type:'main',adventure_duration_seconds:180,boxes:[{box_id:'BOX-1',name:'Box',order:1,pre_scene_id:'SCN-1',event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}],links:{chapter_id:'CH-1',section_id:'SEC-1'}};
data.quests=[ready];a=Export.formalStoryQuestAssessment(data,ready);assert.equal(a.ready,true);assert.equal(a.p5_runtime_ready,true);assert.equal(a.p6_runtime_ready,true);assert.equal(a.p7_runtime_ready,true);assert.equal(a.legacy_runtime_ready,true);assert.equal(Export.summarizeFormalStoryQuests(data).p5_runtime_ready_count,1);assert.equal(Export.summarizeFormalStoryQuests(data).p6_runtime_ready_count,1);assert.equal(Export.summarizeFormalStoryQuests(data).p7_runtime_ready_count,1);assert.deepEqual(Export.summarizeFormalStoryQuests(data).ready_ids,['Q-READY']);

const broken={...ready,id:'Q-BROKEN',boxes:[{...ready.boxes[0],event_zone_before_pre:[{kind:'fixed_event',order:1,failure_policy:'continue',event_id:'EVT-X'}]}]};
a=Export.formalStoryQuestAssessment(data,broken);assert.equal(a.ready,false);assert(a.issues.some(x=>x.code==='QUEST_EVENT_REFERENCE_BROKEN'));

const badDuration={...ready,id:'Q-DURATION',adventure_duration_seconds:0};
a=Export.formalStoryQuestAssessment(data,badDuration);assert.equal(a.ready,false);assert(a.issues.some(x=>x.code==='QUEST_ADVENTURE_DURATION_INVALID'));

const random={...ready,id:'Q-RANDOM',boxes:[{...ready.boxes[0],event_zone_after_post:[{kind:'random_event',order:1,failure_policy:'continue',filter:{},allow_none:true,required:false,box_side_individual_probability_override:false}]}]};
a=Export.formalStoryQuestAssessment(data,random);assert.equal(a.ready,true);assert.equal(a.p5_runtime_ready,false);assert(a.p5_runtime.issues.some(x=>x.code==='FORMAL_QUEST_P6_RANDOM_EVENT_PENDING'));assert.equal(a.p6_runtime_ready,true);assert.equal(a.p7_runtime_ready,true);

const zero=Export.collectFormalQuestExportIssues({...data,quests:[]});assert.equal(zero.summary.ready_count,0);assert(zero.issues.some(x=>x.code==='FORMAL_QUEST_ZERO'&&x.level==='WARNING'));
const boundary=Export.collectFormalQuestExportIssues({...data,quests:[random]});assert(!boundary.issues.some(x=>x.code==='FORMAL_QUEST_P6_RANDOM_EVENT_PENDING'),'P6 current Export issues must not report P6 as pending');
const out=Export.buildData(data);assert.equal(out['quest/main_quests.json'][0].boxes[0].box_id,'BOX-1');assert.equal(out['quest/main_quests.json'][0].adventure_duration_seconds,180);assert.equal(out['quest/main_quests.json'][0].links.chapter_id,'CH-1');

const html=fs.readFileSync('studio/index.html','utf8');
for(const needle of ['id="questFormalStatus"','id="questAdventureDuration"','id="questMapId"','function renderQuestFormalStatus()','P7-B 実行可能Quest','Quest.boxes正式Export契約','P7-B Game Runtime'])assert(html.includes(needle),`studio P7-B formal integration missing: ${needle}`);
console.log('adventure-formal-quest-studio-export-integration PASS');
