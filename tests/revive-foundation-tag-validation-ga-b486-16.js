const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'game-tag-test/assets/js/tag-skill-runtime.js'),'utf8');
const validation=fs.readFileSync(path.join(root,'game-tag-test/assets/js/validation-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(root,'game-tag-test/index.html'),'utf8');
for(const token of ["if(g.has('REVIVE'))",'reviveHp:n.REVIVE_HP','function resetCombatantOnDeath','function reviveTarget',"else if(logic==='REVIVE')"]){if(!runtime.includes(token))throw new Error('missing runtime token: '+token)}
for(const token of ['function tagTestRunReviveJson','TAG-REVIVE-DEVICE-001','REVIVE-DEATH-RESET','tag-revive-device-validation-GA-B486.16']){if(!validation.includes(token))throw new Error('missing validation token: '+token)}
if(!html.includes('id="tagTestRunReviveJson"'))throw new Error('REVIVE validation button missing');
console.log('REVIVE_FOUNDATION_TAG_VALIDATION_GA_B486_16_OK');
