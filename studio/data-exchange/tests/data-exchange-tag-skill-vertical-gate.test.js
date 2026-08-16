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
    schema_version:'4.0.0-draft',
    project:{id:'PRJ-DE18',updated_at:'R1'},
    tag_categories:[{id:'CAT-COMBAT',name:'Combat',enabled:true}],
    tags:[
      {id:'TAG-0001',name:'Fire',status:'draft',category_id:'CAT-COMBAT',parent_id:'',description:'',enabled:true,aliases:['Flame'],updated_at:'TAG-0001'},
      {id:'TAG-0002',name:'Burn',status:'draft',category_id:'CAT-COMBAT',parent_id:'TAG-0001',description:'',enabled:true,aliases:[],updated_at:'TAG-0001'}
    ],
    masters:{
      monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],ai_conditions:[],ai_targets:[],ai_actions:[],
      skills:[
        {
          schemaVersion:1,id:'SKL-0001',name:'Fire Skill',skillLevel:1,
          trigger:{type:'ON_USE',scope:'SELF'},conditions:[],
          target:{side:'ENEMY',range:'SINGLE'},
          effects:[{type:'DAMAGE',power:10,damageType:'PHYSICAL'}],
          resource:{mpCost:0,cooldown:0,activationPriority:0},
          runtimeContracts:{
            schemaVersion:1,registryPhase:'FORMAL-SKILL-1',
            triggerContract:{type:'ON_USE',scope:'SELF',engineEvent:'use',dispatchMode:'RESOLVE_ONLY',priority:0},
            conditionContracts:[],effectContracts:[{type:'DAMAGE',power:10,damageType:'PHYSICAL'}],
            applyContracts:[],auraEffectContract:null
          },
          status:'draft',description:'',updated_at:'TAG-0001'
        }
      ]
    },history:[]
  };
}
async function makeAddEnvelope(base,dataset,id,mutate){
  const sourceId=dataset==='tags'?'TAG-0001':'SKL-0001';
  const env=await dx.buildEnvelope({rootData:base,dataset,ids:[sourceId],dependencyMode:'recursive',studioVersion:'TEST-DE18'});
  const out=clone(env),row=out.datasets[dataset][0];
  row.id=id;
  if(mutate)mutate(row,out);
  out.metadata.base_hash='';
  out.metadata.record_hashes={[dataset]:{}};
  out.metadata.record_count=Object.fromEntries(Object.entries(out.datasets).map(([k,v])=>[k,v.length]));
  out.metadata.package_hash='';
  return out;
}
async function applyAndUndo(base,envelope,dataset,filename){
  const dry=await dx.dryRunImport({rootData:base,envelope});
  assert.equal(dry.summary.add,1);
  const plan=await dx.createApplyPlan({rootData:base,envelope,dryRun:dry});
  assert.equal(plan.can_apply,true,plan.reasons.join(' / '));
  let live=clone(base),before=clone(base);
  const tr=await tx.execute({rootData:live,envelope,plan,dryRun:dry,backup:()=>true,commit:c=>{live=c;return true;},persist:()=>true,rollback:b=>{live=b;return true;}});
  assert.equal(tr.ok,true);
  const session=audit.buildSession({transaction:tr,plan,envelope,beforeData:before,afterHash:await tx.projectHash(live),beforeDatasetHash:await audit.datasetHash(before,dataset),afterDatasetHash:await audit.datasetHash(live,dataset),sourceFilename:filename});
  const store=new MemoryStorage();assert(audit.append(store,'audit',session));
  const undo=await audit.undo({session,currentData:live,normalize:x=>x,validate:x=>audit.validateSnapshot(x,session),backup:()=>true,commit:c=>{live=c;return true;},persist:()=>true,readCurrent:()=>live,rollback:b=>{live=b;return true;}});
  assert.equal(await audit.datasetHash(live,dataset),session.before_dataset_hash);
  assert(audit.markUndone(store,'audit',session.import_session_id,undo.undoAfterHash));
  assert.equal(audit.load(store,'audit')[0].undone,true);
  return live;
}

