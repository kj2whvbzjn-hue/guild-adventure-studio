'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../export-core.js');

const mkBox=(over={})=>({box_id:'BOX-001',name:'開始',order:1,pre_scene_id:'SCN-1',mid_scene_id:null,post_scene_id:null,event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[],...over});
const randomEvent={id:'EVT-R',name:'Random',usage:'random',type:'exploration',group:'ruins',tags:['rare'],conditions:[],intensity:'normal',random_base_weight:2,enabled:true,battle_formation:[]};
const fixedEvent={id:'EVT-S',name:'Story',usage:'story',type:'special',group:'',tags:[],conditions:'',intensity:'low',random_base_weight:1,enabled:true,battle_formation:[]};
const base={
 chapters:[{id:'CH-1',sections:[{id:'SEC-1',boxes:[{id:'OLD-1',type:'scene',ref_id:'SCN-1'}],scenes:[{id:'SCN-1'}]}]}],
 quests:[{id:'Q-P4',name:'P4 Quest',type:'main',adventure_duration_seconds:300,links:{chapter_id:'CH-1',section_id:'SEC-1'},context:{difficulty:1,tags:[]},boxes:[mkBox({event_zone_before_pre:[{kind:'fixed_event',order:1,failure_policy:'continue',event_id:'EVT-S'}],event_zone_after_post:[{kind:'random_event',order:1,failure_policy:'quest_fail',filter:{event_type:'exploration',group:'ruins',tags:['rare']},allow_none:false,required:true,box_side_individual_probability_override:false}]})]}],
 events:[fixedEvent,randomEvent],masters:{}
};

let issues=Core.collectQuestEventContractIssues(base);
assert(!issues.some(x=>x.level==='ERROR'),issues.filter(x=>x.level==='ERROR').map(x=>x.message).join('\n'));
for(const code of ['QUEST_BOX_COUNT','EVENT_COUNT','RANDOM_SLOT_COUNT','SCENE_USAGE_COUNT'])assert(issues.some(x=>x.level==='INFO'&&x.code===code),`missing P4 INFO ${code}`);
let formal=Core.formalStoryQuestAssessment(base,base.quests[0]);assert.equal(formal.ready,true);assert.equal(formal.legacy_runtime_ready,true);

const duplicate=structuredClone(base);duplicate.quests[0].boxes.push(mkBox({box_id:'BOX-001',order:2,pre_scene_id:null}));
issues=Core.collectQuestEventContractIssues(duplicate);assert(issues.some(x=>x.level==='ERROR'&&x.code==='QUEST_BOX_ID_DUPLICATE'));

const brokenRef=structuredClone(base);brokenRef.quests[0].boxes[0].event_zone_before_pre[0].event_id='EVT-MISSING';
issues=Core.collectQuestEventContractIssues(brokenRef);assert(issues.some(x=>x.level==='ERROR'&&x.code==='QUEST_EVENT_REFERENCE_BROKEN'));

const requiredZero=structuredClone(base);requiredZero.quests[0].boxes[0].event_zone_after_post[0].filter.group='none';
issues=Core.collectQuestEventContractIssues(requiredZero);assert(issues.some(x=>x.level==='ERROR'&&x.code==='RANDOM_SLOT_REQUIRED_NO_CANDIDATES'));
const optionalZero=structuredClone(requiredZero);optionalZero.quests[0].boxes[0].event_zone_after_post[0].required=false;
issues=Core.collectQuestEventContractIssues(optionalZero);assert(issues.some(x=>x.level==='WARNING'&&x.code==='RANDOM_SLOT_OPTIONAL_NO_CANDIDATES'));

const conditional=structuredClone(base);conditional.events[1].conditions=[{flag:'F-1'}];
issues=Core.collectQuestEventContractIssues(conditional);assert(issues.some(x=>x.level==='WARNING'&&x.code==='RANDOM_SLOT_CONTEXT_DEPENDENT'));

const freeText=structuredClone(base);freeText.events[1].conditions='night only';
issues=Core.collectQuestEventContractIssues(freeText);assert(issues.some(x=>x.level==='WARNING'&&x.code==='EVENT_CONDITIONS_UNSTRUCTURED'));

const forbidden=structuredClone(base);forbidden.events[0].map_id='MAP-X';forbidden.events[0].battle_formation=[{monster_id:'MON-1',count:1}];
issues=Core.collectQuestEventContractIssues(forbidden);assert(issues.filter(x=>x.level==='ERROR'&&x.code==='EVENT_ENVIRONMENT_FIELD_FORBIDDEN').length>=2);

const p4Only=structuredClone(base);p4Only.chapters[0].sections[0].boxes=[];
formal=Core.formalStoryQuestAssessment(p4Only,p4Only.quests[0]);assert.equal(formal.ready,true);assert.equal(formal.legacy_runtime_ready,false);
const exportIssues=Core.collectFormalQuestExportIssues(p4Only);assert(exportIssues.issues.some(x=>x.level==='WARNING'&&x.code==='FORMAL_QUEST_P6_RANDOM_EVENT_PENDING'));assert.equal(formal.p5_runtime_ready,false);

const out=Core.buildData(base);assert.deepEqual(out['quest/main_quests.json'][0].boxes,base.quests[0].boxes);assert.equal(out['event/events.json'][1].usage,'random');assert.equal(out['event/events.json'][1].random_base_weight,2);

for(const file of ['quest-main_quests.schema.json','quest-sub_quests.schema.json','quest-event_quests.schema.json']){
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/exports',file),'utf8'));
 const box=schema.items.properties.boxes.items;
 assert(schema.items.properties.adventure_duration_seconds,`${file} missing adventure_duration_seconds`);
 for(const key of ['box_id','order','event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post'])assert(box.properties[key],`${file} missing ${key}`);
 const placement=box.properties.event_zone_before_pre.items;assert.deepEqual(placement.properties.kind.enum,['fixed_event','random_event']);assert.equal(placement.properties.box_side_individual_probability_override.const,false);
}
const eventSchema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/exports/event-events.schema.json'),'utf8'));
assert(eventSchema.items.allOf,'P4 Event schema must contain modern-model conditional contract');
assert.deepEqual(eventSchema.items.properties.usage.oneOf[0].enum,['story','random','common']);
assert.deepEqual(eventSchema.items.allOf[0].then.properties.type.enum,['battle','exploration','choice','special']);

const html=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
for(const token of ['GKExportCore.collectQuestEventContractIssues(data)','P4 Export契約 合格','警告 '+"'",'Quest.boxes正式Export契約','P5 Game Runtime'])assert(html.includes(token),`Studio P4 integration missing ${token}`);
assert(!html.includes("level:'WARN'"),'P4 validation must use ERROR/WARNING/INFO levels');
console.log('adventure-quest-event-export-validation-p4 PASS');
