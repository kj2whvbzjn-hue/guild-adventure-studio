const fs=require('fs');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const index=fs.readFileSync('game/index.html','utf8');
const spec=JSON.parse(fs.readFileSync('docs/design/P01-09_ACTION_DISABLED_CURRENT_SPEC.json','utf8'));
const errors=[];
if(build.game_build!=='GA-B486.52')errors.push(`build=${build.game_build}`);
if(!bridge.includes("'SKL-STATUS-ACTION-DISABLED-400'"))errors.push('formal required action-disabled skill missing');
if(!bridge.includes("action_disabled_runtime=typeof runActionDisabledRuntimeRegression"))errors.push('formal action-disabled runtime integration missing');
if(!bridge.includes('action_disabled_runtime_passed_count'))errors.push('formal action-disabled summary missing');
if(!bridge.includes("schema_version:'1.8.0'"))errors.push('formal schema version mismatch');
if(!bridge.includes('tag-formal-runtime-regression-GA-B486.52-'))errors.push('formal filename build mismatch');
if(!app.includes('function runActionDisabledRuntimeRegression()'))errors.push('action-disabled reusable regression runner missing');
for(const id of ['ACTION-DISABLED-RUNTIME-SKILL-BLOCK','ACTION-DISABLED-RUNTIME-NORMAL-BLOCK','ACTION-DISABLED-RUNTIME-EXPIRE-RESTORE','ACTION-DISABLED-RUNTIME-RESERVATION-PRESENTATION','ACTION-DISABLED-RUNTIME-COUNTER-BLOCK','ACTION-DISABLED-RUNTIME-FOLLOW-UP-BLOCK','ACTION-DISABLED-RUNTIME-DOT-CONTINUES','ACTION-DISABLED-RUNTIME-SHIELD-CONTINUES','ACTION-DISABLED-RUNTIME-AURA-CONTINUES','ACTION-DISABLED-RUNTIME-COVER-CONTINUES'])if(!app.includes(id))errors.push(`runtime case missing ${id}`);
if(!index.includes('P01-09 ACTION_DISABLED Runtime v1の10ケース'))errors.push('formal regression UI description missing');
if(spec.runtime_application!==true||spec.stage!=='runtime_v1')errors.push('P01-09 runtime spec changed unexpectedly');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('ACTION_DISABLED_FORMAL_REGRESSION_GA_B486_40_OK');
