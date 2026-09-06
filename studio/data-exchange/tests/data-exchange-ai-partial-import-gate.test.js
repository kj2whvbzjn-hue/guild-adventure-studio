'use strict';
const assert=require('assert');
const exchange=require('../data-exchange-core.js');
const adapter=require('../ai-partial-import-adapter.js');
function root(){return {schema_version:'4.0.0-draft',project:{id:'PRJ-TEST',updated_at:'2026-01-01T00:00:00Z'},tag_categories:[{id:'TGC-0001',name:'Category'}],tags:[{id:'TAG-0001',name:'A',category_id:'TGC-0001'}],characters:[],organizations:[],terms:[],relationships:[],timeline:[],quests:[],events:[],flags:[],rules:[],chapters:[],ai_programs:[],ai_program_layouts:[],ai_program_runtime:[],masters:{monsters:[],skills:[],stats:[],status_effects:[],tablets:[],maps:[],exploration_outcomes:[],adventure_settings:[],reward_tables:[],jobs:[],equipment:[],passives:[],mods:[],ai_searches:[],ai_conditions:[],ai_target_selectors:[],ai_actions:[]}};}
async function artifact(dataset,operations){const a={format:adapter.FORMAT,version:adapter.VERSION,project_id:'PRJ-TEST',dataset,operations,metadata:{generated_at:'',source:'test',package_hash:'',hash_algorithm:'SHA-256'}};const h=JSON.parse(JSON.stringify(a));h.metadata.package_hash='';h.metadata.generated_at='';a.metadata.package_hash=await exchange.sha256Hex(exchange.stableStringify(h));return a;}
(async()=>{
 let r=root();
 const create=await artifact('tag_categories',[{op:'CREATE',id:'TGC-0002',record:{id:'TGC-0002',name:'B'}}]);
 const parsed=await adapter.parseAiPartialImport(create,{rootData:r,exchange});
 const built=await adapter.buildAiMergedCandidate({artifact:parsed,rootData:r,exchange});
 assert(built.candidate.tag_categories.some(x=>x.id==='TGC-0002'));
 await assert.rejects(()=>adapter.buildAiMergedCandidate({artifact:create,rootData:{...r,tag_categories:[...r.tag_categories,{id:'TGC-0002',name:'Existing'}]},exchange}),/CREATE_ID_EXISTS/);
 const oldHash=await exchange.recordHash('tags',r.tags[0]);
 const update=await artifact('tags',[{op:'UPDATE',id:'TAG-0001',expected_record_hash:oldHash,record:{id:'TAG-0001',name:'Updated',category_id:'TGC-0001'}}]);
 const upd=await adapter.buildAiMergedCandidate({artifact:update,rootData:r,exchange});
 assert.strictEqual(upd.candidate.tags[0].name,'Updated');
 const missing=await artifact('tags',[{op:'UPDATE',id:'TAG-9999',expected_record_hash:'x',record:{id:'TAG-9999',name:'Missing'}}]);
 await assert.rejects(()=>adapter.buildAiMergedCandidate({artifact:missing,rootData:r,exchange}),/UPDATE_TARGET_MISSING/);
 const stale=await artifact('tags',[{op:'UPDATE',id:'TAG-0001',expected_record_hash:'stale',record:{id:'TAG-0001',name:'Updated',category_id:'TGC-0001'}}]);
 await assert.rejects(()=>adapter.buildAiMergedCandidate({artifact:stale,rootData:r,exchange}),/STALE_SOURCE/);
 const badProject=await artifact('tags',[{op:'CREATE',id:'TAG-0002',record:{id:'TAG-0002',name:'B',category_id:'TGC-0001'}}]);badProject.project_id='OTHER';
 await assert.rejects(()=>adapter.parseAiPartialImport(badProject,{rootData:r,exchange}),/project_id不一致/);
 const badRef=await artifact('tags',[{op:'CREATE',id:'TAG-0002',record:{id:'TAG-0002',name:'B',category_id:'TGC-9999'}}]);
 await assert.rejects(()=>adapter.buildAiMergedCandidate({artifact:badRef,rootData:r,exchange}),/Dry Run|Apply Plan|参照/);
 const deleteLike=await artifact('tags',[{op:'CREATE',id:'TAG-0002',record:{id:'TAG-0002',name:'B',category_id:'TGC-0001'}}]);deleteLike.operations[0].op='DELETE';
 await assert.rejects(()=>adapter.parseAiPartialImport(deleteLike,{rootData:r,exchange}),/CREATE\/UPDATE/);
 console.log('DATA_EXCHANGE_AI_PARTIAL_IMPORT_GATE_OK');
})().catch(e=>{console.error(e);process.exit(1)});
