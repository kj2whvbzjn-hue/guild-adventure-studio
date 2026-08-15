const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('studio/index.html','utf8');

// Studio Home is the Basic/Create/Verify/Manage launcher, not Dashboard.
assert.ok(html.includes('const STUDIO_LAUNCHER_HISTORY_PREFIX=\'__launcher__:\';'),'launcher history token prefix missing');
assert.ok(html.includes("dashboard:'ダッシュボード'"),'Dashboard must be a normal child screen with a common header title');
assert.ok(html.includes("dashboard:'basic'"),'Dashboard must belong to Basic, not be treated as Studio Home');
assert.ok(html.includes('function studioToggleLauncherHome()'),'mobile Feature List must open the Studio Home state');
assert.ok(html.includes('studioOpenLauncherHome(studioCategoryForView('),'Feature List must preserve the current screen category when opening Studio Home');
assert.ok(!html.includes('<button type="button" class="mobile-only" onclick="closeMobile()">閉じる</button>'),'Studio Home must not carry its own duplicate Close button');

// Every Studio view, including Dashboard, gets the common header. Home itself is the launcher and is outside section.view.
assert.ok(html.includes('function studioEnsureCommonHeader(name){\n if(!name)return;'),'all Studio views including Dashboard must receive the common header');
assert.ok(html.includes("window.addEventListener('DOMContentLoaded',studioEnsureAllCommonHeaders)"),'static Studio views must get the common header');
assert.ok(html.includes("if(name)studioEnsureCommonHeader(name);"),'dynamic Studio views must get the common header');

// The launcher category must be encoded in history so Back from Scenario returns to Create Home, not Dashboard.
assert.ok(html.includes('studioLauncherHomeActive?studioLauncherHistoryToken(studioLauncherCategory):current'),'launcher-home history must not use the currently visible underlying Dashboard as the previous screen');
assert.ok(html.includes('const launcherCategory=studioLauncherCategoryFromHistoryToken(target);'),'Back must detect a launcher-home history entry');
assert.ok(html.includes('studioOpenLauncherHome(launcherCategory||studioCategoryForView(current))'),'Back must return to the correct Studio Home category');
assert.ok(html.includes("studioOpenLauncherHome(category);"),'Close must return directly to Studio Home for the current category');

// Full-screen child screens must sit above the project navigation so their common header is actually visible on iPhone.
for(const fragment of [
  '.studio-input-overlay{position:fixed;inset:0;z-index:10050',
  '.rule-tag-picker{position:fixed;inset:0;z-index:10070',
  '.master-skill-picker{position:fixed;inset:0;z-index:10070',
  '.tag-picker-backdrop{position:fixed;inset:0;z-index:10080',
  '.benchmark-workflow-overlay{position:fixed;inset:0;z-index:10060',
  '.dx-picker{position:fixed;inset:0;z-index:10050'
]) assert.ok(html.includes(fragment),`full-screen Studio child surface not above project nav: ${fragment}`);

// Lightweight behavior test for Home -> Scenario -> Back and Close category routing.
const start=html.indexOf("let pendingStudioView='';");
const end=html.indexOf('function sanitizeProjectId',start);
assert.ok(start>=0&&end>start,'navigation implementation block missing');
const code=html.slice(start,end);

