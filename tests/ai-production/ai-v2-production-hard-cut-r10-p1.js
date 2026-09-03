#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const Store=require('../../studio/ai-production/ai-program-store.js');
const read=(rel)=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const v1Program=read('tests/ai-production/fixtures/valid-program.json');
const v2Program=read('tests/ai-production/fixtures/v2-p1/valid-program.json');
assert.strictEqual(Store.SCHEMA_VERSION,'2.0.0');
assert.throws(()=>Store.normalizeProject({ai_programs:[v1Program]}),/schema_version must be 2\.0\.0/);
assert.strictEqual(Store.normalizeProject({ai_programs:[v2Program]}).ai_programs[0].schema_version,'2.0.0');
const currentSchemas=['schemas/ai/ai-program.schema.json','schemas/ai/ai-layout.schema.json','schemas/ai/ai-runtime.schema.json','schemas/ai/ai-trace.schema.json'];
for(const rel of currentSchemas){const text=fs.readFileSync(path.join(root,rel),'utf8');assert(text.includes('2.0.0'),`${rel} is not V2`);}
assert(!fs.readFileSync(path.join(root,'schemas/ai/ai-runtime.schema.json'),'utf8').includes('"TARGET"'),'Current V2 runtime schema must not admit TARGET');
assert(!fs.readFileSync(path.join(root,'schemas/ai/ai-program.schema.json'),'utf8').includes('"target"'),'Current V2 program schema must not admit Target node');
const storeText=fs.readFileSync(path.join(root,'studio/ai-production/ai-program-store.js'),'utf8');
assert(!storeText.includes("new Set(['condition','target','action'])"),'Store must not admit V1 Target nodes');
assert(!/fallback|dual[-_ ]read|try[^\n]*old/i.test(storeText),'P1 Store must not add compatibility fallback/dual-read');
console.log('AI_V2_SCHEMA_STORE_HARD_CUT_R10_P1_OK current_store_v2=1 v1_production_reader=0 target_schema_residue=0 compatibility_new=0');
