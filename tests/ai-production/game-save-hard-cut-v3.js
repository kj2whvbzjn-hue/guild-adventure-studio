#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const Bridge=require('../../game/assets/js/ai-save-bridge.js');
const root=path.resolve(__dirname,'../..');
const current={saveVersion:3,characters:[{id:'C-1',name:'A',formalAiBinding:null}],aiPrograms:[],aiLayouts:[],aiPresets:[]};
assert.strictEqual(Bridge.SAVE_VERSION,3);
assert.deepStrictEqual(Bridge.assertCurrent(current),current);
assert.throws(()=>Bridge.assertCurrent({...current,saveVersion:2}),/saveVersion must be 3/);
for(const key of ['aiGraph','aiPolicy','defaultSkillId']){
  const legacy=structuredClone(current);legacy.characters[0][key]=key==='aiGraph'?{}:'legacy';
  assert.throws(()=>Bridge.assertCurrent(legacy),/旧AIフィールドは使用できません/);
}
const legacyPreset=structuredClone(current);legacyPreset.aiPresets=[{preset_id:'AIPR-0001',name:'legacy',source:'user',ai_program:{id:'AIP-X'},ai_layout:{layout_id:'AIL-X'}}];
assert.throws(()=>Bridge.assertCurrent(legacyPreset),/旧Preset|Preset/);
assert.strictEqual(Object.prototype.hasOwnProperty.call(Bridge,'migrate'),false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(Bridge,'validateV2'),false);
const app=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
assert(app.includes("const SAVE_KEY='guildAdventureV10.save.v3', SAVE_VERSION=3;"));
assert(!app.includes('GKGameAISaveBridge.migrate'));
assert(!app.includes('validateV2'));
assert(!app.includes('delete c.aiGraph'));
assert(!app.includes('delete c.aiPolicy'));
const html=fs.readFileSync(path.join(root,'game/index.html'),'utf8');
assert(!html.includes('.ai-chip.start{'));
assert(!html.includes('.ai-config-sheet{'));
console.log('AI_GAME_SAVE_HARD_CUT_V3_OK version=3 migration=0 legacy_fields=reject wrappers=0 old_css=0');
