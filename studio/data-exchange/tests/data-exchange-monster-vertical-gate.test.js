const assert=require('assert');
const dx=require('../data-exchange-core.js');
const tx=require('../data-exchange-transaction.js');
const audit=require('../data-exchange-audit.js');

function clone(v){return JSON.parse(JSON.stringify(v));}
function rootData(){
  return {
    schema_version:'4.0.0-draft',
    project:{id:'P-DE17',updated_at:'R1'},
    tags:[{id:'TAG-A',name:'A'},{id:'TAG-B',name:'B'}],
    masters:{
      monsters:[{
        id:'MON-BASE',name:'Base Monster',status:'draft',tags:['TAG-A'],
        params:{skill_ids:['SKL-A'],candidate_skill_ids:['SKL-A'],equipment_ids:[],mod_ids:[]}
      }],
      skills:[{id:'SKL-A',name:'Skill A',tags:['TAG-A'],params:{required_tags:['TAG-A']}}],
      stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],
      ai_conditions:[],ai_targets:[],ai_actions:[]
    }
  };
}
class MemoryStorage{
  constructor(){this.m=new Map();}
  getItem(k){return this.m.has(k)?this.m.get(k):null;}
  setItem(k,v){this.m.set(k,String(v));}
  removeItem(k){this.m.delete(k);}
}

