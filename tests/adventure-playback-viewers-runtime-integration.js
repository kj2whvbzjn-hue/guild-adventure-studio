const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'game','assets','js','app-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(html.includes('id="adventureHistoryFilter"'),'Adventure history filter UI missing');
assert(html.includes('id="adventureHistoryCount"'),'Adventure history count UI missing');
assert(html.includes('id="adventureReturnResult"'),'Adventure return result panel missing');
assert(app.includes("adventureHistoryFilter==='success'"),'success history filtering missing');
assert(app.includes("adventureHistoryFilter==='failure'"),'failure history filtering missing');
assert(app.includes('保存済み Scene Snapshot'),'Scene Viewer must identify saved snapshot source');
assert(app.includes('保存済みBattle Result / Playback Eventsのみを表示'),'Battle Viewer must use stored result/events only');
assert(app.includes('function renderAdventureReturnResult(summary)'),'return result renderer missing');
assert(app.includes('QuestRunに保存済みの結果を正式Saveへ反映しました。再計算はしていません。'),'return result must make no-recalculation behavior explicit');
assert(app.includes("const summary={run_id:current.quest_run_id"),'return summary must be captured from stored QuestRun before commit');
assert(app.includes("raw.schemaRevision='1.5.0';raw.gameVersion='GA-B486.97';"),'current game build missing');
console.log('adventure-playback-viewers-runtime-integration PASS');
