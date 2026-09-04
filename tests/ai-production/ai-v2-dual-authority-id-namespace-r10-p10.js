#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Store=require('../../studio/ai-production/ai-program-store.js');
const ExportAdapter=require('../../studio/ai-production/ai-export-adapter.js');
const Bridge=require('../../game/assets/js/ai-save-bridge.js');
const Model=require('../../shared/ai/ai-program-model.js');
const Layout=require('../../shared/ai/ai-layout-model.js');

const dv='DV-P10';
function program(id,name='AI'){
  const row=Model.createProgram(id,'2026-09-03T00:00:00Z',dv);
  row.name=name;row.status='valid';row.entry_node_id='AIN-0001';
  row.nodes=[{instance_id:'AIN-0001',master_node_id:'AIA-0002',master_data_version:dv,node_type:'action',position:{x:0,y:0},parameters:{},target_selector:null,comment:''}];
  row.edges=[];row.subroutines=[];row.version=1;row.compiled=null;return row;
}
function layout(id,programId){const row=Layout.createLayout(id,programId,dv,8,8);row.chips.push({instance_id:'AIN-0001',x:0,y:0,rotation:0});return row;}
function character(id,name,binding=null){return{id,name,level:1,job:'剣士',base_hp:100,base_mp:30,stats:{HP:100,MP:30,STR:10,VIT:10,INT:10,MND:10,AGI:10,DEX:10,LUK:10},skills:[],equippedSkillId:'',formalAiBinding:binding,equipment:{weapon:null,armor:null,accessory:null},weaponStyle:'single',jobHistory:[],growthHistory:[],createdAt:'2026-09-03T00:00:00Z',formation_position:'FRONTLINE'};}
function saveBase(){const p=program('AIP-0002','Migrated Player AI'),l=layout('AIL-0002','AIP-0002');return{saveVersion:4,schemaRevision:'1.7.0',gameVersion:'GA-B486.212',createdAt:'2026-09-03T00:00:00Z',updatedAt:'2026-09-03T00:00:00Z',characters:[character('C-1','アルト',{program_id:'AIP-0002',layout_id:'AIL-0002'}),character('C-2','イルト',null)],aiPrograms:[p],aiLayouts:[l],aiPresets:[],partyIds:['C-1','C-2'],selectedQuestId:'',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null},flags:{},quest_progress:{completed_quest_ids:[],unlocked_quest_ids:[]},quest_resources:{},adventure:{quest_runs:[],active_quest_run_id:'',history_limit:20,stone_selection_by_quest:{}},gameSettings:{},tutorialProgress:{}};}

(()=>{
  // Current deployed data already occupies Developer 0001 and migrated Player 0002.
  const developerProgram=program('AIP-0001','Developer AI');
  const developerLayout=layout('AIL-0001','AIP-0001');
  const project={ai_programs:[developerProgram],ai_program_layouts:[developerLayout],ai_program_runtime:[]};
  assert.strictEqual(Store.nextProgramId(project),'AIP-0003','Developer Program allocation must stay in odd namespace');
  assert.strictEqual(Store.nextLayoutId(project),'AIL-0003','Developer Layout allocation must stay in odd namespace');
  const duplicate=Store.duplicateBundle(project,'AIP-0001','2026-09-03T00:01:00Z');
  assert.strictEqual(duplicate.program.id,'AIP-0003');assert.strictEqual(duplicate.layout.layout_id,'AIL-0003');

  // Formal Export rejects imported/malformed Developer assets that enter Player even namespace.
  const badProgram=program('AIP-0002','Invalid Developer Even ID'),badLayout=layout('AIL-0002','AIP-0002');
  const exportIssues=ExportAdapter.collectIssues({ai_programs:[badProgram],ai_program_layouts:[badLayout],ai_program_runtime:[]},dv);
  assert(exportIssues.some(row=>row.code==='AI_EXPORT_DEVELOPER_PROGRAM_ID_NAMESPACE'));
  assert(exportIssues.some(row=>row.code==='AI_EXPORT_DEVELOPER_LAYOUT_ID_NAMESPACE'));

  // Existing migrated Player 0002 remains valid alongside Developer 0001/0003.
  let save=saveBase();assert.deepStrictEqual(Bridge.validateCurrent(save),[]);
  const catalog={schema_version:'2.0.0',data_version:dv,developer_programs:[developerProgram,duplicate.program],developer_program_layouts:[developerLayout,duplicate.layout],developer_program_runtime:[]};
  const authority=Bridge.bindingAuthority(save,catalog,save.characters[0].formalAiBinding);
  assert.strictEqual(authority.status,'resolved');assert.strictEqual(authority.source,'player');
  assert.strictEqual(Bridge.nextPlayerProgramId(save,catalog),'AIP-0004','Player Program allocation must stay in even namespace');
  assert.strictEqual(Bridge.nextPlayerLayoutId(save,catalog),'AIL-0004','Player Layout allocation must stay in even namespace');

  // New Player authoring allocates 0004, never colliding with Developer 0003.
  const draftProgram=program('AIP-9998','New Player AI'),draftLayout=layout('AIL-9998','AIP-9998');
  const staged=Bridge.saveForCharacter(save,'C-2',draftProgram,draftLayout,{catalog,now:'2026-09-03T00:02:00Z'});
  assert.strictEqual(staged.binding.program_id,'AIP-0004');assert.strictEqual(staged.binding.layout_id,'AIL-0004');
  assert.deepStrictEqual(Bridge.validateCurrent(staged.save),[]);

  // Game Save rejects Player assets placed in the Developer odd namespace.
  const invalid=saveBase();invalid.aiPrograms[0].id='AIP-0003';invalid.aiLayouts[0].layout_id='AIL-0003';invalid.aiLayouts[0].program_id='AIP-0003';invalid.characters[0].formalAiBinding={program_id:'AIP-0003',layout_id:'AIL-0003'};
  const saveIssues=Bridge.validateCurrent(invalid);
  assert(saveIssues.some(message=>message.includes('even AIP numeric namespace')));
  assert(saveIssues.some(message=>message.includes('even AIL numeric namespace')));

  // Defense in depth remains fail-closed if an externally malformed Developer catalog collides anyway.
  const collisionProgram=program('AIP-0002','Malformed Colliding Developer AI'),collisionLayout=layout('AIL-0002','AIP-0002');
  const collisionRuntime={schema_version:'2.0.0',data_version:dv,program_id:'AIP-0002',program_version:1};
  const collisionCatalog={schema_version:'2.0.0',data_version:dv,developer_programs:[collisionProgram],developer_program_layouts:[collisionLayout],developer_program_runtime:[collisionRuntime]};
  assert.strictEqual(Bridge.bindingAuthority(save,collisionCatalog,save.characters[0].formalAiBinding).status,'ambiguous');

  console.log('AI_V2_DUAL_AUTHORITY_ID_NAMESPACE_R10_P10_OK developer_next=AIP-0003/AIL-0003 player_existing=AIP-0002/AIL-0002 player_next=AIP-0004/AIL-0004 export_even_reject=1 save_odd_reject=1 ambiguous_fail_closed=1');
})();
