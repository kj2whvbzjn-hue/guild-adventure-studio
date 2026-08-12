const fs=require('fs'),vm=require('vm'),assert=require('assert');
const registry=require('../assets/shared/config/skill-generic-registry.json');
const budgetRules=require('../assets/shared/config/skill-budget-rules.json');
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');

const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},dispatchEvent(){}};
let host={project:{id:'P-G07'},masters:{skills:[]}},dryMode='ok',hashSequence=[],auditSaved=0,backupCount=0,persistCount=0;
const storage={m:new Map(),getItem(k){return this.m.has(k)?this.m.get(k):null},setItem(k,v){this.m.set(k,String(v))},removeItem(k){this.m.delete(k)}};
const ctx={window:null,document,console,setTimeout,clearTimeout,AbortController,CustomEvent:function(){},localStorage:storage};ctx.window=ctx;
ctx.GKSGenericSkillAuthoringRegistry={buildUiDefinition:()=>({})};
ctx.GKSGenericSkillBudgetEngine={calculate:(skill,rules)=>({ok:true,budgetRuleVersion:rules.budgetRuleVersion,cost:10,limit:20,errors:[],calculationTrace:[]})};
ctx.GKSGenericSkillBridge={compileForLegacy:async(skill)=>({ok:true,errors:[],warnings:[],legacySkill:{id:skill.id,name:skill.name,tags:['ATTACK','DAMAGE=10','敵','単体']}})};
ctx.GKSSkillHost={
 getData:()=>host,getBuild:()=> 'GKS-B549',
 backup:()=>{backupCount++;return true;},
 setData:d=>{host=JSON.parse(JSON.stringify(d));return true;},
 persist:()=>{persistCount++;return true;}
};
ctx.GKSDataExchange={
 buildEnvelope:async({rootData,ids})=>({schema:'GKS_DATA_EXCHANGE',dataset:'skills',items:rootData.masters.skills.filter(x=>ids.includes(x.id))}),
 dryRunImport:async({envelope})=>{
   const n=envelope.items.length,base={ok:true,summary:{add:n,stale_source:0,broken_reference:0,conflict:0,invalid:0,incompatible:0,readonly_modified:0},items:envelope.items.map(x=>({dataset:'skills',id:x.id,status:'add'}))};
   if(dryMode==='stale'){base.summary.add=0;base.summary.stale_source=1;}
   if(dryMode==='broken'){base.summary.add=0;base.summary.broken_reference=1;}
   if(dryMode==='conflict'){base.summary.add=0;base.summary.conflict=1;base.items=base.items.map(x=>({...x,status:'conflict'}));}
   return base;
 },
 createApplyPlan:async({envelope,dryRun})=>({can_apply:true,add_count:dryRun.summary.add,reasons:[],envelope})
};
ctx.GKSDataExchangeTransaction={
 projectHash:async data=>hashSequence.length?hashSequence.shift():JSON.stringify(data),
 execute:async({rootData,envelope,backup,commit,persist})=>{
   if(!backup())throw new Error('backup');
   const next=JSON.parse(JSON.stringify(rootData));next.masters.skills=[...(next.masters.skills||[]),...envelope.items];
   if(!commit(next))throw new Error('commit');if(!persist())throw new Error('persist');
   return{ok:true,beforeHash:'BEFORE',candidateHash:'AFTER',afterHash:'AFTER',applied:{count:envelope.items.length,add_ids:envelope.items.map(x=>x.id)},validation:{ok:true}};
 }
};
ctx.GKSDataExchangeAudit={
 datasetHash:async(data,dataset)=>JSON.stringify(data.masters?.[dataset]||[]),
 buildSession:({plan,beforeData,afterHash,beforeDatasetHash,afterDatasetHash})=>({import_session_id:'G07-SESSION-1',dataset:'skills',added:['G07-S1'],changed:[],kept:[],before_hash:'BEFORE',after_hash:afterHash,before_dataset_hash:beforeDatasetHash,after_dataset_hash:afterDatasetHash,undo_snapshot:{dataset:'skills',remove_ids:['G07-S1'],restore_records:[]},plan}),
 append:(store,key,session)=>{auditSaved++;store.setItem(key,JSON.stringify([session]));return true;}
};
ctx.GKSDataExchangeUI={undoLatestSession:()=>true};
ctx.fetch=async url=>({ok:true,status:200,json:async()=>String(url).includes('budget')?budgetRules:registry});
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.GKSSkillGenerator;

