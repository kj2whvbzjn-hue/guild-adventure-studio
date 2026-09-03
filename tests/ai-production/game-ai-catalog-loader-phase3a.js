const assert=require('node:assert');
const Loader=require('../../game/assets/js/ai-catalog-loader.js');
const V='catalog-2.0.0';
const env=(data,refs)=>({schema_version:'2.0.0',data_version:V,generated_at:'2026-09-02T00:00:00Z',generated_by:'test',data,...(refs?{refs}: {})});
const payloads={
 '/nodes':{ok:true,json:async()=>env([
  {schema_version:'2.0.0',data_version:V,id:'AIS-0001',node_type:'search'},
  {schema_version:'2.0.0',data_version:V,id:'AIC-0001',node_type:'condition'},
  {schema_version:'2.0.0',data_version:V,id:'AIA-0001',node_type:'action'}
 ],{tags:[{id:'TAG-0001',name:'Tag'}],tag_categories:[]})},
 '/selectors':{ok:true,json:async()=>env([{schema_version:'2.0.0',id:'ATS-0001',evaluator:'selector.lowest_hp_ratio'}])},
 '/programs':{ok:true,json:async()=>env([{schema_version:'2.0.0',data_version:V,id:'AIP-0001'}])},
 '/layouts':{ok:true,json:async()=>env([{schema_version:'2.0.0',data_version:V,layout_id:'AIL-0001',program_id:'AIP-0001'}])},
 '/runtime':{ok:true,json:async()=>env([{schema_version:'2.0.0',data_version:V,program_id:'AIP-0001'}])},
 '/skill':{ok:true,json:async()=>({schema_version:'1.0.0',data_version:V,data:[{id:'SKL-0001',name:'Heal'}]})},
 '/templates':{ok:true,json:async()=>({schema_version:'1.0.0',data_version:V,data:[]})}
};
(async()=>{
 const fetch=async url=>payloads[url];
 const c=await Loader.load({fetch,aiNodeUrl:'/nodes',aiTargetSelectorUrl:'/selectors',aiProgramUrl:'/programs',aiProgramLayoutUrl:'/layouts',aiProgramRuntimeUrl:'/runtime',skillUrl:'/skill',templateUrl:'/templates'});
 assert.strictEqual(c.schema_version,'2.0.0');assert.strictEqual(c.data_version,V);
 assert.strictEqual(c.counts.searches,1);assert.strictEqual(c.counts.conditions,1);assert.strictEqual(c.counts.actions,1);assert.strictEqual(c.counts.target_selectors,1);assert.strictEqual(c.counts.developer_programs,1);assert.strictEqual(c.counts.developer_program_layouts,1);assert.strictEqual(c.counts.developer_program_runtime,1);assert.strictEqual(c.counts.skills,1);assert.strictEqual(c.counts.tags,1);assert.deepStrictEqual(c.warnings,[]);
 assert.strictEqual(Object.prototype.hasOwnProperty.call(c.masters,'ai_targets'),false);assert.deepStrictEqual(c.masters.ai_target_selectors.map(x=>x.id),['ATS-0001']);
 await assert.rejects(()=>Loader.load({fetch:async url=>url==='/nodes'?{ok:true,json:async()=>env([{schema_version:'2.0.0',data_version:V,id:'AIT-0001',node_type:'target'}])}:payloads[url],aiNodeUrl:'/nodes',aiTargetSelectorUrl:'/selectors',aiProgramUrl:'/programs',aiProgramLayoutUrl:'/layouts',aiProgramRuntimeUrl:'/runtime',skillUrl:'/skill',templateUrl:'/templates'}),/invalid Current V2 node/);
 console.log('PASS R10 P2 Game AI catalog loader five-dataset V2 contract');
})().catch(e=>{console.error(e);process.exit(1)});
