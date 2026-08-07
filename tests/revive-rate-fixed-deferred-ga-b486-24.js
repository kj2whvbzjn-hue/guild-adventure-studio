const fs=require('fs');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const spec=JSON.parse(fs.readFileSync('docs/design/P01-05_REVIVE_CURRENT_SPEC.json','utf8'));
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const encoding=fs.readFileSync('docs/operations/ENCODING_POLICY.md','utf8');
const checks=[
 ['build',build.game_build==='GA-B486.24'],
 ['rate report build',app.includes("build:'GA-B486.24'")&&app.includes('tag-revive-rate-game-runtime-validation-GA-B486.24-')],
 ['fixed removed from release cases',!app.includes("run('REVIVE-FIXED-REGRESSION'")],
 ['fixed retained deferred diagnostic',app.includes("id:'REVIVE-FIXED-DEFERRED'")&&app.includes('release_gate:false')],
 ['rate gate 7',spec.validation.release_gate_case_count===7],
 ['fixed future candidate',spec.decisions.fixed_mode_future_use==='candidate_for_last_stand_foundation'],
 ['ascii readme policy',encoding.includes('README_GITHUB_REFLECTION.md')],
 ['legacy japanese readme absent',!fs.existsSync('README_GITHUB反映.md')&&fs.existsSync('README_GITHUB_REFLECTION.md')]
];
const bad=checks.filter(x=>!x[1]);
if(bad.length){for(const [n] of bad)console.error('FAIL',n);process.exit(1)}
console.log('REVIVE_RATE_FIXED_DEFERRED_GA_B486_24_OK');
