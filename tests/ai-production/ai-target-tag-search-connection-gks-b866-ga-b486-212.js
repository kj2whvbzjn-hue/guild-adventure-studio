#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const Validator=require('../../shared/ai/ai-program-validator.js');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const Engine=require('../../shared/ai/ai-decision-engine.js');
const ExportCore=require('../../studio/export-core.js');
const root=path.resolve(__dirname,'../..');
const dv='0.1.0-draft';
const ports=(outputs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outputs.map(id=>({id,kind:'flow',data_type:'flow'}))});
const empty={type:'object',properties:{},required:[],additionalProperties:false};
const project={
  tag_categories:[{id:'TGC-0005',name:'対象'}],
  tags:[
    {id:'TAG-0020',name:'自分',category_id:'TGC-0005',runtime_semantic:'SELF'},
    {id:'TAG-0021',name:'味方',category_id:'TGC-0005',runtime_semantic:'ALLY'},
    {id:'TAG-0022',name:'自分以外の味方',category_id:'TGC-0005',runtime_semantic:'OTHER_ALLY'},
    {id:'TAG-0023',name:'敵',category_id:'TGC-0005',runtime_semantic:'ENEMY'}
  ],
  masters:{
    skills:[],ai_target_selectors:[],
    ai_searches:[{schema_version:'2.0.0',id:'AIS-0001',name:'探索',node_type:'search',status:'active',data_version:dv,description:'',tags:[],evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:empty,unlock:{}}],
    ai_conditions:[{schema_version:'2.0.0',id:'AIC-0001',name:'生存',node_type:'condition',status:'active',data_version:dv,description:'',tags:[],evaluator:'condition.alive',supported_subject_kind:['UNIT'],ports:ports(['true','false']),parameter_schema:empty,unlock:{}}],
    ai_actions:[{schema_version:'2.0.0',id:'AIA-0001',name:'待機',node_type:'action',status:'active',data_version:dv,description:'',tags:[],evaluator:'action.wait',ports:ports([]),parameter_schema:empty,unlock:{}}]
  }
};
const predicate={logic:'ALL',clauses:[{predicate_master_id:'AIC-0001',params:{},negate:false}]};
const program={schema_version:'2.0.0',data_version:dv,id:'AIP-TEST',name:'Target Tag Search',version:1,status:'valid',entry_node_id:'N1',nodes:[
  {instance_id:'N1',master_node_id:'AIS-0001',master_data_version:dv,node_type:'search',position:{x:0,y:0},parameters:{target_tag_id:'TAG-0022',predicate},target_selector:null,comment:''},
  {instance_id:'N2',master_node_id:'AIA-0001',master_data_version:dv,node_type:'action',position:{x:1,y:0},parameters:{},target_selector:null,comment:''}
],edges:[
  {edge_id:'E1',from:{node_id:'N1',port_id:'found'},transition_kind:'NODE',to:{node_id:'N2',port_id:'in'}},
  {edge_id:'E2',from:{node_id:'N1',port_id:'not_found'},transition_kind:'NODE',to:{node_id:'N2',port_id:'in'}}
],subroutines:[],tags:[],description:''};

(async()=>{
  const targetRows=Validator.searchTargetTags(project);
  assert.deepStrictEqual(targetRows.map(x=>x.id),['TAG-0020','TAG-0021','TAG-0022','TAG-0023']);
  assert.strictEqual(Validator.resolveSearchTargetTag('TAG-0022',project).scope,'OTHER_ALLY');
  const validation=Validator.validate(program,project);assert.strictEqual(validation.valid,true,JSON.stringify(validation.issues));
  const runtime=await Compiler.compile(program,project);
  assert.strictEqual(runtime.instructions[0].params.scope,'OTHER_ALLY');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(runtime.instructions[0].params,'target_tag_id'),false,'runtime must consume semantic scope, not authoring tag id');
  const ctx={battle_id:'B',actor_id:'A1',units:[{id:'A1',side:'ALLY',alive:true},{id:'A2',side:'ALLY',alive:true},{id:'E1',side:'ENEMY',alive:true}]};
  assert.deepStrictEqual(Engine.searchPopulation(ctx,'OTHER_ALLY').map(x=>x.id),['A2']);
  const trace=Engine.execute(runtime,ctx,{predicate:(e,p,subject)=>subject.alive===true,action:()=>({wait:true})});
  assert.deepStrictEqual(trace.events.find(x=>x.event_type==='search').details.candidate_ids,['A2']);

  const bad=structuredClone(program);bad.nodes[0].parameters.target_tag_id='TAG-9999';
  assert(Validator.validate(bad,project).issues.some(x=>x.code==='AI_SEARCH_TARGET_TAG_INVALID'));
  const noSemantic=structuredClone(project);noSemantic.tags.push({id:'TAG-0099',name:'意味なし',category_id:'TGC-0005'});const invalid=structuredClone(program);invalid.nodes[0].parameters.target_tag_id='TAG-0099';
  assert(Validator.validate(invalid,noSemantic).issues.some(x=>x.code==='AI_SEARCH_TARGET_TAG_INVALID'));

  const gameUi=fs.readFileSync(path.join(root,'game/assets/js/ai-editor-ui.js'),'utf8');
  assert(gameUi.includes('data-ai-search-target-tag'));
  assert(gameUi.includes('searchTargetSelectHtml'));
  assert(!gameUi.includes("['','SELF','ALLY','ENEMY','ANY']"),'Player UI must not hardcode runtime scope labels');
  assert(gameUi.includes('<span>対象 <span class="required">必須</span>'));

  const studioHtml=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
  assert(studioHtml.includes('id="tagMasterRuntimeSemantic"'));
  assert(studioHtml.includes('AI対象Runtime意味（任意）'));
  const start=studioHtml.indexOf('function phpExportEnvelope('),end=studioHtml.indexOf('\nfunction validateExportIds',start);
  assert(start>=0&&end>start,'phpExportEnvelope extraction failed');
  const context={GKExportCore:ExportCore,data:project,DISTRIBUTION_BUILD:'GKS-B868'};
  vm.createContext(context);vm.runInContext(studioHtml.slice(start,end),context);
  const env=context.phpExportEnvelope('ai/ai_nodes.json',project.masters.ai_searches,dv,'2026-09-04T00:00:00Z');
  assert.strictEqual(env.schema_version,'2.0.0');
  assert.strictEqual(env.refs.tag_categories[0].id,'TGC-0005');
  assert.strictEqual(env.refs.tags.find(x=>x.id==='TAG-0023').runtime_semantic,'ENEMY');

  const build=JSON.parse(fs.readFileSync(path.join(root,'package-build.json'),'utf8'));
  assert.strictEqual(build.studio_build,'GKS-B868');assert.strictEqual(build.game_build,'GA-B486.214');
  console.log('AI_TARGET_TAG_SEARCH_CONNECTION_OK tag_authoring=1 compiler_semantic=1 other_ally_runtime=1 player_ui_data_driven=1 deploy_refs=1 ai_schema=2.0.0');
})().catch(error=>{console.error(error);process.exit(1)});
