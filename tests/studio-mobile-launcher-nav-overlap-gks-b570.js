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
assert.ok(html.includes("if(!name||name==='dashboard')return;"),'Dashboard/launcher root must not receive a child-screen header');
assert.ok(html.includes('.sidebar.mobile-open{top:0;bottom:0') && html.includes('z-index:30'),'Mobile launcher must remain the foreground surface');
assert.ok(html.includes('.studio-common-header-actions'),'child screens must use compact title-row Back/Close actions');
console.log('PASS GKS-B571 mobile launcher keeps Scenario/Quest visible; Back/Close lives only in child-screen common headers');
