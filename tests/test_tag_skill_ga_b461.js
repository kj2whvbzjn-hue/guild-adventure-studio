'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const compiler=require(path.join(root,'assets','shared','js','skill-compiler.js'));
const registry=require(path.join(root,'assets','shared','config','skill-registry.json'));

const skill={
  schemaVersion:1,
  id:'SKL-B461-FORMAL-POISON',
  name:'B461 Formal Poison Regression',
  skillLevel:1,
  trigger:{type:'ON_USE',scope:'SELF'},
  conditions:[],
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[
    {type:'DAMAGE',power:100,damageType:'PHYSICAL'},
    {type:'APPLY',effectId:'POISON',power:20,duration:1000,interval:100,stackGain:1}
  ],
  resource:{mpCost:0,cooldown:0,activationPriority:0}
};

const formal=compiler.compileSkill(skill,registry);
assert.strictEqual(formal.ok,true,JSON.stringify(formal.errors));
assert.strictEqual(formal.warnings.length,0,JSON.stringify(formal.warnings));
assert.strictEqual(formal.compiledSkill.runtimeContracts.schemaVersion,1);
assert.deepStrictEqual(formal.compiledSkill.runtimeContracts.effectContracts.map(x=>x.type),['DAMAGE']);
assert.strictEqual(formal.compiledSkill.runtimeContracts.applyContracts[0].kind,'DOT');

const events=[];
const context={
  console,Set,Number,Math,JSON,String,Array,Date,Map,WeakMap,Promise,
  queueSceneEvent:()=>{},finishIfNeeded:()=>false,renderBattle:()=>{},
  recordValidationEvent:(type,payload={})=>events.push({type,...payload}),
  battle:{tick:0,log:[],units:[],result:null,pendingResult:null}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'game','assets','js','tag-skill-runtime.js'),'utf8'),context);

const compiled=context.compileSkillForRuntime(formal.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(compiled.definition.logicOrder.join(','),'ATTACK,DOT');
assert.strictEqual(compiled.definition.parameters.dotPower,20);
assert.strictEqual(compiled.definition.parameters.dotDuration,1000);
assert.strictEqual(compiled.definition.parameters.dotInterval,100);
assert.strictEqual(compiled.definition.parameters.stackGain,1);

const actor={id:'A',name:'Actor',alive:true,side:'味方',attack:50,damageDealt:0,mp:0,maxMp:0,cooldowns:{},coverEffects:[],statusEffects:[],dotStacks:[],modifierStacks:[],shieldEffects:[]};
const target={id:'E',name:'Enemy',alive:true,side:'敵',hp:60,maxHp:60,damageTaken:0,gauge:0,dotStacks:[],statusEffects:[],modifierStacks:[],shieldEffects:[],coverEffects:[],defenseResistance:0};
context.battle.units=[actor,target];

const result=context.executeSkillRuntime(actor,target,formal.compiledSkill,{suppressDerived:true,skipExecutionEligibility:true});
assert.strictEqual(result.ok,true);
assert.strictEqual(result.attackResult.runtimeContracts,true,'ATTACK must execute from Formal runtimeContracts');
assert.strictEqual(result.attackResult.damage,50,'100% attack');
assert.strictEqual(result.dotResult.added,1,'DOT stack add');
assert.strictEqual(target.hp,10,'direct attack damage');
assert.strictEqual(target.dotStacks[0].nextTick,100,'DOT interval');

context.battle.tick=100;
context.processDotStacks();
assert.strictEqual(target.hp,0,'DOT defeat damage');
assert.strictEqual(target.alive,false,'DOT defeat state');
assert.strictEqual(target.dotStacks.length,0,'DOT stacks cleared on defeat');
assert(events.some(x=>x.type==='dot_damage'),'dot_damage event');
assert(events.some(x=>x.type==='dot_defeat'),'dot_defeat event');

console.log('PASS GA-B461 regression: Formal compiler/runtime/DOT defeat; Legacy dependency removed');
