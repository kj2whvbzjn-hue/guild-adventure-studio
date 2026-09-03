const assert=require('node:assert');
const Loader=require('../../game/assets/js/ai-catalog-loader.js');
const UI=require('../../game/assets/js/ai-editor-ui.js');
const V='catalog-2.0.0';
const empty={type:'object',properties:{},required:[],additionalProperties:false};
const ports=o=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:o.map(id=>({id,kind:'flow',data_type:'flow'}))});
const catalog={...Loader.normalize([
 {id:'AIS-0001',name:'探索',node_type:'search',status:'active',data_version:V,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:empty},
 {id:'AIC-0001',name:'HP判定',node_type:'condition',status:'active',data_version:V,evaluator:'condition.hp_ratio_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{operator:{type:'string',enum:['<']},value:{type:'number',minimum:0,maximum:1}},required:['operator','value'],additionalProperties:false}},
 {id:'AIA-0001',name:'待機',node_type:'action',status:'active',data_version:V,evaluator:'action.wait',ports:ports([]),parameter_schema:empty}
],[],[],[],[],[],[],[],[]),schema_version:'2.0.0',data_version:V,warnings:[]};
assert.strictEqual(UI.definitions(catalog).length,3);assert.strictEqual(UI.definitions(catalog).some(row=>row.node_type==='target'),false);
const s=UI.createSession(catalog,{program_id:'AIP-DRAFT',layout_id:'AIL-0001',data_version:V,now:'2026-09-03T00:00:00Z'});
const search=s.add('AIS-0001',{scope:'ENEMY',predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-0001',params:{operator:'<',value:.5},negate:false}]}},0,0);const wait=s.add('AIA-0001',{},2,0);const wait2=s.add('AIA-0001',{},2,2);
s.connect({node_id:search.instance_id,port_id:'found'},{node_id:wait.instance_id,port_id:'in'});s.connect({node_id:search.instance_id,port_id:'not_found'},{node_id:wait2.instance_id,port_id:'in'});
assert.strictEqual(s.program().entry_node_id,search.instance_id);assert.strictEqual(s.layout().schema_version,'2.0.0');assert.strictEqual(s.evaluate().valid,true);
s.moveNode(wait2.instance_id,3,2);assert.strictEqual(s.layout().chips.find(row=>row.instance_id===wait2.instance_id).x,3);assert.strictEqual(s.undo(),true);assert.strictEqual(s.redo(),true);
console.log('PASS R10 P8 Game formal AI V2 authoring session core');
