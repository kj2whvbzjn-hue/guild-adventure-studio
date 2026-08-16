const assert=require('assert');
const fs=require('fs');
const html=fs.readFileSync('studio/index.html','utf8');

assert.ok(!html.includes('id="studioScreenNav"'),'legacy global Back/Close strip must be removed');
assert.ok(html.includes('function studioCommonHeaderElement('),'common Studio header factory missing');
assert.ok(html.includes('function studioEnsureCommonHeader('),'common Studio header mount missing');
assert.ok(html.includes("function studioEnsureCommonHeader(name){\n if(!name)return;"),'all Studio views including Dashboard must receive the common header');
assert.ok(html.includes("window.addEventListener('DOMContentLoaded',studioEnsureAllCommonHeaders)"),'static child views must receive common headers');
assert.ok(html.includes("if(name)studioEnsureCommonHeader(name);"),'dynamic child views must receive common headers');
assert.ok(html.includes("'equipment-generator':'装備生成'") && html.includes("'skill-generator':'スキル生成'"),'dynamic generator titles missing from common header map');
assert.ok(html.includes("back.addEventListener('click',studioNavigateBack)") && html.includes("close.addEventListener('click',studioNavigateClose)"),'common header actions must use central navigation');

for(const title of ['シナリオ','クエスト','イベント','フラグ','キャラクター','マスター']){
  assert.ok(!html.includes(`<div class="view-heading"><h1>${title}</h1><button type="button" onclick="studioNavigateClose()">とじる</button></div>`),`${title} still has a per-view duplicate close button`);
}

for(const id of ['ruleTagPickerTitle','benchmarkWorkflowTitle','studioInputTitle','dataExchangePickerTitle','masterSkillPickerTitle','tagPickerTitle']){
  const pos=html.indexOf(`id="${id}"`);
  assert.ok(pos>=0,`${id} missing`);
  const start=Math.max(0,pos-500),end=Math.min(html.length,pos+700),chunk=html.slice(start,end);
  assert.ok(chunk.includes('studio-common-header'),`${id} does not use common header`);
  assert.ok(chunk.includes('studioNavigateBack()') && chunk.includes('studioNavigateClose()'),`${id} common navigation missing`);
}

assert.ok(html.includes('if(questBoxEditorState){closeQuestBoxEditor();return;}'),'central Back must return from Box child screen to Quest editor');
assert.ok(html.includes("typeof studioLayerTopId==='function'?studioLayerTopId():''") && html.includes('studioCloseLayerById(topLayer)'),'central Back must close only the current foreground layer');
assert.ok(!/benchmark-workflow-foot[\s\S]{0,300}studioNavigateClose\(\)/.test(html),'Benchmark footer must not duplicate common Close');
assert.ok(html.includes("runLauncherAction('story')\">シナリオ") && html.includes("runLauncherAction('quests')\">クエスト"),'Create launcher Scenario/Quest entries missing');

console.log('PASS current common Studio child-screen header, launcher has no global strip, no duplicate per-view navigation');
