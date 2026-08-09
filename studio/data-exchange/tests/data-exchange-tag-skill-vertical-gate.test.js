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
      {id:'TAG-FIRE',name:'Fire',status:'draft',category_id:'CAT-COMBAT',parent_id:'',description:'',enabled:true,aliases:['Flame'],updated_at:'T1'},
      {id:'TAG-BURN',name:'Burn',status:'draft',category_id:'CAT-COMBAT',parent_id:'TAG-FIRE',description:'',enabled:true,aliases:[],updated_at:'T1'}
    ],
    masters:{
      monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],ai_conditions:[],ai_targets:[],ai_actions:[],
      skills:[
        {id:'SKL-FIRE',name:'Fire Skill',status:'draft',tags:['TAG-FIRE'],params:{required_tags:['TAG-BURN']},description:'',updated_at:'T1'}
      ]
    },history:[]
  };
}
async function makeAddEnvelope(base,dataset,id,mutate){
  const sourceId=dataset==='tags'?'TAG-FIRE':'SKL-FIRE';
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
  assert(studioHtml.includes('data-exchange-integrity-validator.js?v=2'),'Studio must load the DE-18 integrity validator with the refreshed cache key');

  // 1. Tag primary Dataset: deterministic export + safe add/apply/audit/undo.
  const tagExport=await dx.buildEnvelope({rootData:base,dataset:'tags',ids:['TAG-BURN'],dependencyMode:'recursive',studioVersion:'TEST-DE18'});
  assert.deepEqual(tagExport.permissions.writable,['tags']);
  assert.equal(tagExport.datasets.tags.length,1);
  const tagAdd=await makeAddEnvelope(base,'tags','TAG-ICE',row=>{row.name='Ice';row.parent_id='TAG-FIRE';row.aliases=['Cold'];});
  const tagDry=await dx.dryRunImport({rootData:base,envelope:tagAdd});
  assert.equal(tagDry.can_apply,true);
  assert.equal(tagDry.summary.broken_reference,0);
  await applyAndUndo(base,tagAdd,'tags','DE18_TAG_ADD.json');

  // 2. Tag reference safety: parent/replacement/category must exist.
  for(const [field,value] of [['parent_id','TAG-MISSING'],['replacement_tag_id','TAG-MISSING'],['category_id','CAT-MISSING']]){
    const bad=await makeAddEnvelope(base,'tags','TAG-BAD-'+field,row=>{row[field]=value;});
    const dry=await dx.dryRunImport({rootData:base,envelope:bad});
    assert(dry.summary.broken_reference>=1,field+' should block');
    assert.equal(dry.can_apply,false);
  }

  // 3. Tag unknown top-level field is rejected before Safe Apply.
  const tagUnknown=await makeAddEnvelope(base,'tags','TAG-UNKNOWN',row=>{row.future_payload={unsafe:true};});
  const tagUnknownDry=await dx.dryRunImport({rootData:base,envelope:tagUnknown});
  const tagUnknownPlan=await dx.createApplyPlan({rootData:base,envelope:tagUnknown,dryRun:tagUnknownDry});
  assert.equal(tagUnknownPlan.can_apply,false);
  assert(tagUnknownPlan.reasons.some(x=>x.includes('未知フィールド')));

  // 4. Skill primary Dataset exports referenced tags as read_only and supports safe add/apply/audit/undo.
  const skillExport=await dx.buildEnvelope({rootData:base,dataset:'skills',ids:['SKL-FIRE'],dependencyMode:'recursive',studioVersion:'TEST-DE18'});
  assert.deepEqual(skillExport.permissions.writable,['skills']);
  assert(skillExport.permissions.read_only.includes('tags'));
  assert.equal(skillExport.datasets.tags.length,2);
  const skillAdd=await makeAddEnvelope(base,'skills','SKL-BURN',row=>{row.name='Burn Skill';row.tags=['TAG-BURN'];row.params={required_tags:['TAG-FIRE']};});
  const skillDry=await dx.dryRunImport({rootData:base,envelope:skillAdd});
  assert.equal(skillDry.can_apply,true);
  assert.equal(skillDry.summary.broken_reference,0);
  await applyAndUndo(base,skillAdd,'skills','DE18_SKILL_ADD.json');

  // 5. Skill broken tag reference and read_only tampering block.
  const brokenSkill=await makeAddEnvelope(base,'skills','SKL-BROKEN',row=>{row.tags=['TAG-MISSING'];row.params={required_tags:[]};});
  const brokenSkillDry=await dx.dryRunImport({rootData:base,envelope:brokenSkill});
  assert.equal(brokenSkillDry.can_apply,false);
  assert(brokenSkillDry.summary.broken_reference>=1);
  const ro=clone(skillExport);ro.datasets.tags[0].name='Tampered';ro.metadata.package_hash='';
  const roDry=await dx.dryRunImport({rootData:base,envelope:ro});
  assert.equal(roDry.can_apply,false);
  assert(roDry.summary.readonly_modified>=1);

  // 6. Conflict requires explicit keep/import; stale source remains blocking.
  const conflict=clone(skillExport);conflict.datasets.skills[0].description='GPT changed';conflict.metadata.package_hash='';
  const conflictDry=await dx.dryRunImport({rootData:base,envelope:conflict});
  assert.equal(conflictDry.summary.conflict,1);
  assert.equal((await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry})).can_apply,false);
  const importPlan=await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry,conflictChoices:{'SKL-FIRE':'import'}});
  assert.equal(importPlan.can_apply,true);
  const imported=await dx.applySafeMerge({rootData:base,envelope:conflict,plan:importPlan,dryRun:conflictDry});
  assert.equal(dx.records(imported.nextRootData,'skills')[0].description,'GPT changed');
  const staleRoot=clone(base);staleRoot.masters.skills[0].description='Changed after export';
  const stale=await dx.dryRunImport({rootData:staleRoot,envelope:skillExport});
  assert.equal(stale.can_apply,false);assert.equal(stale.summary.stale_source,1);

  // 7. Skill unknown field and DELETE v1 remain blocked.
  const skillUnknown=await makeAddEnvelope(base,'skills','SKL-UNKNOWN',row=>{row.future_payload={unsafe:true};});
  const skillUnknownDry=await dx.dryRunImport({rootData:base,envelope:skillUnknown});
  const skillUnknownPlan=await dx.createApplyPlan({rootData:base,envelope:skillUnknown,dryRun:skillUnknownDry});
  assert.equal(skillUnknownPlan.can_apply,false);
  const del=clone(skillAdd);del.operations={delete:{skills:['SKL-FIRE']}};del.metadata.package_hash='';
  const delDry=await dx.dryRunImport({rootData:base,envelope:del});
  assert.equal(delDry.can_apply,false);

  console.log('DE-18 TAG / SKILL VERTICAL SLICE GATE: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
