const assert=require('assert');
const dx=require('../data-exchange-core.js');
const tx=require('../data-exchange-transaction.js');
const audit=require('../data-exchange-audit.js');
const clone=x=>JSON.parse(JSON.stringify(x));

function project(){return {
  schema_version:'4.0.0-draft',project:{id:'PRJ-R9B',updated_at:'R1'},history:[],
  tags:[{id:'TAG-AI',name:'AI',aliases:[]}],
  masters:{monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],
    skills:[{id:'SKILL-A',name:'Skill A',tags:[],params:{}}],
    ai_conditions:[{id:'COND-A',name:'Always',tags:[],params:{}}],
    ai_targets:[{id:'TARGET-A',name:'Enemy',tags:[],params:{}}],
    ai_actions:[{id:'ACTION-A',name:'Use Skill',tags:[],params:{}}]},
  ai_programs:[{id:'AIP-BASE',name:'Base AI',status:'valid',tags:['TAG-AI'],description:'',version:1,schema_version:'1.0.0',data_version:1,entry_node_id:'N1',nodes:[
    {instance_id:'N1',master_node_id:'COND-A',master_version:1,node_type:'condition',position:{x:0,y:0},parameters:{},comment:''},
    {instance_id:'N2',master_node_id:'TARGET-A',master_version:1,node_type:'target',position:{x:1,y:0},parameters:{},comment:''},
    {instance_id:'N3',master_node_id:'ACTION-A',master_version:1,node_type:'action',position:{x:2,y:0},parameters:{skill_id:'SKILL-A'},comment:''}
  ],edges:[],subroutines:[],compiled:null,updated_at:'T1'}]
}}
async function addEnvelope(base,id='AIP-NEW'){
  const env=await dx.buildEnvelope({rootData:base,dataset:'ai_programs',ids:['AIP-BASE'],dependencyMode:'recursive',studioVersion:'R9-B'});
  const out=clone(env);out.datasets.ai_programs[0].id=id;out.datasets.ai_programs[0].name='Imported AI';out.metadata.base_hash='';out.metadata.record_hashes={ai_programs:{}};out.metadata.package_hash='';return out;
}
async function main(){
  const base=project();
  const exported=await dx.buildEnvelope({rootData:base,dataset:'ai_programs',ids:['AIP-BASE'],dependencyMode:'recursive',studioVersion:'R9-B'});
  assert.deepEqual(exported.permissions.writable,['ai_programs']);
  for(const name of ['tags','skills','ai_conditions','ai_targets','ai_actions'])assert(exported.permissions.read_only.includes(name),name+' dependency');
  assert.equal(exported.datasets.skills[0].id,'SKILL-A');

  const env=await addEnvelope(base),dry=await dx.dryRunImport({rootData:base,envelope:env});
  assert.equal(dry.summary.add,1);assert.equal(dry.can_apply,true);
  const plan=await dx.createApplyPlan({rootData:base,envelope:env,dryRun:dry});assert.equal(plan.can_apply,true,plan.reasons.join(' / '));
  let live=clone(base);const before=clone(base);
  const tr=await tx.execute({rootData:live,envelope:env,plan,dryRun:dry,backup:()=>true,commit:x=>{live=x;return true},persist:()=>true,rollback:x=>{live=x;return true}});
  assert.equal(tr.ok,true);assert(live.ai_programs.some(x=>x.id==='AIP-NEW'));
  const session=audit.buildSession({transaction:tr,plan,envelope:env,beforeData:before,afterHash:await tx.projectHash(live),beforeDatasetHash:await audit.datasetHash(before,'ai_programs'),afterDatasetHash:await audit.datasetHash(live,'ai_programs'),sourceFilename:'AI_PROGRAM.json'});
  const undo=await audit.undo({session,currentData:live,normalize:x=>x,validate:x=>audit.validateSnapshot(x,session),backup:()=>true,commit:x=>{live=x;return true},persist:()=>true,readCurrent:()=>live,rollback:x=>{live=x;return true}});
  assert.equal(undo.ok,true);assert.equal(await audit.datasetHash(live,'ai_programs'),session.before_dataset_hash);

  for(const [nodeType,field,value] of [['action','skill_id','MISSING-SKILL'],['condition','master_node_id','MISSING-COND'],['target','master_node_id','MISSING-TARGET'],['action','master_node_id','MISSING-ACTION']]){
    const broken=await addEnvelope(base,'AIP-BROKEN-'+field+'-'+nodeType);const node=broken.datasets.ai_programs[0].nodes.find(x=>x.node_type===nodeType);if(field==='skill_id')node.parameters.skill_id=value;else node[field]=value;
    const result=await dx.dryRunImport({rootData:base,envelope:broken});assert(result.summary.broken_reference>=1,`${nodeType} ${field}`);assert.equal(result.can_apply,false);
  }
  const ro=clone(exported);ro.datasets.skills[0].name='Tampered';ro.metadata.package_hash='';assert((await dx.dryRunImport({rootData:base,envelope:ro})).summary.readonly_modified>=1);
  const conflict=clone(exported);conflict.datasets.ai_programs[0].description='Changed';conflict.metadata.package_hash='';const conflictDry=await dx.dryRunImport({rootData:base,envelope:conflict});assert.equal((await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry})).can_apply,false);
  const stale=clone(base);stale.ai_programs[0].description='Local update';assert.equal((await dx.dryRunImport({rootData:stale,envelope:exported})).summary.stale_source,1);
  const unknown=await addEnvelope(base,'AIP-UNKNOWN');unknown.datasets.ai_programs[0].future_field=true;assert.equal((await dx.createApplyPlan({rootData:base,envelope:unknown})).can_apply,false);
  const deleted=await addEnvelope(base,'AIP-DELETE');deleted.operations={delete:{ai_programs:['AIP-BASE']}};assert.equal((await dx.dryRunImport({rootData:base,envelope:deleted})).can_apply,false);

  let rolled=clone(base);const rollbackPlan=await dx.createApplyPlan({rootData:base,envelope:env});let failed=false;
  try{await tx.execute({rootData:rolled,envelope:env,plan:rollbackPlan,backup:()=>true,commit:x=>{rolled=x;return true},persist:()=>{throw new Error('persist failure')},rollback:x=>{rolled=x;return true}})}catch(error){failed=String(error.message).includes('persist failure')}
  assert.equal(failed,true);assert.equal(await tx.projectHash(rolled),await tx.projectHash(base));
  console.log('R9-B AI Program Data Exchange vertical gate: PASS');
}
main().catch(error=>{console.error(error);process.exit(1)});
