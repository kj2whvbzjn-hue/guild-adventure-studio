const fs=require('fs');
const src=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const required=[
  "build:'GA-B486.3'",
  "FORMAL-SHIELD-SINGLE-ABSORB",
  "FORMAL-SHIELD-ALL",
  "FORMAL-SHIELD-FIFO",
  "FORMAL-SHIELD-DURATION",
  "FORMAL-SHIELD-BATTLE-END",
  "SKL-TEST-SHIELD-40",
  "shield_runtime_passed_count",
  "tag-formal-runtime-regression-GA-B486.3-"
];
for(const token of required){if(!src.includes(token))throw new Error(`missing: ${token}`)}
const cfg=fs.readFileSync('assets/shared/config/runtime-config.js','utf8');
if(!cfg.includes('gameBuild: "GA-B486.3"')||!cfg.includes("skills.json?v=4863"))throw new Error('runtime config build mismatch');
const pb=JSON.parse(fs.readFileSync('package-build.json','utf8'));
if(pb.game_build!=='GA-B486.3')throw new Error('package-build mismatch');
console.log('SHIELD_FORMAL_REGRESSION_GA_B486_3_OK');
