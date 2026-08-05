const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','game-tag-test','index.html'),'utf8');
const checks=[
 ['GA-B460 build',html.includes('GA-B460 / Sprint 2.4 / DOT Defeat Verification')],
 ['defeat button',html.includes('id="tagTestRunDefeat"')],
 ['defeat test id',html.includes('TAG-DOT-DEFEAT-001')],
 ['low HP setup',html.includes('target.maxHp=100;target.hp=100')],
 ['three DOT hits expected',html.includes('expectedDotHits:3')],
 ['partial lethal DOT total',html.includes('expectedDotDamageTotal:52')],
 ['defeat at tick 300',html.includes('expectedDefeatTick:300')],
 ['defeat event recorded',html.includes("recordValidationEvent('dot_defeat'")],
 ['post-defeat DOT guard',html.includes('撃破後にDOTダメージが発生しています')],
 ['stacks cleared',html.includes('cleared_dot_stacks:clearedStacks')],
 ['AI isolation',html.includes('if(battle.validationMode)continue')],
 ['GA-B460 JSON filename',html.includes('tag-dot-validation-GA-B460-')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
