#!/usr/bin/env node
'use strict';
const assert=require('assert');
const V=require('../../shared/ai/ai-program-validator.js');
const C=require('../../shared/ai/ai-program-compiler.js');
const E=require('../../shared/ai/ai-decision-engine.js');
const P=require('../../shared/ai/ai-program-model.js');
const X=require('../../shared/ai/ai-connection-resolver.js');
const ports=(outputs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outputs.map((id)=>({id,kind:'flow',data_type:'flow'}))});
const dv='dv-p3';
const masters={
  ai_searches:[{id:'AIS-EXISTS',name:'探索',status:'active',data_version:dv,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}}],
  ai_conditions:[
    {id:'AIC-HP',name:'HP比較',status:'active',data_version:dv,evaluator:'condition.hp_ratio_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{operator:{type:'string',enum:['<']},value:{type:'number',minimum:0,maximum:1}},required:['operator','value'],additionalProperties:false}},
    {id:'AIC-DEAD',name:'死亡',status:'active',data_version:dv,evaluator:'condition.dead',supported_subject_kind:['UNIT'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}},
    {id:'AIC-BATTLE',name:'戦闘状態',status:'active',data_version:dv,evaluator:'condition.enemy_count_at_most',supported_subject_kind:['BATTLE'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{count:{type:'integer',minimum:0}},required:['count'],additionalProperties:false}}
  ],
  ai_actions:[
    {id:'AIA-SKILL',name:'Skill',status:'active',data_version:dv,evaluator:'action.skill',ports:ports([]),parameter_schema:{type:'object',properties:{skill_id:{type:'string',ref_kind:'skill'}},required:['skill_id'],additionalProperties:false}},
    {id:'AIA-ATTACK',name:'Attack',status:'active',data_version:dv,evaluator:'action.attack',ports:ports([]),parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}},
    {id:'AIA-WAIT',name:'Wait',status:'active',data_version:dv,evaluator:'action.wait',ports:ports([]),parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}}
  ],
  ai_target_selectors:[
    {id:'ATS-LOW',name:'低HP',evaluator:'selector.lowest_hp_ratio',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},tags:[],enabled:true},
    {id:'ATS-HIGH',name:'高HP',evaluator:'selector.highest_hp_ratio',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},tags:[],enabled:true},
    {id:'ATS-RANDOM',name:'Random',evaluator:'selector.random',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},tags:[],enabled:true}
  ],
  skills:[
    {id:'SKL-BACK',name:'Back',runtimeContracts:{targetContract:{side:'ENEMY',range:'BACK'}}},
    {id:'SKL-FRONT',name:'Front',runtimeContracts:{targetContract:{side:'ENEMY',range:'FRONT'}}},
    {id:'SKL-RANDOM',name:'RandomRange',runtimeContracts:{targetContract:{side:'ENEMY',range:'RANDOM'}}},
    {id:'SKL-SELF',name:'Self',runtimeContracts:{targetContract:{side:'SELF',range:'SINGLE'}}}
  ]
};
const project={tags:[],masters};
const clause=(id,params={})=>({predicate_master_id:id,params,negate:false});
const pred=(logic,clauses)=>({logic,clauses});
const node=(id,master,type,parameters,target_selector)=>({instance_id:id,master_node_id:master,master_data_version:dv,node_type:type,position:{x:0,y:0},parameters,...(target_selector!==undefined?{target_selector}:{})});
const edge=(id,from,port,to)=>({edge_id:id,from:{node_id:from,port_id:port},transition_kind:'NODE',to:{node_id:to,port_id:'in'}});
function baseProgram(){return {schema_version:'2.0.0',data_version:dv,id:'AIP-P3',name:'P3',version:1,status:'valid',entry_node_id:'N1',nodes:[],edges:[],subroutines:[]};}
function predicateHandler(ev,p,subject,kind,ctx){
  if(ev==='condition.hp_ratio_compare') return subject.hp/subject.max_hp < p.value;
  if(ev==='condition.dead') return subject.alive===false;
  if(ev==='condition.enemy_count_at_most') {const actor=ctx.units.find((row)=>row.id===ctx.actor_id);return ctx.units.filter((row)=>row.side!==actor.side).length<=p.count;}
  return false;
}
(async()=>{
  assert.strictEqual(P.SCHEMA_VERSION,'2.0.0');
  assert.strictEqual(P.normalizeProgram({id:'AIP-X'}).schema_version,'2.0.0');
  assert.strictEqual(P.normalizeProgram({id:'AIP-X'}).data_version,'','data_version must not be guessed from schema version');
  assert.deepStrictEqual(X.BASE_PORT_SIDES.search,{in:'west',found:'east',not_found:'south'});
  assert.strictEqual(Object.hasOwn(X.BASE_PORT_SIDES,'target'),false);

  assert.strictEqual(V.selectorRequirement({actionEvaluator:'action.attack'}),'REQUIRED');
  assert.strictEqual(V.selectorRequirement({actionEvaluator:'action.skill',targetContract:{side:'ENEMY',range:'SINGLE'}}),'REQUIRED');
  assert.strictEqual(V.selectorRequirement({actionEvaluator:'action.skill',targetContract:{side:'ENEMY',range:'BACK'}}),'REQUIRED');
  for(const range of ['FRONT','ALL','RANDOM']) assert.strictEqual(V.selectorRequirement({actionEvaluator:'action.skill',targetContract:{side:'ENEMY',range}}),'FORBIDDEN');
  assert.strictEqual(V.selectorRequirement({actionEvaluator:'action.skill',targetContract:{side:'SELF',range:'SINGLE'}}),'FORBIDDEN');
  assert.strictEqual(V.selectorRequirement({actionEvaluator:'action.wait'}),'FORBIDDEN');

  const p=baseProgram();
  p.nodes=[
    node('N1','AIS-EXISTS','search',{scope:'ENEMY',predicate:pred('ANY',[clause('AIC-DEAD'),clause('AIC-HP',{operator:'<',value:.25})])}),
    node('N2','AIA-SKILL','action',{skill_id:'SKL-BACK'},{selector_id:'ATS-LOW',params:{}}),
    node('N3','AIA-WAIT','action',{})
  ];
  p.edges=[edge('E1','N1','found','N2'),edge('E2','N1','not_found','N3')];
  const vr=V.validate(p,project);assert(vr.valid,JSON.stringify(vr.issues));
  const runtime=await C.compile(p,project);assert.strictEqual(runtime.schema_version,'2.0.0');assert.strictEqual(runtime.instructions.some((row)=>row.op==='TARGET'),false);assert.strictEqual(runtime.instructions[0].op,'SEARCH');
  await assert.rejects(()=>C.compile(p,project,{max_steps:128}),error=>error.name==='AIProgramCompilerError');
  let rngCalls=0;
  const context={battle_id:'B1',actor_id:'U1',seed:7,units:[{id:'U1',side:'A',alive:true,hp:100,max_hp:100},{id:'U2',side:'B',alive:false,hp:0,max_hp:100},{id:'U3',side:'B',alive:true,hp:20,max_hp:100},{id:'U4',side:'B',alive:true,hp:20,max_hp:100}],target_selectors:masters.ai_target_selectors};
  const before=structuredClone(context);
  const tr=E.execute(runtime,context,{predicate:predicateHandler,action:(ev,pa,ctx)=>({action_id:'skill:SKL-BACK',target_contract:{side:'ENEMY',range:'BACK'},legal_candidates:ctx.units.filter((row)=>row.side==='B'&&row.alive!==false)}),ai_decision_rng:()=>{rngCalls+=1;return .5;}});
  assert.deepStrictEqual(context,before,'decision input must remain immutable');
  assert.strictEqual(rngCalls,0,'Search/Predicate and deterministic selector must consume no RNG');
  assert.strictEqual(tr.outcome.target_id,'U3','deterministic selector tie-break must use unit_id ascending');
  const searchEvent=tr.events.find((row)=>row.event_type==='search');assert.deepStrictEqual(searchEvent.details.candidate_ids,['U2','U3','U4']);
  assert.strictEqual(tr.events.some((row)=>row.event_type==='action'&&row.details.target_id==='U2'),false,'Search candidate must not propagate as Action target context');

  const pr=baseProgram();pr.id='AIP-RND';pr.entry_node_id='A';pr.nodes=[node('A','AIA-SKILL','action',{skill_id:'SKL-BACK'},{selector_id:'ATS-RANDOM',params:{}})];
  const rr=await C.compile(pr,project);let calls=0;
  const randomTrace=E.execute(rr,context,{action:(ev,pa,ctx)=>({action_id:'skill:SKL-BACK',target_contract:{side:'ENEMY',range:'BACK'},legal_candidates:[ctx.units[3],ctx.units[2]]}),ai_decision_rng:()=>{calls+=1;return .75;}});
  assert.strictEqual(calls,1);assert.strictEqual(randomTrace.outcome.target_id,'U4');assert(randomTrace.events.some((row)=>row.event_type==='rng'&&row.rng_stream==='AI_DECISION'));
  const forbidden=baseProgram();forbidden.id='AIP-F';forbidden.entry_node_id='A';forbidden.nodes=[node('A','AIA-SKILL','action',{skill_id:'SKL-RANDOM'},{selector_id:'ATS-RANDOM',params:{}})];
  const fv=V.validate(forbidden,project);assert.strictEqual(fv.valid,false);assert(fv.issues.some((row)=>row.code==='AI_SELECTOR_FORBIDDEN'));

  const ps=baseProgram();ps.id='AIP-STATE';ps.entry_node_id='S1';ps.nodes=[
    node('S1','AIC-HP','condition',{subject_scope:'SELF',predicate:pred('ALL',[clause('AIC-HP',{operator:'<',value:.5})])}),
    node('S2','AIC-BATTLE','condition',{subject_scope:'BATTLE',predicate:pred('ALL',[clause('AIC-BATTLE',{count:3})])}),
    node('S3','AIA-WAIT','action',{}),node('S4','AIA-WAIT','action',{}),node('S5','AIA-WAIT','action',{})
  ];
  ps.edges=[edge('ES1','S1','true','S2'),edge('ES2','S1','false','S4'),edge('ES3','S2','true','S3'),edge('ES4','S2','false','S5')];
  const sv=V.validate(ps,project);assert(sv.valid,JSON.stringify(sv.issues));
  const sr=await C.compile(ps,project);const stateContext={...context,units:structuredClone(context.units)};stateContext.units[0].hp=40;let stateRng=0;
  const stateTrace=E.execute(sr,stateContext,{predicate:predicateHandler,action:()=>({wait:true}),ai_decision_rng:()=>{stateRng+=1;return 0;}});assert.strictEqual(stateTrace.outcome.status,'wait');assert.strictEqual(stateRng,0);assert.strictEqual(stateTrace.events.filter((row)=>row.event_type==='condition').length,2);

  const merge=baseProgram();merge.id='AIP-MERGE';merge.nodes=[node('N1','AIS-EXISTS','search',{scope:'SELF',predicate:pred('ALL',[clause('AIC-HP',{operator:'<',value:1})])}),node('N2','AIA-WAIT','action',{})];merge.edges=[edge('EM1','N1','found','N2'),edge('EM2','N1','not_found','N2')];
  assert.strictEqual(V.validate(merge,project).valid,true,'multiple incoming transitions may converge on the same input; only output ambiguity is forbidden');

  const sub=baseProgram();sub.id='AIP-SUB';sub.entry_node_id='Q1';sub.nodes=[
    node('Q1','AIS-EXISTS','search',{scope:'SELF',predicate:pred('ALL',[clause('AIC-HP',{operator:'<',value:1})])}),
    node('Q2','AIC-HP','condition',{subject_scope:'SELF',predicate:pred('ALL',[clause('AIC-HP',{operator:'<',value:1})])}),
    node('Q3','AIA-WAIT','action',{}),node('Q4','AIA-WAIT','action',{})
  ];
  sub.edges=[
    {edge_id:'ECALL',from:{node_id:'Q1',port_id:'found'},transition_kind:'CALL',subroutine_id:'SUB-1',return_to:{node_id:'Q3',port_id:'in'}},
    edge('ENOT','Q1','not_found','Q4'),
    {edge_id:'ER1',from:{node_id:'Q2',port_id:'true'},transition_kind:'RETURN'},
    {edge_id:'ER2',from:{node_id:'Q2',port_id:'false'},transition_kind:'RETURN'}
  ];
  sub.subroutines=[{id:'SUB-1',entry_node_id:'Q2'}];
  const subv=V.validate(sub,project);assert(subv.valid,JSON.stringify(subv.issues));const subRuntime=await C.compile(sub,project);assert.strictEqual(subRuntime.limits.max_subroutine_depth,1);assert(subRuntime.limits.max_steps>=5);
  const subTrace=E.execute(subRuntime,{...context,units:[{id:'U1',side:'A',alive:true,hp:1,max_hp:2}],target_selectors:[]},{predicate:predicateHandler,action:()=>({wait:true})});
  assert(subTrace.events.some((row)=>row.event_type==='call'&&row.result==='entered'&&row.origin_part_id==='ECALL'));assert(subTrace.events.some((row)=>row.event_type==='call'&&row.result==='returned'&&['ER1','ER2'].includes(row.origin_part_id)));

  console.log('AI_V2_R10_P3_SHARED_RUNTIME_OK search=1 predicate_all_any=1 state_self_battle=1 selector_matrix=1 selector_rng=AI_DECISION tie_break=unit_id candidate_trace_only=1 readonly=1 call_return=1 compiler_limits=derived target_op=0 multi_inbound=1');
})().catch((error)=>{console.error(error);process.exit(1);});
