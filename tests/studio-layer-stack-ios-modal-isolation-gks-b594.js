const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const build=require('../package-build.json');
const html=fs.readFileSync('studio/index.html','utf8');
const controllerSource=fs.readFileSync('studio/layer-controller.js','utf8');
const dx=fs.readFileSync('studio/data-exchange/data-exchange-ui.js','utf8');
const guide=fs.readFileSync('modules/verification/verification-guide.js','utf8');

assert.strictEqual(build.studio_build,'GKS-B641');
const studioBuildNumber=String(build.studio_build).match(/GKS-B(\d+)/)?.[1];
assert.ok(studioBuildNumber,'studio build number must be available');
assert.ok(html.includes(`<script src="./layer-controller.js?v=${studioBuildNumber}"></script>`),'common layer controller must load before Studio app logic');
assert.ok(html.includes("studioLayerOpen('tagPickerBackdrop')")&&html.includes("studioLayerClose('tagPickerBackdrop')"),'Master tag picker must join common layer stack');
assert.ok(html.includes("studioLayerOpen('masterSkillPicker')")&&html.includes("studioLayerOpen('ruleTagPicker')")&&html.includes("studioLayerOpen('benchmarkWorkflowOverlay')"),'Studio child overlays must join common layer stack');
assert.ok(html.includes("studioLayerOpen('studioInputOverlay')"),'Studio input overlay must join common layer stack');
assert.ok(dx.includes("GKSStudioLayerController?.open?.('dataExchangePicker')")&&dx.includes("GKSStudioLayerController?.close?.('dataExchangePicker')"),'Data Exchange picker must join common layer stack');
assert.ok(guide.includes("GKSStudioLayerController?.open?.('gkVerificationGuideOverlay')")&&guide.includes("GKSStudioLayerController?.close?.('gkVerificationGuideOverlay')"),'Verification Guide must join common layer stack');
assert.ok(html.includes("typeof studioLayerTopId==='function'?studioLayerTopId():''")&&html.includes("studioCloseLayerById(topLayer)"),'Back navigation must close only the foreground layer');
assert.ok(html.includes("const layerRoot=typeof studioLayerTopRoot==='function'?studioLayerTopRoot():window.GKSStudioLayerController?.topRoot?.();if(layerRoot)return layerRoot;"),'iOS touch router must route only inside foreground layer');

function classList(initial=[]){const set=new Set(initial);return{contains:v=>set.has(v),add:v=>set.add(v),remove:v=>set.delete(v)};}
function node(id,classes=[]){
 const attrs=new Set();
 const n={id,classList:classList(classes),style:{zIndex:''},children:[],parent:null,inert:false,blurCount:0,
   contains(other){if(other===this)return true;return this.children.some(x=>x.contains?.(other));},
   append(child){child.parent=this;this.children.push(child);},
   setAttribute(name){attrs.add(name);},removeAttribute(name){attrs.delete(name);},hasAttribute(name){return attrs.has(name);},blur(){this.blurCount++;}};
 return n;
}
const body=node('body'),main=node('main'),input=node('studioInputOverlay',['hidden']),tag=node('tagPickerBackdrop',['hidden']),preInert=node('preInert');
preInert.inert=true;preInert.setAttribute('inert','');
body.append(main);body.append(input);body.append(tag);body.append(preInert);
const underlyingSelect=node('masterStatus');input.append(underlyingSelect);
const nodes={studioInputOverlay:input,tagPickerBackdrop:tag};
const document={body,activeElement:body,getElementById:id=>nodes[id]||null};
const window={document};
const ctx={window,document,console,Map,Array,String,Boolean};vm.createContext(ctx);vm.runInContext(controllerSource,ctx);
const ctl=window.GKSStudioLayerController;

input.classList.remove('hidden');document.activeElement=underlyingSelect;ctl.open('studioInputOverlay');
assert.strictEqual(ctl.topRoot(),input);
assert.strictEqual(main.inert,true,'background must be inert while input overlay is open');
assert.strictEqual(input.inert,false,'foreground input overlay must remain interactive');
assert.strictEqual(preInert.inert,true,'pre-existing inert state must remain protected');

