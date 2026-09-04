const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'game','assets','js','app-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(html.includes('id=\"adventurePlaybackPanel\"'),'Adventure Playback panel missing');
assert(html.includes('id=\"adventureReturn\"'),'return commit control missing');
assert(app.includes('function renderAdventurePlayback(nowMs=Date.now())'),'Playback renderer missing');
assert(app.includes('playback.visible_timeline'),'Playback must render stored timeline visibility');
assert(app.includes('function renderAdventurePlaybackDetail(run,itemIndex)'),'Scene/Battle detail renderer missing');
assert(app.includes('run.scene_snapshots'),'Scene detail must use QuestRun Snapshot');
assert(app.includes('br.playback_events'),'Battle detail must use stored playback events');
assert(app.includes('const result=commitAdventureQuestRun(current.quest_run_id)'),'return must commit stored QuestRun');
assert(app.includes('setInterval(()=>{if(currentAdventureQuestRun())'),'start-time catch-up ticker missing');
assert(app.includes("openAdventurePlayback(result.run)"),'new and resumed Adventure must enter Playback UI');
assert(app.includes("raw.schemaRevision='1.6.0';raw.gameVersion='GA-B486.215';"),'current game build missing');
console.log('adventure-playback-runtime-integration PASS');
