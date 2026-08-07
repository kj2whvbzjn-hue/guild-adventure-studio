const fs=require('fs');
const skills=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8')).data;
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
for(const id of ['SKL-REVIVE-SINGLE-100','SKL-REVIVE-ALL-60','REVIVE-VALIDATION-MISSING-HP'])if(!skills.some(x=>x.id===id))throw new Error(id+' missing');
for(const id of ['FORMAL-REVIVE-SINGLE-FIXED','FORMAL-REVIVE-HP-CAP','FORMAL-REVIVE-LIVING-REJECT','FORMAL-REVIVE-ALL','FORMAL-REVIVE-DEATH-RESET'])if(!bridge.includes(id))throw new Error(id+' missing');
if(!bridge.includes('revive_runtime_passed_count'))throw new Error('revive summary missing');
console.log('REVIVE_FORMAL_CONNECTION_SEPARATED_GA_B486_19_OK');
