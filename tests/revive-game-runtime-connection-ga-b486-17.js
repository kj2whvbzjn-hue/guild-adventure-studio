const fs=require('fs');
const p='game/assets/js/tag-skill-runtime.js';const s=fs.readFileSync(p,'utf8');
for(const x of ["if(g.has('REVIVE'))",'reviveHp:n.REVIVE_HP','function reviveTarget(','isRevive=definition.logicOrder.includes','resetCombatantOnDeath(','reviveResult=reviveTarget']){if(!s.includes(x))throw new Error('missing '+x)}
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');if(!app.includes('function tagTestRunReviveJson()')||!app.includes('GA-B486.17'))throw new Error('game revive json missing');
console.log('REVIVE_GAME_RUNTIME_CONNECTION_GA_B486_17_OK');
