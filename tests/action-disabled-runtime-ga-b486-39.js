const fs=require('fs');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const rt=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const ctl=fs.readFileSync('game/assets/js/battle-control.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const html=fs.readFileSync('game/index.html','utf8');
const spec=JSON.parse(fs.readFileSync('docs/design/P01-09_ACTION_DISABLED_CURRENT_SPEC.json','utf8'));
const errors=[];
if(build.game_build!=='GA-B486.58')errors.push(`build=${build.game_build}`);
for(const x of ['function actionExecutionEligibility','ACTION_DISABLED','action_execution_blocked'])if(!rt.includes(x))errors.push(`runtime missing ${x}`);
for(const x of ['function evaluateActionExecution','actionExecutionEligibility(actor','action_execution_committed','skipExecutionEligibility:true'])if(!ctl.includes(x))errors.push(`execution gate missing ${x}`);
if(ctl.includes('予約時の固定対象が無効'))errors.push('reservation still binds fixed target');
for(const x of ['ACTION-DISABLED-RUNTIME-SKILL-BLOCK','ACTION-DISABLED-RUNTIME-NORMAL-BLOCK','ACTION-DISABLED-RUNTIME-EXPIRE-RESTORE','ACTION-DISABLED-RUNTIME-RESERVATION-PRESENTATION','ACTION-DISABLED-RUNTIME-COUNTER-BLOCK','ACTION-DISABLED-RUNTIME-FOLLOW-UP-BLOCK','ACTION-DISABLED-RUNTIME-DOT-CONTINUES','ACTION-DISABLED-RUNTIME-SHIELD-CONTINUES','ACTION-DISABLED-RUNTIME-AURA-CONTINUES','ACTION-DISABLED-RUNTIME-COVER-CONTINUES'])if(!app.includes(x))errors.push(`case missing ${x}`);
if(!html.includes('tagTestRunActionDisabledRuntimeJson'))errors.push('device runtime button missing');
if(spec.stage!=='runtime_v1'||spec.runtime_application!==true)errors.push('spec runtime_v1 mismatch');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('PASS P01-09 action disabled runtime GA-B486.58');
