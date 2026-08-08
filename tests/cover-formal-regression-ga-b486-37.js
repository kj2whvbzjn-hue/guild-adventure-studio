const fs=require('fs');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const index=fs.readFileSync('game/index.html','utf8');
const errors=[];
if(build.game_build!=='GA-B486.57')errors.push(`build=${build.game_build}`);
for(const id of ['SKL-COVER-SINGLE-ALLY','SKL-COVER-TEST-ALL-ALLIES','SKL-COVER-TEST-USES-1','SKL-COVER-TEST-DURATION-300','SKL-COVER-TEST-DOT-ONLY'])if(!bridge.includes(id))errors.push(`formal required missing ${id}`);
if(!bridge.includes("cover_runtime=typeof runCoverRuntimeRegression"))errors.push('formal cover runtime integration missing');
if(!bridge.includes('cover_runtime_passed_count'))errors.push('formal cover summary missing');
if(!bridge.includes("schema_version:'1.8.0'"))errors.push('formal schema version mismatch');
if(!bridge.includes('tag-formal-runtime-regression-GA-B486.57-'))errors.push('formal filename build mismatch');
if(!app.includes('function runCoverRuntimeRegression()'))errors.push('cover reusable regression runner missing');
if(!app.includes('COVER-RUNTIME-COUNTER-COVER-COUNTER'))errors.push('counter-cover-counter regression missing');
if(!index.includes('P01-08 COVER Runtime v1の13ケース'))errors.push('formal regression UI description missing');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('COVER_FORMAL_REGRESSION_GA_B486_37_OK');
