const fs=require('fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
for(const needle of [
 'let adventureQuestImportIssues=[];',
 'function assessAdventureQuestImport(content,quest)',
 "code:'FORMAL_QUEST_BOXES_EMPTY'",
 "code:'FORMAL_QUEST_SCENE_MISSING'",
 "code:'FORMAL_QUEST_EVENT_MISSING'",
 'function adventureRandomStaticCandidates(content,placement)',
 "code:'FORMAL_QUEST_RANDOM_EVENT_NO_CANDIDATES'",
 "code:'FORMAL_QUEST_RANDOM_EVENT_RESOLVER_PENDING'",
 'assessments.filter(x=>x.assessment.ready)',
 'function formalAdventureQuestImportIssues()',
 'function formalAdventureQuestImportIssueMessage(issue)',
 "FORMAL_QUEST_EVENT_RESOLVER_PENDING:'Event Resolverが利用できません'",
 "code:'FORMAL_QUEST_MAP_REQUIRED'",
 "code:'FORMAL_QUEST_MAP_MISSING'",
 '<details class="small warn">',
 'escapeHtml(issue.quest_id)',
 'function reloadFormalAdventureQuests()',
 "loadAdventureContent({force:true})",
 'id="reloadStoryQuests"',
 'Storyデータを再読込',
 'let adventureStoryLoadState=',
 'function formalAdventureStoryLoadLabel()',
 'id="storyDataLoadStatus"',
 "manifest:'../Export/manifest.json'",
 'async function fetchAdventureManifest()',
 'function assertAdventureExportVersionConsistency(manifest,documents)',
 'Adventure Export data_version mismatch:',
 'function adventureStoryLoadErrorCode(error)',
 "'EXPORT_VERSION_MISMATCH'",
 "error.code='EXPORT_VERSION_MISMATCH'",
 "error.files=mismatches.map(x=>x.url)",
 "error_files:Array.isArray(error?.files)",
 " ／ 対象 ${s.error_files.join(', ')}",
 "error.detail=`HTTP ${res.status}`",
 "error.detail=String(cause?.message||'JSON parse failed')",
 "error_detail:String(error?.detail||'')",
 " ／ 詳細 ${s.error_detail}",
 "failed_at:failedAt",
 " ／ 失敗時刻 ${failed}",
 "function setAdventureStoryLoading()",
 "loading_started_at:new Date().toISOString()",
 "再読込中 ／ 開始 ${started}",
 "setAdventureStoryLoading();adventureStoryReloadPromise=",
 "let adventureStoryReloadPromise=null;",
 "if(adventureStoryReloadPromise)return adventureStoryReloadPromise",
 "adventureStoryReloadPromise.then(()=>{adventureStoryReloadPromise=null}",
 "function adventureStoryLoadElapsedMs(endedAt)",
 "load_elapsed_ms:elapsed",
 " ／ 所要 ${s.load_elapsed_ms}ms",
 "const ADVENTURE_EXPORT_TIMEOUT_MS=15000;",
 "function fetchAdventureResponse(url)",
 "signal:controller.signal",
 "error.code='EXPORT_NETWORK_FAILED'",
 "timeout ${ADVENTURE_EXPORT_TIMEOUT_MS}ms",
 "EXPORT_NETWORK_FAILED:'Export通信失敗'",
 "'EXPORT_MANIFEST_LOAD_FAILED'",
 "'EXPORT_STORY_JSON_LOAD_FAILED'",
 '読込失敗：${',
 'setAdventureStoryLoadError(error)',
 'questDocs.flatMap(x=>x.data)',
 'data_version:String(content?.manifest?.data_version||\'\')',
 'function formatAdventureExportGeneratedAt(value)',
 "'生成日時未設定'",
 'Export ${version} ／ ${generated} ／ 最終読込 ${time}',
 '件のQuestを参照不整合のため除外',
 'StudioのExport検証でQuest Box / Scene / Event参照を確認してください。'
])assert(app.includes(needle),`formal quest Game import readiness missing: ${needle}`);
assert(!app.includes("filter(q=>{const links=q.links||{};return Boolean(q?.id&&links.chapter_id&&links.section_id)"),'link-only formal quest filter must be removed');
assert(!app.includes("FORMAL_QUEST_RANDOM_EVENT_PENDING:'Random EventはP6で実行対応'"),'P6 must not keep the P5 random-event pending import block');
assert(app.includes('P7-Bで実行可能なStory Questがありません。'),'P7-B empty formal Export guidance missing');

// Story Legacy撤去後も、正式QuestRunへの出発・Playback導線を回帰確認する。
const ui=fs.readFileSync('game/assets/js/ui-bootstrap.js','utf8');
const shell=fs.readFileSync('assets/shared/js/game-shell-common.js','utf8');
assert(!/for\(const q of adventureQuestCatalog\).*QUESTS/.test(app),'formal Story quests must not be merged into retired fixed-battle QUESTS');
assert(app.includes("function selectedQuest(){const formal=formalAdventureQuests();return formal.find(q=>q.id===data.selectedQuestId)||formal[0]||null}"),'selectedQuest must remain formal-only');
assert(ui.includes("await beginSelectedAdventure()"),'desktop departure must route to QuestRun');
assert(!ui.includes("prepareEvent();setPhase('event')"),'desktop departure must not restore retired Event route');
assert(shell.includes("if(typeof beginSelectedAdventure==='function') beginSelectedAdventure();"),'mobile departure must route to QuestRun');
assert(!shell.includes("if(typeof prepareEvent==='function') prepareEvent();"),'mobile departure must not restore retired Event route');
for(const token of ['eventScout','eventSearch','eventObserve','eventBattle']){
 assert(!app.includes(token),`app runtime must not restore retired Event action: ${token}`);
 assert(!ui.includes(token),`UI bootstrap must not restore retired Event action: ${token}`);
}
assert(app.includes("formalAdventureQuests().find(x=>String(x.id)===String(run?.quest_id))"),'Playback title must resolve formal quest without retired fixed QUESTS');
console.log('adventure-formal-quest-game-import-readiness PASS');
