const fs=require('fs');
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const runtime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
if(!runtime.includes('function resetCombatantOnDeath('))throw new Error('resetCombatantOnDeath missing');
if(bridge.includes('resetUnitOnDeath('))throw new Error('obsolete resetUnitOnDeath reference remains');
if(!bridge.includes("resetCombatantOnDeath(unit,{reason:'formal_revive_fixture'})"))throw new Error('formal revive fixture is not connected to current death reset API');
for(const id of ['FORMAL-REVIVE-SINGLE-FIXED','FORMAL-REVIVE-HP-CAP','FORMAL-REVIVE-LIVING-REJECT','FORMAL-REVIVE-ALL','FORMAL-REVIVE-DEATH-RESET'])if(!bridge.includes(id))throw new Error(id+' missing');
console.log('REVIVE_FORMAL_DEATH_RESET_CONNECTION_GA_B486_20_OK');
