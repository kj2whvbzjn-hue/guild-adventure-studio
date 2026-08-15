const assert=require('assert'),fs=require('fs');
const build=require('../package-build.json');
assert.strictEqual(build.studio_build,'GKS-B590');
const html=fs.readFileSync('game/index.html','utf8');
const sw=fs.readFileSync('game/sw.js','utf8');
const cfg=fs.readFileSync('assets/shared/config/runtime-config.js','utf8');
for(const needle of [
 '../assets/shared/config/runtime-config.js?v=486182b590',
 './assets/js/tag-skill-runtime.js?v=486182b590',
 './assets/js/studio-skill-bridge.js?v=486182b590',
 './assets/js/app-runtime.js?v=486182b590'
])assert.ok(html.includes(needle),'game html stale cache key: '+needle);
assert.ok(cfg.includes("skillExportUrl: '../Export/skill/skills.json?v=486182b590'"),'formal Export cache key stale');
for(const needle of [
 'ga-game-b486182-b590',
 '../Export/skill/skills.json?v=486182b590',
 '../assets/shared/config/runtime-config.js?v=486182b590',
 './assets/js/tag-skill-runtime.js?v=486182b590',
 './assets/js/studio-skill-bridge.js?v=486182b590',
 './assets/js/app-runtime.js?v=486182b590'
])assert.ok(sw.includes(needle),'game SW stale cache key: '+needle);
assert.ok(!html.includes('studio-skill-bridge.js?v=486123b549'));
assert.ok(!html.includes('app-runtime.js?v=486123b549'));
assert.ok(!html.includes('tag-skill-runtime.js?v=486123b550'));
console.log('PASS GKS-B553 formal runtime cache synchronization');