tag.classList.remove('hidden');ctl.open('tagPickerBackdrop');
assert.strictEqual(underlyingSelect.blurCount,1,'opening child picker must blur the background native control');
assert.strictEqual(ctl.topRoot(),tag);
assert.strictEqual(input.inert,true,'Studio input overlay must become inert under its child picker');
assert.strictEqual(tag.inert,false,'child picker must be the only interactive body layer');
assert.ok(Number(tag.style.zIndex)>Number(input.style.zIndex),'stack order must also control visual z-index');

tag.classList.add('hidden');ctl.close('tagPickerBackdrop');
assert.strictEqual(ctl.topRoot(),input);
assert.strictEqual(input.inert,false,'closing child picker must reactivate Studio input overlay');
input.classList.add('hidden');ctl.close('studioInputOverlay');
assert.strictEqual(ctl.topRoot(),null);
assert.strictEqual(main.inert,false,'closing final layer must restore background interaction');
assert.strictEqual(preInert.inert,true,'pre-existing inert state must survive complete stack teardown');
assert.strictEqual(body.classList.contains('studio-layer-open'),false,'common body scroll lock must be released');

// Reproduce the device failure: visible picker checkbox and hidden-behind native select share the same coordinates.
function extractFunction(name){
 const marker=`function ${name}(`,start=html.indexOf(marker);assert.ok(start>=0,`missing ${name}`);
 const brace=html.indexOf('{',start);let depth=0,quote=null,escape=false;
 for(let i=brace;i<html.length;i++){
  const ch=html[i];if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote=null;continue;}
  if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
 }
 throw new Error(`unterminated ${name}`);
}
function control(tagName,type){return{tagName,type,disabled:false,clickCount:0,showPickerCount:0,focusCount:0,getBoundingClientRect(){return{left:20,top:100,right:300,bottom:160,width:280,height:60};},contains(t){return t===this;},click(){this.clickCount++;},showPicker(){this.showPickerCount++;},focus(){this.focusCount++;}};}
const topCheckbox=control('INPUT','checkbox'),lowerSelect=control('SELECT','');
const topRoot={querySelectorAll:()=>[topCheckbox]},lowerRoot={classList:classList(),querySelectorAll:()=>[lowerSelect]};
const touchDocument={documentElement:{dataset:{}},getElementById:id=>id==='studioInputOverlay'?lowerRoot:id==='sidebar'?null:null,addEventListener(){},elementFromPoint(){return lowerSelect;}};
const touchWindow={GKSStudioLayerController:{topRoot:()=>topRoot},addEventListener(){}};
const navigator={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',maxTouchPoints:5};
const touchCtx={console,document:touchDocument,window:touchWindow,navigator,Date,Math};vm.createContext(touchCtx);
vm.runInContext(`let studioMobileTouchTapState=null;let studioMobileSyntheticTapActive=false;let studioMobileSuppressNativeClickUntil=0;const STUDIO_MOBILE_TOUCH_MOVE_THRESHOLD=12;const STUDIO_MOBILE_TOUCH_MAX_DURATION=900;const STUDIO_MOBILE_NATIVE_CLICK_SUPPRESS_MS=700;`,touchCtx);
for(const name of ['studioIsIosTouchDevice','studioMobileTouchPoint','studioTouchActiveRoot','studioTouchControlFromPoint','studioMobileTouchReset','studioHandleMobileTouchStart','studioHandleMobileTouchMove','studioTouchTargetMatchesControl','studioFocusTouchControl','studioActivateTouchControl','studioHandleMobileTouchEnd'])vm.runInContext(extractFunction(name),touchCtx);
function touch(x,y,changed,target){const p={clientX:x,clientY:y};return{target,touches:changed?[]:[p],changedTouches:changed?[p]:[],preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};}
touchCtx.studioHandleMobileTouchStart(touch(100,125,false,lowerSelect));touchCtx.studioHandleMobileTouchEnd(touch(100,125,true,lowerSelect));
assert.strictEqual(topCheckbox.clickCount,1,'foreground picker control must win even when Safari reports the background select');
assert.strictEqual(lowerSelect.showPickerCount,0,'background select must never open through the foreground picker');

console.log('PASS GKS-B641 common Studio layer stack: inert background, z-order, scroll lock, foreground-only iOS touch routing, and nested picker restoration');
