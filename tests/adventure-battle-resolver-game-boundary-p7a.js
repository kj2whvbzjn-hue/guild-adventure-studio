'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const story=fs.readFileSync('assets/shared/js/adventure-story-system.js','utf8');

for(const token of [
  "function adventureBattleResolverAvailable(){return typeof window.GKAdventureEncounterResolver?.resolveEncounter==='function';}",
  "if(type==='battle')return adventureBattleResolverAvailable();if(type==='exploration')return adventureExplorationResolverAvailable();",
  'function resolveAdventureBattleEncounter({request},bundle)',
  "window.GKAdventureEncounterResolver?.resolveEncounter",
  'map_master:clone(bundle?.maps||[])',
  'adventure_settings:clone(bundle?.adventureSettings||[])',
  'resolveBattleEncounter:adventureBattleResolverAvailable()?args=>resolveAdventureBattleEncounter(args,bundle):undefined',
  'simulateBattle:args=>simulateAdventureBattle(args,bundle,partySnapshot)',
  'tablets:bundle.tablets',
  'resolveExploration:adventureExplorationResolverAvailable()?args=>resolveAdventureExploration(args,bundle):undefined'
])assert(app.includes(token),`P7-A Game boundary missing: ${token}`);

for(const token of [
  'function normalizeEncounterFormation(rows)',
  'function buildBattleResolverRequest(',
  "contract:'adventure_battle_encounter_request'",
  'quest_difficulty:effective',
  "event_intensity:String(e.intensity||'')",
  'effective_enemy_budget:effective',
  "if(String(event?.type||'')==='battle'&&typeof opts.resolveBattleEncounter==='function')",
  "throw new Error('Battle Core adapter is required for resolved Battle Event')",
  'encounter_request:clone(request)',
  'encounter_result:clone(encounter)'
])assert(story.includes(token),`P7-A Story boundary missing: ${token}`);

// P7-B supersedes the former unresolved D-04 / D-05 boundary while keeping P7-A's external resolver contract.
assert(app.includes('function adventureExplorationResolverAvailable()'),'Exploration resolver availability boundary is required');
assert(app.includes('function resolveAdventureExploration({request},bundle)'),'P7-B Exploration adapter is required');
assert(app.includes("maps:'../Export/world/maps.json'"),'Map export must be loaded');
assert(app.includes("explorationOutcomes:'../Export/exploration/outcomes.json'"),'Exploration Outcome export must be loaded');

console.log('adventure-battle-resolver-game-boundary-p7a PASS');
