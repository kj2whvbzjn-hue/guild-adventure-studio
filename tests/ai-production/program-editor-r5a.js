#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const Model = require('../../studio/ai-production/ai-program-model.js');
const Store = require('../../studio/ai-production/ai-program-store.js');

const project = {project:{id:'PRJ-R5A'}, masters:{ai_conditions:[],ai_targets:[],ai_actions:[],skills:[]}, tags:[], ai_programs:[]};
let persistCount = 0;
global.GKSAIProductionHost = {getData:()=>project, persist:()=>{ persistCount += 1; return true; }, now:()=> '2026-08-11T22:00:00Z'};
const UI = require('../../studio/ai-production/ai-production-ui.js');

const blank = Model.createProgram('AIP-0001', '2026-08-11T21:00:00Z');
assert.strictEqual(blank.id, 'AIP-0001');
assert.deepStrictEqual(blank.nodes, []);
Store.upsert(project, {...blank, name:'先行AI'});
const copy = Store.duplicate(project, 'AIP-0001', '2026-08-11T21:30:00Z');
assert.strictEqual(copy.id, 'AIP-0002');
assert.strictEqual(copy.name, '先行AI のコピー');
assert.notStrictEqual(copy.nodes, project.ai_programs[0].nodes, 'duplicate data must be isolated');

const created = UI.newProgram();
assert.strictEqual(created.id, 'AIP-0003');
assert.strictEqual(UI.isDirty(), true);
UI.updateDraft('name', '回復優先AI');
UI.updateDraft('tags', '回復, 安全');
assert.strictEqual(UI.saveDraft(), true);
assert.strictEqual(persistCount, 1);
assert.strictEqual(project.ai_programs.find((item)=>item.id==='AIP-0003').name, '回復優先AI');
assert.deepStrictEqual(project.ai_programs.find((item)=>item.id==='AIP-0003').tags, ['回復','安全']);
assert.strictEqual(UI.isDirty(), false);
assert.strictEqual(UI.openProgram('AIP-0003'), true);
UI.updateDraft('description', '未保存');
assert.strictEqual(UI.isDirty(), true);
assert.strictEqual(UI.revertDraft(), true);
assert.strictEqual(UI.isDirty(), false);
const duplicated = UI.duplicateDraft();
assert.strictEqual(duplicated.id, 'AIP-0004');
assert.strictEqual(UI.isDirty(), true, 'duplicate remains an explicit unsaved draft');
assert.strictEqual(project.ai_programs.some((item)=>item.id==='AIP-0004'), false, 'unsaved duplicate must not mutate project data');

const element = {innerHTML:''};
const documentStub = {getElementById:(id)=>id==='aiProductionRoot'?element:null};
UI.setProgramSearch('回復優先');
assert.strictEqual(UI.render(documentStub), true);
assert(element.innerHTML.includes('回復優先AI'));
assert(!element.innerHTML.includes('先行AI</b>'), 'program search must filter unrelated names');

const html = fs.readFileSync(path.join(root, 'studio/index.html'), 'utf8');
assert(html.includes('R9-A 正式Export'), 'evolved Studio must retain R5-A persistence under later AI production stages');
assert(html.includes('GKSAIProductionHost={getData:()=>data,persist:message=>persist(message),now:()=>now(),getBattleUnits:'));
assert(html.includes('window.GKSAIProductionUI?.refresh()'));
const uiSource = fs.readFileSync(path.join(root, 'studio/ai-production/ai-production-ui.js'), 'utf8');
assert(!uiSource.includes('localStorage'));

console.log('AI_PROGRAM_EDITOR_R5A_OK create=1 save=1 reopen=1 duplicate=1 search=1 dirty=1 project_boundary=1');
