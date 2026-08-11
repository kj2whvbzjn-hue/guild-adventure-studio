const fs=require('fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
for(const needle of [
 'let adventureQuestImportIssues=[];',
 'function assessAdventureQuestImport(content,quest)',
 "code:'FORMAL_QUEST_LINK_INCOMPLETE'",
 "code:'FORMAL_QUEST_CHAPTER_MISSING'",
 "code:'FORMAL_QUEST_SECTION_MISSING'",
 "code:'FORMAL_QUEST_SECTION_BOXES_EMPTY'",
 'assessments.filter(x=>x.assessment.ready)',
 'function formalAdventureQuestImportIssues()',
 'function formalAdventureQuestImportIssueMessage(issue)',
 "FORMAL_QUEST_CHAPTER_MISSING:'Chapter参照切れ'",
 '<details class="small warn">',
 'escapeHtml(issue.quest_id)',
 'async function reloadFormalAdventureQuests()',
 "loadAdventureContent({force:true})",
 'id="reloadStoryQuests"',
 'Storyデータを再読込',
 'let adventureStoryLoadState=',
 'function formalAdventureStoryLoadLabel()',
 'id="storyDataLoadStatus"',
 '最終読込 ${time} ／ 利用可能 ${s.quest_count}件 ／ 除外 ${s.excluded_count}件',
 '件のQuestを参照不整合のため除外',
 'StudioのExport検証でChapter / Section / Boxを確認してください。'
])assert(app.includes(needle),`formal quest Game import readiness missing: ${needle}`);
assert(!app.includes("filter(q=>{const links=q.links||{};return Boolean(q?.id&&links.chapter_id&&links.section_id)"),'link-only formal quest filter must be removed');
console.log('adventure-formal-quest-game-import-readiness PASS');
