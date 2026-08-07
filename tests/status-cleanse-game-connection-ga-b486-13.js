const fs=require('fs');
const runtime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const html=fs.readFileSync('game/index.html','utf8');
for(const needle of ["'CLEANSE'",'function cleanseStatusEffects','cleanseResult=cleanseStatusEffects','cleanseCount:n.CLEANSE_COUNT']){if(!runtime.includes(needle))throw new Error('runtime missing '+needle)}
for(const needle of ['function tagTestRunCleanseJson','tag-cleanse-device-validation-GA-B486.13','runCleanseJson.onclick=tagTestRunCleanseJson']){if(!app.includes(needle))throw new Error('app missing '+needle)}
if(!html.includes('id="tagTestRunCleanseJson"'))throw new Error('button missing');
console.log('CLEANSE_GAME_CONNECTION_GA_B486_13_OK');
