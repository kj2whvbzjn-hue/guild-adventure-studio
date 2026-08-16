'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const S=require('../assets/shared/js/adventure-story-system.js');

// P3 normalization applies the new classification without destructively migrating untouched legacy Events.
const modern=S.normalizeEvent({id:'EVT-P3',usage:'random',type:'exploration',group:'ruins',tags:['rare','night'],intensity:'high',random_base_weight:'2.5',generation_profile_ref:123,enabled:0});
assert.equal(modern.usage,'random');
assert.equal(modern.type,'exploration');
assert.deepEqual(modern.tags,['rare','night']);
assert.equal(modern.intensity,'high');
assert.equal(modern.random_base_weight,2.5);
assert.equal(modern.generation_profile_ref,'123');
assert.equal(modern.enabled,false);
const corrected=S.normalizeEvent({usage:'unknown',type:'reward'});
assert.equal(corrected.usage,'common');
assert.equal(corrected.type,'special');

const studio=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
for(const token of ['id="eventUsage"','id="eventType"','id="eventGroup"','id="eventTags"','id="eventIntensity"','id="eventRandomBaseWeight"','id="eventGenerationProfileRef"','id="eventEnabled"'])assert(studio.includes(token),`P3 Event editor missing ${token}`);
for(const legacyInput of ['id="eventChapterLink"','id="eventSectionLink"','id="eventSceneLink"','id="eventQuestLink"','id="eventCharacterLink"'])assert(!studio.includes(legacyInput),`legacy Event link editor must be removed from formal P3 UI: ${legacyInput}`);
assert(!studio.includes('id="eventLegacyLinksPanel"'),'legacy Event links panel must be removed');
assert(studio.includes('usage:eventUsage.value,type:eventType.value'),'Event save must persist independent usage/type');
assert(studio.includes("persist('event saved')"),'formal Event save marker missing');
const saveStart=studio.indexOf('function saveEvent(){'),saveEnd=studio.indexOf('function editEvent(',saveStart),saveBlock=studio.slice(saveStart,saveEnd);
assert(!saveBlock.includes('syncEventConnections('),'P3 Event save must not trigger legacy Timeline/Character side effects');
assert(saveBlock.includes("for(const key of ['links','battle_formation'])delete record[key]"),'formal Event save must remove retired links/battle_formation fields');
const deleteStart=studio.indexOf('function deleteEvent('),deleteEnd=studio.indexOf('function renderEvents(',deleteStart),deleteBlock=studio.slice(deleteStart,deleteEnd);
assert(!deleteBlock.includes('removeEventConnections('),'formal Event deletion must not run legacy Timeline/Character link cleanup');

// Box fixed Event selection uses a real catalog with all five required filters.
for(const token of ['Event Catalog',"'usage'", "'type'", "'group'", "'tags'", "'name'"])assert(studio.includes(token),`P3 Event Catalog missing ${token}`);
assert(studio.includes('Event本体はコピーせず、選択したEvent IDだけをBoxへ保存します。'),'Box must store an Event ID reference rather than an Event copy');
for(const token of ['updateQuestBoxRandomFilter','event_type','グループ','タグ'])assert(studio.includes(token),`P3 Random Event slot filter UI missing ${token}`);

// Execute the catalog/filter helpers against a minimal P3 catalog.
const helperStart=studio.indexOf('function eventUsageValue(event){');
const helperEnd=studio.indexOf('function normalizeQuestBoxPlacementOrders(zoneKey){',helperStart);
assert(helperStart>=0&&helperEnd>helperStart,'P3 Event catalog helper block not found');
const helper=studio.slice(helperStart,helperEnd);
const sandbox={
 data:{events:[
  {id:'E1',name:'Forest Battle',usage:'story',type:'battle',group:'forest',tags:['day'],enabled:true},
  {id:'E2',name:'Rare Ruin',usage:'random',type:'exploration',group:'ruins',tags:['rare','night'],enabled:true},
  {id:'E3',name:'Disabled Ruin',usage:'random',type:'exploration',group:'ruins',tags:['rare'],enabled:false},
  {id:'E4',name:'Common Choice',usage:'common',type:'choice',group:'town',tags:['social'],enabled:true}
 ]},
 questBoxEditorState:{catalog_filters:{},draft:{event_zone_before_pre:[{kind:'fixed_event',event_id:'E2'}]}},
 splitCsv(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)},
 esc(v){return String(v??'')},escAttr(v){return String(v??'')},
 document:{getElementById(){return null}}
};
vm.runInNewContext(`${helper}\nglobalThis.P3={eventCatalogMatch,questBoxEventCatalogCount,questBoxRandomCandidates,eventUsageValue,eventTypeValue};`,sandbox,{filename:'studio-p3-catalog-harness.js'});
assert.equal(sandbox.P3.questBoxEventCatalogCount({usage:'random',type:'exploration',group:'ruins',tags:'rare',name:'ruin'}),2,'catalog filters must combine usage/type/group/tag/name');
assert.equal(sandbox.P3.questBoxEventCatalogCount({usage:'story',type:'battle'}),1);
assert.equal(sandbox.P3.questBoxRandomCandidates({filter:{event_type:'exploration',group:'ruins',tags:['rare']}}).length,1,'Random slot preview must use usage=random and exclude disabled Events');
assert.equal(sandbox.P3.questBoxRandomCandidates({filter:{event_type:'battle',group:null,tags:[]}}).length,0);

const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/exports/event-events.schema.json'),'utf8'));
for(const key of ['usage','type','group','tags','conditions','intensity','generation_profile_ref','random_base_weight','enabled'])assert(schema.items.properties[key],`Event export schema missing formal field ${key}`);
assert(!schema.items.properties.links,'Event export schema must not expose legacy links');
assert(!schema.items.properties.battle_formation,'Event export schema must not expose legacy battle_formation');

console.log('adventure-event-studio-model-p3 PASS');