(async()=>{
 await api.loadGenericDefinition();await api.loadBudgetRules();
 const skill={schemaVersion:1,id:'G07-S1',name:'Skill',skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:10}],resource:{mpCost:0,cooldown:0,activationPriority:0}};
 const batch={schema:'GKS_GENERIC_SKILL_BATCH',version:'1.0.0',sourceSchema:'GKS_GENERIC_SKILL_AI_BATCH_RESULT',aiGenerationRuleVersion:'A',budgetRuleVersion:budgetRules.budgetRuleVersion,skills:[{index:0,skill,generation:{},validation:{budgetResult:{ok:true,budgetRuleVersion:budgetRules.budgetRuleVersion,cost:10,limit:20},compilerWarnings:[]}}]};

 assert.strictEqual(api.g07DryRunBlocker({summary:{stale_source:1}}).code,'G07_STALE_SOURCE');
 assert.strictEqual(api.g07DryRunBlocker({summary:{broken_reference:1}}).code,'G07_BROKEN_REFERENCE');
 assert.strictEqual(api.g07DryRunBlocker({summary:{conflict:1}}).code,'G07_ID_CONFLICT');
 assert.strictEqual(api.g07DryRunBlocker({summary:{invalid:1}}).code,'G07_INVALID_IMPORT');

 dryMode='stale';await assert.rejects(()=>api.g07DryRunMasterRegistration(batch),e=>e.code==='G07_STALE_SOURCE');
 dryMode='broken';await assert.rejects(()=>api.g07DryRunMasterRegistration(batch),e=>e.code==='G07_BROKEN_REFERENCE');
 dryMode='conflict';await assert.rejects(()=>api.g07DryRunMasterRegistration(batch),e=>e.code==='G07_ID_CONFLICT');

 dryMode='ok';hashSequence=['SAME','SAME','AFTER'];const applied=await api.g07SafeApplyGenericBatch(batch);
 assert.strictEqual(applied.plan.add_count,1);assert.strictEqual(host.masters.skills.length,1);
 assert.strictEqual(auditSaved,1,'successful G07 apply must save Data Exchange audit');
 assert.strictEqual(JSON.parse(storage.getItem(api.g07AuditStorageKey()))[0].import_session_id,'G07-SESSION-1');
 assert.ok(backupCount>=1&&persistCount>=1);

 host={project:{id:'P-G07'},masters:{skills:[]}};hashSequence=['DRY-HASH','CHANGED-HASH'];
 await assert.rejects(()=>api.g07SafeApplyGenericBatch(batch),e=>e.code==='G07_STALE_SOURCE_HASH');
 assert.strictEqual(host.masters.skills.length,0,'stale source hash must reject before commit');

 const unknown=JSON.parse(JSON.stringify(batch));unknown.skills[0].skill.unknownField=true;
 await assert.rejects(()=>api.g07DryRunMasterRegistration(unknown),e=>e.code==='G07_REVALIDATION_REJECT');

 for(const m of ['skgG07Undo','G07_STALE_SOURCE','G07_BROKEN_REFERENCE','G07_STALE_SOURCE_HASH','G07_AUDIT_SAVE_FAILED','gks_data_exchange_audit_v1_'])assert.ok(src.includes(m),`missing ${m}`);
 const html=fs.readFileSync('studio/index.html','utf8');assert.ok(html.includes('skill-generator.js?v=25'));
 console.log('PASS GKS-B549 G07 acceptance stale/broken/conflict/audit/undo gate');
})().catch(e=>{console.error(e);process.exit(1);});
