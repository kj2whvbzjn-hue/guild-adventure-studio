const assert=require('assert');
const fs=require('fs');
const html=fs.readFileSync('studio/index.html','utf8');

const createPanel=html.match(/<div id="launcherPanel-create"[\s\S]*?<\/div>\s*<\/div>/)?.[0]||'';
assert.ok(createPanel,'create launcher panel missing');
const storyPos=createPanel.indexOf("runLauncherAction('story')");
const questPos=createPanel.indexOf("runLauncherAction('quests')");
const eventPos=createPanel.indexOf("runLauncherAction('events')");
assert.ok(storyPos>=0,'Scenario launcher button missing');
assert.ok(questPos>=0,'Quest launcher button missing');
assert.ok(eventPos>=0,'Event launcher button missing');
assert.ok(storyPos<eventPos && questPos<eventPos,'Scenario/Quest must remain before Event in Create launcher');

assert.ok(!html.includes('id="studioScreenNav"'),'mobile launcher must not compete with a global Back/Close strip');
assert.ok(html.includes("function studioEnsureCommonHeader(name){\n if(!name)return;"),'Dashboard is a child screen and must receive the common header; only launcher Home is header-free');
assert.ok(html.includes('.sidebar.mobile-open{top:0;bottom:0') && html.includes('z-index:30'),'Mobile launcher Home must remain the foreground surface over normal views');
assert.ok(html.includes('.studio-common-header-actions'),'child screens must use compact title-row Back/Close actions');
console.log('PASS current mobile launcher keeps Scenario/Quest visible; launcher Home is header-free and child screens use common headers');
