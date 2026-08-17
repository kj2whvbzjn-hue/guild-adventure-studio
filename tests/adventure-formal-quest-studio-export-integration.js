const assert=require('node:assert/strict');
const fs=require('node:fs');
const Export=require('../studio/export-core.js');
const S=require('../assets/shared/js/adventure-story-system.js');
const R=require('../assets/shared/js/adventure-encounter-resolver.js');

assert.strictEqual(S.ADVENTURE_SETTINGS_CANONICAL_ID,'ADV-0001');
assert.strictEqual(R.ADVENTURE_SETTINGS_CANONICAL_ID,'ADV-0001');
const formalSettings=[{id:'ADV-0001',enabled:true,params:{encounter:{max_units:23},reward_scaling:{bonus_per_budget:.23}}}];
assert.strictEqual(S.selectAdventureSettingsRow(formalSettings).id,'ADV-0001');
assert.strictEqual(S.adventureSettingsParams(formalSettings).encounter.max_units,23);
assert.strictEqual(R.normalizeAdventureSettings(formalSettings).encounter.max_units,23);
assert.throws(()=>S.selectAdventureSettingsRow([{id:'UNSUPPORTED-SETTINGS',enabled:true,params:{}}]),/現行Formal ID ADV-0001/,'Story runtime must stop when the formal Adventure Settings row is missing');
assert.throws(()=>R.normalizeAdventureSettings([{id:'UNSUPPORTED-SETTINGS',enabled:true,params:{}}]),/現行Formal ID ADV-0001/,'Encounter runtime must stop when the formal Adventure Settings row is missing');

const section={id:'SEC-1',no:1,title:'節1',scenes:[{id:'SCN-1',no:1,title:'Scene'}]};
const data={chapters:[{id:'CH-1',no:1,title:'章1',sections:[section]}],quests:[],events:[],masters:{maps:[],monsters:[],exploration_outcomes:[]}};

let q={id:'Q-NORMAL',name:'通常',adventure_duration_seconds:300};
let a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,false);assert.equal(a.ready,false);

q={id:'Q-FORMAL',name:'正式',type:'main',adventure_duration_seconds:180,character_ids:['CHR-0001'],boxes:[{box_id:'BOX-1',name:'Box',order:1,pre_scene_id:'SCN-1',event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]};
data.quests=[q];a=Export.formalStoryQuestAssessment(data,q);assert.equal(a.is_formal,true);assert.equal(a.ready,true);assert.equal(Export.summarizeFormalStoryQuests(data).ready_count,1);

const broken={...q,id:'Q-BROKEN',boxes:[{...q.boxes[0],event_zone_before_pre:[{kind:'fixed_event',order:1,failure_policy:'continue',event_id:'EVT-X'}]}]};
a=Export.formalStoryQuestAssessment(data,broken);assert.equal(a.ready,false);assert(a.issues.some(x=>x.code==='QUEST_EVENT_REFERENCE_BROKEN'));
const badDuration={...q,id:'Q-DURATION',adventure_duration_seconds:0};a=Export.formalStoryQuestAssessment(data,badDuration);assert.equal(a.ready,false);assert(a.issues.some(x=>x.code==='QUEST_ADVENTURE_DURATION_INVALID'));

const unsupported=structuredClone(data);unsupported.chapters[0].unsupported_chapter_field=[];unsupported.chapters[0].sections[0].unsupported_section_field=6;unsupported.quests[0].unsupported_quest_field={};unsupported.quests[0].boxes[0].unsupported_box_field=[];unsupported.masters.adventure_settings=[{id:'UNSUPPORTED-SETTINGS',enabled:true,params:{}}];
const shapeIssues=Export.collectFormalStoryModelIssues(unsupported);assert(shapeIssues.some(x=>x.code==='CHAPTER_FIELD_UNSUPPORTED'&&x.field==='unsupported_chapter_field'));assert(shapeIssues.some(x=>x.code==='SECTION_FIELD_UNSUPPORTED'&&x.field==='unsupported_section_field'));assert(shapeIssues.some(x=>x.code==='QUEST_FIELD_UNSUPPORTED'&&x.field==='unsupported_quest_field'));assert(shapeIssues.some(x=>x.code==='QUEST_BOX_FIELD_UNSUPPORTED'&&x.field==='unsupported_box_field'));assert(shapeIssues.some(x=>x.code==='ADVENTURE_SETTINGS_ID_UNSUPPORTED'));

const out=Export.buildData(data),qOut=out['quest/main_quests.json'][0],chOut=out['scenario/chapters.json'][0],secOut=out['scenario/sections.json'][0];
assert.equal(qOut.boxes[0].box_id,'BOX-1');assert.equal(qOut.adventure_duration_seconds,180);assert.deepEqual(qOut.character_ids,['CHR-0001']);

const html=fs.readFileSync('studio/index.html','utf8');
for(const needle of ['id="questFormalStatus"','id="questAdventureDuration"','id="questMapId"','function renderQuestFormalStatus()','P7-B 実行可能Quest','Quest.boxes正式Export契約','P7-B Game Runtime'])assert(html.includes(needle),`studio formal integration missing: ${needle}`);
console.log('adventure-formal-quest-studio-export-integration PASS');
