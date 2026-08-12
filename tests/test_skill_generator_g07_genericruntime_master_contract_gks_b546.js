const fs=require('fs'),assert=require('assert');
const dx=require('../studio/data-exchange/data-exchange-core.js');

(async()=>{
 const rootData={
   schema_version:'4.0.0-draft',
   project:{id:'P-G07-B546',updated_at:'R1'},
   tags:[],
   masters:{skills:[],monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],ai_conditions:[],ai_targets:[],ai_actions:[]},
   chapters:[]
 };
 const skill={
   id:'G05-AI-001',
   name:'R06現行実機検査用',
   tags:['ATTACK','DAMAGE=570','物理','敵','単体','MP_COST=0','COOLDOWN=0','ACTIVATION_PRIORITY=0'],
   genericRuntime:{
     schemaVersion:1,
     registryPhase:'R05-H',
     triggerContract:{type:'ON_USE',scope:'SELF',engineEvent:'use',dispatchMode:'RESOLVE_ONLY',priority:0},
     conditionContracts:[],
     effectContracts:[{type:'DAMAGE',power:570,damageType:'PHYSICAL'}],
     applyContracts:[],
     auraEffectContract:null
   }
 };
 const staged=JSON.parse(JSON.stringify(rootData));
 staged.masters.skills=[skill];
 const env=await dx.buildEnvelope({rootData:staged,dataset:'skills',ids:[skill.id],dependencyMode:'direct',studioVersion:'GKS-B550'});
 const dry=await dx.dryRunImport({rootData,envelope:env});
 assert.strictEqual(dry.summary.add,1,'genericRuntime Skill must be a valid add in Dry Run');
 const plan=await dx.createApplyPlan({rootData,envelope:env,dryRun:dry,conflictChoices:{}});
 assert.strictEqual(plan.can_apply,true,`genericRuntime must be accepted by Apply Plan: ${(plan.reasons||[]).join(' / ')}`);
 const applied=await dx.applySafeMerge({rootData,envelope:env,plan,dryRun:dry});
 const stored=dx.records(applied.nextRootData,'skills').find(x=>x.id===skill.id);
 assert.ok(stored,'Skill must be stored');
 assert.deepStrictEqual(stored.genericRuntime,skill.genericRuntime,'genericRuntime must be preserved in Master');

 const tampered=JSON.parse(JSON.stringify(env));
 tampered.datasets.skills[0].notARealMasterField=true;
 tampered.metadata.package_hash='';
 const dry2=await dx.dryRunImport({rootData,envelope:tampered});
 const plan2=await dx.createApplyPlan({rootData,envelope:tampered,dryRun:dry2,conflictChoices:{}});
 assert.strictEqual(plan2.can_apply,false,'unrelated unknown field must remain rejected');
 assert.ok(plan2.reasons.some(x=>x.includes('notARealMasterField')));

 const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');
 assert.ok(src.includes("const plan=await global.GKSDataExchange.createApplyPlan({rootData:source,envelope:built.envelope,dryRun:dry,conflictChoices:{}})"),
   'G07 Dry Run must validate Apply Plan before reporting PASS');
 assert.ok(src.includes('部分JSON Dry Run・Apply Plan検査を通過しました'));
 const html=fs.readFileSync('studio/index.html','utf8');
 assert.ok(html.includes('skill-generator.js?v=27'));
 assert.ok(html.includes('data-exchange-core.js?v=15'));
 console.log('PASS GKS-B550 genericRuntime Master contract + G07 Dry Run Apply Plan gate');
})().catch(e=>{console.error(e);process.exit(1);});
