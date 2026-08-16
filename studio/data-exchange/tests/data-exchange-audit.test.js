const assert=require('assert');
const dx=require('../data-exchange-core.js');
const tx=require('../data-exchange-transaction.js');
const audit=require('../data-exchange-audit.js');

class MemoryStorage{
  constructor(){this.m=new Map();}
  getItem(k){return this.m.has(k)?this.m.get(k):null;}
  setItem(k,v){this.m.set(k,String(v));}
  removeItem(k){this.m.delete(k);}
}

async function main(){
  const root={
    schema_version:'1.0.0',
    project:{id:'P1',updated_at:'R1'},
    tags:[],
    masters:{
      monsters:[{id:'MON-0001',name:'One',tags:[],params:{skill_ids:[],candidate_skill_ids:[],equipment_ids:[],mod_ids:[]}}],
      skills:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],
      ai_conditions:[],ai_targets:[],ai_actions:[]
    }
  };
  const env=await dx.buildEnvelope({rootData:root,dataset:'monsters',ids:['MON-0001'],dependencyMode:'none',studioVersion:'TEST'});
  const add=JSON.parse(JSON.stringify(env));
  add.datasets.monsters[0].id='MON-0002';add.datasets.monsters[0].name='Two';
  add.metadata.base_hash='';add.metadata.record_hashes={monsters:{}};add.metadata.package_hash='';
  const dry=await dx.dryRunImport({rootData:root,envelope:add});
  const plan=await dx.createApplyPlan({rootData:root,envelope:add,dryRun:dry});
  let live=JSON.parse(JSON.stringify(root));
  const result=await tx.execute({
    rootData:live,envelope:add,plan,dryRun:dry,
    backup:()=>true,commit:(candidate)=>{live=candidate;return true;},persist:()=>true,rollback:(before)=>{live=before;return true;}
  });
  const afterHash=await tx.projectHash(live);
  const session=audit.buildSession({
    transaction:result,plan,envelope:add,beforeData:root,afterHash,sourceFilename:'ADD.json',
    beforeDatasetHash:await audit.datasetHash(root,'monsters'),
    afterDatasetHash:await audit.datasetHash(live,'monsters')
  });
  assert.equal(session.dataset,'monsters');
  assert.deepEqual(session.added,['MON-0002']);
  assert.deepEqual(session.undo_snapshot.remove_ids,['MON-0002']);
  assert.equal(session.undo_snapshot.restore_records.length,0);

  // Device regression: cached DE-14 core supplied legacy plan {ids, add_count}.
  const legacyPlan={dataset:'monsters',add_count:1,ids:['MON-0002'],conflict_choices:{}};
  const legacySession=audit.buildSession({
    transaction:result,plan:legacyPlan,envelope:add,beforeData:root,afterHash,sourceFilename:'ADD.json'
  });
  assert.deepEqual(legacySession.added,['MON-0002']);
  assert.deepEqual(legacySession.undo_snapshot.remove_ids,['MON-0002']);

  const storage=new MemoryStorage(),key='audit';
  assert.equal(audit.append(storage,key,session,{maxSessions:10,maxBytes:1024*1024}),true);
  assert.equal(audit.load(storage,key).length,1);
  const exported=audit.exportPayload(storage,key);
  assert.equal(exported.format,'GKS_DATA_EXCHANGE_AUDIT');
  assert.equal(exported.sessions[0].source_filename,'ADD.json');

  // Simulate Studio persist(): operational metadata changes after commit.
  live.project.updated_at='PERSISTED';
  live.history=(live.history||[]).concat([{at:'PERSISTED',message:'Data Exchange Transaction'}]);
  // Simulate unrelated Studio operational state that may be recomputed during persist/render.
  // Full-project before hash would no longer match after removing only M2, but Dataset hash should.
  live.runtime_view_state={last_render:'after-apply'};
  session.after_hash=await tx.projectHash(live);
  session.after_dataset_hash=await audit.datasetHash(live,'monsters');

  const can=await audit.canUndo(session,live);
  assert.equal(can.ok,true);
  const undoResult=await audit.undo({
    session,currentData:live,
    normalize:(x)=>x,
    validate:(x)=>audit.validateSnapshot(x,session),
    backup:()=>true,
    commit:(candidate)=>{live=candidate;return true;},
    persist:()=>true,
    readCurrent:()=>live,
    rollback:(before)=>{live=before;return true;}
  });
  assert.equal(dx.records(live,'monsters').length,1);
  assert.equal(dx.records(live,'monsters')[0].id,'MON-0001');
  assert.equal(live.runtime_view_state.last_render,'after-apply');
  assert.equal(await audit.datasetHash(live,'monsters'),session.before_dataset_hash);
  assert.equal(audit.markUndone(storage,key,session.import_session_id,undoResult.undoAfterHash),true);
  assert.equal(audit.load(storage,key)[0].undone,true);

  let changedLive=JSON.parse(JSON.stringify(root));
  changedLive.project.updated_at='R2';
  const denied=await audit.canUndo(session,changedLive);
  assert.equal(denied.ok,false);
  assert(denied.reason.includes('Session適用直後'));

  // Conflict Import snapshot restores the previous record rather than storing the full project.
  const conflict=await dx.buildEnvelope({rootData:root,dataset:'monsters',ids:['MON-0001'],dependencyMode:'none',studioVersion:'TEST'});
  conflict.datasets.monsters[0].name='Imported';conflict.metadata.package_hash='';
  const conflictDry=await dx.dryRunImport({rootData:root,envelope:conflict});
  const conflictPlan=await dx.createApplyPlan({rootData:root,envelope:conflict,dryRun:conflictDry,conflictChoices:{'MON-0001':'import'}});
  let conflictLive=JSON.parse(JSON.stringify(root));
  const conflictTx=await tx.execute({
    rootData:conflictLive,envelope:conflict,plan:conflictPlan,dryRun:conflictDry,
    backup:()=>true,commit:(candidate)=>{conflictLive=candidate;return true;},persist:()=>true,rollback:(before)=>{conflictLive=before;return true;}
  });
  const conflictSession=audit.buildSession({
    transaction:conflictTx,plan:conflictPlan,envelope:conflict,beforeData:root,
    afterHash:await tx.projectHash(conflictLive),sourceFilename:'CONFLICT.json'
  });
  assert.equal(conflictSession.undo_snapshot.restore_records[0].name,'One');
  const rebuilt=audit.applyUndoSnapshot(conflictLive,conflictSession.undo_snapshot);
  assert.equal(dx.records(rebuilt,'monsters')[0].name,'One');
  assert.equal(await tx.projectHash(rebuilt),conflictSession.before_hash);

  // Retention limit.
  const s2={...session,import_session_id:'SKL-0002'},s3={...session,import_session_id:'SKL-0003'};
  assert(audit.append(storage,key,s2,{maxSessions:2,maxBytes:1024*1024}));
  assert(audit.append(storage,key,s3,{maxSessions:2,maxBytes:1024*1024}));
  assert.equal(audit.load(storage,key).length,2);

  console.log('DATA EXCHANGE AUDIT TEST: PASS');
}
main().catch(e=>{console.error(e);process.exit(1);});
