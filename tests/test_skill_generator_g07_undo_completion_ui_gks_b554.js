const assert=require('assert'),fs=require('fs');
const build=require('../package-build.json');
assert.strictEqual(build.studio_build,'GKS-B554');
const sg=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const ui=fs.readFileSync('studio/data-exchange/data-exchange-ui.js','utf8');
const html=fs.readFileSync('studio/index.html','utf8');

assert.ok(sg.includes("q('skgG07Undo').onclick=async()=>"),'G07 Undo handler must await completion');
assert.ok(sg.includes("await global.GKSDataExchangeUI.undoLatestSession()"),'G07 Undo must await Data Exchange result');
for(const needle of ['G07 Undo 完了','success ${undone}','undone ${undone} / remain ${remain} / conflict ${conflict}','現在のMasterは登録前の状態に戻っています。']){
  assert.ok(sg.includes(needle),'missing completion UI: '+needle);
}
assert.ok(!sg.includes("Data Exchange Auditの直前Session Undoを開始しました。"),'stale start-only status must be removed');
for(const needle of ['target_count:targetCount','undone_count:targetCount','remain_count:0','conflict_count:0']){
  assert.ok(ui.includes(needle),'Data Exchange Undo result missing: '+needle);
}
assert.ok(ui.includes('return undoSummary;'),'Undo UI must return completion summary');
assert.ok(html.includes('skill-generator.js?v=26'),'Skill generator cache key must advance');
assert.ok(html.includes('data-exchange-ui.js?v=22'),'Data Exchange UI cache key must advance');
console.log('PASS GKS-B554 G07 Undo completion UI');
