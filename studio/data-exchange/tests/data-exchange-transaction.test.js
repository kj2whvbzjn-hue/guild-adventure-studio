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

  console.log('DATA EXCHANGE TRANSACTION TEST: PASS');
}
main().catch(e=>{console.error(e);process.exit(1);});
