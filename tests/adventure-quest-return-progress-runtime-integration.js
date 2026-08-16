const fs=require('fs');
const assert=require('assert');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const story=fs.readFileSync('assets/shared/js/adventure-story-system.js','utf8');
assert(story.includes('applyQuestProgress'),'QuestRun commit must expose persisted quest progress handler');
assert(app.includes('applyQuestProgress:(save,progress)=>'),'runtime quest progress commit handler missing');
assert(app.includes('completed_quest_ids=[...completed]'),'completed quest set commit missing');
assert(app.includes('unlocked_quest_ids=[...unlocked]'),'next quest unlock commit missing');
assert(app.includes("Object.assign(save.flags,progress?.set_flags||{})"),'quest configured flags commit missing');

assert(story.includes("if(typeof applyFlags==='function')applyFlags(save,clone(run.flag_result||{}));if(success)"),'confirmed flag diff must commit for both success and failure runs');
assert(app.includes("progress:clone(run?.quest_progress_result||{})"),'shared QuestRun summary must expose persisted quest progress');
assert(app.includes('const summary=adventureQuestRunSummary(current);'),'return flow must use the shared stored QuestRun summary');
assert(app.includes('<b>Quest進行</b>'),'return result must display committed quest progress');
console.log('adventure-quest-return-progress-runtime-integration: PASS');
