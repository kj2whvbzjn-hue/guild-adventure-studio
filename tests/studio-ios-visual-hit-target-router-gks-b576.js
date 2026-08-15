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
function button(name,left,top,right,bottom){
  return {name,disabled:false,clickCount:0,classList:classList(),getBoundingClientRect(){return {left,top,right,bottom,width:right-left,height:bottom-top};},click(){this.clickCount++;}};
}

assert.ok(html.includes('function studioTouchButtonFromPoint('),'visual-coordinate button resolver must exist');
assert.ok(html.includes("document.addEventListener('touchend',studioHandleMobileTouchEnd,{capture:true,passive:false})"),'document-level iOS touch router must own touchend before Safari creates a wrong native click');

const quest=button('quest',170,100,320,150);
const flag=button('flag',170,160,320,210);
const rule=button('rule',170,340,320,390);
const back=button('back',10,20,120,70);
const close=button('close',130,20,240,70);
const boxAdd=button('boxAdd',10,280,320,330);
const sidebar={classList:classList(['mobile-open']),querySelectorAll:()=>[quest,flag,rule]};
const overlay={classList:classList(['hidden']),querySelectorAll:()=>[back,close,boxAdd]};
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
for(const name of ['studioIsIosTouchDevice','studioMobileTouchPoint','studioTouchActiveRoot','studioTouchButtonFromPoint','studioMobileTouchReset','studioHandleMobileTouchStart','studioHandleMobileTouchMove','studioHandleMobileTouchEnd','studioHandleMobileClickCapture','installStudioMobileTouchRouter'])vm.runInContext(extractFunction(name),ctx);

ctx.installStudioMobileTouchRouter();
assert.deepStrictEqual(listeners.map(x=>x.name),['touchstart','touchmove','touchend','touchcancel','click']);
assert.strictEqual(listeners.find(x=>x.name==='touchend').options.passive,false);

function touchEvent(x,y,changed=false,target=flag){
  let prevented=false,stopped=false;
  const point={clientX:x,clientY:y};
  return {target,touches:changed?[]:[point],changedTouches:changed?[point]:[],preventDefault(){prevented=true;},stopPropagation(){stopped=true;},get prevented(){return prevented;},get stopped(){return stopped;}};
}

// Reproduce the device symptom: Safari reports Flag as target while the finger is visibly on Quest.
ctx.studioHandleMobileTouchStart(touchEvent(220,125,false,flag));
const questEnd=touchEvent(220,125,true,flag);
ctx.studioHandleMobileTouchEnd(questEnd);
assert.strictEqual(quest.clickCount,1,'visual Quest rect must win over Safari\'s wrong Flag event.target');
assert.strictEqual(flag.clickCount,0,'wrong lower-row target must never execute');
assert.strictEqual(questEnd.prevented,true);

// Bottom Rule must still be activatable even when Safari reports no useful button target below it.
vm.runInContext('studioMobileSuppressNativeClickUntil=0',ctx);
ctx.studioHandleMobileTouchStart(touchEvent(220,365,false,sidebar));
ctx.studioHandleMobileTouchEnd(touchEvent(220,365,true,sidebar));
assert.strictEqual(rule.clickCount,1,'bottom Rule button must resolve from visual coordinates');

// Overlay takes priority over the background launcher; Box Add must resolve geometrically as well.
overlay.classList.remove('hidden');
vm.runInContext('studioMobileSuppressNativeClickUntil=0',ctx);
ctx.studioHandleMobileTouchStart(touchEvent(150,305,false,close));
ctx.studioHandleMobileTouchEnd(touchEvent(150,305,true,close));
assert.strictEqual(boxAdd.clickCount,1,'Quest Editor Box Add must resolve from its visible rect, not the wrong touch target');
assert.strictEqual(close.clickCount,0);

// A scroll gesture remains a scroll and never activates a button.
vm.runInContext('studioMobileSuppressNativeClickUntil=0',ctx);
ctx.studioHandleMobileTouchStart(touchEvent(150,305,false,boxAdd));
ctx.studioHandleMobileTouchMove(touchEvent(150,340,false,boxAdd));
ctx.studioHandleMobileTouchEnd(touchEvent(150,340,true,boxAdd));
assert.strictEqual(boxAdd.clickCount,1,'scrolling must not synthesize a tap');

console.log('PASS GKS-B578 iOS visual hit-target router: Quest/Flag row shift, bottom Rule, Quest Box Add, and scroll protection');
