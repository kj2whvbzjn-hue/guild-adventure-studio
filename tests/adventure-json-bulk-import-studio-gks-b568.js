const assert=require('assert');
const fs=require('fs');
const importer=require('../studio/adventure-entity-json-import.js');

const root={
  project:{id:'PRJ-1'},
  decisions:[],characters:[],organizations:[],terms:[],relationships:[],timeline:[],flags:[],entities:[],ai_programs:[],tags:[],tag_categories:[],
  masters:{maps:[{id:'MAP-1'}],reward_tables:[{id:'RWD-1'}],monsters:[{id:'MON-1'}]},
  chapters:[{id:'CH-1',title:'既存章',sections:[{id:'SEC-1',title:'既存節',scenes:[{id:'SCN-1',title:'既存シーン',dialogues:[]}]}]}],
  quests:[{id:'QST-1',name:'既存Quest',summary:'keep me',boxes:[]}],
  events:[{id:'EVT-1',name:'既存Event',type:'special',reward_table_ids:['RWD-1']}]
};

// Dedicated plain JSON envelopes and single-record formats.
assert.strictEqual(importer.extractRecords('quests',{quests:[{id:'QST-2',name:'Q2'}]}).length,1);
assert.strictEqual(importer.extractRecords('events',[{id:'EVT-2',name:'E2'}]).length,1);
assert.strictEqual(importer.extractRecords('story',{story:{chapters:[{id:'CH-2',title:'C2',sections:[]}]}}).length,1);

// Box IDs are Quest-internal: the same Box ID may exist in different Quests.
let plan=importer.buildPlan('quests',{quests:[
  {id:'QST-2',name:'Q2',boxes:[{box_id:'BOX-001'}]},
  {id:'QST-3',name:'Q3',boxes:[{box_id:'BOX-001'}]}
]},root);
assert.deepStrictEqual(plan.errors,[],'same Box ID across different Quests must be allowed');
assert.strictEqual(plan.adds.length,2);

// Duplicate Box ID inside one Quest is invalid.
plan=importer.buildPlan('quests',{quests:[{id:'QST-4',name:'Q4',boxes:[{box_id:'BOX-A'},{box_id:'BOX-A'}]}]},root);
assert.ok(plan.errors.some(x=>x.includes('Box IDが重複')));

// Existing Quest update preserves fields omitted from import.
plan=importer.buildPlan('quests',{id:'QST-1',name:'更新Quest'},root);
assert.strictEqual(plan.updates[0],'QST-1');
const applied=importer.applyPlan(root,plan,'2026-08-15T00:00:00Z');
const q=applied.quests.find(x=>x.id==='QST-1');
assert.strictEqual(q.name,'更新Quest');
assert.strictEqual(q.summary,'keep me','non-imported fields must survive update');

// Cross-dataset ID collision is rejected.
plan=importer.buildPlan('events',{events:[{id:'QST-1',name:'bad'}]},root);
assert.ok(plan.errors.some(x=>x.includes('別データ種別')));

// Missing references are warnings, not blockers, so separate imports can be staged.
plan=importer.buildPlan('quests',{quests:[{id:'QST-5',name:'Q5',context:{map_id:'MAP-LATER'},boxes:[{box_id:'BOX-1',pre_scene_id:'SCN-LATER',event_zone_before_pre:[{kind:'fixed_event',event_id:'EVT-LATER'}]}]}]},root);
assert.strictEqual(plan.errors.length,0);
assert.ok(plan.warnings.some(x=>x.includes('Map参照は現在未登録')));
assert.ok(plan.warnings.some(x=>x.includes('Scene参照は現在未登録')));
assert.ok(plan.warnings.some(x=>x.includes('Event参照は現在未登録')));
assert.ok(plan.canApply);

// Story nested IDs are stable and cannot collide across different imported chapters.
plan=importer.buildPlan('story',{chapters:[
  {id:'CH-2',title:'C2',sections:[{id:'SEC-X',title:'S',scenes:[]}]},
  {id:'CH-3',title:'C3',sections:[{id:'SEC-X',title:'S',scenes:[]}]}
]},root);
assert.ok(plan.errors.some(x=>x.includes('Import内の別章')));

// Current Story node may be updated only inside its current chapter.
plan=importer.buildPlan('story',{chapters:[{id:'CH-1',title:'既存章更新',sections:[{id:'SEC-1',title:'節更新',scenes:[{id:'SCN-1',title:'Scene更新',dialogues:[]}]}]}]},root);
assert.strictEqual(plan.errors.length,0);
assert.strictEqual(plan.updates[0],'CH-1');

const html=fs.readFileSync('studio/index.html','utf8');
assert.ok(html.includes("triggerAdventureEntityJsonImport('quests')"),'Quest JSON import entrance missing');
assert.ok(html.includes("triggerAdventureEntityJsonImport('events')"),'Event JSON import entrance missing');
assert.ok(html.includes("triggerAdventureEntityJsonImport('story')"),'Story JSON import entrance missing');
assert.ok(html.includes('Boxは独立登録せず、Quest JSON内の boxes[] として取り込みます。'),'Quest/Box import ownership notice missing');
assert.ok(html.includes('./adventure-entity-json-import.js?v=571'),'import core script missing');
console.log('PASS GKS-B571 Quest/Event/Story dedicated JSON bulk import entrances and safe import plan');
