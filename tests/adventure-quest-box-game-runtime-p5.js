'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const story=fs.readFileSync('assets/shared/js/adventure-story-system.js','utf8');
for(const token of [
  "code:'FORMAL_QUEST_DURATION_INVALID'",
  "if(!boxes.length)return{ready:false,quest_id:id,code:'FORMAL_QUEST_BOXES_EMPTY'}",
  "code:'FORMAL_QUEST_SCENE_MISSING'",
  "code:'FORMAL_QUEST_EVENT_MISSING'",
  "code:'FORMAL_QUEST_EVENT_RESOLVER_PENDING'",
  "function resolveAdventureBundle(content,questId)",
  "return{quest,scenes:content.scenes||[],events:content.events||[],monsters:content.monsters||[],tablets:content.tablets||[],maps:content.maps||[]",
  "GKAdventureStorySystem.simulateQuest({quest:bundle.quest,scenes:bundle.scenes,events:bundle.events,monsters:bundle.monsters",
])assert(app.includes(token),`P5 Game Runtime integration missing: ${token}`);
for(const token of [
  'function resolveQuestStorySnapshot(quest,scenes)',
  "chapter_id:String(scene.chapter_id||'')",
  "section_id:String(scene.section_id||'')",
  'adventure_duration_seconds:duration',
  'function simulateQuest(opts){const quest=normalizeQuest(clone(opts?.quest||{}));return simulateQuestBoxRuntime(opts||{},quest);}'
])assert(story.includes(token),`P5 Story Runtime integration missing: ${token}`);
console.log('adventure-quest-box-game-runtime-p5 PASS');
