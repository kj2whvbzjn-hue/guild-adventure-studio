const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const skills=Array.from({length:48},(_,i)=>({
 id:`R06-B547-MASS-${String(i+1).padStart(3,'0')}`,name:`case${i+1}`,tags:['味方','単体','HEAL=10','RESOURCE_CHANGE'],
 runtimeContracts:{schemaVersion:1,registryPhase:'R05-H',triggerContract:{type:'ON_USE',scope:'SELF'},conditionContracts:[],effectContracts:[{type:'RESOURCE_CHANGE',resource:'MP',amount:10},{type:'HEAL',power:10}],applyContracts:[],auraEffectContract:null}
}));
const project={masters:{skills}};
const store=new Map([['gas_v4_current_project_v060','P1'],['gas_v4_project_v060_P1',JSON.stringify(project)]]);
const ctx={window:{GA_PROJECT_CONFIG:{skillExportUrl:'x'}},localStorage:{getItem:k=>store.get(k)||null},console,Date,JSON,Math,Number,String,Array,Set,Map,Blob:function(){},URL:{createObjectURL(){return''},revokeObjectURL(){}},document:{createElement(){return{click(){}}}},TAG_SKILLS:[],battle:{validationEvents:[],validationMode:false,validationCaptureEvents:false,log:[]},pauseBattle(){},resetBattle(){ctx.battle.validationEvents=[]},ensureValidationTargets(side,n){return Array.from({length:n},(_,i)=>({id:`${side}${i}`,side,maxHp:100,maxMp:100,hp:50,mp:50,alive:true,statusEffects:[],shieldEffects:[]}))},ensureStatusEffects:t=>(t.statusEffects||(t.statusEffects=[])),shieldTotal(){return 0},compileTaggedSkill(skill){return{ok:true,errors:[],definition:{id:skill.id,name:skill.name,target:{side:'ally',range:'single'},logicOrder:['RESOURCE_CHANGE','HEAL'],runtimeContracts:skill.runtimeContracts}}},executeTaggedSkill(actor,target,skill){for(const c of skill.runtimeContracts.effectContracts){if(c.type==='RESOURCE_CHANGE')ctx.battle.validationEvents.push({type:'generic_resource_change_executed',skill_id:skill.id});if(c.type==='HEAL')ctx.battle.validationEvents.push({type:'generic_heal_executed',skill_id:skill.id})}return{ok:true}},findTagSkill(){return null},runFormalShieldRuntimeRegression(){return{cases:[],summary:{case_count:0,passed_count:0,errors:[]}}},runFormalStatusRuntimeRegression(){return{cases:[],summary:{case_count:0,passed_count:0,errors:[]}}},runFormalCleanseRuntimeRegression(){return{cases:[],summary:{case_count:0,passed_count:0,errors:[]}}},runFormalReviveRuntimeRegression(){return{cases:[],summary:{case_count:0,passed_count:0,errors:[]}}}};
ctx.window=Object.assign(ctx.window,ctx);ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const report=ctx.runR06MasterStructuredRuntimeFinalRegression();
assert.strictEqual(report.summary.master_skill_count,48);
assert.strictEqual(report.summary.compile_passed_count,48);
assert.strictEqual(report.summary.runtime_passed_count,48);
assert.strictEqual(report.summary.runtime_case_count,48);
assert.strictEqual(report.summary.composite_case_count,48);
assert.strictEqual(report.summary.passed,true,JSON.stringify(report.summary.errors));
for(const marker of ['r06_master_structured_runtime=runR06MasterStructuredRuntimeFinalRegression()','r06_master_runtime_passed_count','schema_version:\'1.9.0\''])assert.ok(src.includes(marker),`missing ${marker}`);
const html=fs.readFileSync('game/index.html','utf8');assert.ok(html.includes('R06新仕様複合Skill 48件'));assert.ok(html.includes('studio-skill-bridge.js?v=486121b553'));
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');assert.ok(app.includes('[R06 MASTER COMPOSITE]'));
console.log('PASS GKS-B550 R06 Master structured composite runtime formal-regression connection');
