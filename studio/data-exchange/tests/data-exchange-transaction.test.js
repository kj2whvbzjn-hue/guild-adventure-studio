const assert=require('assert');
const dx=require('../data-exchange-core.js');
const tx=require('../data-exchange-transaction.js');

async function main(){
  const root={
    schema_version:'1.0.0',
    project:{id:'P1',updated_at:'R1'},
    tags:[],
    masters:{
      monsters:[{id:'M1',name:'One',tags:[],params:{skill_ids:[],candidate_skill_ids:[],equipment_ids:[],mod_ids:[]}}],
      skills:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],
      ai_conditions:[],ai_targets:[],ai_actions:[]
    }
  };
  const env=await dx.buildEnvelope({rootData:root,dataset:'monsters',ids:['M1'],dependencyMode:'none',studioVersion:'TEST'});
  const add=JSON.parse(JSON.stringify(env));
  add.datasets.monsters[0].id='M2';
  add.datasets.monsters[0].name='Two';
  add.metadata.base_hash='';
  add.metadata.record_hashes={monsters:{}};
  add.metadata.package_hash='';

  const dry=await dx.dryRunImport({rootData:root,envelope:add});
  const plan=await dx.createApplyPlan({rootData:root,envelope:add,dryRun:dry});
  assert.equal(plan.can_apply,true);

  let live=JSON.parse(JSON.stringify(root));
  let backupCalls=0,commitCalls=0,persistCalls=0,rollbackCalls=0;
  const result=await tx.execute({
    rootData:live,envelope:add,plan,dryRun:dry,
    backup:()=>{backupCalls++;return true;},
    commit:(candidate)=>{commitCalls++;live=candidate;return true;},
    persist:()=>{persistCalls++;return true;},
    rollback:(before)=>{rollbackCalls++;live=before;return true;}
  });
  assert.equal(result.ok,true);
  assert.equal(dx.records(live,'monsters').length,2);
  assert.equal(backupCalls,1);assert.equal(commitCalls,1);assert.equal(persistCalls,1);assert.equal(rollbackCalls,0);
  assert.equal(typeof result.beforeHash,'string');assert.equal(result.beforeHash.length,64);
  assert.equal(typeof result.candidateHash,'string');assert.equal(result.candidateHash.length,64);

  live=JSON.parse(JSON.stringify(root));commitCalls=0;persistCalls=0;
  await assert.rejects(()=>tx.execute({
    rootData:live,envelope:add,plan,dryRun:dry,
    backup:()=>false,
    commit:(candidate)=>{commitCalls++;live=candidate;return true;},
    persist:()=>{persistCalls++;return true;},
    rollback:(before)=>{live=before;return true;}
  }),/Backup/);
  assert.equal(commitCalls,0);assert.equal(persistCalls,0);
  assert.equal(dx.records(live,'monsters').length,1,'backup failure must leave current data unchanged');

  live=JSON.parse(JSON.stringify(root));rollbackCalls=0;
  await assert.rejects(()=>tx.execute({
    rootData:live,envelope:add,plan,dryRun:dry,
    backup:()=>true,
    commit:(candidate)=>{live=candidate;return true;},
    persist:()=>false,
    rollback:(before)=>{rollbackCalls++;live=before;return true;}
  }),/persist/);
  assert.equal(rollbackCalls,1);
  assert.equal(dx.records(live,'monsters').length,1,'persist failure must rollback current data');


  const conflict=await dx.buildEnvelope({rootData:root,dataset:'monsters',ids:['M1'],dependencyMode:'none',studioVersion:'TEST'});
  conflict.datasets.monsters[0].name='Imported';
  conflict.metadata.package_hash='';
  const conflictDry=await dx.dryRunImport({rootData:root,envelope:conflict});

  const importPlan=await dx.createApplyPlan({rootData:root,envelope:conflict,dryRun:conflictDry,conflictChoices:{M1:'import'}});
  live=JSON.parse(JSON.stringify(root));
  const importTx=await tx.execute({
    rootData:live,envelope:conflict,plan:importPlan,dryRun:conflictDry,
    backup:()=>true,commit:(candidate)=>{live=candidate;return true;},persist:()=>true,rollback:(before)=>{live=before;return true;}
  });
  assert.equal(dx.records(live,'monsters')[0].name,'Imported');
  assert.equal(importTx.validation.summary.conflict,0);

  const keepPlan=await dx.createApplyPlan({rootData:root,envelope:conflict,dryRun:conflictDry,conflictChoices:{M1:'keep'}});
  live=JSON.parse(JSON.stringify(root));
  const keepTx=await tx.execute({
    rootData:live,envelope:conflict,plan:keepPlan,dryRun:conflictDry,
    backup:()=>true,commit:(candidate)=>{live=candidate;return true;},persist:()=>true,rollback:(before)=>{live=before;return true;}
  });
  assert.equal(dx.records(live,'monsters')[0].name,'One');
  assert.equal(keepTx.validation.summary.conflict,1);


  const semanticBase=JSON.parse(JSON.stringify(root));
  semanticBase.project.updated_at='BEFORE';
  semanticBase.history=[{at:'A',message:'previous'}];
  const semanticAfter=JSON.parse(JSON.stringify(semanticBase));
  semanticAfter.project.updated_at='AFTER';
  semanticAfter.history.push({at:'B',message:'Data Exchange Transaction'});
  assert.equal(
    await tx.projectHash(semanticBase),
    await tx.projectHash(semanticAfter),
    'persist-only project.updated_at/history changes must not change transaction hash'
  );
  semanticAfter.masters.monsters[0].name='Real content change';
  assert.notEqual(
    await tx.projectHash(semanticBase),
    await tx.projectHash(semanticAfter),
    'real master data changes must still change transaction hash'
  );

  console.log('DATA EXCHANGE TRANSACTION TEST: PASS');
}
main().catch(e=>{console.error(e);process.exit(1);});
