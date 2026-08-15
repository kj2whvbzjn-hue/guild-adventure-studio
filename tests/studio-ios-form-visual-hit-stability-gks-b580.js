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
    closest(){return this;},
    focus(){this.focusCount++;},click(){this.clickCount++;},showPicker(){this.showPickerCount++;}
  };
}

assert.ok(html.includes('.studio-input-overlay input:not([type="hidden"]),.studio-input-overlay select,.studio-input-overlay textarea{font-size:16px;touch-action:manipulation}'),
  'mobile Studio form controls must stay at 16px to avoid iOS focus auto-zoom shifting the visible viewport');
assert.ok(html.includes("typeof document.elementFromPoint==='function'"),'iOS routing must prefer browser visual hit-testing before manual rectangles');

// Deliberately make the raw rectangles stale/wrong: the point geometrically falls in questType,
// while elementFromPoint reports the actually visible Quest-name control.
const questName=control('questName','input',20,40,300,90,'text');
const questType=control('questType','select',20,100,300,150);
const eventRef=control('eventRef','select',20,200,300,250);
const eventFailure=control('eventFailure','select',20,260,300,310);
const overlay={classList:classList(),querySelectorAll:()=>[questName,questType,eventRef,eventFailure]};
const sidebar={classList:classList(),querySelectorAll:()=>[]};
let visualHit=questName;
const document={
  documentElement:{dataset:{}},
  getElementById(id){return id==='studioInputOverlay'?overlay:id==='sidebar'?sidebar:null;},
  elementFromPoint(){return visualHit;},
  addEventListener(){}
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
for(const name of ['studioIsIosTouchDevice','studioMobileTouchPoint','studioTouchActiveRoot','studioTouchControlFromPoint','studioTouchButtonFromPoint','studioMobileTouchReset','studioHandleMobileTouchStart','studioHandleMobileTouchMove','studioTouchTargetMatchesControl','studioFocusTouchControl','studioActivateTouchControl','studioHandleMobileTouchEnd','studioHandleMobileClickCapture']){
  vm.runInContext(extractFunction(name),ctx);
}
function touchEvent(x,y,changed=false,target=questType){
  let prevented=false;const point={clientX:x,clientY:y};
  return {target,touches:changed?[]:[point],changedTouches:changed?[point]:[],preventDefault(){prevented=true;},stopPropagation(){},stopImmediatePropagation(){},get prevented(){return prevented;}};
}
function tap(x,y,target){ctx.studioHandleMobileTouchStart(touchEvent(x,y,false,target));const end=touchEvent(x,y,true,target);ctx.studioHandleMobileTouchEnd(end);return end;}

let end=tap(120,125,questType);
assert.strictEqual(questName.focusCount,1,'browser visual hit-test must win over stale rectangle/native adjacent target for Quest name');
assert.strictEqual(questType.showPickerCount,0,'Quest-name tap must not open the control below it');
assert.strictEqual(end.prevented,true);

visualHit=eventRef;
end=tap(120,285,eventFailure);
assert.strictEqual(eventRef.showPickerCount,1,'Event reference visual hit must open Event reference, not Event failure below');
assert.strictEqual(eventFailure.showPickerCount,0);

console.log('PASS GKS-B580 iOS form stability: 16px controls plus elementFromPoint-first visual hit routing prevent adjacent-field activation');
