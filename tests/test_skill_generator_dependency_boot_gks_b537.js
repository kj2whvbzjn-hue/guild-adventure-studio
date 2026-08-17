const assert=require('assert');
const fs=require('fs');
const build=require('../package-build.json');
const html=fs.readFileSync('studio/index.html','utf8');
const skg=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const sw=fs.readFileSync('studio/sw.js','utf8');

assert.strictEqual(build.studio_build,'GKS-B608');
assert.ok(skg.includes('const DEPENDENCY_TIMEOUT_MS=12000'),'dependency boot must have a bounded timeout');
assert.ok(skg.includes('Promise.race([request,timeout])'),'dependency fetch must race network with timeout');
assert.ok(skg.includes('controller?.abort()'),'timeout must abort the pending fetch when AbortController is available');
for(const [label,url] of [
 ['Skill Registry','../assets/shared/config/skill-registry.json'],
 ['Budget Rules','../assets/shared/config/skill-budget-rules.json'],
 ['AI Rules','../assets/shared/config/skill-ai-generation-rules.json']
]){
 assert.ok(skg.includes(`fetchJsonDependency('${url}','${label}')`),`${label} must use bounded dependency loading`);
 assert.ok(sw.includes(`"${url}"`),`${label} must be in Studio service-worker app shell`);
}
assert.ok(!skg.includes('runtime-requirements.json'),'retired Runtime Requirements must not be a Skill Generator dependency');
assert.ok(!sw.includes('./skill/runtime-requirements.json'),'retired Runtime Requirements must not be precached by Studio');
assert.ok(skg.includes('registry:skillRegistry'),'Skill compile must reuse the already-loaded registry instead of refetching it');
assert.ok(skg.includes("setBootStatus('初期化停止: '+message,'error')"),'timeout/fetch failure must be visible in-view');
assert.ok(html.includes('Game GA-B486.190 / Studio GKS-B608'),'Studio header build must not show the stale GKS-B527 label');
assert.ok(html.includes('./skill/skill-generator.js?v=33'),'Skill Generator cache key must advance');
assert.ok(html.includes("navigator.serviceWorker.register('./sw.js?v=608'"),'Studio service worker URL must advance');
assert.ok(html.includes("url.searchParams.set('appv','608')"),'Studio reload appv must advance');
assert.ok(sw.includes('const CACHE_NAME="gks-studio-b608"'),'Studio cache namespace must advance');
console.log('PASS GKS-B538 Skill Generator bounded dependency boot / precache regression');
