const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','game-tag-test','index.html'),'utf8');
const checks=[
 ['GA-B459 build',html.includes('GA-B459 / Sprint 2.3 / DOT Independent Timer Verification')],
 ['staggered button',html.includes('id="tagTestRunStaggered"')],
 ['staggered test id',html.includes('TAG-DOT-STAGGERED-TIMER-001')],
 ['requested 1600 ticks',html.includes('requestedTicks:1600')],
 ['add tick expectations',html.includes('expectedAddTicks:[0,250,600]')],
 ['expire tick expectations',html.includes('expectedExpireTicks:[1000,1250,1600]')],
 ['three staggered executions',html.includes('processTicks(250)')&&html.includes('processTicks(350)')&&html.includes('processTicks(1000)')],
 ['per-stack hit schedule',html.includes('expectedHitTicksByStack')],
 ['schedule validation',html.includes('DOT付与Tick不一致')&&html.includes('DOT終了Tick不一致')&&html.includes('DOT発生Tick不一致')],
 ['AI isolation',html.includes('if(battle.validationMode)continue')],
 ['GA-B459 JSON filename',html.includes('tag-dot-validation-GA-B459-')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
