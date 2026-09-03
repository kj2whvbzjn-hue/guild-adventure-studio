const assert=require('assert');
const dx=require('../data-exchange-core.js');
const tx=require('../data-exchange-transaction.js');
const audit=require('../data-exchange-audit.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const dv='0.1.0-draft';
const inPort=[{id:'in',kind:'flow',data_type:'flow'}];
const boolPorts=[{id:'true',kind:'flow',data_type:'flow'},{id:'false',kind:'flow',data_type:'flow'}];
const searchPorts=[{id:'found',kind:'flow',data_type:'flow'},{id:'not_found',kind:'flow',data_type:'flow'}];
const parameter_schema={type:'object',properties:{},required:[],additionalProperties:false};
function node(id,name,node_type,evaluator,outputs,extra={}){return {schema_version:'2.0.0',id,name,node_type,status:'active',tags:[],description:'',data_version:dv,evaluator,ports:{inputs:inPort,outputs},parameter_schema,unlock:{},...extra};}
function project(){return {
  schema_version:'4.0.0-draft',project:{id:'PRJ-R10P2',updated_at:'R1'},history:[],
  tags:[{id:'TAG-0003',name:'AI',aliases:[]}],
  masters:{monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],
    skills:[{id:'SKL-0001',name:'Skill A',tags:[],params:{}}],
    ai_searches:[node('AIS-0001','Enemy exists','search','search.exists',searchPorts)],
    ai_conditions:[node('AIC-0001','Alive','condition','condition.alive',boolPorts,{supported_subject_kind:['UNIT']}),node('AIC-0002','Self ready','condition','condition.ready',boolPorts,{supported_subject_kind:['SELF']})],
    ai_target_selectors:[{schema_version:'2.0.0',id:'ATS-0001',name:'Lowest HP',evaluator:'selector.lowest_hp_ratio',parameter_schema,tags:[],enabled:true}],
    ai_actions:[node('AIA-0001','Use Skill','action','action.skill',[])]},
  ai_programs:[{id:'AIP-0001',name:'Base AI',status:'valid',tags:['TAG-0003'],description:'',version:1,schema_version:'2.0.0',data_version:dv,entry_node_id:'N1',nodes:[
    {instance_id:'N1',master_node_id:'AIS-0001',node_type:'search',position:{x:0,y:0},parameters:{scope:'ENEMY',predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-0001',params:{},negate:false}]}}},
    {instance_id:'N2',master_node_id:'AIC-0002',node_type:'condition',position:{x:1,y:0},parameters:{subject_scope:'SELF',predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-0002',params:{},negate:false}]}}},
    {instance_id:'N3',master_node_id:'AIA-0001',node_type:'action',position:{x:2,y:0},parameters:{skill_id:'SKL-0001'},target_selector:{selector_id:'ATS-0001',params:{}}}
  ],edges:[],subroutines:[],compiled:null,updated_at:'TAG-0001'}],ai_program_layouts:[],ai_program_runtime:[]
}}
async function addEnvelope(base,id='AIP-0002'){
  const env=await dx.buildEnvelope({rootData:base,dataset:'ai_programs',ids:['AIP-0001'],dependencyMode:'recursive',studioVersion:'R10-P2'});
  const out=clone(env);out.datasets.ai_programs[0].id=id;out.datasets.ai_programs[0].name='Imported AI';out.metadata.base_hash='';out.metadata.record_hashes={ai_programs:{}};out.metadata.package_hash='';return out;
}
async function main(){
  const base=project();
  const exported=await dx.buildEnvelope({rootData:base,dataset:'ai_programs',ids:['AIP-0001'],dependencyMode:'recursive',studioVersion:'R10-P2'});
  assert.deepEqual(exported.permissions.writable,['ai_programs']);
  for(const name of ['tags','skills','ai_searches','ai_conditions','ai_target_selectors','ai_actions'])assert(exported.permissions.read_only.includes(name),name+' dependency');
  assert.equal(exported.datasets.ai_target_selectors[0].id,'ATS-0001');assert.equal(exported.datasets.ai_searches[0].id,'AIS-0001');

  const env=await addEnvelope(base),dry=await dx.dryRunImport({rootData:base,envelope:env});
  assert.equal(dry.summary.add,1);assert.equal(dry.can_apply,true);
  const plan=await dx.createApplyPlan({rootData:base,envelope:env,dryRun:dry});assert.equal(plan.can_apply,true,plan.reasons.join(' / '));
  let live=clone(base);const before=clone(base);
  const tr=await tx.execute({rootData:live,envelope:env,plan,dryRun:dry,backup:()=>true,commit:x=>{live=x;return true},persist:()=>true,rollback:x=>{live=x;return true}});
  assert.equal(tr.ok,true);assert(live.ai_programs.some(x=>x.id==='AIP-0002'));
  const session=audit.buildSession({transaction:tr,plan,envelope:env,beforeData:before,afterHash:await tx.projectHash(live),beforeDatasetHash:await audit.datasetHash(before,'ai_programs'),afterDatasetHash:await audit.datasetHash(live,'ai_programs'),sourceFilename:'AI_PROGRAM_V2.json'});
  const undo=await audit.undo({session,currentData:live,normalize:x=>x,validate:x=>audit.validateSnapshot(x,session),backup:()=>true,commit:x=>{live=x;return true},persist:()=>true,readCurrent:()=>live,rollback:x=>{live=x;return true}});
  assert.equal(undo.ok,true);assert.equal(await audit.datasetHash(live,'ai_programs'),session.before_dataset_hash);

  const cases=[
    b=>{b.datasets.ai_programs[0].nodes.find(x=>x.node_type==='action').parameters.skill_id='SKL-9999'},
    b=>{b.datasets.ai_programs[0].nodes.find(x=>x.node_type==='search').master_node_id='AIS-9999'},
    b=>{b.datasets.ai_programs[0].nodes.find(x=>x.node_type==='search').parameters.predicate.clauses[0].predicate_master_id='AIC-9999'},
    b=>{b.datasets.ai_programs[0].nodes.find(x=>x.node_type==='action').target_selector.selector_id='ATS-9999'},
    b=>{b.datasets.ai_programs[0].nodes.find(x=>x.node_type==='action').master_node_id='AIA-9999'}
  ];
  for(let i=0;i<cases.length;i++){const broken=await addEnvelope(base,'AIP-'+String(100+i).padStart(4,'0'));cases[i](broken);const result=await dx.dryRunImport({rootData:base,envelope:broken});assert(result.summary.broken_reference>=1,'broken ref '+i);assert.equal(result.can_apply,false);}
  const ro=clone(exported);ro.datasets.ai_target_selectors[0].name='Tampered';ro.metadata.package_hash='';assert((await dx.dryRunImport({rootData:base,envelope:ro})).summary.readonly_modified>=1);
  const conflict=clone(exported);conflict.datasets.ai_programs[0].description='Changed';conflict.metadata.package_hash='';const conflictDry=await dx.dryRunImport({rootData:base,envelope:conflict});assert.equal((await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry})).can_apply,false);
  const stale=clone(base);stale.ai_programs[0].description='Local update';assert.equal((await dx.dryRunImport({rootData:stale,envelope:exported})).summary.stale_source,1);
  console.log('R10-P2 AI Program Data Exchange vertical gate: PASS');
}
main().catch(error=>{console.error(error);process.exit(1)});
