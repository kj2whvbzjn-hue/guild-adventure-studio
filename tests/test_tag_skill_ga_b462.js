'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');

const gameHtml=fs.readFileSync(path.join(root,'game','index.html'),'utf8');
const appRuntime=fs.readFileSync(path.join(root,'game','assets','js','app-runtime.js'),'utf8');
const battleControl=fs.readFileSync(path.join(root,'game','assets','js','battle-control.js'),'utf8');
const compiler=require(path.join(root,'assets','shared','js','skill-compiler.js'));
const registry=require(path.join(root,'assets','shared','config','skill-registry.json'));

// B462 intent retained: skill loadout UI, persisted equipped skill, and battle handoff.
assert(/data-base-view="character-skills"/.test(gameHtml),'character skill view missing');
assert(/id="characterSkillList"/.test(gameHtml),'character skill list missing');
assert(/skills:\['SKL-TEST-ATTACK','SKL-TEST-HEAVY','SKL-TEST-POISON'\]/.test(appRuntime),'owned skill defaults missing');
assert(/equippedSkillId:'SKL-TEST-ATTACK'/.test(appRuntime),'default equipped skill missing');
assert(/c\.equippedSkillId=c\.skills\.includes\(c\.equippedSkillId\)\?c\.equippedSkillId:/.test(appRuntime),'equipped skill migration missing');
assert(/data-equip-skill/.test(appRuntime)&&/c\.equippedSkillId=id/.test(appRuntime)&&/persist\(\)/.test(appRuntime),'equip action persistence missing');
assert(/defaultSkillId:c\.equippedSkillId\|\|c\.skills\?\.\[0\]/.test(appRuntime),'equipped skill battle handoff missing');
assert(/formalBattleSkill\(actor\.defaultSkillId\)/.test(battleControl),'battle does not resolve equipped skill through Formal Production registry');
assert(/compileSkillForRuntime\(skill\)/.test(battleControl),'battle compile boundary missing');
assert(/executeSkillRuntime\(actor,target,skill/.test(battleControl),'battle execution boundary missing');
assert(!/findTagSkill\(actor\.defaultSkillId\)/.test(appRuntime+battleControl),'Legacy findTagSkill battle dependency remains');
assert(!gameHtml.includes('スキル装着画面は次の実験Buildで追加します。'),'obsolete placeholder remains');

// Prove the handoff target is executable through Formal compiler -> runtimeContracts -> Production Runtime.
const skill={
  schemaVersion:1,
  id:'SKL-B462-FORMAL-EQUIP',
  name:'B462 Formal Equipped Skill Regression',
  skillLevel:1,
  trigger:{type:'ON_USE',scope:'SELF'},
  conditions:[],
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0,activationPriority:0}
};
const formal=compiler.compileSkill(skill,registry);
assert.strictEqual(formal.ok,true,JSON.stringify(formal.errors));
assert.strictEqual(formal.warnings.length,0,JSON.stringify(formal.warnings));
assert.strictEqual(formal.compiledSkill.runtimeContracts.schemaVersion,1);
assert.deepStrictEqual(formal.compiledSkill.runtimeContracts.effectContracts.map(x=>x.type),['DAMAGE']);

const context={
  console,Set,Number,Math,JSON,String,Array,Date,Map,WeakMap,Promise,
  queueSceneEvent:()=>{},finishIfNeeded:()=>false,renderBattle:()=>{},
  recordValidationEvent:()=>{},
  battle:{tick:0,log:[],units:[],result:null,pendingResult:null}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'game','assets','js','tag-skill-runtime.js'),'utf8'),context);
const compiled=context.compileSkillForRuntime(formal.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(compiled.definition.logicOrder.join(','),'ATTACK');

const actor={id:'A',name:'Actor',alive:true,side:'味方',attack:50,damageDealt:0,mp:0,maxMp:0,cooldowns:{},coverEffects:[],statusEffects:[],dotStacks:[],modifierStacks:[],shieldEffects:[]};
const target={id:'E',name:'Enemy',alive:true,side:'敵',hp:100,maxHp:100,damageTaken:0,gauge:0,dotStacks:[],statusEffects:[],modifierStacks:[],shieldEffects:[],coverEffects:[],defenseResistance:0};
context.battle.units=[actor,target];
const result=context.executeSkillRuntime(actor,target,formal.compiledSkill,{suppressDerived:true,skipExecutionEligibility:true});
assert.strictEqual(result.ok,true);
assert.strictEqual(result.attackResult.runtimeContracts,true,'equipped skill must execute from Formal runtimeContracts');
assert.strictEqual(result.attackResult.damage,50,'100% equipped attack');
assert.strictEqual(target.hp,50,'equipped skill damage application');

console.log('PASS GA-B462 regression: loadout UI -> Formal Production battle handoff; Legacy dependency removed');
