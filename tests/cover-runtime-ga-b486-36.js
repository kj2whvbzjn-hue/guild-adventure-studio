const fs=require('fs');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const rt=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const ctl=fs.readFileSync('game/assets/js/battle-control.js','utf8');
const html=fs.readFileSync('game/index.html','utf8');
const errors=[];
if(build.game_build!=='GA-B486.58')errors.push(`build=${build.game_build}`);
for(const needle of ['function applyTaggedCover','function resolveCoverIntervention','function processCoverEffects','function clearAllCoverEffects','derivedGeneration=0','wasCovered=false'])if(!rt.includes(needle))errors.push(`runtime missing ${needle}`);
for(const needle of ['COVER-RUNTIME-BASE','COVER-RUNTIME-ATTACHED-STATUS','COVER-RUNTIME-ATTACHED-DOT','COVER-RUNTIME-DOT-ONLY-BLOCK','COVER-RUNTIME-STATUS-ONLY-BLOCK','COVER-RUNTIME-AREA-ONE','COVER-RUNTIME-USES','COVER-RUNTIME-DURATION','COVER-RUNTIME-COUNTER-COVER-COUNTER','COVER-RUNTIME-FOLLOW-UP'])if(!app.includes(needle))errors.push(`case missing ${needle}`);
if(!ctl.includes("processCoverEffects();"))errors.push('tick cover processing missing');
if(!ctl.includes("clearAllCoverEffects('battle_end')"))errors.push('battle end cover cleanup missing');
if(!html.includes('tagTestRunCoverRuntimeJson'))errors.push('device runtime button missing');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('PASS P01-08 COVER runtime GA-B486.58');
