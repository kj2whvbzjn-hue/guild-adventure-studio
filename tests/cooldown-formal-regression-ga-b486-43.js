const fs=require('fs');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const index=fs.readFileSync('game/index.html','utf8');
const spec=JSON.parse(fs.readFileSync('docs/design/P01-10_COOLDOWN_CURRENT_SPEC.json','utf8'));
const errors=[];
if(!/^GA-B\d+(?:\.\d+)+$/.test(build.game_build||''))errors.push(`build=${build.game_build}`);
if(!bridge.includes("'SKL-COOLDOWN-ATTACK-300'"))errors.push('formal required cooldown skill missing');
if(!bridge.includes("cooldown_runtime=typeof runCooldownRuntimeRegression"))errors.push('formal cooldown runtime integration missing');
if(!bridge.includes('cooldown_runtime_passed_count'))errors.push('formal cooldown summary missing');
if(!bridge.includes("schema_version:'1.9.0'"))errors.push('formal schema version mismatch');
if(!bridge.includes(`tag-formal-runtime-regression-${build.game_build}-`))errors.push('formal filename build mismatch');
if(!app.includes('function runCooldownRuntimeRegression()'))errors.push('cooldown reusable regression runner missing');
for(const id of ['COOLDOWN-RUNTIME-START','COOLDOWN-RUNTIME-BLOCK','COOLDOWN-RUNTIME-EXPIRE-REUSE','COOLDOWN-RUNTIME-ZERO','COOLDOWN-RUNTIME-RESERVATION-NO-START','COOLDOWN-RUNTIME-ACTION-DISABLED-NO-START','COOLDOWN-RUNTIME-INVALID-TARGET-NO-START'])if(!app.includes(id))errors.push(`runtime case missing ${id}`);
if(!index.includes('P01-10 COOLDOWN Runtime v1の7ケース'))errors.push('formal regression UI description missing');
if(spec.runtime_application!==true||spec.stage!=='runtime_v1'||spec.formal_regression?.integrated!==true)errors.push('P01-10 formal regression spec mismatch');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('COOLDOWN_FORMAL_REGRESSION_GA_B486_43_OK');
