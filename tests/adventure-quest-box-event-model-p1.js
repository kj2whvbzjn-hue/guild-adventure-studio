'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const S=require('../assets/shared/js/adventure-story-system.js');

assert.deepEqual(S.QUEST_EVENT_PLACEMENT_KINDS,['fixed_event','random_event']);
assert.deepEqual(S.QUEST_EVENT_FAILURE_POLICIES,['continue','quest_fail']);

const quest=S.normalizeQuest({
 id:'Q-P1',
 context:{map_id:'MAP-1',difficulty:3,tags:[' forest ','']},
 boxes:[{
  box_id:'BOX-001',name:'入口',order:'2',
  event_zone_before_pre:[
   {kind:'fixed_event',event_id:'EVT-FIXED',order:1,failure_policy:'quest_fail'},
   {kind:'random_event',order:2,failure_policy:'continue',filter:{event_type:'battle',group:'night',tags:[' rare ','']},allow_none:false,required:true}
  ],
  pre_scene_id:'SCN-PRE',mid_scene_id:null,post_scene_id:'SCN-POST',
 }],
});
assert.deepEqual(quest.context.tags,['forest']);
assert.equal(quest.boxes[0].box_id,'BOX-001');
assert.equal(quest.boxes[0].order,2);
assert.equal(quest.boxes[0].pre_scene_id,'SCN-PRE');
assert.equal(quest.boxes[0].post_scene_id,'SCN-POST');
assert.equal(quest.boxes[0].event_zone_before_pre.length,2);
assert.equal(quest.boxes[0].event_zone_before_pre[0].kind,'fixed_event');
assert.equal(quest.boxes[0].event_zone_before_pre[0].event_id,'EVT-FIXED');
assert.equal(quest.boxes[0].event_zone_before_pre[0].failure_policy,'quest_fail');
assert.equal(quest.boxes[0].event_zone_before_pre[1].kind,'random_event');
assert.deepEqual(quest.boxes[0].event_zone_before_pre[1].filter,{event_type:'battle',group:'night',tags:['rare']});
assert.equal(quest.boxes[0].event_zone_before_pre[1].allow_none,false);
assert.equal(quest.boxes[0].event_zone_before_pre[1].required,true);
assert.deepEqual(quest.boxes[0].event_zone_pre_to_mid,[]);
assert.deepEqual(quest.boxes[0].event_zone_mid_to_post,[]);
assert.deepEqual(quest.boxes[0].event_zone_after_post,[]);


const modernEvent=S.normalizeEvent({id:'E-NEW',usage:['random','common'],type:'exploration',group:' ruins ',tags:[' rare ',''],conditions:[{flag:'F1'}],intensity:'high',generation_profile_ref:123,random_base_weight:'2.5',custom:'keep'});
assert.deepEqual(modernEvent.usage,['random','common']);
assert.equal(modernEvent.type,'exploration');
assert.equal(modernEvent.group,' ruins ');
assert.deepEqual(modernEvent.tags,['rare']);
assert.deepEqual(modernEvent.conditions,[{flag:'F1'}]);
assert.equal(modernEvent.intensity,'high');
assert.equal(modernEvent.generation_profile_ref,'123');
assert.equal(modernEvent.random_base_weight,2.5);
assert.equal(modernEvent.custom,'keep');

const studio=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
assert(studio.includes("GKAdventureStorySystem.normalizeQuest(q)"),'Studio load/persist must normalize Quest boxes');
assert(studio.includes('const previous=existing>=0?data.quests[existing]:{};'),'Quest editor must merge previous data');
assert(studio.includes('previous=existing>=0?data.events[existing]:{}'),'Event editor must merge previous data');
assert(studio.includes('usage:eventUsage.value,type:eventType.value'),'P3 Event editor must save canonical usage/type ');
assert(studio.includes('function fullImportPrepareCandidate(raw)'),'full import must preflight/normalize candidate data before persistence');
assert(studio.includes('data=structuredClone(raw);')&&studio.includes('normalizeData();'),'full import candidate normalization must preserve the P1 model before gate evaluation');
assert(studio.includes("persist('full json imported through preflight gate')"),'full import must persist only after the preflight gate passes');

for(const file of ['quest-main_quests.schema.json','quest-sub_quests.schema.json','quest-event_quests.schema.json']){
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/exports',file),'utf8'));
 assert(schema.items.properties.boxes,'Quest export schema must preserve boxes');
 assert(schema.items.properties.context,'Quest export schema must preserve context');
}
const eventSchema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/exports/event-events.schema.json'),'utf8'));
for(const key of ['usage','type','group','tags','conditions','intensity','generation_profile_ref','random_base_weight'])assert(eventSchema.items.properties[key],`Event schema missing ${key}`);

console.log('adventure-quest-box-event-model-p1 PASS');
