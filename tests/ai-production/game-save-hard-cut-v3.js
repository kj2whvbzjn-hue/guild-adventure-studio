#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const Bridge=require('../../game/assets/js/ai-save-bridge.js');
const makeCharacter=()=>({id:'C-1',name:'A',level:1,job:'剣士',stats:{HP:10,MP:10,STR:10,VIT:10,INT:10,MND:10,AGI:10,DEX:10,LUK:10},skills:['SKL-TEST-ATTACK'],equippedSkillId:'SKL-TEST-ATTACK',formalAiBinding:null,equipment:{weapon:null,armor:null,accessory:null},jobHistory:[],growthHistory:[],createdAt:'2026-08-17T00:00:00Z'});
const current={saveVersion:3,schemaRevision:'1.6.0',gameVersion:'GA-B486.198',createdAt:'2026-08-17T00:00:00Z',updatedAt:'2026-08-17T00:00:00Z',characters:[makeCharacter()],aiPrograms:[],aiLayouts:[],aiPresets:[],partyIds:['C-1'],selectedQuestId:'',inventory:[],guild:{gold:0,victories:0,defeats:0,lastBattle:null},flags:{},quest_progress:{completed_quest_ids:[],unlocked_quest_ids:[]},quest_resources:{},adventure:{quest_runs:[],active_quest_run_id:'',history_limit:20,stone_selection_by_quest:{}}};
assert.strictEqual(Bridge.SAVE_VERSION,3);
assert.deepStrictEqual(Bridge.assertCurrent(current),current);
for(const mutate of [
  save=>{save.saveVersion=2;},
  save=>{save.extraField=true;},
  save=>{delete save.aiPrograms;},
  save=>{save.characters[0].extraField=true;},
  save=>{delete save.characters[0].formalAiBinding;},
  save=>{save.characters[0].formalAiBinding={program_id:'AIP-1',layout_id:'AIL-1',extra:true};}
]){const invalid=structuredClone(current);mutate(invalid);assert.throws(()=>Bridge.assertCurrent(invalid),/不正|not allowed|required|must be/);}
const program={schema_version:'1.0.0',data_version:'1.0.0',id:'AIP-1',name:'AI',version:1,status:'valid',entry_node_id:'N1',nodes:[{instance_id:'N1',master_node_id:'AIA-WAIT',node_type:'action',position:{x:0,y:0},parameters:{}}],edges:[],subroutines:[],tags:[],description:'',updated_at:'2026-08-17T00:00:00Z',compiled:null};
const layout={layout_version:1,layout_id:'AIL-1',program_id:'AIP-1',width:8,height:8,chips:[{instance_id:'N1',x:0,y:0,rotation:0}],extensions:[]};
const withAi=structuredClone(current);withAi.aiPrograms=[program];withAi.aiLayouts=[layout];withAi.characters[0].formalAiBinding={program_id:'AIP-1',layout_id:'AIL-1'};assert.deepStrictEqual(Bridge.assertCurrent(withAi),withAi);
for(const mutate of [
  save=>{save.aiPrograms[0].extraField=true;},
  save=>{save.aiPrograms[0].nodes[0].extraField=true;},
  save=>{save.aiLayouts[0].extraField=true;},
  save=>{save.aiLayouts[0].chips[0].extraField=true;}
]){const invalid=structuredClone(withAi);mutate(invalid);assert.throws(()=>Bridge.assertCurrent(invalid),/not allowed|不正/);}
console.log('AI_GAME_SAVE_SCHEMA_V3_OK current_valid=1 invalid_reject=1 unknown_field_reject=1');
