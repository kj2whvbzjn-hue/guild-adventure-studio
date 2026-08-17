const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const SharedAdapter=require('../../shared/ai/ai-master-adapter.js');
const SharedLayout=require('../../shared/ai/ai-layout-model.js');
const SharedProgram=require('../../shared/ai/ai-program-model.js');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'studio/sw.js'),'utf8');
for(const name of ['ai-program-model','ai-layout-model','ai-connection-resolver','ai-master-adapter','ai-program-validator','ai-program-compiler','ai-program-trace','ai-decision-engine']){
  const wrapper=`./ai-production/${name}.js`;
  assert(!html.includes(wrapper),`${wrapper} must not be loaded by Studio`);
  assert(!sw.includes(wrapper),`${wrapper} must not be cached by Studio`);
  const source=fs.readFileSync(path.join(root,'studio/ai-production',`${name}.js`),'utf8');
  assert(source.includes('Removed compatibility entrypoint'));
  assert(!source.includes('module.exports=')&&!source.includes('module.exports ='),'removed wrapper must not forward exports');
}
const action=SharedAdapter.toNode({id:'AIA-0001',name:'攻撃',status:'active',data_version:'1.0.0',evaluator:'action.attack',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[]},parameter_schema:{type:'object',properties:{}}},'ai_actions');
assert.deepStrictEqual(SharedAdapter.definitionErrors(action),[]);
assert.strictEqual(typeof SharedLayout.normalizeLayout,'function');
assert.strictEqual(typeof SharedProgram.normalizeProgram,'function');
console.log('PASS Phase3A shared Formal AI canonical core hard-cut=1 wrappers=0');
