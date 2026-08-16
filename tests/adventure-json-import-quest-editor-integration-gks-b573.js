const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const importer=require('../studio/adventure-entity-json-import.js');
const story=require('../assets/shared/js/adventure-story-system.js');
const html=fs.readFileSync(require('path').join(__dirname,'../studio/index.html'),'utf8');
function extractFunction(name){
  const marker=`function ${name}(`, start=html.indexOf(marker);
  assert.ok(start>=0,`missing ${name}`);
  const brace=html.indexOf('{',start); let depth=0, quote=null, escape=false, templateDepth=0;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){
      if(escape){escape=false;continue;} if(ch==='\\'){escape=true;continue;}
      if(ch===quote){quote=null;} continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++; else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}
function classList(initial=[]){const s=new Set(initial);return{add(...xs){xs.forEach(x=>s.add(x))},remove(...xs){xs.forEach(x=>s.delete(x))},contains(x){return s.has(x)},toggle(x,v){if(v===undefined){if(s.has(x)){s.delete(x);return false;}s.add(x);return true;}v?s.add(x):s.delete(x);return !!v;}}}
function node(id,{value='',textContent='',classes=[]}={}){return{id,value,textContent,innerHTML:'',scrollTop:0,attrs:{},classList:classList(classes),parentNode:null,setAttribute(k,v){this.attrs[k]=v},querySelector(){return null},focus(){this.focused=true}}}
const rootParent={children:[],insertBefore(child,before){child.parentNode=this; if(!this.children.includes(child))this.children.push(child);},};
const panel=node('questEditorPanel',{classes:['hidden']}); panel.parentNode=rootParent; rootParent.children.push(panel);
const overlay=node('studioInputOverlay',{classes:['hidden']});
const body=node('studioInputBody'); body.appendChild=function(child){child.parentNode=this;}; body.innerHTML='';
const heading=node('studioInputTitle',{textContent:'入力'});
const inline=node('questBoxEditorInline',{classes:['hidden']});
const boxId=node('questBoxEditorId');
const boxBody=node('questBoxEditorBody');
const boxList=node('questBoxList');
const saveStatus=node('saveStatus');
const elements={questEditorPanel:panel,studioInputOverlay:overlay,studioInputBody:body,studioInputTitle:heading,questBoxEditorInline:inline,questBoxEditorId:boxId,questBoxEditorBody:boxBody,questBoxList:boxList,saveStatus};
const inputNames=['questId','questName','questType','questStatus','questSummary','questConditions','questCompletion','questFailure','questRewards','questAdventureDuration','questEnemyBudget','questMapId','questEnvironmentTags','questStartCostGold','questStartCostResources','questPrerequisites','questNextQuests','questRequiredFlags','questSetFlags'];
for(const name of inputNames)elements[name]=node(name);
const document={
 body:{classList:classList()},
 getElementById(id){return elements[id]||null},
 createComment(){const m={parentNode:null,remove(){if(this.parentNode?.children)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}};return m;},
 querySelector(sel){if(sel==='.view:not(.hidden)')return {id:'view-quests'};return null;},
 querySelectorAll(){return[];}
};
const ctx={console,window:null,document,setTimeout:fn=>fn(),structuredClone:v=>JSON.parse(JSON.stringify(v)),GKAdventureStorySystem:story,GKSAdventureEntityJsonImport:importer,
 currentProjectId:'PRJ-TEST',characterTagsValue:[],now:()=> '2026-08-15T05:00:00Z',normalizeStoryDesign:v=>v||{},normalizeStoryCandidate:v=>v||{},normalizeStoryExportControl:v=>v||{},isFormalSkillMasterRecord:()=>false,
 refreshQuestMapOptions:v=>{elements.questMapId.value=v||''},refreshLinkSelectors:()=>{},renderDraftCharacterChips:()=>{},renderQuestFormalStatus:()=>{},showView:()=>{},renderQuestBoxEditor:()=>{boxBody.innerHTML='rendered'},esc:v=>String(v??''),escAttr:v=>String(v??''),
 QUEST_BOX_ZONE_DEFS:[{key:'event_zone_before_pre'},{key:'event_zone_pre_to_mid'},{key:'event_zone_mid_to_post'},{key:'event_zone_after_post'}],
 alert:m=>{throw new Error('unexpected alert '+m)},confirm:()=>true,
 studioOverlayVisible:()=>false,studioViewHistory:[],studioLauncherCategoryFromHistoryToken:()=>'',studioCategoryForView:()=> 'basic',studioHistoryNavigation:false,
 closeRuleTagPicker(){},closeBenchmarkWorkflow(){},closeMasterSkillPicker(){},closeTagPicker(){},
};ctx.window=ctx;
for(const name of inputNames)ctx[name]=elements[name];
vm.createContext(ctx);
vm.runInContext('let data={}; let questDraftCharacterIds=[]; let questDraftBoxes=[]; let questBoxEditorState=null; let studioInputPanelState=null;',ctx);
for(const fn of ['normalizeData','questBoxClone','questBoxId','nextQuestBoxId','normalizeQuestDraftBoxOrder','questBoxEventCount','questBoxSceneMark','renderQuestBoxDraftList','addQuestBoxDraft','openQuestBoxEditor','closeQuestBoxEditor','openStudioInputPanel','closeStudioInputPanel','currentStudioView','backToDatabase','editQuest','studioNavigateBack','studioNavigateClose']){
  vm.runInContext(extractFunction(fn),ctx);
}
// override close target with a small launcher stub after function definitions.
vm.runInContext("studioOpenLauncherHome=function(){ if(questBoxEditorState)closeQuestBoxEditor(); if(studioInputPanelState)closeStudioInputPanel(); window.__launcherOpened=true; };",ctx);
const root={project:{id:'PRJ-TEST'},chapters:[],quests:[],events:[{id:'EVT-CH01-SEC01-A',name:'A'},{id:'EVT-CH01-SEC01-B',name:'B'},{id:'EVT-CH01-SEC01-C',name:'C'},{id:'EVT-CH01-SEC01-D',name:'D'}],characters:[],organizations:[],terms:[],relationships:[],timeline:[],flags:[],entities:[],decisions:[],history:[],tags:[],tag_categories:[],ai_programs:[],masters:{maps:[],reward_tables:[],monsters:[]}};
const payload={quests:[{id:'QST-CH01-SEC01',name:'新たな訓練の日',type:'sub',status:'draft',context:{environment_tags:['grassland']},boxes:[{box_id:'BOX-QST-CH01-SEC01-01',name:'訓練',pre_scene_id:'SCN-CH01-SEC01-A',mid_scene_id:'SCN-CH01-SEC01-B',post_scene_id:'SCN-CH01-SEC01-C',event_zone_before_pre:[{kind:'fixed_event',event_id:'EVT-CH01-SEC01-A'}],event_zone_pre_to_mid:[{kind:'fixed_event',event_id:'EVT-CH01-SEC01-B'}],event_zone_mid_to_post:[{kind:'fixed_event',event_id:'EVT-CH01-SEC01-C'}],event_zone_after_post:[{kind:'fixed_event',event_id:'EVT-CH01-SEC01-D'}]}]}]};
const plan=importer.buildPlan('quests',payload,root);assert.deepStrictEqual(plan.errors,[]);let candidate=importer.applyPlan(root,plan,'2026-08-15T05:00:00Z');ctx.data=candidate;vm.runInContext('data=window.data; normalizeData(); window.data=data;',ctx);
assert.strictEqual(ctx.data.quests.length,1);
vm.runInContext("editQuest('QST-CH01-SEC01')",ctx);
assert.strictEqual(vm.runInContext('questDraftBoxes.length',ctx),1);assert.ok(vm.runInContext('!!studioInputPanelState',ctx));
vm.runInContext('addQuestBoxDraft()',ctx);
assert.strictEqual(vm.runInContext('questDraftBoxes.length',ctx),2);assert.ok(vm.runInContext('!!questBoxEditorState',ctx));assert.ok(panel.classList.contains('quest-box-detail-open'));
vm.runInContext('studioNavigateBack()',ctx);assert.strictEqual(vm.runInContext('questBoxEditorState',ctx),null);assert.ok(vm.runInContext('!!studioInputPanelState',ctx));
vm.runInContext('studioNavigateBack()',ctx);assert.strictEqual(vm.runInContext('studioInputPanelState',ctx),null);
// reopen and close via common close navigation
vm.runInContext("editQuest('QST-CH01-SEC01'); openQuestBoxEditor(0); studioNavigateClose();",ctx);
assert.strictEqual(vm.runInContext('questBoxEditorState',ctx),null);assert.strictEqual(vm.runInContext('studioInputPanelState',ctx),null);assert.strictEqual(ctx.__launcherOpened,true);
console.log('PASS import -> normalize -> Quest Editor -> Box add/detail -> back/close');