async function main(){
  const base=rootData();

  // 1. Export envelope / package hash / dependency read_only.
  const exported=await dx.buildEnvelope({
    rootData:base,dataset:'monsters',ids:['MON-BASE'],
    dependencyMode:'recursive',studioVersion:'DE17'
  });
  assert.equal(exported.format,'GKS_DATA_EXCHANGE');
  assert.equal(exported.datasets.monsters.length,1);
  assert(exported.metadata.package_hash.length===64);
  assert(exported.permissions.read_only.includes('tags'));
  assert(exported.permissions.read_only.includes('skills'));

  // 2. Unchanged.
  const unchanged=await dx.dryRunImport({rootData:base,envelope:exported});
  assert.equal(unchanged.summary.unchanged,1);
  assert.equal(unchanged.can_apply,false);

  // 3. Add + Impact + Safe Transaction.
  const add=clone(exported);
  add.datasets.monsters[0].id='MON-ADD';
  add.datasets.monsters[0].name='Added Monster';
  add.datasets.monsters[0].params.skill_ids=[];
  add.datasets.monsters[0].params.candidate_skill_ids=[];
  delete add.datasets.skills;
  delete add.datasets.tags;
  add.permissions.read_only=[];
  add.metadata.record_count={monsters:1};
  add.metadata.base_hash='';
  add.metadata.base_project_revision='';
  add.metadata.record_hashes={monsters:{}};
  add.metadata.package_hash='';
  const addDry=await dx.dryRunImport({rootData:base,envelope:add});
  assert.equal(addDry.summary.add,1);
  assert.equal(addDry.can_apply,true);
  assert.equal(addDry.impact_preview.summary.direct,1);
  const impact=dx.buildImpactExportPayload(add,addDry);
  assert.equal(impact.format,'GKS_DATA_EXCHANGE_IMPACT');
  assert.equal(impact.direct_changes[0].id,'MON-ADD');

  const addPlan=await dx.createApplyPlan({rootData:base,envelope:add,dryRun:addDry});
  let live=clone(base);
  const before=clone(live);
  const tr=await tx.execute({
    rootData:live,envelope:add,plan:addPlan,dryRun:addDry,
    backup:()=>true,
    commit:c=>{live=c;return true;},
    persist:()=>true,
    rollback:b=>{live=b;return true;}
  });
  assert.equal(tr.ok,true);
  assert(dx.records(live,'monsters').some(x=>x.id==='MON-ADD'));

  // 4. Audit + session-scoped Undo.
  const session=audit.buildSession({
    transaction:tr,plan:addPlan,envelope:add,beforeData:before,
    afterHash:await tx.projectHash(live),
    beforeDatasetHash:await audit.datasetHash(before,'monsters'),
    afterDatasetHash:await audit.datasetHash(live,'monsters'),
    sourceFilename:'DE17_ADD.json'
  });
  assert.deepEqual(session.undo_snapshot.remove_ids,['MON-ADD']);
  const store=new MemoryStorage();
  assert(audit.append(store,'audit',session));
  const undo=await audit.undo({
    session,currentData:live,
    normalize:x=>x,
    validate:x=>audit.validateSnapshot(x,session),
    backup:()=>true,
    commit:c=>{live=c;return true;},
    persist:()=>true,
    readCurrent:()=>live,
    rollback:b=>{live=b;return true;}
  });
  assert.equal(dx.records(live,'monsters').some(x=>x.id==='MON-ADD'),false);
  assert.equal(await audit.datasetHash(live,'monsters'),session.before_dataset_hash);
  assert(audit.markUndone(store,'audit',session.import_session_id,undo.undoAfterHash));
  assert.equal(audit.load(store,'audit')[0].undone,true);

  // 5. Conflict must be explicit; keep/import both work.
  const conflict=clone(exported);
  conflict.datasets.monsters[0].name='Imported Name';
  conflict.metadata.package_hash='';
  const conflictDry=await dx.dryRunImport({rootData:base,envelope:conflict});
  assert.equal(conflictDry.summary.conflict,1);
  const unresolved=await dx.createApplyPlan({rootData:base,envelope:conflict,dryRun:conflictDry});
  assert.equal(unresolved.can_apply,false);

  const keep=await dx.createApplyPlan({
    rootData:base,envelope:conflict,dryRun:conflictDry,
    conflictChoices:{'MON-BASE':'keep'}
  });
  assert.equal(keep.can_apply,true);
  const kept=await dx.applySafeMerge({rootData:base,envelope:conflict,plan:keep,dryRun:conflictDry});
  assert.equal(dx.records(kept.nextRootData,'monsters')[0].name,'Base Monster');

  const importedPlan=await dx.createApplyPlan({
    rootData:base,envelope:conflict,dryRun:conflictDry,
    conflictChoices:{'MON-BASE':'import'}
  });
  assert.equal(importedPlan.can_apply,true);
  const imported=await dx.applySafeMerge({rootData:base,envelope:conflict,plan:importedPlan,dryRun:conflictDry});
  assert.equal(dx.records(imported.nextRootData,'monsters')[0].name,'Imported Name');

  // 6. Stale source blocks.
  const staleRoot=clone(base);
  staleRoot.masters.monsters[0].name='Changed After Export';
  const stale=await dx.dryRunImport({rootData:staleRoot,envelope:exported});
  assert.equal(stale.summary.stale_source,1);
  assert.equal(stale.can_apply,false);

  // 7. Broken reference blocks.
  const broken=clone(add);
  broken.datasets.monsters[0].params.skill_ids=['SKL-MISSING'];
  broken.metadata.package_hash='';
  const brokenDry=await dx.dryRunImport({rootData:base,envelope:broken});
  assert.equal(brokenDry.summary.broken_reference,1);
  assert.equal(brokenDry.can_apply,false);

  // 8. read_only modification blocks.
  const ro=clone(exported);
  ro.datasets.tags[0].name='Tampered';
  ro.metadata.package_hash='';
  const roDry=await dx.dryRunImport({rootData:base,envelope:ro});
  assert.equal(roDry.summary.readonly_modified,1);
  assert.equal(roDry.can_apply,false);

  // 9. Unsupported DELETE stays blocked.
  const del=clone(add);
  del.operations={delete:{monsters:['MON-BASE']}};
  del.metadata.package_hash='';
  const delDry=await dx.dryRunImport({rootData:base,envelope:del});
  assert.equal(delDry.can_apply,false);

  console.log('DE-17 MONSTER VERTICAL SLICE GATE: PASS');
}
main().catch(e=>{console.error(e);process.exit(1);});
