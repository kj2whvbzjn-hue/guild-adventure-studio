#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Model=require('../../shared/ai/ai-program-model.js');
const Adapter=require('../../shared/ai/ai-master-adapter.js');
const Editor=require('../../studio/ai-production/ai-program-editor.js');
const Store=require('../../studio/ai-production/ai-program-store.js');
const Validator=require('../../shared/ai/ai-program-validator.js');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const ExportAdapter=require('../../studio/ai-production/ai-export-adapter.js');
const root=path.resolve(__dirname,'../..');
const dv='DV-P7';
const ports=(outputs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outputs.map((id)=>({id,kind:'flow',data_type:'flow'}))});
const emptySchema={type:'object',properties:{},required:[],additionalProperties:false};
const project={
  project:{id:'PRJ-P7',data_version:dv}, data_version:dv, tags:[{id:'TAG-P7',name:'P7'}],
  ai_programs:[],ai_program_layouts:[],ai_program_runtime:[],
  masters:{
    ai_searches:[{id:'AIS-EXISTS',name:'探索',status:'active',data_version:dv,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:emptySchema}],
    ai_conditions:[{id:'AIC-HP',name:'HP割合',status:'active',data_version:dv,evaluator:'condition.hp_ratio_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{operator:{type:'string',enum:['<']},value:{type:'number',minimum:0,maximum:1}},required:['operator','value'],additionalProperties:false}}],
    ai_actions:[
      {id:'AIA-SKILL',name:'Skill',status:'active',data_version:dv,evaluator:'action.skill',ports:ports([]),parameter_schema:{type:'object',properties:{skill_id:{type:'string',ref_kind:'skill'}},required:['skill_id'],additionalProperties:false}},
      {id:'AIA-WAIT',name:'Wait',status:'active',data_version:dv,evaluator:'action.wait',ports:ports([]),parameter_schema:emptySchema}
    ],
    ai_target_selectors:[{id:'ATS-LOW',name:'低HP',evaluator:'selector.lowest_hp_ratio',parameter_schema:emptySchema,tags:[],enabled:true}],
    skills:[{id:'SKL-P7',name:'P7 Skill',runtimeContracts:{targetContract:{side:'ENEMY',range:'SINGLE'}}}]
  }
};
const defs=Adapter.palette(project.masters,'',{data_version:dv});
const byId=(id)=>defs.find((row)=>row.id===id);
const program=Model.createProgram('AIP-0001','2026-09-03T00:00:00Z',dv);
program.name='P7 Developer Program';
const session=Editor.create(program);
assert.throws(()=>session.addNode({id:'AIT-OLD',node_type:'target',data_version:dv}),/Valid AI V2 master definition/,'Target box must not be authorable');
const search=session.addNode(byId('AIS-EXISTS'),{scope:'ENEMY',predicate:{logic:'ANY',clauses:[{predicate_master_id:'AIC-HP',params:{operator:'<',value:.5},negate:false}]}},{x:0,y:0});
const skill=session.addNode(byId('AIA-SKILL'),{skill_id:'SKL-P7'},{x:3,y:0});
session.updateNode(skill.instance_id,{target_selector:{selector_id:'ATS-LOW',params:{}}});
const condition=session.addNode(byId('AIC-HP'),{subject_scope:'SELF',predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-HP',params:{operator:'<',value:.25},negate:true}]}},{x:1,y:3});
const wait=session.addNode(byId('AIA-WAIT'),{},{x:4,y:3});
session.setEntryNode(search.instance_id);
const sub=session.addSubroutine(condition.instance_id,'SUB-1');
assert.strictEqual(sub.id,'SUB-1');
const eFound=session.connect({node_id:search.instance_id,port_id:'found'},{node_id:skill.instance_id,port_id:'in'});
const eCall=session.connectCall({node_id:search.instance_id,port_id:'not_found'},'SUB-1',{node_id:wait.instance_id,port_id:'in'});
const eTrue=session.connectReturn({node_id:condition.instance_id,port_id:'true'});
const eFalse=session.connectReturn({node_id:condition.instance_id,port_id:'false'});
assert.strictEqual(eFound.transition_kind,'NODE');assert.strictEqual(eCall.transition_kind,'CALL');assert.strictEqual(eTrue.transition_kind,'RETURN');assert.strictEqual(eFalse.transition_kind,'RETURN');
assert.throws(()=>session.connect({node_id:search.instance_id,port_id:'found'},{node_id:wait.instance_id,port_id:'in'}),/Output already has a transition/);
let authored=session.program(); authored.status='valid'; authored.updated_at='2026-09-03T00:01:00Z';
const vr=Validator.validate(authored,project);assert(vr.valid,JSON.stringify(vr.issues));
(async()=>{
  const runtime=await Compiler.compile(authored,project);
  assert.strictEqual(runtime.schema_version,'2.0.0');
  assert.strictEqual(runtime.data_version,dv);
  assert(runtime.instructions.some((row)=>row.op==='CALL'));
  assert(runtime.instructions.some((row)=>row.op==='RETURN'));
  assert.strictEqual(runtime.instructions.some((row)=>row.op==='TARGET'),false);
  const callInstruction=runtime.instructions.find((row)=>row.op==='CALL');
  assert.strictEqual(callInstruction.origin_part_id,eCall.edge_id);
  assert.strictEqual(runtime.source_map[callInstruction.instruction_id].source_node_id,search.instance_id);

  const layout=Store.layoutFromProgram(authored,null,'AIL-0001');
  const saved=Store.upsertBundle(project,{program:authored,layout,runtime});
  assert.strictEqual(project.ai_programs.length,1);assert.strictEqual(project.ai_program_layouts.length,1);assert.strictEqual(project.ai_program_runtime.length,1);
  assert.strictEqual(saved.program.compiled,null,'compiled runtime must not be embedded in canonical Program');
  const reopened=Store.bundle(project,'AIP-0001');
  assert.deepStrictEqual(reopened.layout,layout);assert.deepStrictEqual(reopened.runtime,runtime);
  const exported=ExportAdapter.build(project);assert.strictEqual(exported.programs.length,1);assert.strictEqual(exported.layouts.length,1);assert.strictEqual(exported.runtimes.length,1);
  assert.deepStrictEqual(ExportAdapter.collectIssues(project,dv),[]);
  const duplicate=Store.duplicateBundle(project,'AIP-0001','2026-09-03T00:02:00Z');
  assert.notStrictEqual(duplicate.program.id,authored.id);assert.notStrictEqual(duplicate.layout.layout_id,layout.layout_id);assert.strictEqual(duplicate.runtime,null);
  assert.strictEqual(project.ai_programs.length,1,'unsaved duplicate bundle must not mutate project data');

  const ui=fs.readFileSync(path.join(root,'studio/ai-production/ai-production-ui.js'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'studio/ai-production/manifest.json'),'utf8'));
  const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
  for(const text of ['使用可能部品','開発者作成AIプログラム本体','選択部品のパラメータ設定と検証結果','candidate','暗黙']) assert(ui.includes(text),`P7 UI contract missing: ${text}`);
  assert(ui.includes("transition_kind"));assert(ui.includes('origin_part_id'));assert(ui.includes('Formal Export'));
  assert(!ui.includes('localStorage'));
  assert.strictEqual(manifest.authoring_authority.program_type,'開発者作成AIプログラム');
  assert.strictEqual(manifest.authoring_authority.author,'Developer');
  assert.strictEqual(manifest.authoring_authority.player_facing,false);
  assert.strictEqual(manifest.authoring_authority.game_graph_authoring,false);
  assert(html.includes('R10 P7 Developer Authoring'));
  assert(html.includes('getDataVersion:()=>'));
  assert(html.includes('exportFormal:()=>exportPhpPackage()'));
  console.log('AI_V2_STUDIO_DEVELOPER_AUTHORING_R10_P7_OK developer_only=1 regions=3 boxes=search_condition_action predicate=1 ats=1 subroutine=1 bundle_roundtrip=1 trace_origin=1 formal_export=1 player_studio_authoring=0');
})().catch((error)=>{console.error(error);process.exit(1);});
