const assert=require('node:assert');
const Loader=require('../../game/assets/js/ai-catalog-loader.js');
const UI=require('../../game/assets/js/ai-editor-ui.js');
const V='catalog-2.0.0';
const empty={type:'object',properties:{},required:[],additionalProperties:false};
const ports=o=>({inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:o.map(id=>({id,kind:'flow',data_type:'flow'}))});
const targetCategories=[{id:'TGC-TARGET',name:'対象'}];
const targetTags=[
 {id:'TAG-TGT-SELF',name:'自分',category_id:'TGC-TARGET',runtime_semantic:'SELF'},
 {id:'TAG-TGT-ALLY',name:'味方',category_id:'TGC-TARGET',runtime_semantic:'ALLY'},
 {id:'TAG-TGT-OTHER-ALLY',name:'自分以外の味方',category_id:'TGC-TARGET',runtime_semantic:'OTHER_ALLY'},
 {id:'TAG-TGT-ENEMY',name:'敵',category_id:'TGC-TARGET',runtime_semantic:'ENEMY'}
];
const catalog={...Loader.normalize([
 {id:'AIS-0001',name:'探索',node_type:'search',status:'active',data_version:V,evaluator:'search.exists',ports:ports(['found','not_found']),parameter_schema:empty},
 {id:'AIC-0001',name:'HP判定',node_type:'condition',status:'active',data_version:V,evaluator:'condition.hp_ratio_compare',supported_subject_kind:['UNIT','SELF'],ports:ports(['true','false']),parameter_schema:{type:'object',properties:{operator:{type:'string',enum:['<']},value:{type:'number',minimum:0,maximum:1}},required:['operator','value'],additionalProperties:false}},
 {id:'AIA-0001',name:'待機',node_type:'action',status:'active',data_version:V,evaluator:'action.wait',ports:ports([]),parameter_schema:empty}
],[],[],targetTags,targetCategories,[],[],[],[]),schema_version:'2.0.0',data_version:V,warnings:[]};
assert.strictEqual(UI.definitions(catalog).length,3);assert.strictEqual(UI.definitions(catalog).some(row=>row.node_type==='target'),false);
const s=UI.createSession(catalog,{program_id:'AIP-DRAFT',layout_id:'AIL-0001',data_version:V,now:'2026-09-03T00:00:00Z'});
const search=s.add('AIS-0001',{target_tag_id:'TAG-TGT-ENEMY',predicate:{logic:'ALL',clauses:[{predicate_master_id:'AIC-0001',params:{operator:'<',value:.5},negate:false}]}},1,1);
const found=s.add('AIA-0001',{},2,1),notFound=s.add('AIA-0001',{},1,2);s.rotate(notFound.instance_id,90);
assert.strictEqual(s.program().entry_node_id,search.instance_id);assert.strictEqual(s.layout().schema_version,'2.0.0');assert.deepStrictEqual(s.program().edges,[],'Player Session must not require manual Program edges');
const evaluation=s.evaluate();assert.strictEqual(evaluation.valid,true,JSON.stringify(evaluation.issues));assert.deepStrictEqual(evaluation.program.edges.map(edge=>[edge.from.node_id,edge.from.port_id,edge.transition_kind,edge.to.node_id,edge.to.port_id]),[[search.instance_id,'found','NODE',found.instance_id,'in'],[search.instance_id,'not_found','NODE',notFound.instance_id,'in']]);assert.deepStrictEqual(evaluation.program.subroutines,[]);
for(const name of ['setTransition','connect','connectCall','connectReturn','removeEdge','addSubroutine','removeSubroutine'])assert.strictEqual(typeof s[name],'undefined',`Player Session must not expose ${name}`);
const preview=s.previewMoveNode(found.instance_id,4,1);assert.strictEqual(preview.valid,false);assert(preview.issues.some(row=>row.code==='AI_OUTPUT_OPEN'),'Invalid Board preview must return Resolver diagnostics without throwing');
s.moveNode(found.instance_id,3,1);assert.strictEqual(s.layout().chips.find(row=>row.instance_id===found.instance_id).x,3);assert.strictEqual(s.evaluate().valid,false);assert.strictEqual(s.undo(),true);assert.strictEqual(s.evaluate().valid,true);assert.strictEqual(s.redo(),true);assert.strictEqual(s.evaluate().valid,false);
console.log('PASS R10 P8 Game formal AI V2 Board Resolver authoring session core');
