#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const Store=require('../../studio/ai-production/ai-program-store.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/valid-program.json'),'utf8'));
const project={project:{id:'PRJ-A'},history:[],ai_programs:[fixture]};
assert.strictEqual(Store.normalizeProject(project),project);assert.notStrictEqual(project.ai_programs[0],fixture);assert.deepStrictEqual(Store.inspect(project),{valid:true,duplicate_ids:[],missing_id_indexes:[]});assert.strictEqual(Store.nextProgramId(project),'AIP-0001');
for(const invalid of [{project:{id:'P'}},{ai_programs:null},{ai_programs:[{...fixture,unknown_field:true}]},{ai_programs:[{...fixture,schema_version:'2.0.0'}]}])assert.throws(()=>Store.normalizeProject(invalid),/ai_programs|not allowed|schema_version/);
const duplicate={ai_programs:[fixture,{...fixture}]};assert.deepStrictEqual(Store.inspect(duplicate).duplicate_ids,['AIP-SAMPLE']);assert.throws(()=>Store.upsert(duplicate,fixture),/Duplicate AI program id/);
console.log('AI_STORE_SCHEMA_R2_OK current_valid=1 invalid_reject=1');
