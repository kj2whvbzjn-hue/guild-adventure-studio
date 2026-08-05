const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'game','sw.js'),'utf8');
const checks=[
 ['build',html.includes('GA-B465 — Modifier Death Lifecycle Runtime')],
 ['target button',html.includes('tagTestRunModifierTargetDeath')],
 ['source button',html.includes('tagTestRunModifierSourceDeath')],
 ['death cleanup',html.includes('function clearModifierStacksOnDeath')],
 ['source persistence',html.includes('grant_persists_until_expiry')],
 ['target policy',html.includes('target_death_clears_all')],
 ['target test',html.includes('TAG-MODIFIER-TARGET-DEATH-001')],
 ['source test',html.includes('TAG-MODIFIER-SOURCE-DEATH-001')],
 ['schema',html.includes("schema_version:'1.2.0'" )],
 ['sw cache',sw.includes("guild-adventure-ga-b465")&&sw.includes('appv=465')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
