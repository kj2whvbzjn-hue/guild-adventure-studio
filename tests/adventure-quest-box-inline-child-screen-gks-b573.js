const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('studio/index.html','utf8');

assert.ok(html.includes('id="questBoxEditorInline"'),'Box child screen container missing');
assert.ok(html.includes('#questEditorPanel.quest-box-detail-open>:not(#questBoxEditorInline){display:none!important}'),'Quest editor child-screen switch CSS missing');
assert.ok(html.includes('onclick="openQuestBoxEditor(${i},event)"'),'Box detail button must stop the originating mobile click');
assert.ok(html.includes('if(questBoxEditorState){closeQuestBoxEditor();return;}'),'Back must return from Box child screen to Quest editor before leaving the Quest editor');
assert.ok(html.includes('if(questBoxEditorState)closeQuestBoxEditor();'),'closing the Studio input surface must unwind the Box child screen first');

const start=html.indexOf('function openQuestBoxEditor(index,event){');
const end=html.indexOf('function saveQuestBoxEditor(){',start);
assert.ok(start>=0&&end>start,'Box open/close function block missing');
const code=html.slice(start,end);

function classList(initial=[]){const s=new Set(initial);return{add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x),_s:s};}
const panel={classList:classList(),};
const inline={classList:classList(['hidden']),attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
const heading={textContent:'クエストを編集する'};
const body={scrollTop:321};
const idEl={textContent:''};
const editorBody={innerHTML:''};
const nodes={questEditorPanel:panel,questBoxEditorInline:inline,studioInputTitle:heading,studioInputBody:body,questBoxEditorId:idEl,questBoxEditorBody:editorBody};
const document={getElementById:id=>nodes[id]||null,querySelector(){return null}};
const event={prevented:false,stopped:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
const questDraftBoxes=[{box_id:'BOX-Q1',name:'Imported Box',order:1,event_zone_before_pre:[],event_zone_pre_to_mid:[],event_zone_mid_to_post:[],event_zone_after_post:[]}];
let questBoxEditorState=null;
const studioInputPanelState={panel};
const QUEST_BOX_ZONE_DEFS=[{key:'event_zone_before_pre'},{key:'event_zone_pre_to_mid'},{key:'event_zone_mid_to_post'},{key:'event_zone_after_post'}];
const ctx={console,document,event,questDraftBoxes,questBoxEditorState,studioInputPanelState,QUEST_BOX_ZONE_DEFS,
 questBoxClone:v=>JSON.parse(JSON.stringify(v)),questBoxId:b=>b.box_id,renderQuestBoxEditor(){},renderQuestBoxZone:()=>'',renderQuestBoxSceneStage:()=>'',esc:v=>String(v??''),setTimeout:fn=>fn()};
vm.createContext(ctx);
vm.runInContext(code,ctx);
ctx.openQuestBoxEditor(0,event);
assert.ok(event.prevented&&event.stopped,'originating click must be consumed');
assert.strictEqual(ctx.questDraftBoxes.length,1,'opening Box detail must not clear Quest Box drafts');
assert.strictEqual(ctx.questDraftBoxes[0].box_id,'BOX-Q1');
assert.ok(panel.classList.contains('quest-box-detail-open'),'Quest editor must switch to Box child screen');
assert.ok(!inline.classList.contains('hidden'),'Box child screen must become visible');
assert.strictEqual(heading.textContent,'01 Boxを編集');
assert.ok(ctx.questBoxEditorState,'Box editor state must remain active');
ctx.closeQuestBoxEditor();
assert.ok(!panel.classList.contains('quest-box-detail-open'),'Back must restore Quest editor');
assert.ok(inline.classList.contains('hidden'),'Box child screen must close');
assert.strictEqual(heading.textContent,'クエストを編集する');
assert.strictEqual(ctx.questDraftBoxes.length,1,'returning from Box detail must preserve Quest Box drafts');

console.log('PASS GKS-B573 Quest Box detail uses same Studio input surface and preserves Quest drafts');
