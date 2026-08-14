'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const build=JSON.parse(fs.readFileSync(path.join(root,'package-build.json'),'utf8'));
const buildId=build.game_build;
const cacheId=buildId.replace(/^GA-B/,'').replace('.','');
const html=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
const appRuntime=fs.readFileSync(path.join(root,'game','assets','js','app-runtime.js'),'utf8');
const formalRuntime=fs.readFileSync(path.join(root,'game','assets','js','tag-skill-runtime.js'),'utf8');
const harness=fs.readFileSync(path.join(root,'assets','shared','js','device-game-test-harness.js'),'utf8');
const gameSw=fs.readFileSync(path.join(root,'game','sw.js'),'utf8');
const compiler=require(path.join(root,'assets','shared','js','skill-compiler.js'));
const registry=require(path.join(root,'assets','shared','config','skill-registry.json'));

// Retain the original device-HEAL acceptance intent on the Formal Game surface.
assert.strictEqual(buildId,'GA-B486.179');
assert(html.includes('id="tagTestRunHealSingle"'),'Formal Game single-heal validation control missing');
assert(html.includes('id="tagTestRunHealAll"'),'Formal Game all-ally-heal validation control missing');
assert(appRuntime.includes('function runHealSingleValidation()'),'Formal Game single-heal validation missing');
assert(appRuntime.includes('function runHealAllValidation()'),'Formal Game all-ally-heal validation missing');
assert(appRuntime.includes("findSkill('SKL-TEST-HEAL-100')"),'single-heal Formal fixture missing');
assert(appRuntime.includes("findSkill('SKL-TEST-HEAL-ALL-60')"),'all-ally-heal Formal fixture missing');
assert(appRuntime.includes('executeSkillRuntime(actor,target,skill)'),'single-heal does not execute Production Runtime');
assert(appRuntime.includes('executeSkillRuntime(actor,allies[1],skill)'),'all-ally-heal does not execute Production Runtime');
assert(formalRuntime.includes("const GKS_SKILL_RUNTIME_MODE=Object.freeze({production:'runtimeContracts_only'})"),'Production Skill Runtime is not runtimeContracts-only');
assert(harness.includes("kind:'real_device_acceptance'"),'Formal Game real-device JSON harness missing');
assert(harness.includes('device-acceptance-${context}-${BUILD}-'),'device JSON filename is not derived from current Formal Game build');
assert(harness.includes('結果JSONをコピー'),'device JSON copy path missing');
assert(html.includes(`../assets/shared/js/device-game-test-harness.js?v=${cacheId}`),'device harness cache buster is not current');
assert(gameSw.includes(`ga-game-b${cacheId}-b565`),'Game Service Worker cache is not current');
assert(gameSw.includes(`device-game-test-harness.js?v=${cacheId}`),'Game Service Worker does not cache the current device harness');

// Prove HEAL itself executes through Formal compiler -> runtimeContracts -> Production Runtime.
const skill={
  schemaVersion:1,
  id:'SKL-B4831-FORMAL-HEAL',
  name:'B483.1 Formal Heal Device Regression',
  skillLevel:1,
  trigger:{type:'ON_USE',scope:'SELF'},
  conditions:[],
  target:{side:'ALLY',range:'SINGLE'},
  effects:[{type:'HEAL',power:100}],
  resource:{mpCost:0,cooldown:0,activationPriority:0}
};
const formal=compiler.compileSkill(skill,registry);
assert.strictEqual(formal.ok,true,JSON.stringify(formal.errors));
assert.strictEqual(formal.warnings.length,0,JSON.stringify(formal.warnings));
assert.deepStrictEqual(formal.compiledSkill.runtimeContracts.effectContracts,[{type:'HEAL',power:100}]);

const events=[];
const context={
  console,Set,Number,Math,JSON,String,Array,Date,Map,WeakMap,Promise,
  recordValidationEvent:(type,payload={})=>events.push({type,payload}),
  battle:{tick:0,log:[],units:[],result:null,pendingResult:null}
};
vm.createContext(context);
vm.runInContext(formalRuntime,context);
const compiled=context.compileSkillForRuntime(formal.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(compiled.definition.logicOrder.join(','),'HEAL');
const actor={id:'A',name:'Actor',alive:true,side:'味方'};
const target={id:'T',name:'Target',alive:true,side:'味方',hp:50,maxHp:100};
const result=context.executeRuntimeHealRuntime(actor,target,compiled);
assert.strictEqual(result.ok,true);
assert.strictEqual(result.requested,100);
assert.strictEqual(result.healed,50);
assert.strictEqual(result.overheal,50);
assert.strictEqual(target.hp,100);
assert(events.some(x=>x.type==='skill_heal_executed'&&x.payload.power===100),'Formal HEAL execution event missing');

console.log('HEAL_FORMAL_DEVICE_JSON_GA_B483_1_OK');
