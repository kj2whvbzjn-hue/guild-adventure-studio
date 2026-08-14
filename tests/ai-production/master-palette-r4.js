#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Adapter = require('../../studio/ai-production/ai-master-adapter.js');

const root = path.resolve(__dirname, '../..');
const master = {
  id: 'AIC-HP-BELOW', name: 'HP低下', status: 'approved', tags: ['TAG-HP'], description: 'HP割合を検査',
  data_version: '1.0.0', evaluator: 'condition.hp_below',
  ports: {inputs: [{id:'in',kind:'flow',data_type:'flow'}], outputs: [{id:'true',kind:'flow',data_type:'flow'},{id:'false',kind:'flow',data_type:'flow'}]},
  parameter_schema: {type:'object', required:['threshold','tag_id','skill_id','mode'], properties: {
    threshold: {type:'number', minimum:0, maximum:1},
    tag_id: {type:'string', ref_kind:'tag'},
    skill_id: {type:'string', ref_kind:'skill'},
    mode: {type:'string', enum:['self','target']}
  }, additionalProperties:false}, unlock: {required_ids:['UNLOCK-AI']}, params: {}
};
const masters = {ai_conditions:[master], ai_targets:[{id:'AIT-SELF',name:'自分',status:'disabled'}], ai_actions:[]};
const refs = {tags:[{id:'TAG-HP',name:'HP'}], skills:[{id:'SKL-HEAL',name:'回復'}]};
const node = Adapter.toNode(master, 'ai_conditions');
assert.strictEqual(node.node_type, 'condition');
assert.strictEqual(node.status, 'active', 'approved legacy status must map to active');
assert.deepStrictEqual(Adapter.definitionErrors(node), []);
assert.strictEqual(Adapter.isAvailable(node, {data_version:'1.0.0',unlocked_ids:[]}), false, 'locked node must be unavailable');
assert.strictEqual(Adapter.isAvailable(node, {data_version:'1.0.0',unlocked_ids:['UNLOCK-AI']}), true);
assert.strictEqual(Adapter.isAvailable(node, {data_version:'2.0.0',unlocked_ids:['UNLOCK-AI']}), false, 'other data versions must be unavailable');

const palette = Adapter.palette(masters, 'hp', {data_version:'1.0.0',unlocked_ids:['UNLOCK-AI']});
assert.strictEqual(palette.length, 1);
assert.strictEqual(palette[0].available, true);
assert.strictEqual(Adapter.palette(masters, '', {data_version:'1.0.0',unlocked_ids:['UNLOCK-AI']}).find(x=>x.id==='AIT-SELF').available, false);

const descriptors = Adapter.inputDescriptors(node, refs);
assert.strictEqual(descriptors.find(x=>x.name==='threshold').type, 'number');
assert.deepStrictEqual(descriptors.find(x=>x.name==='tag_id').options.map(x=>x.id), ['TAG-HP']);
assert.deepStrictEqual(descriptors.find(x=>x.name==='skill_id').options.map(x=>x.id), ['SKL-HEAL']);
assert.deepStrictEqual(Adapter.validateParameters(node, {threshold:.5,tag_id:'TAG-HP',skill_id:'SKL-HEAL',mode:'self'}, refs), []);
const invalid = Adapter.validateParameters(node, {threshold:2,tag_id:'MISSING',skill_id:'MISSING',mode:'other'}, refs);
assert(invalid.some(x=>x.includes('最大値')));
assert(invalid.filter(x=>x.includes('存在しません')).length === 3);

const legacy = Adapter.toNode({id:'AIA-WAIT',name:'待機',status:'approved',params:{ai_definition:{data_version:'1.0.0',evaluator:'action.wait',parameter_schema:{type:'object',properties:{}},ports:{inputs:[],outputs:[{id:'next',kind:'flow',data_type:'flow'}]}}}}, 'ai_actions');
assert.strictEqual(legacy.evaluator, 'action.wait', 'params.ai_definition must migrate into formal fields');

const html = fs.readFileSync(path.join(root, 'studio/index.html'), 'utf8');
assert(html.includes('id="aiMasterFields"'));
assert(html.includes('id="aiMasterParameterSchema"'));
assert(html.includes('params.ai_definition=structuredClone(node)'), 'dedicated fields must mirror into legacy params');
assert(html.includes('window.GKSAIProductionHost={getData:()=>data,'), 'evolved host must retain read-only master access while adding project persistence');
assert(html.includes('./ai-production/ai-master-adapter.js?v=1'));

console.log('AI_MASTER_PALETTE_R4_OK palette=1 status=1 unlock=1 version=1 types=1 refs=1 sync=1');
