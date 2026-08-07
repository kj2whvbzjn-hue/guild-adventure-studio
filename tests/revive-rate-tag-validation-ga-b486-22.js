const fs=require('fs');
const compiler=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
const validation=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');
const checks=[
 ['rate accepted',compiler.includes("hasRate&&(!Number.isFinite(n.REVIVE_HP_RATE.value)")],
 ['mutual exclusion',compiler.includes('REVIVE_HPとREVIVE_HP_RATEは同時指定できません')],
 ['rate calculation',compiler.includes('Math.floor(maxHp*reviveValue)')],
 ['minimum one',compiler.includes('Math.max(1,Math.floor(maxHp*reviveValue))')],
 ['rate validation report',validation.includes('TAG-REVIVE-RATE-DEVICE-001')],
 ['fixed regression',validation.includes('REVIVE-FIXED-REGRESSION')],
 ['invalid both',validation.includes('fixed_and_rate:both')],
 ['build',validation.includes("build:'GA-B486.22'")]
];
const failed=checks.filter(x=>!x[1]);
if(failed.length){console.error(failed.map(x=>x[0]).join('\n'));process.exit(1)}
console.log('REVIVE_RATE_TAG_VALIDATION_GA_B486_22_OK');
