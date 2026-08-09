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
      {id:'TAG-FIRE',name:'Fire',status:'draft',category_id:'CAT-COMBAT',parent_id:'',description:'',enabled:true,updated_at:'T1'},
      {id:'TAG-HEAVY',name:'Heavy',status:'draft',category_id:'CAT-COMBAT',parent_id:'',description:'',enabled:true,updated_at:'T1'}
    ],
    masters:{
      monsters:[],skills:[],stats:[],status_effects:[],tablets:[],
      jobs:[{id:'JOB-WARRIOR',name:'Warrior',status:'draft',tags:['TAG-HEAVY'],params:{},description:'',str:10,vit:8,updated_at:'T1'}],
      mods:[{id:'MOD-FIRE',name:'Fire MOD',status:'draft',tags:['TAG-FIRE'],params:{power:5},description:'',updated_at:'T1'}],
      equipment:[{id:'EQ-SWORD',name:'Sword',status:'draft',tags:['TAG-HEAVY'],mod_ids:['MOD-FIRE'],params:{},description:'',item_level:1,mod_budget:1,updated_at:'T1'}],
      ai_conditions:[{id:'AIC-FIRE',name:'Has Fire',status:'draft',tags:['TAG-FIRE'],params:{kind:'has_tag'},description:'',updated_at:'T1'}],
      ai_targets:[{id:'AIT-ENEMY',name:'Enemy',status:'draft',tags:['TAG-HEAVY'],params:{kind:'enemy'},description:'',updated_at:'T1'}],
      ai_actions:[{id:'AIA-ATTACK',name:'Attack',status:'draft',tags:['TAG-FIRE'],params:{kind:'attack'},description:'',updated_at:'T1'}]
    },history:[]
  };
}
const SOURCE_IDS={jobs:'JOB-WARRIOR',equipment:'EQ-SWORD',mods:'MOD-FIRE',ai_conditions:'AIC-FIRE',ai_targets:'AIT-ENEMY',ai_actions:'AIA-ATTACK'};
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
  assert(studioHtml.includes('data-exchange-core.js?v=12'),'Studio must load DE-19 core with refreshed cache key');
  for(const f of ['job-dataset.schema.json','equipment-dataset.schema.json','mod-dataset.schema.json','ai_condition-dataset.schema.json','ai_target-dataset.schema.json','ai_action-dataset.schema.json']){
    assert(fs.existsSync(path.resolve(__dirname,'../schemas',f)),`missing schema ${f}`);
  }

  // 1. All six DE-19 datasets are primary-writable and export dependencies read_only.
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await dx.buildEnvelope({rootData:base,dataset:ds,ids:[SOURCE_IDS[ds]],dependencyMode:'recursive',studioVersion:'TEST-DE19'});
    assert.deepEqual(env.permissions.writable,[ds],`${ds} writable`);
    assert(env.permissions.read_only.includes('tags'),`${ds} tag dependency`);
    assert.equal(env.datasets[ds].length,1,`${ds} record`);
  }
  const equipmentExport=await dx.buildEnvelope({rootData:base,dataset:'equipment',ids:['EQ-SWORD'],dependencyMode:'recursive',studioVersion:'TEST-DE19'});
  assert(equipmentExport.permissions.read_only.includes('mods'),'equipment MOD dependency must be read_only');
  assert.equal(equipmentExport.datasets.mods.length,1);
  assert.equal(equipmentExport.datasets.tags.length,2,'recursive equipment dependency must include equipment + MOD tags');

  // 2. New records safely pass Dry Run -> Transaction -> Audit -> Undo for every DE-19 dataset.
  const addIds={jobs:'JOB-DE19',equipment:'EQ-DE19',mods:'MOD-DE19',ai_conditions:'AIC-DE19',ai_targets:'AIT-DE19',ai_actions:'AIA-DE19'};
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await makeAddEnvelope(base,ds,addIds[ds],row=>{row.name='DE19 '+ds;row.description='DE-19 vertical test';});
    await applyAndUndo(base,env,ds,`DE19_${ds}.json`);
  }

  // 3. Broken Tag references block all six classifications.
  for(const ds of Object.keys(SOURCE_IDS)){
    const env=await makeAddEnvelope(base,ds,addIds[ds]+'-BROKEN-TAG',row=>{row.tags=['TAG-MISSING-DE19'];});
    const dry=await dx.dryRunImport({rootData:base,envelope:env});
    assert(dry.summary.broken_reference>=1,`${ds} broken tag must be detected`);assert.equal(dry.can_apply,false);
  }

  // 4. Equipment mod_ids is a first-class dependency and missing MOD blocks Apply.
  const badMod=await makeAddEnvelope(base,'equipment','EQ-DE19-BROKEN-MOD',row=>{row.mod_ids=['MOD-MISSING-DE19'];row.tags=[];});
  const badModDry=await dx.dryRunImport({rootData:base,envelope:badMod});
  assert(badModDry.items.some(x=>x.status==='broken_reference'&&String(x.detail).includes('mods:MOD-MISSING-DE19')),'equipment missing MOD reference');
  assert.equal(badModDry.can_apply,false);
  const paramsMod=await makeAddEnvelope(base,'equipment','EQ-DE19-PARAM-MOD',row=>{delete row.mod_ids;row.params={mod_ids:['MOD-MISSING-DE19']};row.tags=[];});
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

  // 7. New-record unknown fields and DELETE v1 remain blocked for every DE-19 dataset.
  for(const ds of Object.keys(SOURCE_IDS)){
    const unknown=await makeAddEnvelope(base,ds,addIds[ds]+'-UNKNOWN',row=>{row.future_payload={unsafe:true};});
    const dry=await dx.dryRunImport({rootData:base,envelope:unknown});
    const plan=await dx.createApplyPlan({rootData:base,envelope:unknown,dryRun:dry});assert.equal(plan.can_apply,false,`${ds} unknown field`);assert(plan.reasons.some(x=>x.includes('未知フィールド')));
    const del=clone(unknown);del.operations={delete:{[ds]:[addIds[ds]]}};del.metadata.package_hash='';
    const delDry=await dx.dryRunImport({rootData:base,envelope:del});assert.equal(delDry.can_apply,false,`${ds} delete`);assert(delDry.summary.invalid+delDry.summary.incompatible>=1);
  }

  console.log('DE-19 Job / Equipment / MOD / AI vertical gate: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
