'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const game=fs.readFileSync('game/index.html','utf8');
const studio=fs.readFileSync('studio/index.html','utf8');
const exp=fs.readFileSync('studio/export-core.js','utf8');
const expRoot=fs.readFileSync('export-core.js','utf8');
const story=fs.readFileSync('assets/shared/js/adventure-story-system.js','utf8');
const reward=fs.readFileSync('assets/shared/js/adventure-reward-resolver.js','utf8');
for(const token of [
 "dropTables:'../Export/system/drop_tables.json'",
 'function resolveAdventureEventReward(args,bundle)',
 'GKAdventureRewardResolver?.resolveEventReward',
 'resolveReward:args=>resolveAdventureEventReward(args,bundle)',
 'for(const row of (Array.isArray(reward.resources)?reward.resources:[]))',
 'save.quest_resources[id]=',
 'Event報酬補正（現在設定）',
])assert(app.includes(token),`P7-C Game integration missing: ${token}`);
for(const token of ['adventure-reward-resolver.js?v=1'])assert(game.includes(token),`P7-C Game shell missing: ${token}`);
for(const token of [
 'value="reward_tables">報酬テーブル',
 'id="eventRewardTableIds"',
 'id="masterMonsterDropTableIds"',
 'id="masterExplorationSuccessRewardTableIds"',
 'id="masterExplorationFailureRewardTableIds"',
 "params.drop_table_ids=splitCsv(masterMonsterDropTableIds.value)",
 "params.on_success.reward_table_ids=splitCsv(masterExplorationSuccessRewardTableIds.value)",
 "masterMonsterDropTableIds.value=''",
])assert(studio.includes(token),`P7-C Studio integration missing: ${token}`);
for(const source of [exp,expRoot])assert(source.includes("'system/drop_tables.json':clean((masters.reward_tables&&masters.reward_tables.length)?masters.reward_tables:(data.drop_tables||[]))"),'P7-C Export must prefer formal Reward Table Master with legacy fallback');
for(const token of ['reward_history:rewardHistory','reward_result:success?aggregateReward:{}','if(success){if(typeof applyReward===\'function\')applyReward'])assert(story.includes(token),`P7-C QuestRun contract missing: ${token}`);
for(const token of ['function resolveRewardTable','function resolveEventReward','apply_difficulty_scaling','resource_kind:\'stone\'','resource_kind:String(entry?.resource_kind||\'material\')'])assert(reward.includes(token),`P7-C Reward Resolver contract missing: ${token}`);
for(const file of ['schemas/exports/system-drop_tables.schema.json','schemas/exports/event-events.schema.json','schemas/exports/monster-monsters.schema.json','schemas/exports/exploration-outcomes.schema.json'])assert(fs.existsSync(file),`P7-C schema missing: ${file}`);
assert(!app.includes('完了報酬倍率（現在設定）'),'obsolete Quest completion reward wording must be removed');
console.log('adventure-event-reward-game-p7c PASS');
