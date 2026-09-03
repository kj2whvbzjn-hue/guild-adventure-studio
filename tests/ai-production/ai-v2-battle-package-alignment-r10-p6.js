'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const Envelope=require(path.join(root,'assets/shared/js/battle-package-formal-envelope.js'));

const ports=(outs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outs.map(id=>({id,kind:'flow',data_type:'flow'}))});
const schema={type:'object',properties:{},required:[],additionalProperties:false};
const snapshot={
  schema_version:'2.0.0',id:'AIMS-P6',version:'1',data_version:'DV-P6',
  nodes:[
    {schema_version:'2.0.0',id:'AIS-0001',name:'Search',node_type:'search',status:'active',data_version:'DV-P6',evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:schema},
    {schema_version:'2.0.0',id:'AIC-0001',name:'State',node_type:'condition',status:'active',data_version:'DV-P6',evaluator:'condition.hp_ratio_compare',ports:ports(['true','false']),parameter_schema:schema,supported_subject_kind:['SELF']},
    {schema_version:'2.0.0',id:'AIA-0001',name:'Action',node_type:'action',status:'active',data_version:'DV-P6',evaluator:'action.wait',ports:ports([]),parameter_schema:schema}
  ],
  target_selectors:[
    {schema_version:'2.0.0',id:'ATS-0001',name:'Lowest HP',evaluator:'selector.lowest_hp_ratio',parameter_schema:schema,tags:[],enabled:true}
  ]
};
assert.deepStrictEqual(Envelope.validateAiMasterSnapshotData(snapshot),snapshot);
assert.throws(()=>Envelope.validateAiMasterSnapshotData({...snapshot,target_selectors:undefined}),/target_selectors/);
assert.throws(()=>Envelope.validateAiMasterSnapshotData({...snapshot,nodes:[{...snapshot.nodes[0],id:'AIT-0001',node_type:'target'}]}),/node_type|未対応/);
assert.throws(()=>Envelope.validateAiMasterSnapshotData({...snapshot,nodes:[{...snapshot.nodes[0],id:'ATS-0001'}]}),/prefix/);

assert.deepStrictEqual(Envelope.validatePersistentAiBinding({program_id:'AIP-1',layout_id:'AIL-1'}),{program_id:'AIP-1',layout_id:'AIL-1'});
assert.throws(()=>Envelope.validatePersistentAiBinding({program_id:'AIP-1',layout_id:'AIL-1',master_snapshot_id:'AIMS-1'}),/Persistent binding/);
assert.deepStrictEqual(Envelope.validateResolvedAiBinding({program_id:'AIP-1',layout_id:'AIL-1',master_snapshot_id:'AIMS-1'}),{program_id:'AIP-1',layout_id:'AIL-1',master_snapshot_id:'AIMS-1'});
assert.throws(()=>Envelope.validateResolvedAiBinding({program_id:'AIP-1',layout_id:'AIL-1'}),/Resolved binding/);

const studio=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
for(const required of [
  "ai_searches:[]",
  "ai_target_selectors:selectors.map",
  "validatePersistentAiBinding(monster.formalAiBinding",
  "validateResolvedAiBinding(unitSnapshot.formalAiBinding",
  "BATTLE_FORMAL_LEGACY_MONSTER_AI_OWNER_FORBIDDEN",
  "owner_kind:u.formalMonsterProvenance?'monster':'character'",
  "ai_runtime_kind:'formal_ai_v2'",
  "legacy_monster_separate_ai_forbidden:true"
]) assert(studio.includes(required),`missing P6 contract: ${required}`);
for(const forbidden of ['current_monster_battle_path','MONSTER OWNER AI','monster_owner','ai_targets:[]'])assert(!studio.includes(forbidden),`legacy Battle Package AI residue: ${forbidden}`);
assert(studio.includes('data.nodesにSearch/StateCheck/Actionだけ、data.target_selectorsにATS-*だけを分離'));
assert(studio.includes('Monster MasterのPersistent formalAiBinding'));
console.log('AI_V2_BATTLE_PACKAGE_ALIGNMENT_R10_P6_OK snapshot_nodes_selectors_split=1 shared_character_monster_runtime=1 legacy_monster_owner_ai=0');
