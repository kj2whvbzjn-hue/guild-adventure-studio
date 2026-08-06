const fs=require('fs');
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
const cfg=fs.readFileSync('assets/shared/config/runtime-config.js','utf8');
const game=fs.readFileSync('game/index.html','utf8');
const sw=fs.readFileSync('game/sw.js','utf8');
const pb=JSON.parse(fs.readFileSync('package-build.json','utf8'));
if(bridge.includes('applyTaggedAttack('))throw new Error('formal regression still calls unavailable applyTaggedAttack');
for(const id of ['FORMAL-SHIELD-SINGLE-ABSORB','FORMAL-SHIELD-FIFO']){
  const at=bridge.indexOf(id); if(at<0)throw new Error(`${id} missing`);
  const block=bridge.slice(at,at+1800);
  if(!block.includes("requireSkill('SKL-TEST-ATTACK')"))throw new Error(`${id} does not use Studio production ATTACK`);
  if(!block.includes('executeTaggedSkill(attacker,target,attackSkill)'))throw new Error(`${id} does not execute the common runtime`);
}
if(!bridge.includes("build:'GA-B486.4'"))throw new Error('formal report build mismatch');
if(!bridge.includes('tag-formal-runtime-regression-GA-B486.4-'))throw new Error('formal report filename mismatch');
if(!cfg.includes('gameBuild: "GA-B486.4"')||!cfg.includes('skills.json?v=4864'))throw new Error('runtime config mismatch');
if(!game.includes('GA-B486.4')||!game.includes('?v=4864'))throw new Error('game entry build/cache mismatch');
if(!sw.includes('ga-game-b4864')||!sw.includes('appv=4864'))throw new Error('service worker cache mismatch');
if(pb.game_build!=='GA-B486.4')throw new Error('package-build mismatch');
console.log('SHIELD_FORMAL_REGRESSION_GA_B486_4_OK');
