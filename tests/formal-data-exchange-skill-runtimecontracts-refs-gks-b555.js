const fs=require('fs'),assert=require('assert');
const dx=require('../studio/data-exchange/data-exchange-core.js');
function baseProject(){return{schema_version:'4.0.0-draft',project:{id:'P-FORMAL',updated_at:'R1'},tags:[],masters:{skills:[],monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],ai_conditions:[],ai_targets:[],ai_actions:[]},chapters:[]}}
function skill(id){return{schemaVersion:1,id,name:id,skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'RESOURCE_CHANGE',resource:'MP',amount:10}],resource:{mpCost:0,cooldown:0,activationPriority:0},runtimeContracts:{schemaVersion:1,registryPhase:'FORMAL',triggerContract:{type:'ON_USE',scope:'SELF'},conditionContracts:[],effectContracts:[{type:'RESOURCE_CHANGE',resource:'MP',amount:10}],applyContracts:[],auraEffectContract:null}}}
(async()=>{
 const root=baseProject(),staged=baseProject();staged.masters.skills=[skill('FORMAL-DX-001')];
 const env=await dx.buildEnvelope({rootData:staged,dataset:'skills',ids:['FORMAL-DX-001'],dependencyMode:'direct',studioVersion:'GKS-B565'});
 const dry=await dx.dryRunImport({rootData:root,envelope:env});
 assert.strictEqual(dry.summary.add,1);assert.strictEqual(dry.summary.broken_reference,0);
 const core=fs.readFileSync('studio/data-exchange/data-exchange-core.js','utf8');
 assert.ok(core.includes('const runtime=row?.runtimeContracts;'));assert.ok(!core.includes('genericRuntime'));
 console.log('FORMAL_DATA_EXCHANGE_SKILL_RUNTIMECONTRACTS_REFS_PASS');
})().catch(e=>{console.error(e);process.exit(1)});