function classList(initial=[]){
  const set=new Set(initial);
  return {contains:x=>set.has(x),add:x=>set.add(x),remove:x=>set.delete(x),toggle:(x,v)=>{if(v===undefined){set.has(x)?set.delete(x):set.add(x)}else v?set.add(x):set.delete(x)},_set:set};
}
const views={
  dashboard:{id:'view-dashboard',classList:classList([])},
  story:{id:'view-story',classList:classList(['hidden'])},
  flags:{id:'view-flags',classList:classList(['hidden'])}
};
const sidebar={classList:classList([]),scrollIntoView(){}};
const categoryButtons=['basic','create','verify','manage'].map(name=>({dataset:{launcherCategory:name},classList:classList(name==='basic'?['active']:[])}));
const panels=['basic','create','verify','manage'].map(name=>({id:'launcherPanel-'+name,classList:classList(name==='basic'?['active']:[])}));
const selectedLabel={value:''};
const nav={addEventListener(){}};
const doc={
  createElement(){return {className:'',dataset:{},textContent:'',type:'',append(){},addEventListener(){},querySelector(){return {textContent:''}}}},
  getElementById(id){if(id.startsWith('view-'))return views[id.slice(5)]||null;if(id==='sidebar')return sidebar;if(id==='selectedLabel')return selectedLabel;if(id==='nav')return nav;return null},
  querySelector(sel){if(sel==='.view:not(.hidden)')return Object.values(views).find(v=>!v.classList.contains('hidden'))||null;const m=sel.match(/^\[data-launcher-category="([^"]+)"\]$/);if(m)return categoryButtons.find(b=>b.dataset.launcherCategory===m[1])||null;if(sel==='[data-launcher-category="basic"]')return categoryButtons[0];return null},
  querySelectorAll(sel){if(sel==='.view')return Object.values(views);if(sel==='#nav button[data-view]')return [];if(sel==='.launcher-category-tabs button')return categoryButtons;if(sel==='.launcher-action-panel')return panels;if(sel==='section.view[id]')return [];return []},
  addEventListener(){}
};
const ctx={console,document:doc,window:{matchMedia:()=>({matches:true}),scrollTo(){},addEventListener(){},GKSAIProductionUI:null,GKSDataExchangeUI:null},studioInputPanelState:null,questBoxEditorState:null,rememberRecentFeature(){},closeMobile(){sidebar.classList.remove('mobile-open')},render(){},closeQuestBoxEditor(){},closeRuleTagPicker(){},closeBenchmarkWorkflow(){},closeMasterSkillPicker(){},closeTagPicker(){},backToDatabase(){},setTimeout,clearTimeout};
ctx.selectLauncherCategory=(name,button)=>{categoryButtons.forEach(b=>b.classList.toggle('active',b===button));panels.forEach(p=>p.classList.toggle('active',p.id==='launcherPanel-'+name));vm.runInContext(`studioLauncherCategory=${JSON.stringify(name||'basic')}`,ctx)};
ctx.currentStudioView=()=>Object.values(views).find(v=>!v.classList.contains('hidden'))?.id.replace('view-','')||'';
vm.createContext(ctx);vm.runInContext(code,ctx);
ctx.studioEnsureCommonHeader=()=>{};

// Open Studio Home on Create while Dashboard is merely the underlying visible child.
ctx.studioOpenLauncherHome('create');
assert.strictEqual(vm.runInContext('studioLauncherHomeActive',ctx),true);
assert.ok(sidebar.classList.contains('mobile-open'));
assert.ok(categoryButtons.find(b=>b.dataset.launcherCategory==='create').classList.contains('active'));
ctx.showView('story');
assert.strictEqual(ctx.currentStudioView(),'story');
assert.strictEqual(vm.runInContext('studioLauncherHomeActive',ctx),false);
ctx.studioNavigateBack();
assert.strictEqual(ctx.currentStudioView(),'story','Back to Home must not switch the underlying view to Dashboard');
assert.strictEqual(vm.runInContext('studioLauncherHomeActive',ctx),true,'Back from Scenario must open Studio Home');
assert.ok(categoryButtons.find(b=>b.dataset.launcherCategory==='create').classList.contains('active'),'Back from Scenario must return to Create Home');

// Close from a Create child must also go directly to Create Home.
ctx.studioCloseLauncherHome();
ctx.showView('flags');
ctx.studioNavigateClose();
assert.strictEqual(vm.runInContext('studioLauncherHomeActive',ctx),true);
assert.ok(categoryButtons.find(b=>b.dataset.launcherCategory==='create').classList.contains('active'),'Close from Flag must return to Create Home');

console.log('PASS GKS-B573 Studio Home-aware common navigation: Dashboard is child, Back is actual previous screen, Close returns category Home, full-screen headers remain visible');
