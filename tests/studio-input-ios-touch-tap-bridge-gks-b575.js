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

assert.ok(html.includes('.studio-input-overlay button{touch-action:manipulation;'),'Studio input buttons must opt into direct touch manipulation');
assert.ok(html.includes("overlay.addEventListener('touchend',studioHandleInputTouchEnd,{capture:true,passive:false})"),'touchend bridge must be non-passive so Safari native click synthesis can be replaced safely');
assert.ok(html.includes("window.addEventListener('DOMContentLoaded',installStudioInputTouchTapBridge)"),'touch tap bridge must install at startup');

const listeners=[];
const overlay={classList:classList(),dataset:{},contains:node=>node===button,addEventListener:(name,fn,options)=>listeners.push({name,fn,options})};
const button={disabled:false,clickCount:0,closest(sel){return sel==='button'?this:null;},click(){this.clickCount++;}};
const document={getElementById:id=>id==='studioInputOverlay'?overlay:null};
const window={addEventListener(){}};
const ctx={console,document,window,Date,Math};
vm.createContext(ctx);
vm.runInContext(`
let studioInputTouchTapState=null;
let studioInputSyntheticTapActive=false;
let studioInputSuppressNativeClickUntil=0;
const STUDIO_INPUT_TOUCH_MOVE_THRESHOLD=12;
const STUDIO_INPUT_TOUCH_MAX_DURATION=900;
const STUDIO_INPUT_NATIVE_CLICK_SUPPRESS_MS=700;
`,ctx);
for(const name of ['studioInputTouchPoint','studioInputTouchButton','studioInputTouchReset','studioHandleInputTouchStart','studioHandleInputTouchMove','studioHandleInputTouchEnd','studioHandleInputClickCapture','installStudioInputTouchTapBridge'])vm.runInContext(extractFunction(name),ctx);

ctx.installStudioInputTouchTapBridge();
assert.deepStrictEqual(listeners.map(x=>x.name),['touchstart','touchmove','touchend','touchcancel','click']);
assert.strictEqual(listeners.find(x=>x.name==='touchend').options.passive,false);
assert.strictEqual(overlay.dataset.touchTapBridge,'1');
ctx.installStudioInputTouchTapBridge();
assert.strictEqual(listeners.length,5,'bridge must not be installed twice');

function touchEvent(x,y,changed=false){
  let prevented=false,stopped=false;
  const point={clientX:x,clientY:y};
  return {target:button,touches:changed?[]:[point],changedTouches:changed?[point]:[],preventDefault(){prevented=true;},stopPropagation(){stopped=true;},get prevented(){return prevented;},get stopped(){return stopped;}};
}

// A stationary tap must invoke button.click even if iOS never synthesizes a normal click.
let start=touchEvent(100,200);ctx.studioHandleInputTouchStart(start);
let end=touchEvent(103,204,true);ctx.studioHandleInputTouchEnd(end);
assert.strictEqual(button.clickCount,1,'stationary touch must execute the button exactly once');
assert.strictEqual(end.prevented,true,'native click synthesis must be prevented after fallback dispatch');
assert.strictEqual(end.stopped,true,'touchend must not bubble into backdrop handlers after fallback dispatch');

// A follow-up native click from Safari must be suppressed to avoid double activation.
let duplicatePrevented=false,duplicateStopped=false;
ctx.studioHandleInputClickCapture({preventDefault(){duplicatePrevented=true;},stopImmediatePropagation(){duplicateStopped=true;}});
assert.strictEqual(duplicatePrevented,true);
assert.strictEqual(duplicateStopped,true);

// Scrolling across a button must never activate it.
vm.runInContext('studioInputSuppressNativeClickUntil=0',ctx);
ctx.studioHandleInputTouchStart(touchEvent(100,200));
ctx.studioHandleInputTouchMove(touchEvent(100,230));
ctx.studioHandleInputTouchEnd(touchEvent(100,230,true));
assert.strictEqual(button.clickCount,1,'scroll gesture must not be converted into a button tap');

// Disabled controls stay disabled.
button.disabled=true;
ctx.studioHandleInputTouchStart(touchEvent(50,50));
ctx.studioHandleInputTouchEnd(touchEvent(50,50,true));
assert.strictEqual(button.clickCount,1,'disabled button must not be activated by the touch bridge');

console.log('PASS GKS-B575 iOS Studio input touch bridge: stationary taps execute once, duplicate native clicks are suppressed, scroll gestures remain scrolls');
