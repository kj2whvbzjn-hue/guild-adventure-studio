#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Validator=require('../../shared/ai/ai-program-validator.js');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const Runtime=require('../../shared/ai/ai-battle-runtime-context.js');
const dv='DV-P11';
const ports=(outputs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outputs.map((id)=>({id,kind:'flow',data_type:'flow'}))});
const empty={type:'object',properties:{},required:[],additionalProperties:false};
const project={
  data_version:dv,
  tag_categories:[{id:'TGC-TARGET',name:'対象'},{id:'TGC-STATE',name:'状態管理'}],
  tags:[
    {id:'TAG-ENEMY',name:'敵',category_id:'TGC-TARGET',runtime_semantic:'ENEMY'},
    {id:'TAG-HP',name:'HP',category_id:'TGC-STATE',runtime_semantic:'HP'}
  ],
  masters:{
    ai_searches:[{id:'AIS-SEARCH',name:'探索',status:'active',data_version:dv,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:empty}],
    ai_conditions:[{id:'AIC-STATE',name:'状態管理',status:'active',data_version:dv,evaluator:'condition.state_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{state_tag_id:{type:'string',ref_kind:'tag',ref_category_id:'TGC-STATE'},value_mode:{type:'string',enum:['CURRENT','RATIO']},operator:{type:'string',enum:['<','<=','>','>=','=']},value:{type:'number',minimum:0}},required:['state_tag_id'],additionalProperties:false}}],
    ai_actions:[
      {id:'AIA-ATTACK',name:'通常攻撃',status:'active',data_version:dv,evaluator:'action.attack',ports:ports([]),parameter_schema:empty},
      {id:'AIA-WAIT',name:'待機',status:'active',data_version:dv,evaluator:'action.wait',ports:ports([]),parameter_schema:empty}
    ],
    ai_target_selectors:[{id:'ATS-LOW',name:'HP最低',evaluator:'selector.lowest_hp_ratio',enabled:true,parameter_schema:empty,tags:[]}],
    skills:[]
  }
};
const search=(id,slot)=>({instance_id:id,master_node_id:'AIS-SEARCH',master_data_version:dv,node_type:'search',position:{x:0,y:0},parameters:{target_tag_id:'TAG-ENEMY',...(slot?{result_slot_id:slot}:{}),predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-STATE',params:{state_tag_id:'TAG-HP',value_mode:'RATIO',operator:'<=',value:.5},negate:false}]}},target_selector:null,comment:''});
const attack=(id,slot)=>({instance_id:id,master_node_id:'AIA-ATTACK',master_data_version:dv,node_type:'action',position:{x:1,y:0},parameters:{},target_selector:{selector_id:'ATS-LOW',params:{}},...(slot?{target_source:{kind:'SEARCH_RESULT',result_slot_id:slot}}:{}),comment:''});
const wait=(id)=>({instance_id:id,master_node_id:'AIA-WAIT',master_data_version:dv,node_type:'action',position:{x:1,y:1},parameters:{},target_selector:null,comment:''});
const edge=(id,from,port,to)=>({edge_id:id,from:{node_id:from,port_id:port},transition_kind:'NODE',to:{node_id:to,port_id:'in'}});
function program(){return {schema_version:'2.0.0',data_version:dv,id:'AIP-P11',name:'slot binding',version:1,status:'draft',entry_node_id:'AIN-0001',result_slots:[{slot_id:'ARS-0001',name:'HP50%以下の敵',value_type:'UNIT_SET'}],nodes:[search('AIN-0001','ARS-0001'),attack('AIN-0002','ARS-0001'),wait('AIN-0003')],edges:[edge('AIE-0001','AIN-0001','found','AIN-0002'),edge('AIE-0002','AIN-0001','not_found','AIN-0003')],subroutines:[],tags:[],description:''};}
(async()=>{
  const p=program();
  const valid=Validator.validate(p,project);assert(valid.valid,JSON.stringify(valid.issues));
  const runtime=await Compiler.compile(p,project);
  const s=runtime.instructions.find(row=>row.source_node_id==='AIN-0001'),a=runtime.instructions.find(row=>row.source_node_id==='AIN-0002');
  assert.strictEqual(s.params.result_slot_id,'ARS-0001');
  assert.deepStrictEqual(a.target_source,{kind:'SEARCH_RESULT',result_slot_id:'ARS-0001'});
  const result=Runtime.decide(runtime,{battle_id:'B-P11',actor_id:'ALLY-1',seed:7,units:[
    {id:'ALLY-1',side:'ALLY',alive:true,hp:100,maxHp:100,mp:10,maxMp:10,formationPosition:'FRONTLINE'},
    {id:'ENEMY-1',side:'ENEMY',alive:true,hp:80,maxHp:100,mp:0,maxMp:0,formationPosition:'FRONTLINE'},
    {id:'ENEMY-2',side:'ENEMY',alive:true,hp:40,maxHp:100,mp:0,maxMp:0,formationPosition:'FRONTLINE'},
    {id:'ENEMY-3',side:'ENEMY',alive:true,hp:20,maxHp:100,mp:0,maxMp:0,formationPosition:'BACKLINE'}
  ],target_selectors:project.masters.ai_target_selectors});
  assert.strictEqual(result.proposal.target_id,'ENEMY-2','Search result must be intersected with the fresh attack legal candidate pool');
  const searchTrace=result.trace.events.find(row=>row.event_type==='search');assert.deepStrictEqual(searchTrace.details.candidate_ids,['ENEMY-2','ENEMY-3']);assert.strictEqual(searchTrace.details.result_slot_id,'ARS-0001');
  const selectorTrace=result.trace.events.find(row=>row.event_type==='selector');assert.deepStrictEqual(selectorTrace.details.target_source.stored_candidate_ids,['ENEMY-2','ENEMY-3']);assert.deepStrictEqual(selectorTrace.details.target_source.legal_candidate_ids,['ENEMY-2']);

  const unwritten=program();unwritten.nodes[0].parameters.result_slot_id=undefined;delete unwritten.nodes[0].parameters.result_slot_id;
  let vr=Validator.validate(unwritten,project);assert(vr.issues.some(row=>row.code==='AI_TARGET_SOURCE_SLOT_UNWRITTEN'));

  const multi=program();multi.nodes.push(search('AIN-0004','ARS-0001'));
  vr=Validator.validate(multi,project);assert(vr.issues.some(row=>row.code==='AI_RESULT_SLOT_MULTIPLE_WRITERS'));

  const path=program();path.nodes.unshift(wait('AIN-0000'));path.entry_node_id='AIN-0000';path.edges.push(edge('AIE-0000','AIN-0000','out','AIN-0002'));
  // Directly reaching the Action without its Search writer must fail path initialization, regardless of another valid writer path.
  vr=Validator.validate(path,project);assert(vr.issues.some(row=>row.code==='AI_TARGET_SOURCE_SLOT_UNINITIALIZED_PATH'));

  const forbidden=program();forbidden.nodes[1]=wait('AIN-0002');forbidden.nodes[1].target_source={kind:'SEARCH_RESULT',result_slot_id:'ARS-0001'};
  vr=Validator.validate(forbidden,project);assert(vr.issues.some(row=>row.code==='AI_TARGET_SOURCE_FORBIDDEN'));

  const noLegalRuntime=JSON.parse(JSON.stringify(runtime));
  const noLegal=Runtime.decide(noLegalRuntime,{battle_id:'B-P11-X',actor_id:'ALLY-1',seed:8,units:[
    {id:'ALLY-1',side:'ALLY',alive:true,hp:100,maxHp:100,formationPosition:'FRONTLINE'},
    {id:'ENEMY-BACK',side:'ENEMY',alive:true,hp:20,maxHp:100,formationPosition:'BACKLINE'},
    {id:'ENEMY-FRONT',side:'ENEMY',alive:true,hp:90,maxHp:100,formationPosition:'FRONTLINE'}
  ],target_selectors:project.masters.ai_target_selectors});
  assert.strictEqual(noLegal.proposal.status,'failed');assert.strictEqual(noLegal.proposal.reason,'target_source_no_legal_candidates');
  console.log('AI_SEARCH_RESULT_SLOT_BINDING_R10_P11_OK slot=UNIT_SET writer=search reader=action intersection=target_contract selector=post_intersection lifetime=decision fail_closed=unwritten,multi_writer,uninitialized,forbidden,no_legal');
})().catch(error=>{console.error(error);process.exit(1);});
