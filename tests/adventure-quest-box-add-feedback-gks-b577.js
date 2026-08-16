const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('studio/index.html','utf8');

function extractFunction(name){
  const marker=`function ${name}(`,start=html.indexOf(marker);
  assert.ok(start>=0,`missing ${name}`);
  const brace=html.indexOf('{',start);let depth=0,quote=null,escape=false;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}
function classList(){const s=new Set();return{add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)};}

assert.ok(html.includes('.quest-box-placement-added{'),'new placement must have a visible highlight');
assert.ok(!html.includes('quest-box-add-feedback'),'obsolete success-message UI must not be rendered');
assert.ok(html.includes('data-placement-index="${index}"'),'rendered placement must be targetable after re-render');
assert.ok(html.includes('data-quest-zone="${esc(zoneDef.key)}"'),'zone must be targetable after re-render');

const target={classList:classList(),scrollCalls:[],scrollIntoView(options){this.scrollCalls.push(options);}};
const stage={querySelector(selector){
  if(selector==='.quest-box-placement[data-placement-index="2"]')return target;
  return null;
}};
const document={querySelector(selector){return selector==='.quest-box-stage[data-quest-zone="event_zone_before_pre"]'?stage:null;}};
const delayed=[];
function setTimeout(fn,ms){if(ms===0){fn();return 1;}delayed.push(fn);return delayed.length+1;}
function clearTimeout(){}
const ctx={console,document,setTimeout,clearTimeout,window:{GKAdventureStorySystem:{normalizeQuestEventPlacement:(source,index)=>({...source,order:index+1})}},GKAdventureStorySystem:null};
ctx.GKAdventureStorySystem=ctx.window.GKAdventureStorySystem;
vm.createContext(ctx);
vm.runInContext(`
let questBoxPlacementHighlightTimer=null;
let questBoxEditorState={draft:{event_zone_before_pre:[{kind:'fixed_event'},{kind:'fixed_event'}]}};
const QUEST_BOX_ZONE_DEFS=[{key:'event_zone_before_pre'}];
function questBoxCatalogFilter(){return {usage:'',type:'',group:'',tags:'',name:''};}
function normalizeQuestBoxPlacementOrders(zoneKey){questBoxEditorState.draft[zoneKey].forEach((p,i)=>p.order=i+1);}
let renderCount=0;
function renderQuestBoxEditor(){renderCount++;}
`,ctx);
vm.runInContext(extractFunction('focusQuestBoxPlacementAdded'),ctx);
vm.runInContext(extractFunction('addQuestBoxPlacement'),ctx);

ctx.addQuestBoxPlacement('event_zone_before_pre','fixed_event');
assert.strictEqual(vm.runInContext('questBoxEditorState.draft.event_zone_before_pre.length',ctx),3,'add must append exactly one placement');
assert.strictEqual(vm.runInContext('renderCount',ctx),1,'add must re-render once');
assert.ok(target.classList.contains('quest-box-placement-added'),'new placement must be highlighted');
assert.strictEqual(target.scrollCalls.length,1,'new placement must be brought into view');
assert.strictEqual(target.scrollCalls[0].behavior,'smooth');
assert.strictEqual(target.scrollCalls[0].block,'center');

assert.strictEqual(delayed.length,1,'highlight cleanup must be scheduled');
delayed[0]();
assert.ok(!target.classList.contains('quest-box-placement-added'),'highlight must clear after acknowledgement');

console.log('PASS GKS-B582 Quest Box add feedback: auto-scroll and temporary highlight without redundant success message');
