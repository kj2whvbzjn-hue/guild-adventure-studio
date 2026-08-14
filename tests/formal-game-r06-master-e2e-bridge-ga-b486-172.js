const fs=require('fs'),vm=require('vm'),assert=require('assert');
const masterSkills=Array.from({length:48},(_,i)=>({
  schemaVersion:1,
  id:`SKL-${String(i+1).padStart(4,'0')}`,
  name:`R06大量複合検査 V${String(i+1).padStart(2,'0')} fixture`,
  trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:10}],resource:{mpCost:0,cooldown:0},
  runtimeContracts:{schemaVersion:1,triggerContract:{},conditionContracts:[],effectContracts:[{type:'DAMAGE',power:10}],applyContracts:[]}
}));
const storage=new Map([
 ['gas_v4_current_project_v060','PRJ-GAS-V4'],
 ['gas_v4_project_v060_PRJ-GAS-V4',JSON.stringify({masters:{skills:masterSkills}})]
]);
const context={console,Map,window:{GA_PROJECT_CONFIG:{skillExportUrl:'../Export/skill/skills.json'}},globalThis:null,localStorage:{getItem:k=>storage.get(k)||null},compileSkillRuntime:s=>({ok:!!s?.runtimeContracts,errors:s?.runtimeContracts?[]:['missing'],definition:{runtimeContracts:s?.runtimeContracts,logicOrder:['ATTACK']}}),SKILLS:[{id:'KEEP'}]};
context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8'),context);
const listed=vm.runInContext('listR06MasterSkillsForGameE2E()',context);
assert.strictEqual(listed.ok,true);assert.strictEqual(listed.skills.length,48);assert.strictEqual(listed.skills[0].id,'SKL-0001');assert.strictEqual(listed.skills[47].id,'SKL-0048');
const loaded=vm.runInContext("loadR06MasterSkillForGameE2E('SKL-0001')",context);
assert.strictEqual(loaded.ok,true);assert.strictEqual(loaded.skill.e2e_test_only,true);assert.strictEqual(loaded.skill.source,'studio_master_localstorage');
assert.strictEqual(vm.runInContext("findDeveloperE2ESkill('SKL-0001').id",context),'SKL-0001');
assert.deepStrictEqual(context.SKILLS,[{id:'KEEP'}],'developer E2E bridge must not contaminate production SKILLS store');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8'),battle=fs.readFileSync('game/assets/js/battle-control.js','utf8'),html=fs.readFileSync('game/index.html','utf8');
assert(app.includes('developerE2ESkillOverrides=new Map()'));
assert(app.includes('defaultSkillId:e2e||c.equippedSkillId'));
assert(app.includes('loadR06MasterSkillForGameE2E(sid)'));
assert(battle.includes("findDeveloperE2ESkill==='function'"));
assert(battle.includes('e2e?.e2e_test_only===true'));
for(const id of ['r06GameE2EPanel','r06E2ECharacter','r06E2ESkill','r06E2ELoad','r06E2EEquip','r06E2EClear','r06E2EStatus'])assert(html.includes(`id=\"${id}\"`),`${id} missing`);
assert(html.includes('正式SKILLS/セーブデータへは追加しません。'));
console.log('FORMAL_GAME_R06_MASTER_E2E_BRIDGE_OK');
