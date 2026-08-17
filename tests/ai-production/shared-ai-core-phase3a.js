const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const SharedAdapter=require('../../shared/ai/ai-master-adapter.js');
const SharedLayout=require('../../shared/ai/ai-layout-model.js');
const SharedProgram=require('../../shared/ai/ai-program-model.js');
const SharedResolver=require('../../shared/ai/ai-connection-resolver.js');
const SharedValidator=require('../../shared/ai/ai-program-validator.js');
const SharedCompiler=require('../../shared/ai/ai-program-compiler.js');
const SharedTrace=require('../../shared/ai/ai-program-trace.js');
const SharedDecision=require('../../shared/ai/ai-decision-engine.js');
const root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'studio/ai-production/manifest.json'),'utf8'));
const canonical={program_model:SharedProgram,layout_model:SharedLayout,master_adapter:SharedAdapter,connection_resolver:SharedResolver,program_validator:SharedValidator,program_compiler:SharedCompiler,program_trace:SharedTrace,decision_engine:SharedDecision};
for(const [key,module] of Object.entries(canonical)){assert(module&&typeof module==='object',`${key} canonical module must load`);assert.strictEqual(manifest.shared_canonical[key],`shared/ai/ai-${key.replaceAll('_','-')}.js`);}
const action=SharedAdapter.toNode({id:'AIA-0001',name:'攻撃',status:'active',data_version:'1.0.0',evaluator:'action.attack',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[]},parameter_schema:{type:'object',properties:{}}},'ai_actions');
assert.deepStrictEqual(SharedAdapter.definitionErrors(action),[]);assert.strictEqual(typeof SharedLayout.normalizeLayout,'function');assert.strictEqual(typeof SharedProgram.normalizeProgram,'function');
console.log('PASS Phase3A shared Formal AI canonical core current=1');
