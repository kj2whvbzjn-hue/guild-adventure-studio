const assert=require('assert');
const dx=require('../data-exchange-core.js');

(async()=>{
  assert.equal(dx.FORMAT,'GKS_DATA_EXCHANGE');
  const a={id:'MON-1',tags:['B','A'],updated_at:'x',params:{skill_ids:['S2','S1']}};
  const b={id:'MON-1',tags:['A','B'],updated_at:'y',params:{skill_ids:['S1','S2']}};
  assert.equal(dx.stableStringify(dx.canonicalizeRecord('monsters',a)),dx.stableStringify(dx.canonicalizeRecord('monsters',b)),'unordered/volatile normalization');
  const root={schema_version:'4.0.0-draft',project:{id:'P1',updated_at:'R1'},tags:[{id:'T1',name:'Tag'}],masters:{monsters:[{id:'M1',name:'Monster',tags:['T1'],params:{skill_ids:['S1']}}],skills:[{id:'S1',name:'Skill',tags:['T1'],params:{required_tags:['T1']}}],jobs:[],equipment:[],mods:[],ai_conditions:[],ai_targets:[],ai_actions:[]}};
  const env=await dx.buildEnvelope({rootData:root,dataset:'monsters',ids:['M1'],dependencyMode:'recursive',studioVersion:'TEST'});
  assert.equal(env.datasets.monsters.length,1);
  assert.equal(env.datasets.tags.length,1);
  assert.equal(env.datasets.skills.length,1);
  assert.deepEqual(env.permissions.writable,['monsters']);
  assert(env.permissions.read_only.includes('tags'));
  assert.equal(env.metadata.package_hash.length,64);
  assert(dx.validateEnvelopeShape(env).ok);
  console.log('Data Exchange core tests: PASS');
})().catch(e=>{console.error(e);process.exit(1)});
