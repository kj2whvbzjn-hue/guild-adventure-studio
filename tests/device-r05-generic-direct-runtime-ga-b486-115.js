const fs=require('fs');
const assert=require('assert');
const build=require('../package-build.json');
assert.ok(/^GA-B486\.\d+$/.test(build.game_build),`unexpected build ${build.game_build}`);
const html=fs.readFileSync('game/index.html','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
assert.ok(html.includes('id="tagTestRunR05GenericDirectRuntimeJson"'),'R05 device button missing');
for(const marker of [
 'async function runR05GenericDirectRuntimeDeviceValidation()',
 'R05-GENERIC-DIRECT-RUNTIME-DEVICE-001',
 "skill_source:'generated_at_test_time_from_current_generic_contract'",
 'uses_studio_export:false',
 'uses_legacy_demo_export:false',
 'R05-DEVICE-DAMAGE',
 'R05-DEVICE-HEAL',
 'R05-DEVICE-APPLY',
 'R05-DEVICE-REMOVE',
 'R05-DEVICE-RESOURCE-CHANGE',
 'R05-DEVICE-REVIVE',
 'R05-DEVICE-TARGET-CONTROL',
 'R05-DEVICE-SPECIAL-BOUNDARY',
 'tagTestRunR05GenericDirectRuntimeJson'
])assert.ok(app.includes(marker),`app marker missing: ${marker}`);
assert.ok(app.includes("source:'r05_current_contract_device_fixture'"),'fixture provenance missing');
assert.ok(app.includes("t==='DAMAGE=73'?'DAMAGE=999':t"),'DAMAGE legacy tamper check missing');
assert.ok(app.includes("t==='HEAL=63'?'HEAL=999':t"),'HEAL legacy tamper check missing');
assert.ok(app.includes("t.startsWith('COVER_PRIORITY=')?'COVER_PRIORITY=999':t"),'TARGET_CONTROL legacy tamper check missing');

const tagHtml=fs.readFileSync('game-tag-test/index.html','utf8');
const tagValidation=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');
assert.ok(tagHtml.includes('id="tagTestRunR05GenericDirectRuntimeJson"'),'R05 tag-test device button missing');
for(const marker of [
 'async function runR05GenericDirectRuntimeDeviceValidation()',
 'R05-GENERIC-DIRECT-RUNTIME-DEVICE-001',
 "entrypoint='game-tag-test/index.html'",
 'runR05GenericDirectRuntimeJson.onclick=tagTestRunR05GenericDirectRuntimeJson',
 'tagTestRunR05GenericDirectRuntimeJson'
])assert.ok(tagValidation.includes(marker),`tag-test marker missing: ${marker}`);
console.log('DEVICE_R05_GENERIC_DIRECT_RUNTIME_GA_B486_116_PASS');
