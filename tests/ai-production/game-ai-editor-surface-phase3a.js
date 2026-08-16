const assert=require('node:assert');const fs=require('node:fs');
const html=fs.readFileSync('game/index.html','utf8');const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');const sw=fs.readFileSync('game/sw.js','utf8');
for(const id of ['aiCandidateScreen','aiCandidateSearch','aiCandidateTabs','aiCandidateList','aiConfigScreen','aiConfigBody','aiConfigApply'])assert.ok(html.includes(`id="${id}"`),id);
assert.ok(html.includes('../shared/ai/ai-master-adapter.js'),'Game must load shared AI master adapter');
assert.ok(html.includes('./assets/js/ai-editor-ui.js'),'Game must load formal AI editor UI');
assert.ok(!app.includes('const AI_CHIPS='),'Legacy demo AI_CHIPS must not drive formal editor');
assert.ok(!app.includes('神官プリセット'),'Legacy demo preset must not drive formal editor');
assert.ok(sw.includes('../Export/ai/ai_nodes.json'),'Game offline shell must include formal AI node export');
console.log('PASS Phase3A Game formal AI candidate/config screen surface');
