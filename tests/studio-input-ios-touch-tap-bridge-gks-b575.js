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
const button={tagName:'BUTTON',type:'button',disabled:false,clickCount:0,getBoundingClientRect(){return {left:20,top:100,right:220,bottom:150,width:200,height:50};},contains(target){return target===this;},click(){this.clickCount++;}};
const overlay={classList:classList(),querySelectorAll:()=>[button]};
const sidebar={classList:classList(),querySelectorAll:()=>[]};
const listeners=[];
const document={documentElement:{dataset:{}},getElementById:id=>id==='studioInputOverlay'?overlay:id==='sidebar'?sidebar:null,addEventListener:(name,fn,options)=>listeners.push({name,fn,options})};
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
for(const name of ['studioIsIosTouchDevice','studioMobileTouchPoint','studioTouchActiveRoot','studioTouchControlFromPoint','studioTouchButtonFromPoint','studioMobileTouchReset','studioHandleMobileTouchStart','studioHandleMobileTouchMove','studioTouchTargetMatchesControl','studioFocusTouchControl','studioActivateTouchControl','studioHandleMobileTouchEnd','studioHandleMobileClickCapture','installStudioMobileTouchRouter'])vm.runInContext(extractFunction(name),ctx);

assert.ok(html.includes('.launcher-category-tabs button,.launcher-action-grid button,.studio-input-overlay button{touch-action:manipulation;'),'touch manipulation must cover launcher and Studio input buttons');
ctx.installStudioMobileTouchRouter();
assert.deepStrictEqual(listeners.map(x=>x.name),['touchstart','touchmove','touchend','touchcancel','click']);
assert.strictEqual(listeners.find(x=>x.name==='touchend').options.passive,false);

function touchEvent(x,y,changed=false){
  let prevented=false,stopped=false;const p={clientX:x,clientY:y};
  return {target:button,touches:changed?[]:[p],changedTouches:changed?[p]:[],preventDefault(){prevented=true;},stopPropagation(){stopped=true;},get prevented(){return prevented;},get stopped(){return stopped;}};
}
ctx.studioHandleMobileTouchStart(touchEvent(100,125));
const end=touchEvent(100,125,true);ctx.studioHandleMobileTouchEnd(end);
assert.strictEqual(button.clickCount,1,'stationary iOS tap must execute once');
assert.strictEqual(end.prevented,true);
assert.strictEqual(end.stopped,true);

let duplicatePrevented=false,duplicateStopped=false;
ctx.studioHandleMobileClickCapture({preventDefault(){duplicatePrevented=true;},stopImmediatePropagation(){duplicateStopped=true;}});
assert.strictEqual(duplicatePrevented,true);assert.strictEqual(duplicateStopped,true);

vm.runInContext('studioMobileSuppressNativeClickUntil=0',ctx);
ctx.studioHandleMobileTouchStart(touchEvent(100,125));
ctx.studioHandleMobileTouchMove(touchEvent(100,160));
ctx.studioHandleMobileTouchEnd(touchEvent(100,160,true));
assert.strictEqual(button.clickCount,1,'scroll gesture must not become a tap');

console.log('PASS GKS-B580 preserves B575 iOS fallback intent with document-level visual hit routing and scroll protection');
