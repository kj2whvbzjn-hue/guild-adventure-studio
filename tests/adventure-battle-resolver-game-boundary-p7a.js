'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const story=fs.readFileSync('assets/shared/js/adventure-story-system.js','utf8');

for(const token of [
  "function adventureBattleResolverAvailable(){return typeof window.GKAdventureEncounterResolver?.resolveEncounter==='function';}",
  "if(type==='battle')return adventureBattleResolverAvailable();if(type==='exploration')return false;",
  'function resolveAdventureBattleEncounter({request},bundle)',
  "window.GKAdventureEncounterResolver?.resolveEncounter",
  'resolver({request:clone(request),monster_master:clone(bundle?.monsters||[])})',
  'resolveBattleEncounter:adventureBattleResolverAvailable()?args=>resolveAdventureBattleEncounter(args,bundle):undefined',
  'simulateBattle:args=>simulateAdventureBattle(args,bundle,partySnapshot)',
  'tablets:bundle.tablets'
])assert(app.includes(token),`P7-A Game boundary missing: ${token}`);

for(const token of [
  'function normalizeEncounterFormation(rows)',
  'function buildBattleResolverRequest(',
  "contract:'adventure_battle_encounter_request'",
  'quest_difficulty:context.difficulty??null',
  "event_intensity:String(e.intensity||'')",
  'enemy_budget:resolveEnemyBudget({quest:q,startCostResources:startResources,tablets})',
  "if(String(event?.type||'')==='battle'&&typeof opts.resolveBattleEncounter==='function')",
  "throw new Error('Battle Core adapter is required for resolved Battle Event')",
  'encounter_request:clone(request)',
  'encounter_result:clone(encounter)'
])assert(story.includes(token),`P7-A Story boundary missing: ${token}`);

// D-04 / D-05 stay explicit: no built-in Map/Area pool and no guessed Exploration resolver are introduced.
assert(!story.includes('function resolveMapEncounterPool('),'P7-A must not invent a Map/Area encounter dataset');
assert(!story.includes('function simulateExploration('),'P7-B must not guess an Exploration runtime');
assert(app.includes("if(type==='exploration')return false;"),'Exploration must remain blocked until D-05 is resolved');

console.log('adventure-battle-resolver-game-boundary-p7a PASS');
