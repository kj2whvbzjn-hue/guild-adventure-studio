#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const SaveBridge=require('../../game/assets/js/ai-save-bridge.js');
const GameBridge=require('../../game/assets/js/ai-battle-bridge.js');
const Layout=require('../../shared/ai/ai-layout-model.js');
const AdventureCore=require('../../assets/shared/js/adventure-battle-core.js');
const root=path.resolve(__dirname,'../..');
const dv='dv-p4';
const ports={inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[]};
const project={tags:[],masters:{
  ai_searches:[],ai_conditions:[],
  ai_actions:[{id:'AIA-ATTACK',name:'Attack',status:'active',data_version:dv,evaluator:'action.attack',ports,parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}}],
  ai_target_selectors:[{id:'ATS-LOW',name:'Lowest HP',evaluator:'selector.lowest_hp_ratio',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},tags:[],enabled:true}],
  skills:[]
}};
const program={schema_version:'2.0.0',data_version:dv,id:'AIP-P4',name:'P4 actor-common',version:1,status:'valid',entry_node_id:'N1',nodes:[{instance_id:'N1',master_node_id:'AIA-ATTACK',master_data_version:dv,node_type:'action',position:{x:0,y:0},parameters:{},target_selector:{selector_id:'ATS-LOW',params:{}}}],edges:[],subroutines:[]};
(async()=>{
  const runtime=await Compiler.compile(program,project);
  const layout=Layout.createLayout('AIL-0004',program.id,dv,8,8);layout.chips.push({instance_id:'N1',x:0,y:0,rotation:0});
  const binding={program_id:program.id,layout_id:layout.layout_id};
  const playerProgram={...program,compiled:runtime};
  const save={characters:[{id:'CHAR-1',formalAiBinding:binding}],aiPrograms:[playerProgram],aiLayouts:[layout]};
  const playerCatalog={data_version:dv,developer_programs:[],developer_program_layouts:[],developer_program_runtime:[]};
  const monsterCatalog={data_version:dv,developer_programs:[program],developer_program_layouts:[layout],developer_program_runtime:[runtime]};
  const character=SaveBridge.resolveRuntimeForActor({save,catalog:playerCatalog,actor:{characterId:'CHAR-1'}});
  const monster=SaveBridge.resolveRuntimeForActor({save,catalog:monsterCatalog,actor:{monsterId:'MON-1',formalAiBinding:binding}});
  assert(character&&monster,'Character/Monster runtime resolution must both succeed');
  assert.strictEqual(character.owner_kind,'character');assert.strictEqual(monster.owner_kind,'monster');
  assert.deepStrictEqual(character.binding,binding);assert.deepStrictEqual(monster.binding,binding);
  assert.deepStrictEqual(character.runtime,monster.runtime,'Character/Monster must consume the same V2 runtime contract');

  const effect={source_skill_id:'SKL-0001',source_effect_index:0,effect_tag_ids:['TAG-0001']};
  const unitsFor=(actorId)=>[
    {id:actorId,side:'ALLY',alive:true,hp:100,maxHp:100,mp:10,maxMp:10,formationPosition:'FRONTLINE',statusEffects:[effect],aiSkillStates:{'SKL-0001':{ready:true,usable:false,target_contract:{side:'ENEMY',range:'SINGLE'},reason:'NO_VALID_TARGET'}}},
    {id:'E-2',side:'ENEMY',alive:true,hp:20,maxHp:100,formationPosition:'FRONTLINE'},
    {id:'E-1',side:'ENEMY',alive:true,hp:80,maxHp:100,formationPosition:'FRONTLINE'}
  ];
  const inputFor=(actorId)=>({battle_id:'BT-P4',tick:10,phase:'reservation',seed:77,actor_id:actorId,units:unitsFor(actorId),target_selectors:project.masters.ai_target_selectors});
  const cDecision=GameBridge.decide(character.runtime,inputFor('C-ACTOR'));
  const mDecision=GameBridge.decide(monster.runtime,inputFor('M-ACTOR'));
  assert.strictEqual(cDecision.proposal.status,'selected');assert.strictEqual(mDecision.proposal.status,'selected');
  assert.strictEqual(cDecision.proposal.action_id,'attack');assert.strictEqual(mDecision.proposal.action_id,'attack');
  assert.strictEqual(cDecision.proposal.target_id,'E-2');assert.strictEqual(mDecision.proposal.target_id,'E-2');
  assert.deepStrictEqual(cDecision.trace.events.map(x=>[x.event_type,x.result]),mDecision.trace.events.map(x=>[x.event_type,x.result]),'Character/Monster trace event contract must be identical');

  const snap=GameBridge.snapshot(inputFor('C-ACTOR')),self=snap.units.find(x=>x.id==='C-ACTOR');
  assert.strictEqual(GameBridge.predicate('condition.skill_ready',{skill_id:'SKL-0001'},self,'SELF'),true);
  assert.strictEqual(GameBridge.predicate('condition.skill_usable',{skill_id:'SKL-0001'},self,'SELF'),false);
  assert.strictEqual(GameBridge.predicate('condition.active_effect_has_tag',{effect_scope:'STATUS',tag_id:'TAG-0001'},self,'SELF'),true);
  assert.deepStrictEqual(self.statusEffects[0],effect,'Active Effect provenance must be projected without name/type inference');

  const stats=AdventureCore.monsterStats({id:'MON-1',name:'Monster',formalAiBinding:binding,params:{job_code:'SWD',level:1,maxHp:100,maxMp:10,attack:10,agi:5,skill_ids:['SKL-0001']}});
  assert.deepStrictEqual(stats.formalAiBinding,binding,'Monster Master persistent binding must project to battle row');
  assert.throws(()=>AdventureCore.monsterStats({id:'MON-BAD',formalAiBinding:{...binding,master_snapshot_id:'SNAP-1'},params:{job_code:'SWD',level:1,maxHp:100,maxMp:10,attack:10,agi:5}}),e=>e.code==='FORMAL_AI_BINDING_INVALID','Persistent Monster binding must reject master_snapshot_id');

  const battleControl=fs.readFileSync(path.join(root,'game/assets/js/battle-control.js'),'utf8');
  const appRuntime=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
  assert(battleControl.includes('GKGameAISaveBridge.resolveRuntimeForActor({save:data,catalog:formalAiCatalog(),actor})'),'Battle runtime must use actor-common runtimeForActor resolution');
  assert(battleControl.includes('const formalResolution=formalAiResolutionForActor(actor);'),'Battle runtime must resolve the actor-common V2 authority before reservation');
  assert(!battleControl.includes('chooseTarget(')&&!battleControl.includes('actor.aiPolicy'),'Legacy Monster target/policy route must be absent from Current runtime');
  assert(battleControl.includes('target_selectors:catalog?.masters?.ai_target_selectors||[]'),'Game decision must receive ATS catalog');
  assert(battleControl.includes('units:formalAiProjectedUnits(actor,runtime)'),'Game decision must receive shared skill/effect projection');
  assert(battleControl.includes("{requireEquipped:!!actor.characterId}"),'Character loadout authority and Monster content-skill authority must remain distinct');
  assert(appRuntime.includes('loadFormalAiCatalog()'),'Game startup must prime the Formal AI V2 catalog');
  assert(appRuntime.includes('formalAiBinding:e.formalAiBinding?clone(e.formalAiBinding):null'),'Monster binding must project into production battle actors');

  console.log('AI_V2_R10_P4_ACTOR_COMMON_RUNTIME_OK character=1 monster=1 same_runtime=1 same_trace=1 monster_binding=DEP024 skill_state=1 effect_provenance=1 actor_common_fail_closed=1 legacy_monster_route=0');
})().catch((error)=>{console.error(error);process.exit(1);});
