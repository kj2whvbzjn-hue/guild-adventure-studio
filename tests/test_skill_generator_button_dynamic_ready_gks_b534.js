const fs=require('fs'),assert=require('assert'),vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
assert.strictEqual(build.game_build,'GA-B486.180');
assert.strictEqual(build.studio_build,'GKS-B573');
const html=fs.readFileSync('studio/index.html','utf8');
const skill=fs.readFileSync('studio/skill/skill-generator.js','utf8');
assert.ok(html.includes("runLauncherAction('skill-generator')"),'launcher skill-generator button missing');
assert.ok(html.includes("<button data-view=\"skill-generator\">スキル生成</button>"),'nav skill-generator button missing');
assert.ok(html.includes("if(!target){pendingStudioView=name;return false;}"),'dynamic view pending guard missing');
assert.ok(html.indexOf("if(!target){pendingStudioView=name;return false;}")<html.indexOf("document.querySelectorAll('.view').forEach"),'current view must not be hidden before dynamic target exists');
assert.ok(html.includes("document.addEventListener('gks:view-ready',handleStudioDynamicViewReady)"),'dynamic view ready listener missing');
assert.ok(skill.includes("new CustomEvent('gks:view-ready',{detail:{view:'skill-generator'}})"),'Skill Generator must notify view readiness after panel render');
assert.ok(html.includes('./skill/skill-generator.js?v=33'),'Skill Generator cache key was not advanced');

function classList(initial=[]){const set=new Set(initial);return{add:x=>set.add(x),remove:x=>set.delete(x),toggle:(x,on)=>on?set.add(x):set.delete(x),contains:x=>set.has(x)};}
const views={
 'view-dashboard':{id:'view-dashboard',classList:classList()},
};
const selectedLabel={value:''};
const navButtons=[{dataset:{view:'dashboard'},classList:classList(['active'])},{dataset:{view:'skill-generator'},classList:classList()}];
let readyListener=null,remembered='',renderCount=0;
const documentMock={
 getElementById(id){if(id==='selectedLabel')return selectedLabel;return views[id]||null;},
 querySelectorAll(sel){if(sel==='.view')return Object.values(views);if(sel==='#nav button[data-view]')return navButtons;return[];},
 addEventListener(type,fn){if(type==='gks:view-ready')readyListener=fn;}
};
const ctx={document:documentMock,window:{matchMedia:()=>({matches:false}),scrollTo:()=>{}},rememberRecentFeature:n=>remembered=n,closeMobile:()=>{},render:()=>renderCount++,String};
vm.createContext(ctx);
const start=html.indexOf("let pendingStudioView='';");
const end=html.indexOf("document.getElementById('nav').addEventListener",start);
assert.ok(start>=0&&end>start,'showView dynamic readiness block not found');
vm.runInContext(html.slice(start,end),ctx,{filename:'studio-show-view-dynamic.js'});

assert.strictEqual(ctx.showView('skill-generator'),false,'missing dynamic view should be deferred');
assert.strictEqual(views['view-dashboard'].classList.contains('hidden'),false,'current view was hidden while target was not ready');
assert.strictEqual(selectedLabel.value,'','selection changed before target existed');
assert.ok(readyListener,'ready event listener not installed');
views['view-skill-generator']={id:'view-skill-generator',classList:classList(['hidden'])};
readyListener({detail:{view:'skill-generator'}});
assert.strictEqual(views['view-dashboard'].classList.contains('hidden'),true,'dashboard should hide after Skill Generator becomes ready');
assert.strictEqual(views['view-skill-generator'].classList.contains('hidden'),false,'Skill Generator should open after ready event');
assert.strictEqual(selectedLabel.value,'skill-generator');
assert.strictEqual(remembered,'skill-generator');
assert.strictEqual(renderCount,1);
assert.strictEqual(navButtons[1].classList.contains('active'),true);
console.log('SKILL_GENERATOR_DYNAMIC_BUTTON_READY_GKS_B534_PASS');
