const fs=require('fs');
const assert=(v,m)=>{if(!v)throw new Error(m)};
const tagShared=fs.readFileSync('game-tag-test/assets/js/device-tag-test-harness.js','utf8');
const gameShared=fs.readFileSync('assets/shared/js/device-game-test-harness.js','utf8');
const game=fs.readFileSync('game/index.html','utf8');
const tag=fs.readFileSync('game-tag-test/index.html','utf8');
const legacyHarness='assets/shared/js/device-test-harness.js';
assert(!fs.existsSync(legacyHarness),'retired shared legacy-capable harness must be physically removed');
for(const shared of [tagShared,gameShared]){
 assert(shared.includes("kind:'real_device_acceptance'"),'report kind missing');
 assert(shared.includes('navigator.serviceWorker.getRegistration'),'service worker probe missing');
 assert(shared.includes('../Export/skill/skills.json'),'skill export probe missing');
 assert(shared.includes('結果JSONをコピー'),'clipboard fallback UI missing');
}
assert(gameShared.includes("['reactive','反応スキル'"),'game reactive manual case missing');
assert(!gameShared.includes('compileTaggedSkill'),'production game harness retains compileTaggedSkill');
assert(!gameShared.includes('executeTaggedSkill'),'production game harness retains executeTaggedSkill');
assert(tagShared.includes("['counter','反撃検証'"),'tag counter manual case missing');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const token=build.game_build.replace(/^GA-B486\./,'486');
assert(game.includes(`../assets/shared/js/device-game-test-harness.js?v=${token}`),'formal game harness ref missing');
assert(!game.includes(`../assets/shared/js/device-test-harness.js?v=${token}`),'legacy-capable shared harness still loaded by game');
assert(tag.includes(`./assets/js/device-tag-test-harness.js?v=${token}`),'isolated tag harness ref missing');
assert(!tag.includes('../assets/shared/js/device-test-harness.js'),'shared legacy-capable harness still loaded by tag-test');
console.log('DEVICE_TEST_HARNESS_GA_B486_92_PASS');
