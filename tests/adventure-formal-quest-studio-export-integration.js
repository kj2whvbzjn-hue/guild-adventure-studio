const assert=require('node:assert/strict');
const fs=require('node:fs');
const Export=require('../studio/export-core.js');
const section={id:'SEC-1',no:1,title:'節1',adventure_duration_seconds:300,enemy_budget:6,boxes:[{type:'scene',ref_id:'SCN-1'}],scenes:[{id:'SCN-1',no:1,title:'Scene'}]};
const data={chapters:[{id:'CH-1',no:1,title:'章1',available_monster_ids:['MON-OLD'],random_event_candidates:[{event_id:'EVT-OLD'}],sections:[section]}],quests:[],events:[],masters:{maps:[],monsters:[],exploration_outcomes:[]}};

let q={id:'Q-NORMAL',name:'通常',adventure_duration_seconds:300,links:{chapter_id:'CH-1',section_id:'SEC-1'}};
let a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,false);assert.equal(a.ready,false);assert.equal(Object.prototype.hasOwnProperty.call(a,'legacy_runtime_ready'),false);

q={id:'Q-FORMAL',name:'正式',type:'main',adventure_duration_seconds:180,character_ids:['CHR-0001'],boxes:[{box_id:'BOX-1',name:'Box',order:1,pre_scene_id:'SCN-1',event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}],links:{chapter_id:'CH-1',section_id:'SEC-1',character_ids:['CHR-OLD']}};
data.quests=[q];a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,true);assert.equal(a.ready,true);assert.equal(Object.prototype.hasOwnProperty.call(a,'legacy_runtime_ready'),false);assert.equal(Export.summarizeFormalStoryQuests(data).ready_count,1);assert.equal(Object.prototype.hasOwnProperty.call(Export.summarizeFormalStoryQuests(data),'legacy_runtime_ready_count'),false);

const broken={...q,id:'Q-BROKEN',boxes:[{...q.boxes[0],event_zone_before_pre:[{kind:'fixed_event',order:1,failure_policy:'continue',event_id:'EVT-X'}]}]};
a=Export.formalStoryQuestAssessment(data,broken);assert.equal(a.ready,false);assert(a.issues.some(x=>x.code==='QUEST_EVENT_REFERENCE_BROKEN'));
const badDuration={...q,id:'Q-DURATION',adventure_duration_seconds:0};a=Export.formalStoryQuestAssessment(data,badDuration);assert.equal(a.ready,false);assert(a.issues.some(x=>x.code==='QUEST_ADVENTURE_DURATION_INVALID'));

const out=Export.buildData(data),qOut=out['quest/main_quests.json'][0],chOut=out['scenario/chapters.json'][0],secOut=out['scenario/sections.json'][0];
assert.equal(qOut.boxes[0].box_id,'BOX-1');assert.equal(qOut.adventure_duration_seconds,180);assert.deepEqual(qOut.character_ids,['CHR-0001']);assert.equal(Object.prototype.hasOwnProperty.call(qOut,'links'),false);
for(const key of ['available_monster_ids','random_event_candidates'])assert.equal(Object.prototype.hasOwnProperty.call(chOut,key),false);
for(const key of ['adventure_duration_seconds','enemy_budget','boxes'])assert.equal(Object.prototype.hasOwnProperty.call(secOut,key),false);

const html=fs.readFileSync('studio/index.html','utf8');
for(const needle of ['id="questFormalStatus"','id="questAdventureDuration"','id="questMapId"','function renderQuestFormalStatus()','P7-B 実行可能Quest','Quest.boxes正式Export契約','P7-B Game Runtime'])assert(html.includes(needle),`studio formal integration missing: ${needle}`);
for(const legacy of ['id="questChapterLink"','id="questSectionLink"','id="questSceneLink"'])assert(!html.includes(legacy),`legacy Quest link UI must be removed: ${legacy}`);
console.log('adventure-formal-quest-studio-export-integration PASS');
