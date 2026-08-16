#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Adapter=require('../../studio/ai-production/ai-master-adapter.js');
const Validator=require('../../studio/ai-production/ai-program-validator.js');
const Compiler=require('../../studio/ai-production/ai-program-compiler.js');
const action=Adapter.toNode({id:'AIA-0001',name:'通常攻撃',status:'active',data_version:'1.0.0',evaluator:'action.attack',parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}},'ai_actions');
assert.deepStrictEqual(action.ports.outputs,[]);
assert.deepStrictEqual(Adapter.definitionErrors(action),[]);
const project={tags:[],masters:{skills:[],ai_conditions:[],ai_targets:[],ai_actions:[action]}};
const program={schema_version:'1.0.0',data_version:'1.0.0',id:'AIP-P0',name:'ACTION終端',version:1,status:'valid',entry_node_id:'AIN-0001',nodes:[{instance_id:'AIN-0001',master_node_id:'AIA-0001',master_data_version:'1.0.0',node_type:'action',position:{x:0,y:0},parameters:{}}],edges:[],subroutines:[],tags:[],description:''};
const validation=Validator.validate(program,project);assert.strictEqual(validation.valid,true,JSON.stringify(validation.issues));
(async()=>{const runtime=await Compiler.compile(program,project);assert.strictEqual(runtime.instructions.length,1);assert.strictEqual(runtime.instructions[0].op,'ACTION');assert.strictEqual('next' in runtime.instructions[0],false);console.log('AI_ACTION_TERMINAL_P0_OK action_outputs=0 validator=1 compiler=1 runtime_next_absent=1');})().catch(e=>{console.error(e);process.exit(1)});
