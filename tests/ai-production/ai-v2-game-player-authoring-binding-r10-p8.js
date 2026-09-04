#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Loader=require('../../game/assets/js/ai-catalog-loader.js');
const UI=require('../../game/assets/js/ai-editor-ui.js');
const Bridge=require('../../game/assets/js/ai-save-bridge.js');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const Model=require('../../shared/ai/ai-program-model.js');
const Layout=require('../../shared/ai/ai-layout-model.js');
const root=path.resolve(__dirname,'../..');
const dv='DV-P8';
const ports=(outputs)=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:outputs.map((id)=>({id,kind:'flow',data_type:'flow'}))});
const emptySchema={type:'object',properties:{},required:[],additionalProperties:false};
const nodes=[
 {id:'AIS-0001',name:'探索',node_type:'search',status:'active',data_version:dv,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:emptySchema},
 {id:'AIC-0001',name:'HP割合',node_type:'condition',status:'active',data_version:dv,evaluator:'condition.hp_ratio_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{operator:{type:'string',enum:['<']},value:{type:'number',minimum:0,maximum:1}},required:['operator','value'],additionalProperties:false}},
 {id:'AIA-0001',name:'Skill',node_type:'action',status:'active',data_version:dv,evaluator:'action.skill',ports:ports([]),parameter_schema:{type:'object',properties:{skill_id:{type:'string',ref_kind:'skill'}},required:['skill_id'],additionalProperties:false}},
 {id:'AIA-0002',name:'Wait',node_type:'action',status:'active',data_version:dv,evaluator:'action.wait',ports:ports([]),parameter_schema:emptySchema}
];
const selectors=[{id:'ATS-0001',name:'低HP',evaluator:'selector.lowest_hp_ratio',parameter_schema:emptySchema,tags:[],enabled:true}];
const skills=[{id:'SKL-P8',name:'P8 Skill',runtimeContracts:{targetContract:{side:'ENEMY',range:'SINGLE'}}}];
const targetCategories=[{id:'TGC-TARGET',name:'対象'}];
const targetTags=[
 {id:'TAG-TGT-SELF',name:'自分',category_id:'TGC-TARGET',runtime_semantic:'SELF'},
 {id:'TAG-TGT-ALLY',name:'味方',category_id:'TGC-TARGET',runtime_semantic:'ALLY'},
 {id:'TAG-TGT-OTHER-ALLY',name:'自分以外の味方',category_id:'TGC-TARGET',runtime_semantic:'OTHER_ALLY'},
 {id:'TAG-TGT-ENEMY',name:'敵',category_id:'TGC-TARGET',runtime_semantic:'ENEMY'}
];

function saveBase(){return{saveVersion:4,schemaRevision:'1.7.0',gameVersion:'GA-B486.214',createdAt:'2026-09-03T00:00:00Z',updatedAt:'2026-09-03T00:00:00Z',characters:[{id:'C-1',name:'冒険者',level:1,job:'剣士',base_hp:100,base_mp:30,stats:{HP:100,MP:30,STR:10,VIT:10,INT:10,MND:10,AGI:10,DEX:10,LUK:10},skills:['SKL-P8'],equippedSkillId:'SKL-P8',formalAiBinding:null,equipment:{weapon:null,armor:null,accessory:null},weaponStyle:'single',jobHistory:[],growthHistory:[],createdAt:'2026-09-03T00:00:00Z',formation_position:'FRONTLINE'}],aiPrograms:[],aiLayouts:[],aiPresets:[],partyIds:['C-1'],selectedQuestId:'',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null},flags:{},quest_progress:{completed_quest_ids:[],unlocked_quest_ids:[]},quest_resources:{},adventure:{quest_runs:[],active_quest_run_id:'',history_limit:20,stone_selection_by_quest:{}},gameSettings:{},tutorialProgress:{}};}
(async()=>{
 const baseCatalog={...Loader.normalize(nodes,selectors,skills,targetTags,targetCategories,[],[],[],[]),schema_version:'2.0.0',data_version:dv,warnings:[]};
 const session=UI.createSession(baseCatalog,{program_id:'AIP-DRAFT',layout_id:'AIL-0001',data_version:dv,now:'2026-09-03T00:00:00Z'});
 assert.strictEqual(UI.definitions(baseCatalog).some(row=>row.node_type==='target'),false,'Target box must not be authorable');
 const search=session.add('AIS-0001',{target_tag_id:'TAG-TGT-ENEMY',predicate:{logic:'ANY',clauses:[{predicate_master_id:'AIC-0001',params:{operator:'<',value:.5},negate:false}]}},0,0);
 const skill=session.add('AIA-0001',{skill_id:'SKL-P8'},2,0);session.updateTargetSelector(skill.instance_id,{selector_id:'ATS-0001',params:{}});
 const state=session.add('AIC-0001',{subject_scope:'SELF',predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-0001',params:{operator:'<',value:.25},negate:true}]}},0,2);
 const wait=session.add('AIA-0002',{},2,2);
 session.setEntry(search.instance_id);session.addSubroutine(state.instance_id,'SUB-1');
 const e1=session.connect({node_id:search.instance_id,port_id:'found'},{node_id:skill.instance_id,port_id:'in'});
 const e2=session.connectCall({node_id:search.instance_id,port_id:'not_found'},'SUB-1',{node_id:wait.instance_id,port_id:'in'});
 session.connectReturn({node_id:state.instance_id,port_id:'true'});session.connectReturn({node_id:state.instance_id,port_id:'false'});
 session.setTransition(e1.edge_id,{node_id:search.instance_id,port_id:'found'},'NODE',{node_id:skill.instance_id,port_id:'in'});
 assert.strictEqual(e2.transition_kind,'CALL');
 const evaluation=session.evaluate();assert(evaluation.valid,JSON.stringify(evaluation.issues));
 const previewRuntime=await Compiler.compile(evaluation.program,UI.projectData(baseCatalog));assert(previewRuntime.instructions.some(row=>row.op==='SEARCH'));assert(previewRuntime.instructions.some(row=>row.op==='CALL'));assert(previewRuntime.instructions.some(row=>row.op==='RETURN'));assert.strictEqual(previewRuntime.instructions.some(row=>row.op==='TARGET'),false);
 let save=saveBase();const staged=Bridge.saveForCharacter(save,'C-1',evaluation.program,evaluation.layout,{catalog:baseCatalog,now:'2026-09-03T00:01:00Z'});const runtime=await Compiler.compile(staged.program,UI.projectData(baseCatalog));staged.program.compiled=runtime;staged.save.aiPrograms[0].compiled=runtime;assert.deepStrictEqual(Bridge.validateCurrent(staged.save),[]);save=staged.save;
 const playerState=Bridge.characterBindingAuthority(save,baseCatalog,'C-1');assert.strictEqual(playerState.status,'resolved');assert.strictEqual(playerState.source,'player');assert(playerState.runtime);
 const developerProgram=Model.createProgram('AIP-9000','2026-09-03T00:02:00Z',dv);developerProgram.name='Developer AI';developerProgram.status='valid';developerProgram.nodes=[{instance_id:'AIN-0001',master_node_id:'AIA-0002',master_data_version:dv,node_type:'action',position:{x:0,y:0},parameters:{},target_selector:null,comment:''}];developerProgram.entry_node_id='AIN-0001';developerProgram.version=1;
 const developerLayout=Layout.createLayout('AIL-9000',developerProgram.id,dv,8,8);developerLayout.chips.push({instance_id:'AIN-0001',x:0,y:0,rotation:0});
 const developerRuntime=await Compiler.compile(developerProgram,UI.projectData(baseCatalog));
 const catalog={...baseCatalog,developer_programs:[developerProgram],developer_program_layouts:[developerLayout],developer_program_runtime:[developerRuntime]};
 const equipped=Bridge.equipCharacterBinding(save,'C-1',{program_id:'AIP-9000',layout_id:'AIL-9000'},catalog);save=equipped.save;assert.strictEqual(equipped.source,'developer');assert.strictEqual(save.aiPrograms.some(row=>row.id==='AIP-9000'),false,'Developer Program graph must not be copied into Game Save');
 const developerState=Bridge.characterBindingAuthority(save,catalog,'C-1');assert.strictEqual(developerState.source,'developer');assert(developerState.runtime);assert.deepStrictEqual(save.characters[0].formalAiBinding,{program_id:'AIP-9000',layout_id:'AIL-9000'});assert.strictEqual(Object.prototype.hasOwnProperty.call(save.characters[0].formalAiBinding,'master_snapshot_id'),false);
 const actorResolution=Bridge.resolveRuntimeForActor({save,catalog,actor:{characterId:'C-1'}});assert.strictEqual(actorResolution.program_source,'developer');
 const cleared=Bridge.clearCharacterBinding(save,'C-1');assert.strictEqual(cleared.save.characters[0].formalAiBinding,null);
 const conflictSave=saveBase();const playerConflict={...developerProgram,id:'AIP-9000',compiled:developerRuntime};const playerConflictLayout={...developerLayout};conflictSave.aiPrograms=[playerConflict];conflictSave.aiLayouts=[playerConflictLayout];conflictSave.characters[0].formalAiBinding={program_id:'AIP-9000',layout_id:'AIL-9000'};assert.strictEqual(Bridge.bindingAuthority(conflictSave,catalog,conflictSave.characters[0].formalAiBinding).status,'ambiguous');assert.throws(()=>Bridge.equipCharacterBinding(conflictSave,'C-1',{program_id:'AIP-9000',layout_id:'AIL-9000'},catalog),/衝突/);
 const uiSource=fs.readFileSync(path.join(root,'game/assets/js/ai-editor-ui.js'),'utf8'),appSource=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'game/index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'game/sw.js'),'utf8');
 for(const text of ['Search candidate非伝播','Predicate','Connection transition','接続を変更','Subroutine','Target Selector','判断プレビュー','構成要約'])assert(uiSource.includes(text),`Game AI authoring surface missing: ${text}`);
 assert(html.includes('characterAiBindingPanel'));assert(html.includes('プレイヤーAI編集'));assert(appSource.includes("bindingState.source==='player'"),'Developer graph must not be opened as editable Game graph');assert(appSource.includes('開発者作成AIはGameで編集しません'));
 for(const file of ['ai_nodes.json','ai_target_selectors.json','ai_programs.json','ai_program_layouts.json','ai_program_runtime.json'])assert(sw.includes(file),`offline AI dataset missing: ${file}`);
 for(const modulePath of ['game/assets/js/ai-catalog-loader.js','game/assets/js/ai-save-bridge.js','game/assets/js/ai-editor-ui.js'])assert(!fs.readFileSync(path.join(root,modulePath),'utf8').includes('localStorage'),`${modulePath} must not read Studio localStorage`);
 console.log('AI_V2_GAME_PLAYER_AUTHORING_BINDING_R10_P8_OK player_authoring=1 game_save=1 developer_usage=1 developer_graph_edit=0 binding_single_authority=1 persistent_snapshot_id=0 connections=1 predicate=1 ats=1 subroutine=1 datasets=5');
})().catch(error=>{console.error(error);process.exit(1);});
