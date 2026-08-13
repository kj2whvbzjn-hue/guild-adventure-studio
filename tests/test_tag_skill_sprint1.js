'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');

const baseSkill=(id,effects)=>({
  schemaVersion:1,
  id,
  name:id,
  skillLevel:5,
  trigger:{type:'ON_USE',scope:'SELF'},
  conditions:[],
  target:{side:'ENEMY',range:'SINGLE'},
  effects,
  resource:{mpCost:0,cooldown:0,activationPriority:0}
});

const context={console,battle:{tick:0,log:[],units:[]}};
vm.createContext(context);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),context);

const compileFormal=(skill)=>{
  const formal=compiler.compileSkill(skill,registry);
  const runtime=formal.ok?context.compileSkillForRuntime(formal.compiledSkill):null;
  return {formal,runtime};
};

let r=compileFormal(baseSkill('SKL-9101',[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}]));
assert.strictEqual(r.formal.ok,true,JSON.stringify(r.formal.errors));
assert.strictEqual(r.runtime.ok,true,JSON.stringify(r.runtime.errors));
assert.strictEqual(r.runtime.definition.logicOrder.join(','),'ATTACK');
assert.strictEqual(r.runtime.definition.parameters.damage,100);

r=compileFormal(baseSkill('SKL-9102',[{type:'DAMAGE',power:150,damageType:'PHYSICAL'}]));
assert.strictEqual(r.formal.ok,true,JSON.stringify(r.formal.errors));
assert.strictEqual(r.runtime.definition.parameters.damage,150);

r=compileFormal(baseSkill('SKL-9103',[{type:'DAMAGE',damageType:'PHYSICAL'}]));
assert.strictEqual(r.formal.ok,false,'missing DAMAGE power must be rejected at the Formal registration gate');
assert(r.formal.errors.some(x=>x.code==='DAMAGE_POWER_REQUIRED'),'DAMAGE_POWER_REQUIRED must be reported');

r=compileFormal(baseSkill('SKL-9104',[
  {type:'DAMAGE',power:100,damageType:'PHYSICAL'},
  {type:'APPLY',effectId:'POISON',power:3,duration:20,interval:100,stackGain:1}
]));
assert.strictEqual(r.formal.ok,true,JSON.stringify(r.formal.errors));
assert.strictEqual(r.runtime.ok,true,JSON.stringify(r.runtime.errors));
assert.strictEqual(r.runtime.definition.logicOrder.join(','),'ATTACK,DOT');
assert.strictEqual(r.formal.warnings.length,0,'Formal ATTACK + DOT must compile without warnings');

const actor={id:'A',alive:true,side:'味方',attack:48};
const attack=compileFormal(baseSkill('SKL-9105',[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}])).runtime;
const heavy=compileFormal(baseSkill('SKL-9106',[{type:'DAMAGE',power:150,damageType:'PHYSICAL'}])).runtime;
assert.strictEqual(context.calculateSkillDamage(actor,context.resolveRuntimeDamageContract(attack).contract),48,'100% damage');
assert.strictEqual(context.calculateSkillDamage(actor,context.resolveRuntimeDamageContract(heavy).contract),72,'150% damage');

console.log('PASS Formal skill Sprint 1: isolated Legacy dependency removed');
