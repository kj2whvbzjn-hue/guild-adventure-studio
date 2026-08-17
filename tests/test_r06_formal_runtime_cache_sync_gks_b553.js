const assert=require('assert'),fs=require('fs');
const build=require('../package-build.json');
const gameCacheId=String(build.game_build||'').replace(/^GA-B/,'').replace('.','');
const studioCacheId=String(build.studio_build||'').replace(/^GKS-B/,'');
const combo=`${gameCacheId}b${studioCacheId}`;
assert(gameCacheId&&studioCacheId,'current Game/Studio build ids are required');
const html=fs.readFileSync('game/index.html','utf8');
const sw=fs.readFileSync('game/sw.js','utf8');
const cfg=fs.readFileSync('assets/shared/config/runtime-config.js','utf8');
for(const needle of [
 `../assets/shared/config/runtime-config.js?v=${combo}`,
 `./assets/js/tag-skill-runtime.js?v=${combo}`,
 `./assets/js/studio-skill-bridge.js?v=${combo}`,
 `./assets/js/app-runtime.js?v=${combo}`
])assert.ok(html.includes(needle),'game html stale cache key: '+needle);
assert.ok(cfg.includes(`skillExportUrl: '../Export/skill/skills.json?v=${combo}'`),'formal Export cache key stale');
for(const needle of [
 `ga-game-b${gameCacheId}-b${studioCacheId}`,
 `../Export/skill/skills.json?v=${combo}`,
 `../assets/shared/config/runtime-config.js?v=${combo}`,
 `./assets/js/tag-skill-runtime.js?v=${combo}`,
 `./assets/js/studio-skill-bridge.js?v=${combo}`,
 `./assets/js/app-runtime.js?v=${combo}`
])assert.ok(sw.includes(needle),'game SW stale cache key: '+needle);
assert.ok(!html.includes('studio-skill-bridge.js?v=486123b549'));
assert.ok(!html.includes('app-runtime.js?v=486123b549'));
assert.ok(!html.includes('tag-skill-runtime.js?v=486123b550'));
console.log('PASS formal runtime cache synchronization current build');
