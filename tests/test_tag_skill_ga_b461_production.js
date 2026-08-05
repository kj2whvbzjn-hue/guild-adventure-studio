const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
const test=fs.readFileSync(path.join(root,'game-tag-test','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'game','sw.js'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(game.includes('GA-B461 — Tag Skill ATTACK + DOT Runtime'),'production build label missing');
ok(game.includes("const TAG_SKILL_TEST_BUILD='GA-B461 / Production ATTACK + DOT Runtime';"),'production runtime marker missing');
ok(game.includes("const TAG_LOGIC_ORDER=['ATTACK','DOT'"),'tag compiler missing');
ok(game.includes('function applyTaggedDot'),'DOT apply runtime missing');
ok(game.includes('function processDotStacks'),'DOT tick runtime missing');
ok(game.includes('executeTaggedSkill(actor,target,skill'),'reserved tag skill execution missing');
ok(game.includes('dot_defeat'),'DOT defeat handling missing');
ok(sw.includes("guild-adventure-ga-b461"),'service worker cache not bumped');
ok(sw.includes('appv=461'),'service worker app version not bumped');
ok(test.includes('GA-B460'),'test harness build must remain GA-B460');
ok(!test.includes('GA-B461 — Tag Skill ATTACK + DOT Runtime'),'test harness was overwritten');
console.log('GA-B461 production integration checks: PASS');
