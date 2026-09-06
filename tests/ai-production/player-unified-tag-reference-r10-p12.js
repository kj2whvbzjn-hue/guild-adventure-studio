#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Validator=require('../../shared/ai/ai-program-validator.js');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const Runtime=require('../../shared/ai/ai-battle-runtime-context.js');
const dv='DV-P12';
const ports=(outputs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outputs.map(id=>({id,kind:'flow',data_type:'flow'}))});
const empty={type:'object',properties:{},required:[],additionalProperties:false};
const categories=[
  {id:'TGC-0001',name:'能力変化'},{id:'TGC-0002',name:'継続ダメ'},{id:'TGC-0003',name:'状態異常'},
  {id:'TGC-0004',name:'防御効果'},{id:'TGC-0005',name:'対象'},{id:'TGC-0006',name:'状態管理'}
];
const tags=[
  {id:'TAG-0006',name:'攻撃上昇',category_id:'TGC-0001'},
  {id:'TAG-0007',name:'火傷',category_id:'TGC-0002'},
  {id:'TAG-0008',name:'毒',category_id:'TGC-0003'},
  {id:'TAG-0009',name:'シールド',category_id:'TGC-0004'},
  {id:'TAG-0020',name:'自分',category_id:'TGC-0005',runtime_semantic:'SELF'},
  {id:'TAG-0021',name:'味方',category_id:'TGC-0005',runtime_semantic:'ALLY'},
  {id:'TAG-0022',name:'自分以外の味方',category_id:'TGC-0005',runtime_semantic:'OTHER_ALLY'},
  {id:'TAG-0023',name:'敵',category_id:'TGC-0005',runtime_semantic:'ENEMY'},
  {id:'TAG-0024',name:'生存',category_id:'TGC-0006',runtime_semantic:'ALIVE'},
  {id:'TAG-0025',name:'死亡',category_id:'TGC-0006',runtime_semantic:'DEAD'},
  {id:'TAG-0026',name:'HP',category_id:'TGC-0006',runtime_semantic:'HP'},
  {id:'TAG-0027',name:'MP',category_id:'TGC-0006',runtime_semantic:'MP'}
];
const project={data_version:dv,tag_categories:categories,tags,masters:{
  ai_searches:[{id:'AIS-0001',name:'探索',status:'active',data_version:dv,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:empty}],
  ai_conditions:[{id:'AIC-0004',name:'状態管理',status:'active',data_version:dv,evaluator:'condition.state_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{state_tag_id:{type:'string',ref_kind:'tag',ref_category_id:'TGC-0006'}},required:['state_tag_id'],additionalProperties:false}}],
  ai_actions:[{id:'AIA-0003',name:'待機',status:'active',data_version:dv,evaluator:'action.wait',ports:ports([]),parameter_schema:empty}],
  ai_target_selectors:[],skills:[]
}};
const node=(id,master,nodeType,parameters)=>({instance_id:id,master_node_id:master,master_data_version:dv,node_type:nodeType,position:{x:0,y:0},parameters,target_selector:null,comment:''});
const edge=(id,from,port,to)=>({edge_id:id,from:{node_id:from,port_id:port},transition_kind:'NODE',to:{node_id:to,port_id:'in'}});
const base=(id)=>({schema_version:'2.0.0',data_version:dv,id,name:id,version:1,status:'draft',entry_node_id:'',result_slots:[],nodes:[],edges:[],subroutines:[],tags:[],description:''});
(async()=>{
  const conditionRows=Validator.playerConditionTags(project);
  assert.deepStrictEqual([...new Set(conditionRows.map(row=>row.category_name))],['能力変化','継続ダメ','状態異常','防御効果','状態管理']);
  assert.strictEqual(conditionRows.some(row=>row.category_id==='TGC-0005'),false,'Target category must not appear in Player condition candidates');
  const targets=Validator.searchTargetTags(project);assert.deepStrictEqual(targets.map(row=>row.id),['TAG-0020','TAG-0021','TAG-0022','TAG-0023']);assert.strictEqual(new Set(targets.map(row=>row.category_id)).size,1);
  const ambiguous=JSON.parse(JSON.stringify(project));ambiguous.tag_categories.push({id:'TGC-9999',name:'誤配置'});ambiguous.tags.find(row=>row.id==='TAG-0023').category_id='TGC-9999';assert.deepStrictEqual(Validator.searchTargetTags(ambiguous),[],'Target tags split across categories must fail closed');

  const search=base('AIP-P12-SEARCH');search.entry_node_id='S';search.nodes=[
    node('S','AIS-0001','search',{target_tag_id:'TAG-0023',tag_condition:{tag_id:'TAG-0026',params:{value_mode:'RATIO',operator:'<=',value:.3}}}),
    node('T','AIA-0003','action',{}),node('F','AIA-0003','action',{})
  ];search.edges=[edge('E1','S','found','T'),edge('E2','S','not_found','F')];
  let validation=Validator.validate(search,project);assert(validation.valid,JSON.stringify(validation.issues));
  const searchRuntime=await Compiler.compile(search,project),searchInstruction=searchRuntime.instructions.find(row=>row.source_node_id==='S');assert.strictEqual(searchInstruction.params.scope,'ENEMY');assert.deepStrictEqual(searchInstruction.params.tag_condition,{kind:'PREDICATE',evaluator:'condition.state_compare',params:{operator:'<=',state_semantic:'HP',value:.3,value_mode:'RATIO'}});
  const searchResult=Runtime.decide(searchRuntime,{battle_id:'B-P12-S',actor_id:'ALLY-1',units:[
    {id:'ALLY-1',side:'ALLY',alive:true,hp:100,maxHp:100,mp:20,maxMp:20,formationPosition:'FRONTLINE'},
    {id:'ENEMY-LOW',side:'ENEMY',alive:true,hp:20,maxHp:100,mp:0,maxMp:0,formationPosition:'FRONTLINE'},
    {id:'ENEMY-HIGH',side:'ENEMY',alive:true,hp:80,maxHp:100,mp:0,maxMp:0,formationPosition:'FRONTLINE'}
  ]});
  const searchTrace=searchResult.trace.events.find(row=>row.event_type==='search');assert.deepStrictEqual(searchTrace.details.candidate_ids,['ENEMY-LOW'],'Search must evaluate current battle HP, not an authoring-time value');

  const state=base('AIP-P12-STATE');state.entry_node_id='C';state.nodes=[
    node('C','AIC-0004','condition',{tag_condition:{tag_id:'TAG-0008',params:{}}}),
    node('T','AIA-0003','action',{}),node('F','AIA-0003','action',{})
  ];state.edges=[edge('E3','C','true','T'),edge('E4','C','false','F')];
  validation=Validator.validate(state,project);assert(validation.valid,JSON.stringify(validation.issues));
  const stateRuntime=await Compiler.compile(state,project),stateInstruction=stateRuntime.instructions.find(row=>row.source_node_id==='C');assert.deepStrictEqual(stateInstruction.params,{subject_scope:'SELF',tag_condition:{kind:'PREDICATE',evaluator:'condition.active_effect_has_tag',params:{effect_scope:'ANY_ACTIVE_EFFECT',tag_id:'TAG-0008'}}});
  const effect={source_skill_id:'SKL-0001',source_effect_index:0,effect_tag_ids:['TAG-0008']};
  const stateResult=Runtime.decide(stateRuntime,{battle_id:'B-P12-C',actor_id:'ALLY-1',units:[{id:'ALLY-1',side:'ALLY',alive:true,hp:100,maxHp:100,mp:20,maxMp:20,formationPosition:'FRONTLINE',statusEffects:[effect]}]});
  assert.strictEqual(stateResult.trace.events.find(row=>row.event_type==='condition').result,'true','StateCheck must read the current active-effect tags from the actor at runtime');

  const authoring=JSON.stringify({search:search.nodes[0].parameters,state:state.nodes[0].parameters});
  for(const runtimeOnly of ['ENEMY-LOW','ENEMY-HIGH','statusEffects','current_hp','target_id'])assert.strictEqual(authoring.includes(runtimeOnly),false,`Runtime-only value leaked into Player AI authoring: ${runtimeOnly}`);
  assert(authoring.includes('TAG-0023')&&authoring.includes('TAG-0026')&&authoring.includes('TAG-0008'),'Authoring must retain Formal Tag references');
  console.log('PLAYER_UNIFIED_TAG_REFERENCE_R10_P12_OK condition_categories=5 target_category=unique search=current_hp statecheck=current_effect authoring=formal_refs runtime_values=not_persisted');
})().catch(error=>{console.error(error);process.exit(1);});