async function main(){
  const base=baseProject();

  // Runtime regression: B485 validator cache key must not be reused after DE-18 reference rules changed.
  const studioHtml=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
  assert(studioHtml.includes('data-exchange-integrity-validator.js?v=4'),'Studio must load the DE-18 integrity validator with the refreshed cache key');

  // 1. Tag primary Dataset: deterministic export + safe add/apply/audit/undo.
  const tagExport=await dx.buildEnvelope({rootData:base,dataset:'tags',ids:['TAG-0002'],dependencyMode:'recursive',studioVersion:'TEST-DE18'});
  assert.deepEqual(tagExport.permissions.writable,['tags']);
  assert.equal(tagExport.datasets.tags.length,1);
  const tagAdd=await makeAddEnvelope(base,'tags','TAG-0005',row=>{row.name='Ice';row.parent_id='TAG-0001';row.aliases=['Cold'];});
  const tagDry=await dx.dryRunImport({rootData:base,envelope:tagAdd});
  assert.equal(tagDry.can_apply,true);
  assert.equal(tagDry.summary.broken_reference,0);
  await applyAndUndo(base,tagAdd,'tags','DE18_TAG_ADD.json');

  // 2. Tag reference safety: parent/replacement/category must exist.
  let badIndex=0;
  for(const [field,value] of [['parent_id','TAG-9999'],['replacement_tag_id','TAG-9999'],['category_id','CAT-MISSING']]){
    const badId='TAG-'+String(6+(badIndex++)).padStart(4,'0');
    const bad=await makeAddEnvelope(base,'tags',badId,row=>{row[field]=value;});
    const dry=await dx.dryRunImport({rootData:base,envelope:bad});
    assert(dry.summary.broken_reference>=1,field+' should block');
    assert.equal(dry.can_apply,false);
  }

  // 3. Tag unknown top-level field is rejected before Safe Apply.
  const tagUnknown=await makeAddEnvelope(base,'tags','TAG-9997',row=>{row.future_payload={unsafe:true};});
  const tagUnknownDry=await dx.dryRunImport({rootData:base,envelope:tagUnknown});
  const tagUnknownPlan=await dx.createApplyPlan({rootData:base,envelope:tagUnknown,dryRun:tagUnknownDry});
  assert.equal(tagUnknownPlan.can_apply,false);
  assert(tagUnknownPlan.reasons.some(x=>x.includes('未知フィールド')));

  // 4. Formal Skill primary Dataset supports safe add/apply/audit/undo without reviving legacy tags/params.
  const skillExport=await dx.buildEnvelope({rootData:base,dataset:'skills',ids:['SKL-0001'],dependencyMode:'recursive',studioVersion:'TEST-DE18'});
  assert.deepEqual(skillExport.permissions.writable,['skills']);
  assert.deepEqual(skillExport.permissions.read_only,[]);
  assert.equal(Object.prototype.hasOwnProperty.call(skillExport.datasets,'tags'),false);
  const skillAdd=await makeAddEnvelope(base,'skills','SKL-0002',row=>{row.name='Burn Skill';});
  const skillDry=await dx.dryRunImport({rootData:base,envelope:skillAdd});
  assert.equal(skillDry.can_apply,true);
  assert.equal(skillDry.summary.broken_reference,0);
  await applyAndUndo(base,skillAdd,'skills','DE18_SKILL_ADD.json');

  // 5. Legacy Skill tags/params remain blocked by the current Formal Skill Master contract.
  const legacySkill=await makeAddEnvelope(base,'skills','SKL-0003',row=>{row.tags=['TAG-9999'];row.params={required_tags:['TAG-0001']};});
  const legacyDry=await dx.dryRunImport({rootData:base,envelope:legacySkill});
  const legacyPlan=await dx.createApplyPlan({rootData:base,envelope:legacySkill,dryRun:legacyDry});
  assert.equal(legacyPlan.can_apply,false);
  assert(legacyPlan.reasons.some(x=>x.includes('未知フィールド')));

  // 6. Conflict requires explicit keep/import; stale source remains blocking.
  const conflict=clone(skillExport);conflict.datasets.skills[0].description='GPT changed';conflict.metadata.package_hash='';
  const conflictDry=await dx.dryRunImport({rootData:base,envelope:conflict});
  assert.equal(conflictDry.summary.conflict,1);
  assert.equal((await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry})).can_apply,false);
  const importPlan=await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry,conflictChoices:{'SKL-0001':'import'}});
  assert.equal(importPlan.can_apply,true);
  const imported=await dx.applySafeMerge({rootData:base,envelope:conflict,plan:importPlan,dryRun:conflictDry});
  assert.equal(dx.records(imported.nextRootData,'skills')[0].description,'GPT changed');
  const staleRoot=clone(base);staleRoot.masters.skills[0].description='Changed after export';
  const stale=await dx.dryRunImport({rootData:staleRoot,envelope:skillExport});
  assert.equal(stale.can_apply,false);assert.equal(stale.summary.stale_source,1);

  // 7. Skill unknown field and DELETE v1 remain blocked.
  const skillUnknown=await makeAddEnvelope(base,'skills','SKL-9998',row=>{row.future_payload={unsafe:true};});
  const skillUnknownDry=await dx.dryRunImport({rootData:base,envelope:skillUnknown});
  const skillUnknownPlan=await dx.createApplyPlan({rootData:base,envelope:skillUnknown,dryRun:skillUnknownDry});
  assert.equal(skillUnknownPlan.can_apply,false);
  const del=clone(skillAdd);del.operations={delete:{skills:['SKL-0001']}};del.metadata.package_hash='';
  const delDry=await dx.dryRunImport({rootData:base,envelope:del});
  assert.equal(delDry.can_apply,false);

  console.log('DE-18 TAG / SKILL VERTICAL SLICE GATE: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
