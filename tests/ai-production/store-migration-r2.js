#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Store = require('../../studio/ai-production/ai-program-store.js');

const root = path.resolve(__dirname, '../..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/valid-program.json'), 'utf8'));

const legacyProject = {project: {id: 'PRJ-LEGACY', updated_at: 'old'}, history: []};
assert.strictEqual(Store.normalizeProject(legacyProject), legacyProject, 'normalization must retain the project object');
assert.deepStrictEqual(legacyProject.ai_programs, [], 'old projects must receive an empty AI program collection');

const project = {project: {id: 'PRJ-A'}, history: [], ai_programs: [fixture]};
Store.normalizeProject(project);
assert.notStrictEqual(project.ai_programs[0], fixture, 'program normalization must isolate stored objects');
assert.strictEqual(project.ai_programs[0].data_version, '1.0.0');
assert.deepStrictEqual(Store.inspect(project), {valid: true, duplicate_ids: [], missing_id_indexes: []});
assert.strictEqual(Store.nextProgramId(project), 'AIP-0001');

const numbered = {ai_programs: [{id: 'AIP-0002'}, {id: 'AIP-0010'}, {id: 'AIP-CUSTOM'}]};
assert.strictEqual(Store.nextProgramId(numbered), 'AIP-0011', 'generated ids must not collide with existing numeric ids');

const duplicate = {ai_programs: [fixture, {...fixture}]};
const duplicateResult = Store.inspect(duplicate);
assert.strictEqual(duplicateResult.valid, false);
assert.deepStrictEqual(duplicateResult.duplicate_ids, ['AIP-SAMPLE']);
assert.throws(() => Store.upsert(duplicate, fixture), /Duplicate AI program id/);

const upsertProject = {ai_programs: []};
Store.upsert(upsertProject, fixture);
Store.upsert(upsertProject, {...fixture, name: 'Updated'});
assert.strictEqual(upsertProject.ai_programs.length, 1);
assert.strictEqual(upsertProject.ai_programs[0].name, 'Updated');

const backup = structuredClone(project);
const restored = JSON.parse(JSON.stringify(backup));
Store.normalizeProject(restored);
assert.deepStrictEqual(restored.ai_programs, project.ai_programs, 'backup and restore must retain AI programs');

const secondProject = {project: {id: 'PRJ-B'}, ai_programs: []};
const multiProjectPackage = JSON.parse(JSON.stringify({
  format: 'guild-adventure-studio-multi-project',
  projects: [{meta: {id: 'PRJ-A'}, data: project}, {meta: {id: 'PRJ-B'}, data: secondProject}]
}));
multiProjectPackage.projects.forEach((entry) => Store.normalizeProject(entry.data));
assert.strictEqual(multiProjectPackage.projects[0].data.ai_programs.length, 1);
assert.strictEqual(multiProjectPackage.projects[1].data.ai_programs.length, 0, 'project AI collections must remain isolated');

const protectedProjectData = JSON.parse(fs.readFileSync(path.join(root, 'project-data.json'), 'utf8'));
Store.normalizeProject(protectedProjectData);
assert(Array.isArray(protectedProjectData.ai_programs), 'protected project-data.json must migrate at runtime');

const studioHtml = fs.readFileSync(path.join(root, 'studio/index.html'), 'utf8');
assert(studioHtml.includes('./ai-production/ai-program-model.js?v=1'));
assert(studioHtml.includes('./ai-production/ai-program-store.js?v=1'));
assert(studioHtml.includes('ai_programs:[]'), 'new Main projects must initialize an AI program collection');
assert(studioHtml.includes('function normalizeData(){')&&studioHtml.includes('if(window.GKSAIProgramStore)data=GKSAIProgramStore.normalizeProject(data);'), 'loaded/legacy projects must normalize AI programs through the project boundary');
assert(studioHtml.includes("function persist(message='端末保存'){\n if(window.GKSAIProgramStore)data=GKSAIProgramStore.normalizeProject(data);"), 'persist must normalize AI programs without replacing Main save behavior');

const storeSource = fs.readFileSync(path.join(root, 'studio/ai-production/ai-program-store.js'), 'utf8');
assert(!storeSource.includes('localStorage'), 'AI store must use the Studio project boundary, not an independent localStorage key');

console.log('AI_STORE_MIGRATION_R2_OK legacy=1 roundtrip=1 backup=1 multi_project=1 duplicate_gate=1');
