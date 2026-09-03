#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Adapter=require('../../shared/ai/ai-master-adapter.js');
const Validator=require('../../shared/ai/ai-program-validator.js');
const Compiler=require('../../shared/ai/ai-program-compiler.js');
const action=Adapter.toNode({id:'AIA-0001',name:'通常攻撃',status:'active',data_version:'2.0.0',evaluator:'action.attack',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}},'ai_actions');
assert.deepStrictEqual(action.ports.outputs,[]);
assert.deepStrictEqual(Adapter.definitionErrors(action),[]);
const selector={id:'ATS-0001',name:'低HP',evaluator:'selector.lowest_hp_ratio',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false},tags:[],enabled:true};
const project={tags:[],masters:{skills:[],ai_searches:[],ai_conditions:[],ai_actions:[action],ai_target_selectors:[selector]}};
const program={schema_version:'2.0.0',data_version:'2.0.0',id:'AIP-P0',name:'ACTION終端',version:1,status:'valid',entry_node_id:'AIN-0001',nodes:[{instance_id:'AIN-0001',master_node_id:'AIA-0001',master_data_version:'2.0.0',node_type:'action',position:{x:0,y:0},parameters:{},target_selector:{selector_id:'ATS-0001',params:{}}}],edges:[],subroutines:[],tags:[],description:''};
const validation=Validator.validate(program,project);assert.strictEqual(validation.valid,true,JSON.stringify(validation.issues));
(async()=>{const runtime=await Compiler.compile(program,project);assert.strictEqual(runtime.schema_version,'2.0.0');assert.strictEqual(runtime.instructions.length,1);assert.strictEqual(runtime.instructions[0].op,'ACTION');assert.strictEqual('next' in runtime.instructions[0],false);assert.deepStrictEqual(runtime.instructions[0].target_selector,{params:{},selector_id:'ATS-0001'});console.log('AI_ACTION_TERMINAL_P0_OK v2=1 action_outputs=0 selector=1 validator=1 compiler=1 runtime_next_absent=1');})().catch((error)=>{console.error(error);process.exit(1)});
