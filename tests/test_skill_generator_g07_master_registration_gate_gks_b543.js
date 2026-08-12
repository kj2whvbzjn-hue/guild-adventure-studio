const fs=require('fs'),vm=require('vm'),assert=require('assert');
const registry=require('../assets/shared/config/skill-generic-registry.json');
const budgetRules=require('../assets/shared/config/skill-budget-rules.json');
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');

const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},dispatchEvent(){}};
let host={project:{id:'P'},masters:{skills:[]}},backupCount=0,persistCount=0,commitCount=0,rollbackCount=0,conflict=false;
const ctx={window:null,document,console,setTimeout,clearTimeout,AbortController,CustomEvent:function(){}};ctx.window=ctx;
ctx.GKSGenericSkillAuthoringRegistry={buildUiDefinition:()=>({})};
ctx.GKSGenericSkillBudgetEngine={calculate:(skill,rules)=>({ok:true,budgetRuleVersion:rules.budgetRuleVersion,cost:10,limit:20,errors:[],calculationTrace:[]})};
ctx.GKSGenericSkillBridge={compileForLegacy:async(skill)=>({ok:true,errors:[],warnings:[],legacySkill:{id:skill.id,name:skill.name,tags:['ATTACK','DAMAGE=10','敵','単体']}})};
ctx.GKSSkillHost={
 getData:()=>host,getBuild:()=> 'GKS-B543',
 backup:()=>{backupCount++;return true;},
 setData:d=>{host=d;commitCount++;return true;},
 persist:()=>{persistCount++;return true;}
};
ctx.GKSDataExchange={
 buildEnvelope:async({rootData,ids})=>({schema:'GKS_DATA_EXCHANGE',version:'1.0.0',dataset:'skills',items:rootData.masters.skills.filter(x=>ids.includes(x.id))}),
 dryRunImport:async({envelope})=> conflict
   ? {ok:true,summary:{add:0},items:envelope.items.map(x=>({dataset:'skills',id:x.id,status:'conflict'}))}
   : {ok:true,summary:{add:envelope.items.length},items:envelope.items.map(x=>({dataset:'skills',id:x.id,status:'add'}))},
 createApplyPlan:async({envelope,dryRun})=>({can_apply:true,add_count:dryRun.summary.add,reasons:[],envelope})
};
ctx.GKSDataExchangeTransaction={
 execute:async({rootData,envelope,backup,commit,persist,rollback})=>{
   if(!backup())throw new Error('backup fail');
   try{
     const next=JSON.parse(JSON.stringify(rootData));
     next.masters=next.masters||{};next.masters.skills=[...(next.masters.skills||[]),...envelope.items];
     if(!commit(next))throw new Error('commit fail');
     if(!persist())throw new Error('persist fail');
     return{ok:true,validation:{ok:true}};
   }catch(e){rollback(rootData);rollbackCount++;throw e;}
 }
};
ctx.fetch=async url=>({ok:true,status:200,json:async()=>String(url).includes('budget')?budgetRules:registry});
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.GKSSkillGenerator;

(async()=>{
 await api.loadGenericDefinition(); await api.loadBudgetRules();
 const skill={schemaVersion:1,id:'G07-S1',name:'Skill',skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:10}],resource:{mpCost:0,cooldown:0,activationPriority:0}};
 const batch={schema:'GKS_GENERIC_SKILL_BATCH',version:'1.0.0',sourceSchema:'GKS_GENERIC_SKILL_AI_BATCH_RESULT',aiGenerationRuleVersion:'A',budgetRuleVersion:budgetRules.budgetRuleVersion,skills:[{index:0,skill,generation:{},validation:{budgetResult:{ok:true,budgetRuleVersion:budgetRules.budgetRuleVersion,cost:10,limit:20},compilerWarnings:[]}}]};

 const dry=await api.g07DryRunMasterRegistration(batch);
 assert.strictEqual(dry.dryRun.summary.add,1);assert.strictEqual(host.masters.skills.length,0,'Dry Run must not mutate Master');

 const applied=await api.g07SafeApplyGenericBatch(batch);
 assert.strictEqual(applied.plan.add_count,1);assert.strictEqual(host.masters.skills.length,1);
 assert.strictEqual(backupCount,1);assert.strictEqual(commitCount,1);assert.strictEqual(persistCount,1);

 conflict=true;
 const skill2={...skill,id:'G07-S2'};const conflictBatch=JSON.parse(JSON.stringify(batch));conflictBatch.skills[0].skill=skill2;conflictBatch.skills[0].validation.budgetResult.cost=10;
 await assert.rejects(()=>api.g07DryRunMasterRegistration(conflictBatch),e=>e.code==='G07_ID_CONFLICT');

 const rejected=JSON.parse(JSON.stringify(batch));rejected.skills[0].skill.unexpected=true;
 await assert.rejects(()=>api.g07DryRunMasterRegistration(rejected),e=>e.code==='G07_REVALIDATION_REJECT');

 for(const m of ['skgG07GenericJson','skgG07DryRun','skgG07Register','G07_ID_CONFLICT','before-g07-generic-skill-safe-apply'])assert.ok(src.includes(m),`missing ${m}`);
 const html=fs.readFileSync('studio/index.html','utf8');assert.ok(html.includes('skill-generator.js?v=21'));
 console.log('PASS GKS-B543 G07 Master registration safety gate');
})().catch(e=>{console.error(e);process.exit(1);});
