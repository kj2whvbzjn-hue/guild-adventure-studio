#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(root,rel));
const walkJs=(rel,out=[])=>{const base=path.join(root,rel);for(const ent of fs.readdirSync(base,{withFileTypes:true})){const full=path.join(base,ent.name);if(ent.isDirectory())walkJs(path.relative(root,full),out);else if(ent.isFile()&&ent.name.endsWith('.js'))out.push(path.relative(root,full));}return out;};

// P9 is the one-way hard cut: V1 may not be read by Production after migration completes.
const migrationRel='shared/ai/migration/ai-v1-migration-validator.js';
assert.strictEqual(exists(migrationRel),false,'Dedicated V1 migration validator must be removed after P9 migration completion');
const productionFiles=[...walkJs('shared/ai'),...walkJs('studio/ai-production'),...walkJs('game/assets/js')];
const v1ReaderRefs=productionFiles.filter(rel=>read(rel).includes('ai-v1-migration-validator'));
assert.deepStrictEqual(v1ReaderRefs,[],`Production V1 reader residue: ${v1ReaderRefs.join(', ')}`);

// Current V2 program/runtime schemas must not admit the retired Target node/op.
const programSchema=read('schemas/ai/ai-program.schema.json');
const runtimeSchema=read('schemas/ai/ai-runtime.schema.json');
assert(!programSchema.includes('"target"'),'V1 target node residue in Current program schema');
assert(!runtimeSchema.includes('"TARGET"'),'V1 TARGET op residue in Current runtime schema');

// The two V1 AI export contracts are deleted, not hidden behind compatibility aliases.
for(const rel of ['schemas/exports/ai-ai_templates.schema.json','schemas/exports/ai-ai_runtimes.schema.json'])assert.strictEqual(exists(rel),false,`${rel} must be deleted at P9 hard cut`);
const schemaMap=JSON.parse(read('schemas/export-schema-map.json'));
assert.strictEqual(schemaMap['ai/ai_templates.json'],undefined);
assert.strictEqual(schemaMap['ai/ai_runtimes.json'],undefined);
const RootExport=require('../../export-core.js');
const StudioExport=require('../../studio/export-core.js');
assert.deepStrictEqual(RootExport.EXPORT_PATHS,StudioExport.EXPORT_PATHS);
for(const rel of ['ai/ai_templates.json','ai/ai_runtimes.json'])assert(!RootExport.EXPORT_PATHS.includes(rel),`legacy Formal Export residue: ${rel}`);
for(const rel of ['ai/ai_nodes.json','ai/ai_target_selectors.json','ai/ai_programs.json','ai/ai_program_layouts.json','ai/ai_program_runtime.json'])assert(RootExport.EXPORT_PATHS.includes(rel),`missing V2 AI export: ${rel}`);

// Current Monster battle path is Formal AI V2 only. Legacy policy/default-skill targeting cannot reserve actions.
const battle=read('game/assets/js/battle-control.js');
const core=read('assets/shared/js/adventure-battle-core.js');
const monsterSchema=JSON.parse(read('schemas/exports/monster-monsters.schema.json'));
const monsterDatasetSchema=JSON.parse(read('studio/data-exchange/schemas/monster-dataset.schema.json'));
assert(!battle.includes('chooseTarget('),'legacy Monster chooseTarget route remains');
assert(!battle.includes('actor.aiPolicy'),'legacy Monster aiPolicy route remains');
assert(!core.includes('aiPolicy:'),'legacy Monster aiPolicy projection remains');
assert(!core.includes('defaultSkillId:'),'legacy Monster defaultSkillId projection remains');
assert(core.includes('normalizeFormalAiBinding(monster?.formalAiBinding,{nullable:false})'),'Monster formalAiBinding must be mandatory at source boundary');
assert((monsterSchema.items?.required||[]).includes('formalAiBinding'),'Export Monster schema must require formalAiBinding');
assert((monsterDatasetSchema.items?.required||[]).includes('formalAiBinding'),'Data Exchange Monster schema must require formalAiBinding');

// PHP current package reader must consume only the five V2 AI datasets.
const phpRepo=read('php-runtime/src/GameMasterRepository.php');
assert(!phpRepo.includes("'ai_templates'"),'PHP runtime still registers ai_templates');
assert(!phpRepo.includes("'ai_runtimes'"),'PHP runtime still registers ai_runtimes');

console.log('AI_V2_MIGRATION_HARD_CUT_R10_P9_OK v1_reader=0 TARGET_op=0 monster_legacy_route=0 legacy_ai_exports=0 formal_binding_required=1');
