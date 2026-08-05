const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
const test=fs.readFileSync(path.join(root,'game-tag-test','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'game','sw.js'),'utf8');
const checks=[
 ['game build',game.includes('GA-B461')],
 ['tag compiler',game.includes('function compileTaggedSkill')],
 ['tag execute',game.includes('function executeTaggedSkill')],
 ['dot stacks',game.includes('function applyTaggedDot')],
 ['dot ticking',game.includes('function processDotStacks')],
 ['dot defeat',game.includes("recordValidationEvent('dot_defeat'")],
 ['json validation',game.includes('build:\'GA-B461\'')],
 ['service worker',sw.includes("guild-adventure-ga-b461")&&sw.includes('appv=461')],
 ['test route retained',test.includes('GA-B460')&&!test.includes('GA-B461')]
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
