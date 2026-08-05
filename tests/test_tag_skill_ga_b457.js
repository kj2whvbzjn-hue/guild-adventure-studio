const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','game-tag-test','index.html'),'utf8');
const checks=[
 ['GA-B457+ JSON validation regression',html.includes('DOT Independent Timer Verification')||html.includes('DOT Stack Limit Verification')||html.includes('DOT JSON Verification')],
 ['1000 tick button',html.includes('id="tagTestRun1000"')],
 ['JSON export button',html.includes('id="tagTestExportJson"')],
 ['validation mode',html.includes('battle.validationMode')],
 ['AI isolation',html.includes('if(battle.validationMode)continue')],
 ['attack event',html.includes("recordValidationEvent('attack'")],
 ['stack event',html.includes("recordValidationEvent('dot_stack_added'")],
 ['dot damage event',html.includes("recordValidationEvent('dot_damage'")],
 ['expire event',html.includes("recordValidationEvent('dot_expired'")],
 ['JSON schema',html.includes("DOT_LOG_SCHEMA_VERSION='1.0.0'")],
 ['PASS calculation',html.includes('expected_dot_hit_count')&&html.includes('normal_ai_actions')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
