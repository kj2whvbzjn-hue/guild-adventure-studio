const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','game-tag-test','index.html'),'utf8');
const checks=[
 ['GA-B458 build',html.includes('GA-B458 / Sprint 2.2 / DOT Stack Limit Verification')],
 ['stack limit button',html.includes('id="tagTestRunStackLimit"')],
 ['six executions',html.includes('executionCount:6')],
 ['five expected stacks',html.includes('expectedStacks:5')],
 ['one expected rejection',html.includes('expectedRejects:1')],
 ['MAX_STACK event',html.includes("recordValidationEvent('dot_stack_rejected'")],
 ['high HP isolation',html.includes('target.maxHp=Math.max(target.maxHp,5000)')],
 ['strict non-empty validation',html.includes("validationErrors.push('skill_idがありません')")],
 ['1000 tick strict validation',html.includes("validationErrors.push('1000 Tick進行していません')")],
 ['stack hit expectation',html.includes('hitsPerStack*expectedStacks')],
 ['AI isolation',html.includes('if(battle.validationMode)continue')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
