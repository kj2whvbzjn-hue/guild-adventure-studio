const fs=require('fs');
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const skills=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const required=['SKL-TEST-CLEANSE-1','SKL-TEST-CLEANSE-ALL','SKL-TEST-CLEANSE-ALL-PARTY','SKL-TEST-CLEANSE-INVALID'];
for(const id of required){if(!skills.data.some(x=>x.id===id))throw new Error(`missing studio skill: ${id}`)}
for(const token of ['runFormalCleanseRuntimeRegression','FORMAL-CLEANSE-SINGLE-OLDEST','FORMAL-CLEANSE-ALL','FORMAL-CLEANSE-ALL-PARTY','FORMAL-CLEANSE-PROTECTED','FORMAL-CLEANSE-NONE','cleanse_runtime_passed_count']){if(!bridge.includes(token))throw new Error(`missing formal cleanse token: ${token}`)}
if(!bridge.includes("build:'GA-B486.14'"))throw new Error('formal build not updated');
console.log('CLEANSE_FORMAL_REGRESSION_GA_B486_14_OK');
