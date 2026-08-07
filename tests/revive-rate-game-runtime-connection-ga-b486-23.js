const fs=require('fs');
const runtime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const html=fs.readFileSync('game/index.html','utf8');
const required=[
 ['compiler mutual exclusion',runtime.includes('REVIVE_HPとREVIVE_HP_RATEは同時指定できません')],
 ['compiler rate range',runtime.includes('REVIVE_HP_RATEは0より大きく1以下の有限数が必要です')],
 ['runtime rate mode',runtime.includes("mode==='rate'")&&runtime.includes('Math.floor(maxHp*reviveValue)')],
 ['game validation 8 cases',app.includes('REVIVE-RATE-SINGLE')&&app.includes('REVIVE-FIXED-REGRESSION')&&app.includes('REVIVE-RATE-INVALID-DATA')],
 ['game runtime report',app.includes('tag-revive-rate-game-runtime-validation-GA-B486.23-')],
 ['ui label',html.includes('蘇生割合JSON検証')]
];
const failed=required.filter(x=>!x[1]);
if(failed.length){console.error(failed.map(x=>x[0]).join('\n'));process.exit(1)}
console.log('REVIVE_RATE_GAME_RUNTIME_CONNECTION_GA_B486_23_OK');
