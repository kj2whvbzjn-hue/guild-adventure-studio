const assert=require('node:assert');
const Loader=require('../../game/assets/js/ai-catalog-loader.js');
const UI=require('../../game/assets/js/ai-editor-ui.js');
const catalog=Loader.normalize([
 {id:'AIC-0001',name:'HP判定',node_type:'condition',status:'active',data_version:'1.0.0',evaluator:'condition.hp_below',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'true',kind:'flow',data_type:'flow'},{id:'false',kind:'flow',data_type:'flow'}]},parameter_schema:{type:'object',properties:{threshold:{type:'number',minimum:0,maximum:1}},required:['threshold']}},
 {id:'AIT-0001',name:'自分',node_type:'target',status:'active',data_version:'1.0.0',evaluator:'target.self',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'next',kind:'flow',data_type:'flow'}]},parameter_schema:{type:'object',properties:{}}},
 {id:'AIA-0001',name:'通常攻撃',node_type:'action',status:'active',data_version:'1.0.0',evaluator:'action.attack',ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[]},parameter_schema:{type:'object',properties:{}}}
],[],[],[]);
assert.strictEqual(UI.definitions(catalog).length,3);
const s=UI.createSession(catalog,{program_id:'AIP-TEST',layout_id:'AIL-0001',now:'2026-08-16T00:00:00Z'});
const n=s.add('AIC-0001',{threshold:.5},0,0);assert.strictEqual(n.instance_id,'AIN-0001');assert.strictEqual(s.program().entry_node_id,'AIN-0001');assert.strictEqual(s.layout().chips.length,1);
assert.throws(()=>s.add('AIC-0001',{threshold:2},1,0),/maximum|最大|超過/);
s.updateParameters(n.instance_id,{threshold:.25});assert.strictEqual(s.program().nodes[0].parameters.threshold,.25);
s.replace(n.instance_id,'AIA-0001',{});assert.strictEqual(s.program().nodes[0].node_type,'action');
assert.strictEqual(s.undo(),true);assert.strictEqual(s.program().nodes[0].node_type,'condition');assert.strictEqual(s.redo(),true);assert.strictEqual(s.program().nodes[0].node_type,'action');
s.remove(n.instance_id);assert.strictEqual(s.program().nodes.length,0);assert.strictEqual(s.layout().chips.length,0);
console.log('PASS Phase3A Game formal chip candidate/config session core');
