#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Adapter = require('../../shared/ai/ai-master-adapter.js');

const root = path.resolve(__dirname, '../..');
const master = {
  id: 'AIC-HP-BELOW', name: 'HP低下', status: 'active', tags: ['TAG-HP'], description: 'HP割合を検査',
  data_version: '1.0.0', evaluator: 'condition.hp_below', supported_subject_kind: ['UNIT','SELF'],
  ports: {inputs: [{id:'in',kind:'flow',data_type:'flow'}], outputs: [{id:'true',kind:'flow',data_type:'flow'},{id:'false',kind:'flow',data_type:'flow'}]},
  parameter_schema: {type:'object', required:['threshold','tag_id','skill_id','mode'], properties: {
    threshold: {type:'number', minimum:0, maximum:1},
    tag_id: {type:'string', ref_kind:'tag'},
    skill_id: {type:'string', ref_kind:'skill'},
    mode: {type:'string', enum:['self','target']}
  }, additionalProperties:false}, unlock: {required_ids:['UNLOCK-AI']}, params: {}
};
const selector={schema_version:'2.0.0',id:'ATS-SELF',name:'自分',evaluator:'selector.self',parameter_schema:{type:'object',properties:{}},tags:[],enabled:false};
const masters = {ai_searches:[],ai_conditions:[master],ai_target_selectors:[selector],ai_actions:[]};
const refs = {tags:[{id:'TAG-HP',name:'HP'}], skills:[{id:'SKL-HEAL',name:'回復'}]};
const node = Adapter.toNode(master, 'ai_conditions');
assert.strictEqual(node.node_type, 'condition');
assert.strictEqual(node.status, 'active');
assert.deepStrictEqual(Adapter.definitionErrors(node), []);
assert.strictEqual(Adapter.isAvailable(node, {data_version:'1.0.0',unlocked_ids:[]}), false, 'locked node must be unavailable');
assert.strictEqual(Adapter.isAvailable(node, {data_version:'1.0.0',unlocked_ids:['UNLOCK-AI']}), true);
assert.strictEqual(Adapter.isAvailable(node, {data_version:'2.0.0',unlocked_ids:['UNLOCK-AI']}), false, 'other data versions must be unavailable');

const palette = Adapter.palette(masters, 'hp', {data_version:'1.0.0',unlocked_ids:['UNLOCK-AI']});
assert.strictEqual(palette.length, 1);
assert.strictEqual(palette[0].available, true);
assert.strictEqual(Adapter.palette(masters, '', {data_version:'1.0.0',unlocked_ids:['UNLOCK-AI']}).some(x=>x.id==='ATS-SELF'), false, 'ATS must not be a node palette item');
assert.strictEqual(Adapter.targetSelectorPalette(masters,'').find(x=>x.id==='ATS-SELF').available,false,'disabled ATS must be unavailable');

const descriptors = Adapter.inputDescriptors(node, refs);
assert.strictEqual(descriptors.find(x=>x.name==='threshold').type, 'number');
assert.deepStrictEqual(descriptors.find(x=>x.name==='tag_id').options.map(x=>x.id), ['TAG-HP']);
assert.deepStrictEqual(descriptors.find(x=>x.name==='skill_id').options.map(x=>x.id), ['SKL-HEAL']);
assert.deepStrictEqual(Adapter.validateParameters(node, {threshold:.5,tag_id:'TAG-HP',skill_id:'SKL-HEAL',mode:'self'}, refs), []);
const invalid = Adapter.validateParameters(node, {threshold:2,tag_id:'MISSING',skill_id:'MISSING',mode:'other'}, refs);
assert(invalid.some(x=>x.includes('最大値')));
assert(invalid.filter(x=>x.includes('存在しません')).length === 3);

const genericParamsOnly = Adapter.toNode({id:'AIA-WAIT',name:'待機',status:'active',data_version:'1.0.0',params:{definition:{evaluator:'action.wait'}}}, 'ai_actions');
assert.strictEqual(genericParamsOnly.evaluator, 'action.unconfigured', 'AI Master must read only Formal top-level fields');
assert.deepStrictEqual(genericParamsOnly.ports.outputs, [], 'ACTION default ports must be terminal');
assert.deepStrictEqual(Adapter.definitionErrors(genericParamsOnly), []);
const invalidAction = Adapter.toNode({id:'AIA-INVALID',name:'不正ACTION',status:'active',evaluator:'action.wait',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'next',kind:'flow',data_type:'flow'}]}}, 'ai_actions');
assert(Adapter.definitionErrors(invalidAction).some(x=>x.includes('終端')), 'ACTION next output must be rejected');

const html = fs.readFileSync(path.join(root, 'studio/index.html'), 'utf8');
assert(html.includes('id="aiMasterFields"'));
assert(html.includes('id="aiMasterParameterSchema"'));
assert(!html.includes('params.ai_definition'), 'AI Master must not mirror Formal fields into generic params');
assert(html.includes('node_type:node.node_type'), 'AI Master save must persist Formal node_type');
assert(html.includes("masterParamsField')?.classList.toggle('hidden',isAI)"), 'generic params editor must be hidden for AI Master');
assert(html.includes('window.GKSAIProductionHost={getData:()=>data,'), 'evolved host must retain read-only master access while adding project persistence');
assert(html.includes('../shared/ai/ai-master-adapter.js?v=2'));
assert(html.includes('id="aiMasterSupportedSubjects"'),'AIC supported subject authoring field missing');

console.log('AI_MASTER_PALETTE_R10_P2_OK palette=1 ats_non_node=1 status=1 unlock=1 version=1 subjects=1 refs=1 formal_only=1 action_terminal=1');
