const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');

assert.ok(html.includes('id="gameDataIdReferenceAuditResult"'),'Game data audit result panel missing');
assert.ok(html.includes('function buildGameDataIdReferenceAudit(rootData=data)'),'Game data audit builder missing');
assert.ok(html.includes('function runGameDataIdReferenceAudit()'),'Game data audit runner missing');
assert.ok(html.includes('Quest Box IDはQuest内部の安定識別子'),'Box ID exclusion must be explicit');

const start=html.indexOf('const GAME_DATA_AUDIT_RULES=');
const end=html.indexOf('function masterSearchText(category,m){',start);
assert.ok(start>=0&&end>start,'Game data audit source range missing');
const source=html.slice(start,end);
const original={
 chapters:[{id:'CHP-0001',sections:[{id:'SEC-0001',scenes:[{id:'SCN-CH01-A',dialogues:[{id:'DLG-0001'}]}]}]}],
 characters:[{id:'CHR-0001',name:'Character'}],
 quests:[
  {id:'QST-0001',next_quest_ids:['QST-CH01-SEC01'],boxes:[]},
  {id:'QST-CH01-SEC01',prerequisite_ids:['QST-9999'],next_quest_ids:[],required_flags:['FLG-0001'],set_flags:[],character_ids:['CHR-0001'],boxes:[{box_id:'BOX-QST-CH01-SEC01-01',pre_scene_id:'SCN-CH01-A',mid_scene_id:'SCN-MISSING',post_scene_id:'',event_zone_before_pre:[{kind:'fixed_event',event_id:'EVT-CH01-A'}],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}]}
 ],
 events:[{id:'EVT-CH01-A',required_flags:['FLG-MISSING'],set_flags:[]}],
 flags:[{id:'FLG-0001',name:'ok'}]
};
const context={
 data:JSON.parse(JSON.stringify(original)),
 now(){return '2026-08-15T00:00:00.000Z'},
 window:{},document:{getElementById(){return null}},esc(v){return String(v)}
};
vm.createContext(context);vm.runInContext(source,context);
const report=vm.runInContext('buildGameDataIdReferenceAudit()',context);
assert.strictEqual(report.counts.invalid_ids,3,'Quest/Event/Scene noncanonical IDs must be reported');
assert.ok(report.issues.some(x=>x.type==='invalid_id'&&x.id==='QST-CH01-SEC01'&&x.reference_count===1),'invalid Quest ID must count formal Quest reference');
assert.ok(report.issues.some(x=>x.type==='invalid_id'&&x.id==='EVT-CH01-A'&&x.reference_count===1),'invalid Event ID must count Quest Box fixed Event reference');
assert.ok(report.issues.some(x=>x.type==='invalid_id'&&x.id==='SCN-CH01-A'&&x.reference_count===1),'invalid Scene ID must count Quest Box Scene reference');
assert.ok(report.issues.some(x=>x.type==='missing_reference'&&x.id==='QST-9999'),'missing prerequisite Quest must be reported');
assert.ok(report.issues.some(x=>x.type==='missing_reference'&&x.id==='FLG-MISSING'),'missing Flag must be reported');
assert.ok(report.issues.some(x=>x.type==='missing_reference'&&x.id==='SCN-MISSING'),'missing Quest Box Scene must be reported');
assert.strictEqual(JSON.stringify(context.data),JSON.stringify(original),'audit must not mutate Game data');
assert.ok(!report.issues.some(x=>x.id==='BOX-QST-CH01-SEC01-01'),'Quest Box IDs must remain outside this ID audit');
assert.ok(!source.includes('random_event_candidates'),'audit must not scan legacy Chapter random Event candidates');
assert.ok(!source.includes('.links'),'audit must not scan legacy Quest/Event links');
console.log('PASS GKS-B601 Game data ID/reference audit is read-only and uses the formal Quest/Event model');
