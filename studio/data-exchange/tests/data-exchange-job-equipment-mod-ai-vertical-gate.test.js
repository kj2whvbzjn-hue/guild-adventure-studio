const assert=require('assert');
const fs=require('fs');
const path=require('path');
const dx=require('../data-exchange-core.js');
const tx=require('../data-exchange-transaction.js');
const audit=require('../data-exchange-audit.js');

const clone=x=>JSON.parse(JSON.stringify(x));
class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}
function baseProject(){
  return {
    schema_version:'4.0.0-draft',project:{id:'PRJ-DE19',updated_at:'R1'},
    tag_categories:[{id:'CAT-COMBAT',name:'Combat',enabled:true}],
    tags:[
      {id:'TAG-0001',name:'Fire',status:'draft',category_id:'CAT-COMBAT',parent_id:'',description:'',enabled:true,updated_at:'TAG-0001'},
      {id:'TAG-0004',name:'Heavy',status:'draft',category_id:'CAT-COMBAT',parent_id:'',description:'',enabled:true,updated_at:'TAG-0001'}
    ],
    masters:{
      monsters:[],skills:[],stats:[],status_effects:[],tablets:[],
      jobs:[{id:'JOB-0001',name:'Warrior',status:'draft',tags:['TAG-0004'],params:{},description:'',str:10,vit:8,updated_at:'TAG-0001'}],
      mods:[{id:'MOD-0001',name:'Fire MOD',status:'draft',tags:['TAG-0001'],params:{power:5},description:'',updated_at:'TAG-0001'}],
      equipment:[{id:'EQP-0001',name:'Sword',status:'draft',tags:['TAG-0004'],mod_ids:['MOD-0001'],params:{},description:'',item_level:1,mod_budget:1,updated_at:'TAG-0001'}],
      ai_searches:[{schema_version:'2.0.0',id:'AIS-0001',name:'Enemy exists',node_type:'search',status:'draft',tags:['TAG-0004'],description:'',data_version:'0.1.0-draft',evaluator:'search.exists',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'found',kind:'flow',data_type:'flow'},{id:'not_found',kind:'flow',data_type:'flow'}]},parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},unlock:{},updated_at:'TAG-0001'}],
      ai_conditions:[{schema_version:'2.0.0',id:'AIC-0001',name:'Has Fire',node_type:'condition',status:'draft',tags:['TAG-0001'],description:'',data_version:'0.1.0-draft',evaluator:'condition.has_tag',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'true',kind:'flow',data_type:'flow'},{id:'false',kind:'flow',data_type:'flow'}]},parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},unlock:{},supported_subject_kind:['UNIT'],updated_at:'TAG-0001'}],
      ai_target_selectors:[],
      ai_actions:[{schema_version:'2.0.0',id:'AIA-0001',name:'Attack',node_type:'action',status:'draft',tags:['TAG-0001'],description:'',data_version:'0.1.0-draft',evaluator:'action.attack',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[]},parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},unlock:{},updated_at:'TAG-0001'}]
    },history:[]
  };
}
const SOURCE_IDS={jobs:'JOB-0001',equipment:'EQP-0001',mods:'MOD-0001',ai_searches:'AIS-0001',ai_conditions:'AIC-0001',ai_actions:'AIA-0001'};
async function makeAddEnvelope(base,dataset,id,mutate){
  const env=await dx.buildEnvelope({rootData:base,dataset,ids:[SOURCE_IDS[dataset]],dependencyMode:'recursive',studioVersion:'TEST-DE19'});
  const out=clone(env),row=out.datasets[dataset][0];row.id=id;if(mutate)mutate(row,out);
  out.metadata.base_hash='';out.metadata.record_hashes={[dataset]:{}};
  out.metadata.record_count=Object.fromEntries(Object.entries(out.datasets).map(([k,v])=>[k,v.length]));out.metadata.package_hash='';
  return out;
}
async function applyAndUndo(base,envelope,dataset,filename){
  const dry=await dx.dryRunImport({rootData:base,envelope});
  assert.equal(dry.summary.add,1,`${dataset} add`);assert.equal(dry.can_apply,true,`${dataset} dry can_apply`);
  const plan=await dx.createApplyPlan({rootData:base,envelope,dryRun:dry});assert.equal(plan.can_apply,true,plan.reasons.join(' / '));
  let live=clone(base),before=clone(base);
  const tr=await tx.execute({rootData:live,envelope,plan,dryRun:dry,backup:()=>true,commit:c=>{live=c;return true;},persist:()=>true,rollback:b=>{live=b;return true;}});
  assert.equal(tr.ok,true,`${dataset} transaction`);
  const session=audit.buildSession({transaction:tr,plan,envelope,beforeData:before,afterHash:await tx.projectHash(live),beforeDatasetHash:await audit.datasetHash(before,dataset),afterDatasetHash:await audit.datasetHash(live,dataset),sourceFilename:filename});
  const store=new MemoryStorage();assert(audit.append(store,'audit',session));
  const undo=await audit.undo({session,currentData:live,normalize:x=>x,validate:x=>audit.validateSnapshot(x,session),backup:()=>true,commit:c=>{live=c;return true;},persist:()=>true,readCurrent:()=>live,rollback:b=>{live=b;return true;}});
  assert.equal(await audit.datasetHash(live,dataset),session.before_dataset_hash,`${dataset} undo`);assert(audit.markUndone(store,'audit',session.import_session_id,undo.undoAfterHash));
}
async function main(){
  const base=baseProject();
  const studioHtml=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
  assert(studioHtml.includes('data-exchange-core.js?v=19'),'Studio must load DE-19 core with refreshed cache key');
  for(const f of ['job-dataset.schema.json','equipment-dataset.schema.json','mod-dataset.schema.json','ai_search-dataset.schema.json','ai_condition-dataset.schema.json','ai_target_selector-dataset.schema.json','ai_action-dataset.schema.json']){
    assert(fs.existsSync(path.resolve(__dirname,'../schemas',f)),`missing schema ${f}`);
  }

  // 1. All six DE-19 datasets are primary-writable and export dependencies read_only.
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await dx.buildEnvelope({rootData:base,dataset:ds,ids:[SOURCE_IDS[ds]],dependencyMode:'recursive',studioVersion:'TEST-DE19'});
    assert.deepEqual(env.permissions.writable,[ds],`${ds} writable`);
    assert(env.permissions.read_only.includes('tags'),`${ds} tag dependency`);
    assert.equal(env.datasets[ds].length,1,`${ds} record`);
  }
  const equipmentExport=await dx.buildEnvelope({rootData:base,dataset:'equipment',ids:['EQP-0001'],dependencyMode:'recursive',studioVersion:'TEST-DE19'});
  assert(equipmentExport.permissions.read_only.includes('mods'),'equipment MOD dependency must be read_only');
  assert.equal(equipmentExport.datasets.mods.length,1);
  assert.equal(equipmentExport.datasets.tags.length,2,'recursive equipment dependency must include equipment + MOD tags');

  // 2. New records safely pass Dry Run -> Transaction -> Audit -> Undo for every DE-19 dataset.
  const addIds={jobs:'JOB-0002',equipment:'EQP-0002',mods:'MOD-0002',ai_searches:'AIS-0002',ai_conditions:'AIC-0002',ai_actions:'AIA-0002'};
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await makeAddEnvelope(base,ds,addIds[ds],row=>{row.name='DE19 '+ds;row.description='DE-19 vertical test';});
    await applyAndUndo(base,env,ds,`DE19_${ds}.json`);
  }

  // 3. Broken Tag references block all six classifications.
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await makeAddEnvelope(base,ds,addIds[ds].replace(/0002$/,'0003'),row=>{row.tags=['TAG-9998'];});
    const dry=await dx.dryRunImport({rootData:base,envelope:env});
    assert(dry.summary.broken_reference>=1,`${ds} broken tag must be detected`);assert.equal(dry.can_apply,false);
  }

  // 4. Equipment mod_ids is a first-class dependency and missing MOD blocks Apply.
  const badMod=await makeAddEnvelope(base,'equipment','EQP-0003',row=>{row.mod_ids=['MOD-9999'];row.tags=[];});
  const badModDry=await dx.dryRunImport({rootData:base,envelope:badMod});
  assert(badModDry.items.some(x=>x.status==='broken_reference'&&String(x.detail).includes('mods:MOD-9999')),'equipment missing MOD reference');
  assert.equal(badModDry.can_apply,false);
  const paramsMod=await makeAddEnvelope(base,'equipment','EQP-0004',row=>{delete row.mod_ids;row.params={mod_ids:['MOD-9999']};row.tags=[];});
  const paramsModDry=await dx.dryRunImport({rootData:base,envelope:paramsMod});
  assert(paramsModDry.summary.broken_reference>=1,'equipment params.mod_ids must also be checked');

  // 5. read_only dependency tampering blocks.
  const ro=clone(equipmentExport);ro.datasets.mods[0].name='Tampered MOD';ro.metadata.package_hash='';
  const roDry=await dx.dryRunImport({rootData:base,envelope:ro});assert(roDry.summary.readonly_modified>=1);assert.equal(roDry.can_apply,false);

  // 6. Conflict requires explicit choice and stale source remains blocking for every DE-19 dataset.
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await dx.buildEnvelope({rootData:base,dataset:ds,ids:[SOURCE_IDS[ds]],dependencyMode:'recursive',studioVersion:'TEST-DE19'});
    const changed=clone(env);changed.datasets[ds][0].description='GPT changed';changed.metadata.package_hash='';
    const conflictDry=await dx.dryRunImport({rootData:base,envelope:changed});assert.equal(conflictDry.summary.conflict,1,`${ds} conflict`);
    assert.equal((await dx.createApplyPlan({rootData:base,envelope:changed,dryRun:conflictDry})).can_apply,false,`${ds} conflict choice required`);
    const plan=await dx.createApplyPlan({rootData:base,envelope:changed,dryRun:conflictDry,conflictChoices:{[SOURCE_IDS[ds]]:'import'}});assert.equal(plan.can_apply,true,`${ds} import choice`);
    const staleRoot=clone(base);dx.records(staleRoot,ds)[0].description='Changed after export';
    const staleDry=await dx.dryRunImport({rootData:staleRoot,envelope:env});assert.equal(staleDry.summary.stale_source,1,`${ds} stale`);assert.equal(staleDry.can_apply,false);
  }

  // 7. AI Master is Formal-only: generic params are not an accepted AI master field.
  for(const ds of ['ai_searches','ai_conditions','ai_actions']){
    const generic=await makeAddEnvelope(base,ds,addIds[ds].replace(/0002$/,'0004'),row=>{row.params={kind:'generic'};});
    const dry=await dx.dryRunImport({rootData:base,envelope:generic});
    const plan=await dx.createApplyPlan({rootData:base,envelope:generic,dryRun:dry});
    assert.equal(plan.can_apply,false,`${ds} generic params must be blocked`);
    assert(plan.reasons.some(x=>x.includes('未知フィールド')),`${ds} generic params rejection reason`);
  }

  // 8. New-record unknown fields and DELETE v1 remain blocked for every DE-19 dataset.
  for(const ds of Object.keys(SOURCE_IDS)){
    const unknown=await makeAddEnvelope(base,ds,addIds[ds].replace(/0002$/,'0005'),row=>{row.future_payload={unsafe:true};});
    const dry=await dx.dryRunImport({rootData:base,envelope:unknown});
    const plan=await dx.createApplyPlan({rootData:base,envelope:unknown,dryRun:dry});assert.equal(plan.can_apply,false,`${ds} unknown field`);assert(plan.reasons.some(x=>x.includes('未知フィールド')));
    const del=clone(unknown);del.operations={delete:{[ds]:[addIds[ds]]}};del.metadata.package_hash='';
    const delDry=await dx.dryRunImport({rootData:base,envelope:del});assert.equal(delDry.can_apply,false,`${ds} delete`);assert(delDry.summary.invalid+delDry.summary.incompatible>=1);
  }

  console.log('DE-19 Job / Equipment / MOD / AI vertical gate: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
