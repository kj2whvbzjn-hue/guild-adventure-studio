'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const game=fs.readFileSync('game/index.html','utf8');
const studio=fs.readFileSync('studio/index.html','utf8');
const exp=fs.readFileSync('studio/export-core.js','utf8');
for(const token of [
 "maps:'../Export/world/maps.json'",
 "explorationOutcomes:'../Export/exploration/outcomes.json'",
 "adventureSettings:'../Export/system/adventure_settings.json'",
 "if(type==='exploration')return adventureExplorationResolverAvailable();",
 'function resolveAdventureExploration({request},bundle)',
 'map_master:clone(bundle?.maps||[])',
 'outcome_master:clone(bundle?.explorationOutcomes||[])',
 "code:'FORMAL_QUEST_MAP_REQUIRED'",
 "code:'FORMAL_QUEST_MAP_MISSING'",
 'function adventureSelectedStones(questId,validTablets=null)',
 'GKAdventureStorySystem.stoneResourceCost(selectedStones)',
 'GKAdventureStorySystem.resolveAdventureDifficulty({quest,selectedStones',
 'resolveExploration:adventureExplorationResolverAvailable()?args=>resolveAdventureExploration(args,bundle):undefined',
 "reason:'simulation_failed_before_cost'",
 'run.start_cost_result={consumed:true',
])assert(app.includes(token),`P7-B Game integration missing: ${token}`);
assert(app.indexOf('GKAdventureStorySystem.simulateQuest({')<app.indexOf('GKAdventureStorySystem.consumeQuestStartCost(data,startState.cost)'),'Stone/start cost must commit only after QuestRun simulation succeeds');
for(const token of ['adventure-encounter-resolver.js?v=3','id="adventureStonePicker"'])assert(game.includes(token),`P7-B Game shell missing: ${token}`);
for(const token of ['id="questMapId"','id="questEnvironmentTags"','value="maps">マップ','value="exploration_outcomes">探索結果','value="adventure_settings">冒険設定','Story Battle Override','required_monsters','fixed_formation','id="masterEnvironmentTagFields"','params.stone_level=stoneLevel'])assert(studio.includes(token),`P7-B Studio integration missing: ${token}`);
for(const token of ["'world/maps.json'","'exploration/outcomes.json'","'system/adventure_settings.json'",'function p7StoryQuestRuntimeAssessment(data,quest)','p7_runtime_ready'])assert(exp.includes(token),`P7-B Export integration missing: ${token}`);
console.log('adventure-tag-encounter-exploration-game-p7b PASS');
