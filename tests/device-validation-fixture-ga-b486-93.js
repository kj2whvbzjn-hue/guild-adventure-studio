const fs=require('fs');
const assert=(v,m)=>{if(!v)throw new Error(m)};
const runtime=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
assert(build.game_build==='GA-B486.94','unexpected game build');
assert(runtime.includes("function currentValidationGameBuild(){return window.GA_PROJECT_CONFIG?.gameBuild||'UNKNOWN'}"),'current build helper missing');
const fixture=(runtime.match(/function prepareShieldValidationFixture\(\)\{[^\n]+/)||[])[0]||'';
assert(fixture.includes("ensureValidationTargets('味方',3)"),'shield fixture does not ensure three allies');
assert(fixture.includes("ensureValidationTargets('敵',1)"),'shield fixture does not ensure an enemy');
assert(fixture.includes('u.shieldEffects=[]'),'shield fixture does not reset shields');
assert(runtime.includes("for(const e of battle.units.filter(u=>u.side==='敵')){e.hp=0;e.alive=false}finishIfNeeded();"),'shield battle-end validation does not defeat all battle enemies');
assert(!runtime.includes("for(const e of f.enemies){e.hp=0;e.alive=false}finishIfNeeded();"),'shield battle-end validation still depends on fixture enemy subset');
for(const id of ['TAG-HEAL-DEVICE-001','TAG-SHIELD-DEVICE-001','TAG-STATUS-DEVICE-001','TAG-CLEANSE-DEVICE-001','TAG-REVIVE-RATE-DEVICE-001']){
  const pos=runtime.indexOf(`id:'${id}'`); assert(pos>=0,`${id} missing`);
  const chunk=runtime.slice(Math.max(0,pos-180),pos+180);
  assert(chunk.includes('build:currentValidationGameBuild()'),`${id} still exports stale build`);
}
console.log('DEVICE_VALIDATION_FIXTURE_GA_B486_93_PASS');
