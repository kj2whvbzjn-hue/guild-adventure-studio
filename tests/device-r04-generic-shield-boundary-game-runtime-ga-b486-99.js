const fs=require('fs');
const assert=require('assert');
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const registry=require('../assets/shared/config/skill-generic-registry.json');
const build=require('../package-build.json');
assert.strictEqual(build.game_build,'GA-B486.103');
const sample={schemaVersion:1,id:'R04-DEVICE-GENERIC-SHIELD-BOUNDARY',name:'R04 Generic Shield Boundary Device',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power:100,duration:300}],resource:{mpCost:0,cooldown:0}};
const generated=generic.compileGenericSkill(sample,registry);
assert.strictEqual(generated.ok,true,JSON.stringify(generated.errors));
const contract=(generated.legacySkill.genericRuntime.applyContracts||[]).find(x=>x.kind==='SHIELD');
assert.ok(contract,'SHIELD apply contract missing');
assert.strictEqual(contract.lifecycle.stackRule,'STACK');
assert.strictEqual(contract.lifecycle.consumeRule,'FIFO');
assert.strictEqual(contract.lifecycle.removeOnDeath,true);
assert.strictEqual(contract.lifecycle.removeOnBattleEnd,true);
const html=fs.readFileSync('game/index.html','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const runtime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const control=fs.readFileSync('game/assets/js/battle-control.js','utf8');
assert.ok(html.includes('id="tagTestRunR04GenericShieldBoundaryRuntimeJson"'),'Game Generic SHIELD boundary device button missing');
for(const marker of [
 'async function runR04GenericShieldBoundaryDeviceValidation()',
 'GKSGenericSkillBridge.compileForLegacy',
 'R04-GENERIC-SHIELD-BOUNDARY-STACK',
 'R04-GENERIC-SHIELD-BOUNDARY-FIFO',
 'R04-GENERIC-SHIELD-BOUNDARY-DEATH-CLEANUP',
 'R04-GENERIC-SHIELD-BOUNDARY-BATTLE-END',
 'generic_production_runtime_boundary_device_validation'
])assert.ok(app.includes(marker),`app marker missing: ${marker}`);
for(const marker of ['function consumeShieldLayersLifecycle(','function processApplyLifecycleDeathCleanup(','function processApplyLifecycleCleanup(','function resetCombatantOnDeath('])assert.ok(runtime.includes(marker),`runtime marker missing: ${marker}`);
assert.ok(control.includes("processApplyLifecycleCleanup('battle_end')"),'battle-end lifecycle cleanup missing');
console.log('DEVICE_R04_GENERIC_SHIELD_BOUNDARY_GAME_RUNTIME_GA_B486_99_PASS');
