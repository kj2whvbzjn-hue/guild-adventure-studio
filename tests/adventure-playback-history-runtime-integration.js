const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'game','assets','js','app-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(html.includes('id="adventureHistoryList"'),'Adventure history list missing');
assert(html.includes('id="adventureResume"'),'active QuestRun resume control missing');
assert(app.includes('function renderAdventureHistory()'),'Adventure history renderer missing');
assert(app.includes('GKAdventureStorySystem.questRunHistory(data)'),'QuestRun history source must be stored save data');
assert(app.includes("openAdventurePlayback(run,{history:true})"),'history playback entry missing');
assert(app.includes("adventurePlaybackHistoryRunId"),'history playback mode missing');
assert(app.includes("aria-current=\"step\""),'current Box auto-follow marker missing');
assert(app.includes("scrollIntoView({block:'nearest',behavior:'smooth'})"),'current Box auto-follow scroll missing');
assert(app.includes('const activeRun=currentAdventureQuestRun();if(activeRun)openAdventurePlayback(activeRun);else setPhase(\'base\')'),'continue must resume active QuestRun');
assert(app.includes("ret.textContent=history?'履歴を閉じる'"),'history viewer must not commit results');
assert(app.includes("raw.schemaRevision='1.5.0';raw.gameVersion='GA-B486.92';"),'current game build missing');
console.log('adventure-playback-history-runtime-integration PASS');
