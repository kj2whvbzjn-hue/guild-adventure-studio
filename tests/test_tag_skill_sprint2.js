'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');

const skill={
  schemaVersion:1,
  id:'SKL-9201',
  name:'formal-poison',
  skillLevel:5,
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

const context={
  console,Set,Number,Math,JSON,String,Array,Date,Map,WeakMap,Promise,
  queueSceneEvent:()=>{},finishIfNeeded:()=>false,renderBattle:()=>{},recordValidationEvent:()=>{},
  battle:{tick:0,log:[],units:[],result:null,pendingResult:null}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),context);

const compiled=context.compileSkillForRuntime(formal.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(compiled.definition.logicOrder.join(','),'ATTACK,DOT');
assert.strictEqual(compiled.definition.parameters.dotPower,20);
assert.strictEqual(compiled.definition.parameters.dotDuration,1000);
assert.strictEqual(compiled.definition.parameters.dotInterval,100);
assert.strictEqual(compiled.definition.parameters.stackGain,1);

const actor={id:'A',name:'Actor',alive:true,side:'味方',attack:50,damageDealt:0,mp:0,maxMp:0,cooldowns:{}};
const target={id:'E',name:'Enemy',alive:true,side:'敵',hp:500,maxHp:500,damageTaken:0,dotStacks:[],shieldEffects:[],defenseResistance:0};
context.battle.units=[actor,target];

const result=context.executeSkillRuntime(actor,target,formal.compiledSkill,{suppressDerived:true,skipExecutionEligibility:true});
assert.strictEqual(result.ok,true);
assert.strictEqual(result.attackResult.runtimeContracts,true,'ATTACK must execute from Formal runtimeContracts');
assert.strictEqual(result.attackResult.damage,50,'100% attack');
assert.strictEqual(result.dotResult.added,1,'DOT stack add');
assert.strictEqual(target.dotStacks[0].nextTick,100,'DOT interval');
assert.strictEqual(target.hp,450,'direct attack damage');

context.battle.tick=99;
context.processDotStacks();
assert.strictEqual(target.hp,450,'DOT must not tick early');
context.battle.tick=100;
context.processDotStacks();
assert.strictEqual(target.hp,430,'first DOT tick');
context.battle.tick=1000;
context.processDotStacks();
assert.strictEqual(target.dotStacks.length,0,'DOT expires after final tick');
assert.strictEqual(target.hp,250,'10 DOT ticks after direct attack');

console.log('PASS Formal skill Sprint 2: isolated Legacy dependency removed');
