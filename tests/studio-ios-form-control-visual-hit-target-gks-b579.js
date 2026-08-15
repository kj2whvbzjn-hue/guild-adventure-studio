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
function classList(initial=[]){const s=new Set(initial);return{contains:x=>s.has(x),add:x=>s.add(x),remove:x=>s.delete(x)};}
function control(name,tag,left,top,right,bottom,type=''){
  return {
    name,tagName:String(tag).toUpperCase(),type,disabled:false,focusCount:0,clickCount:0,showPickerCount:0,classList:classList(),
    getBoundingClientRect(){return {left,top,right,bottom,width:right-left,height:bottom-top};},
    contains(target){return target===this;},
    focus(){this.focusCount++;},click(){this.clickCount++;},showPicker(){this.showPickerCount++;}
  };
}

assert.ok(html.includes("button,input:not([type=\"hidden\"]),select,textarea"),'iOS visual resolver must cover form controls, not buttons only');
assert.ok(html.includes('function studioTouchControlFromPoint('));
assert.ok(html.includes('function studioActivateTouchControl('));

const questName=control('questName','input',20,100,300,150,'text');
const questType=control('questType','select',20,160,300,210);
const boxName=control('boxName','input',20,220,300,270,'text');
const eventRef=control('eventRef','select',20,300,300,350);
const eventFailure=control('eventFailure','select',20,360,300,410);
const back=control('back','button',20,20,120,70);
const overlay={classList:classList(),querySelectorAll:()=>[back,questName,questType,boxName,eventRef,eventFailure]};
const sidebar={classList:classList(),querySelectorAll:()=>[]};
const listeners=[];
const document={
  documentElement:{dataset:{}},
  getElementById(id){return id==='studioInputOverlay'?overlay:id==='sidebar'?sidebar:null;},
  addEventListener(name,fn,options){listeners.push({name,fn,options});}
};
const navigator={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',maxTouchPoints:5};
const window={addEventListener(){}};
const ctx={console,document,navigator,window,Date,Math};
vm.createContext(ctx);
vm.runInContext(`
let studioMobileTouchTapState=null;
let studioMobileSyntheticTapActive=false;
let studioMobileSuppressNativeClickUntil=0;
const STUDIO_MOBILE_TOUCH_MOVE_THRESHOLD=12;
const STUDIO_MOBILE_TOUCH_MAX_DURATION=900;
const STUDIO_MOBILE_NATIVE_CLICK_SUPPRESS_MS=700;
`,ctx);
for(const name of [
  'studioIsIosTouchDevice','studioMobileTouchPoint','studioTouchActiveRoot','studioTouchControlFromPoint','studioTouchButtonFromPoint',
  'studioMobileTouchReset','studioHandleMobileTouchStart','studioHandleMobileTouchMove','studioTouchTargetMatchesControl',
  'studioFocusTouchControl','studioActivateTouchControl','studioHandleMobileTouchEnd','studioHandleMobileClickCapture','installStudioMobileTouchRouter'
])vm.runInContext(extractFunction(name),ctx);

function touchEvent(x,y,changed=false,target=eventFailure){
  let prevented=false,stopped=false,immediate=false;
  const point={clientX:x,clientY:y};
  return {target,touches:changed?[]:[point],changedTouches:changed?[point]:[],preventDefault(){prevented=true;},stopPropagation(){stopped=true;},stopImmediatePropagation(){immediate=true;},get prevented(){return prevented;},get stopped(){return stopped;},get immediate(){return immediate;}};
}
function tap(x,y,wrongTarget){
  ctx.studioHandleMobileTouchStart(touchEvent(x,y,false,wrongTarget));
  const end=touchEvent(x,y,true,wrongTarget);ctx.studioHandleMobileTouchEnd(end);return end;
}

// Reproduce the real-device symptom: the finger is on Event reference but Safari reports the next Event-failure select.
let end=tap(120,325,eventFailure);
assert.strictEqual(eventRef.showPickerCount,1,'visible Event reference select must open instead of the lower Event-failure select');
assert.strictEqual(eventFailure.showPickerCount,0,'wrong Event-failure select must never be activated');
assert.strictEqual(end.prevented,true);

// Quest-name and Box-name re-editing must focus the visible text input even if Safari reports the control below it.
end=tap(120,125,questType);
assert.strictEqual(questName.focusCount,1,'Quest name input must receive focus for re-change');
assert.strictEqual(questType.showPickerCount,0);
assert.strictEqual(end.prevented,true);
end=tap(120,245,eventRef);
assert.strictEqual(boxName.focusCount,1,'Box name input must receive focus for re-edit');
assert.strictEqual(eventRef.showPickerCount,1,'Box-name tap must not open Event reference');

// If Safari already reports the correct native form control, leave its native behavior untouched.
end=tap(120,125,questName);
assert.strictEqual(end.prevented,false,'correct native input target should keep normal iOS editing behavior');
assert.strictEqual(questName.focusCount,1,'no duplicate synthetic focus for a correct target');

// Existing button fallback remains active.
end=tap(60,45,eventFailure);
assert.strictEqual(back.clickCount,1,'button visual routing must remain intact');
assert.strictEqual(end.prevented,true);

// A scroll gesture must not focus/open any form control.
ctx.studioHandleMobileTouchStart(touchEvent(120,325,false,eventFailure));
ctx.studioHandleMobileTouchMove(touchEvent(120,350,false,eventFailure));
ctx.studioHandleMobileTouchEnd(touchEvent(120,350,true,eventFailure));
assert.strictEqual(eventRef.showPickerCount,1,'scrolling must not synthesize a select tap');

// Re-edit fields are still explicitly loaded/rendered from the persisted Quest/Box names.
assert.ok(html.includes("questId.value=q.id;questName.value=q.name"),'Quest edit must restore persisted quest name');
assert.ok(html.includes('<label>Box名</label><input value="${esc(box.name||\'\')}"'),'Box editor must restore persisted Box name');

console.log('PASS GKS-B581 iOS form-control visual hit routing: Quest-name re-change, Box-name re-edit, Event reference select, native target preservation, and scroll protection');
