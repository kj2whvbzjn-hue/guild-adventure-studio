const fs=require('fs');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const index=fs.readFileSync('game/index.html','utf8');
const errors=[];
if(build.game_build!=='GA-B486.53')errors.push(`build=${build.game_build}`);
for(const id of ['SKL-COUNTER-ATTACK-100','SKL-COUNTER-TEST-INCOMING-ALL-60','SKL-COUNTER-TEST-ATTACK-STATUS-100'])if(!bridge.includes(id))errors.push(`formal required missing ${id}`);
if(!bridge.includes('counter_runtime=typeof runCounterRuntimeRegression'))errors.push('formal counter runtime integration missing');
if(!bridge.includes('counter_runtime_passed_count'))errors.push('formal counter summary missing');
if(!bridge.includes('tag-formal-runtime-regression-GA-B486.53-'))errors.push('formal filename build mismatch');
if(!app.includes('function runCounterRuntimeRegression()'))errors.push('counter reusable regression runner missing');
if(!app.includes("reason==='BATTLE_END'"))errors.push('BATTLE_END verification missing');
if(!app.includes('COUNTER-RUNTIME-ATTACHED-STATUS'))errors.push('attached status regression missing');
if(!index.includes('P01-07 COUNTER Runtime v1.1の9ケース'))errors.push('formal regression UI description missing');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('COUNTER_FORMAL_REGRESSION_GA_B486_33_OK');
