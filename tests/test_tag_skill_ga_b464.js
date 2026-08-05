const fs=require('fs');
const html=fs.readFileSync('game/index.html','utf8');
const sw=fs.readFileSync('game/sw.js','utf8');
const checks=[
 ['build',html.includes('GA-B464')],
 ['multi runtime',html.includes('BUFF + DEBUFF Multi-Target Runtime')],
 ['buff all button',html.includes('tagTestRunBuffAll')],
 ['debuff all button',html.includes('tagTestRunDebuffAll')],
 ['all range resolver',html.includes("range!=='all'")],
 ['resolved target loop',html.includes('for(const resolvedTarget of resolved.targets)')],
 ['three validation targets',html.includes('ensureValidationTargets(targetSide,3)')],
 ['per target transitions',html.includes('effective_transitions_by_target')],
 ['9 stack expectation formula',html.includes('expectedPerTarget*targetIds.length')],
 ['AI isolation',html.includes('通常AI行動が混入しました')],
 ['json filename',html.includes('tag-modifier-validation-GA-B464-')],
 ['service worker',sw.includes('guild-adventure-ga-b464')&&sw.includes('appv=464')]
];
let fail=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)fail++}process.exit(fail?1:0);
