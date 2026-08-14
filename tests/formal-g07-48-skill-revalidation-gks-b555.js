
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const registry=require('../assets/shared/config/skill-registry.json');
const compiler=require('../assets/shared/js/skill-compiler.js');
const budgetEngine=require('../assets/shared/js/skill-budget-engine.js');
const budgetRules=require('../assets/shared/config/skill-budget-rules.json');
const sample=JSON.parse(fs.readFileSync('tests/fixtures/g06-r06-48-skill-batch.json','utf8'));
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');

const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},dispatchEvent(){},scripts:[]};
const ctx={window:null,document,console,setTimeout,clearTimeout,AbortController,CustomEvent:function(){}};ctx.window=ctx;
ctx.GKSSkillSchema={
 BATCH:{root:['schema','version','sourceSchema','aiGenerationRuleVersion','budgetRuleVersion','skills'],row:['index','skill','generation','validation']},
 masterAllowed(){return ['schemaVersion','id','name','skillLevel','trigger','conditions','target','effects','resource','runtimeContracts','status','description','created_at','updated_at'];}
};
ctx.GKSSkillBudgetEngine=budgetEngine;
ctx.GKSSkillAuthoringRegistry={buildUiDefinition:()=>({effects:[],triggers:[],conditions:[],registryPhase:'FORMAL-SKILL-1'})};
ctx.GKSSkillCompileService={compileSkill:async(skill)=>compiler.compileSkill(skill,registry)};
ctx.GKSDataExchange={
 FORMAL_SKILL_MASTER_FIELDS:['schemaVersion','id','name','skillLevel','trigger','conditions','target','effects','resource','runtimeContracts','status','description','created_at','updated_at'],
 skillMasterContractDiagnostic(){return{shared_schema_loaded:true,shared_matches:true,missing:[],extra:[]}},
 buildEnvelope:async({rootData,ids})=>({datasets:{skills:rootData.masters.skills.filter(x=>ids.includes(x.id))},permissions:{writable:['skills'],read_only:[]}})
};
ctx.GKSSkillHost={getData:()=>({project:{id:'P'},masters:{skills:[]}}),getBuild:()=> 'GKS-B558'};
ctx.fetch=async(url)=>({ok:true,status:200,json:async()=>String(url).includes('skill-budget-rules')?budgetRules:registry});
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.GKSSkillGenerator;

(async()=>{
 const report=await api.g07RevalidateSkillBatch(sample);
 assert.strictEqual(report.summary.total,48);
 assert.strictEqual(report.summary.accepted,48,JSON.stringify(report.entries.filter(x=>x.status!=='ACCEPT').slice(0,5)));
 assert.strictEqual(report.summary.rejected,0);
 assert.strictEqual(report.summary.rootIssueCount,0);
 assert.strictEqual(report.summary.allAccepted,true);
 assert.strictEqual(report.batch.schema,'GKS_SKILL_BATCH');
 assert.strictEqual(report.compiledSkills.length,48);
 const built=await api.g07BuildMasterEnvelopeFromSkillBatch(sample);
 assert.strictEqual(built.masterSkills.length,48);
 assert.strictEqual(built.revalidation.summary.accepted,48);
 assert.strictEqual(built.envelope.datasets.skills.length,48);
 for(const skill of report.compiledSkills){
   assert.strictEqual(skill.schemaVersion,1);
   assert(skill.runtimeContracts&&skill.runtimeContracts.schemaVersion===1);
 }
 const tampered=JSON.parse(JSON.stringify(sample));
 tampered.skills[0].skill.runtimeContracts={schemaVersion:1,broken:true};
 const bad=await api.g07RevalidateSkillBatch(tampered);
 assert.strictEqual(bad.summary.rejected,1);
 assert(bad.entries[0].issues.some(x=>x.code==='G07_RUNTIME_CONTRACTS_MISMATCH'));
 const unknown=JSON.parse(JSON.stringify(sample));
 unknown.skills[0].skill.notARealMasterField=true;
 const bad2=await api.g07RevalidateSkillBatch(unknown);
 assert.strictEqual(bad2.summary.rejected,1);
 assert(bad2.entries[0].issues.some(x=>x.code==='G07_UNKNOWN_SKILL_FIELD'));
 const duplicateDot=JSON.parse(JSON.stringify(sample));
 duplicateDot.skills=duplicateDot.skills.slice(0,1);
 duplicateDot.skills[0].skill={schemaVersion:1,id:'SKL-0063',name:'R06 ERR15 DOT logic重複',skillLevel:30,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:226,duration:1507,interval:100,stackGain:1},{type:'APPLY',effectId:'POISON',power:246,duration:1643,interval:100,stackGain:1}],resource:{mpCost:0,cooldown:0,activationPriority:0}};
 const bad3=await api.g07RevalidateSkillBatch(duplicateDot);
 assert.strictEqual(bad3.summary.rejected,1);
 assert(bad3.entries[0].issues.some(x=>x.code==='DOT_LOGIC_DUPLICATE'));
 const mixed=JSON.parse(JSON.stringify(sample));
 mixed.skills.push(duplicateDot.skills[0]);
 const mixedReport=await api.g07RevalidateSkillBatch(mixed);
 assert.strictEqual(mixedReport.summary.total,49);
 assert.strictEqual(mixedReport.summary.accepted,48);
 assert.strictEqual(mixedReport.summary.rejected,1);
 assert.strictEqual(mixedReport.summary.canRegisterAccepted,true);
 const mixedBuilt=await api.g07BuildMasterEnvelopeFromSkillBatch(mixed);
 assert.strictEqual(mixedBuilt.masterSkills.length,48);
 assert.strictEqual(mixedBuilt.revalidation.summary.rejected,1);
 assert.strictEqual(mixedBuilt.masterSkills[0].id,'SKL-0001');
 assert.strictEqual(mixedBuilt.masterSkills[47].id,'SKL-0048');
 assert(mixedBuilt.masterSkills.every(x=>/^SKL-\d{4}$/.test(x.id)));
 assert(!mixedBuilt.masterSkills.some(x=>String(x.id).startsWith('G05-AI-')));
 console.log('FORMAL_G07_48_SKILL_REVALIDATION_PASS');
})().catch(e=>{console.error(e);process.exit(1)});
