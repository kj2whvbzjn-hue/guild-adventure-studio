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
assert(app.includes("raw.schemaRevision='1.6.0';raw.gameVersion='GA-B486.209';"),'current game build missing');

assert(app.includes("function adventureQuestRunTitle(run){const stored=String(run?.quest_name||'').trim();if(stored)return stored;"),'stored Quest name must have first priority');
assert(app.includes("$('eventTitle').textContent=adventureQuestRunTitle(run)"),'Playback title must be resolved from the QuestRun');
assert(app.includes('renderAdventureReturnResult(adventureQuestRunSummary(run),{history:true})'),'history must render the stored QuestRun aggregate');
assert(app.includes("run.quest_name=String(bundle.quest?.name||bundle.quest?.id||'')"),'new QuestRun must snapshot the Quest name');
assert(app.includes("reward:clone(run?.reward_result||{})"),'history summary must use stored reward_result');
assert(app.includes("start_cost:clone(run?.start_cost_result||{})"),'history summary must use stored start_cost_result');
assert(app.includes("difficulty:clone(run?.difficulty_snapshot||{})"),'history summary must use stored difficulty_snapshot');
assert(app.includes("results_applied:Boolean(run?.results_applied)"),'history summary must expose stored commit state');
for(const label of ['正式Save','開始コスト','使用石板','最終Enemy Budget'])assert(app.includes(`<b>${label}</b>`),`${label} field missing from aggregate history result`);
assert(app.includes('保存済みQuestRunの総合結果です。再計算・再抽選・再Commitは行いません。'),'history aggregate result must prohibit recalculation/recommit');
assert(app.includes('summary.results_applied=true;'),'post-commit result must display applied state without recomputation');

console.log('adventure-playback-history-runtime-integration PASS');
