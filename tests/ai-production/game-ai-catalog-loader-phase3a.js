const assert=require('node:assert');
const Loader=require('../../game/assets/js/ai-catalog-loader.js');
const payloads={
 '/ai':{ok:true,json:async()=>({data:[{id:'AIC-0001',node_type:'condition'},{id:'AIT-0001',node_type:'target'},{id:'AIA-0001',node_type:'action'}]})},
 '/skill':{ok:true,json:async()=>({data:[{id:'SKL-0001',name:'Heal'}]})}
};
(async()=>{
 const fetch=async url=>payloads[url];
 const c=await Loader.load({fetch,aiUrl:'/ai',skillUrl:'/skill'});
 assert.strictEqual(c.counts.conditions,1);assert.strictEqual(c.counts.targets,1);assert.strictEqual(c.counts.actions,1);assert.strictEqual(c.counts.skills,1);assert.deepStrictEqual(c.warnings,[]);
 const empty=await Loader.load({fetch:async()=>({ok:true,json:async()=>({data:[]})}),aiUrl:'/ai',skillUrl:'/skill'});assert.strictEqual(empty.counts.conditions,0);
 console.log('PASS Phase3A Game AI catalog loader');
})().catch(e=>{console.error(e);process.exit(1)});
