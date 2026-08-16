'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const S=require('../assets/shared/js/adventure-story-system.js');

const studio=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');

// Quest editor overview and dedicated Box child screen exist.
for(const token of ['id="questBoxList"','＋ Box追加','id="questBoxEditorInline"','Boxを反映','詳細を開く']){
  assert(studio.includes(token),`P2 Quest Box UI missing: ${token}`);
}
assert(studio.includes('#questEditorPanel.quest-box-detail-open>:not(#questBoxEditorInline){display:none!important}'),'Box detail must replace the Quest editor body in the same Studio input surface');
assert(!studio.includes('id="questBoxEditorOverlay"'),'nested fixed Box overlay must not return');

// The seven-stage order is fixed in the renderer: A -> pre -> B -> mid -> C -> post -> D.
const sequenceLine=studio.match(/body\.innerHTML=`<div class="field"><label>Box名<\/label>.*?<div class="quest-box-sequence">([^\n]+)<\/div>`;/)?.[1]||'';
const orderedTokens=[
  'QUEST_BOX_ZONE_DEFS[0]',"'pre_scene_id','前Scene'",'QUEST_BOX_ZONE_DEFS[1]',"'mid_scene_id','中Scene'",'QUEST_BOX_ZONE_DEFS[2]',"'post_scene_id','後Scene'",'QUEST_BOX_ZONE_DEFS[3]'
];
let last=-1;
for(const token of orderedTokens){const at=sequenceLine.indexOf(token);assert(at>last,`fixed Box sequence broken at ${token}`);last=at;}
assert(!studio.includes('moveQuestBoxScene'),'Scene stages must not expose reordering');

// All four canonical Event zones are present and each zone can hold fixed/random placements.
for(const key of ['event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post'])assert(studio.includes(`key:'${key}'`),`zone missing: ${key}`);
assert(studio.includes("addQuestBoxPlacement('${zoneDef.key}','fixed_event')"),'fixed Event placement action missing');
assert(studio.includes("addQuestBoxPlacement('${zoneDef.key}','random_event')"),'random Event placement action missing');
assert(studio.includes('Event失敗時'),'placement failure policy UI missing');
assert(studio.includes('何も起きないを許可'),'random Event slot allow-none UI missing');
assert(studio.includes('必須枠'),'random Event slot required UI missing');
assert(studio.includes('Event失敗時'),'P2 placement failure policy must remain after later Event Catalog phases');

// Quest persistence must use the P1 normalizer and preserve Box draft data.
assert(studio.includes('boxes:questDraftBoxes.map((box,i)=>questBoxClone({...box,order:i+1},i))'),'Quest save must persist Box drafts');
assert(studio.includes('questDraftBoxes=(Array.isArray(q.boxes)?q.boxes:[]).map((box,i)=>questBoxClone(box,i))'),'Quest edit must load Box drafts');
assert(studio.includes("typeof GKAdventureStorySystem.normalizeQuestBox==='function'"),'Box editor must use P1 normalization');
assert(!studio.includes('id="storyBoxEditor"'),'legacy Section Box Editor must be removed; Quest Box is the only adventure Box editor');

// Execute only the P2 helper block against a minimal environment to verify reorder/id and multi-placement behavior.
const start=studio.indexOf('function questBoxClone(box,index=0){');
const end=studio.indexOf('function renderQuestFormalStatus(){',start);
assert(start>=0&&end>start,'P2 helper block not found');
const helperBlock=studio.slice(start,end);
const sandbox={
  window:{GKAdventureStorySystem:S},GKAdventureStorySystem:S,
  data:{quests:[],events:[{id:'EVT-1',name:'One'},{id:'EVT-2',name:'Two'}],chapters:[]},
  document:{getElementById(){return null},querySelector(){return null},body:{classList:{add(){},remove(){}}}},
  confirm(){return true},alert(message){throw new Error('unexpected alert: '+message)},setTimeout(){},
  esc(v){return String(v??'')},escAttr(v){return String(v??'')},console
};
const harness=`
let questDraftBoxes=[];
let questBoxEditorState=null;
const QUEST_BOX_ZONE_DEFS=[
 {key:'event_zone_before_pre',label:'A',position:'before'},
 {key:'event_zone_pre_to_mid',label:'B',position:'between'},
 {key:'event_zone_mid_to_post',label:'C',position:'between'},
 {key:'event_zone_after_post',label:'D',position:'after'}
];
${helperBlock}
globalThis.P2={
 setBoxes(v){questDraftBoxes=v},getBoxes(){return questDraftBoxes},
 setEditor(v){questBoxEditorState=v},getEditor(){return questBoxEditorState},
 moveQuestBoxDraft,addQuestBoxPlacement,moveQuestBoxPlacement,normalizeQuestDraftBoxOrder
};`;
vm.runInNewContext(harness,sandbox,{filename:'studio-p2-helper-harness.js'});

sandbox.P2.setBoxes([
 S.normalizeQuestBox({box_id:'BOX-0100',name:'A',order:1},0),
 S.normalizeQuestBox({box_id:'BOX-0200',name:'B',order:2},1)
]);
sandbox.P2.moveQuestBoxDraft(0,1);
let boxes=sandbox.P2.getBoxes();
assert.equal(boxes[0].box_id,'BOX-0200');
assert.equal(boxes[1].box_id,'BOX-0100');
assert.deepEqual(boxes.map(x=>x.order),[1,2]);

const draft=S.normalizeQuestBox({box_id:'BOX-0300'},0);
sandbox.P2.setEditor({index:0,draft});
sandbox.P2.addQuestBoxPlacement('event_zone_before_pre','fixed_event');
sandbox.P2.addQuestBoxPlacement('event_zone_before_pre','random_event');
let rows=sandbox.P2.getEditor().draft.event_zone_before_pre;
assert.equal(rows.length,2,'multiple Event placements must be retained in one zone');
assert.equal(rows[0].kind,'fixed_event');
assert.equal(rows[1].kind,'random_event');
assert.deepEqual(rows.map(x=>x.order),[1,2]);
sandbox.P2.moveQuestBoxPlacement('event_zone_before_pre',1,-1);
rows=sandbox.P2.getEditor().draft.event_zone_before_pre;
assert.equal(rows[0].kind,'random_event');
assert.equal(rows[1].kind,'fixed_event');
assert.deepEqual(rows.map(x=>x.order),[1,2]);

console.log('adventure-quest-box-studio-ui-p2 PASS');
