#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Adapter=require('../../studio/ai-production/ai-export-adapter.js');
const RootCore=require('../../export-core.js');
const StudioCore=require('../../studio/export-core.js');
const minimum=require('../e2e/minimum-data.js');
const validProgram=require('./fixtures/valid-program.json');
const validRuntime=require('./fixtures/valid-runtime.json');
const data=structuredClone(minimum);data.ai_programs=[{...structuredClone(validProgram),compiled:structuredClone(validRuntime)}];
const root=path.resolve(__dirname,'../..');
(async()=>{
  assert.deepStrictEqual(RootCore.EXPORT_PATHS,StudioCore.EXPORT_PATHS);assert.strictEqual(RootCore.EXPORT_PATHS.length,28);assert(RootCore.EXPORT_PATHS.includes('master/passives.json'));
  const built=Adapter.build(data);assert.strictEqual(built.programs.length,1);assert.strictEqual(built.runtimes.length,1);assert.strictEqual('compiled' in built.programs[0],false);assert.strictEqual(built.runtimes[0].program_id,built.programs[0].id);assert.deepStrictEqual(Adapter.collectIssues(data),[]);
  const pkg=await RootCore.buildPackage(data,{dataVersion:'r9a-1.0.0',generatedAt:'2026-08-11T22:00:00Z',appVersion:'GKS-B527'});assert(pkg.files['ai/ai_programs.json']);assert(pkg.files['ai/ai_runtimes.json']);assert.strictEqual(pkg.manifest.files.length,28);assert(pkg.files['master/passives.json']);assert(pkg.manifest.files.every((row)=>/^[a-f0-9]{64}$/.test(row.sha256)));
  const invalid=structuredClone(data);invalid.ai_programs[0].status='draft';invalid.ai_programs[0].compiled=null;assert(Adapter.collectIssues(invalid).some((row)=>row.code==='AI_EXPORT_RUNTIME_MISSING'));await assert.rejects(()=>RootCore.buildPackage(invalid,{dataVersion:'x',generatedAt:'x',appVersion:'x'}),/AI export validation failed/);
  const schemaMap=JSON.parse(fs.readFileSync(path.join(root,'schemas/export-schema-map.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(root,'studio/ai-production/manifest.json'),'utf8')),html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');assert(schemaMap['ai/ai_programs.json']);assert(schemaMap['ai/ai_runtimes.json']);assert.strictEqual(manifest.entrypoints.export_adapter,'ai-export-adapter.js');assert(html.includes('GKExportCore.collectAIExportIssues(data)'));assert(html.includes("PHP_EXPORT_PATHS.length+'ファイル生成可能"));
  console.log('AI_FORMAL_EXPORT_R9A_OK adapter=1 programs=1 runtimes=1 cores=2 schemas=2 manifest_hash=1 fail_closed=1 studio_gate=1');
})().catch((error)=>{console.error(error);process.exit(1);});
