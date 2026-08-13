'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

function counter(id,priority=0){
 return {
  schemaVersion:1,id,name:id,skillLevel:5,
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority},conditions:[],
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0,activationPriority:0}
 };
}
const valid=[counter('COUNTER-P0',0),counter('COUNTER-P10',10)];
for(const skill of valid){
 const out=compiler.compileSkill(skill,registry);
 assert.strictEqual(out.ok,true,`${skill.id}: ${JSON.stringify(out.errors)}`);
 const c=out.compiledSkill.runtimeContracts;
 assert.strictEqual(c.triggerContract.dispatchMode,'COUNTER');
 assert.strictEqual(c.triggerContract.priority,skill.trigger.priority);
 assert.strictEqual(c.targetContract.side,'ENEMY');
 assert.strictEqual(c.targetContract.range,'SINGLE');
 assert.strictEqual(c.effectContracts[0].type,'DAMAGE');
}

const ctx={console,battle:{tick:0,units:[],log:[]}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
for(const skill of valid){
 const formal=compiler.compileSkill(skill,registry).compiledSkill;
 const out=ctx.compileSkillForRuntime(formal);
 assert.strictEqual(out.ok,true,`${skill.id}: ${JSON.stringify(out.errors)}`);
 assert.ok(Array.from(out.definition.logicOrder).includes('COUNTER'));
 assert.ok(Array.from(out.definition.logicOrder).includes('ATTACK'));
 assert.strictEqual(out.definition.parameters.counterLimit,1);
 assert.strictEqual(out.definition.parameters.counterPriority,skill.trigger.priority);
}

const invalid=[
 [{...counter('NO-DAMAGE'),effects:[{type:'HEAL',power:10}]},'COUNTER_DAMAGE_EFFECT_REQUIRED'],
 [{...counter('BAD-RANGE'),target:{side:'ENEMY',range:'ALL'}},'COUNTER_TARGET_RANGE_REQUIRED'],
 [{...counter('BAD-SIDE'),target:{side:'ALLY',range:'SINGLE'}},'COUNTER_TARGET_SIDE_REQUIRED'],
 [{...counter('BAD-SCOPE'),trigger:{type:'ON_HIT_RECEIVED',scope:'TARGET',priority:0}},'TRIGGER_SCOPE_UNSUPPORTED']
];
for(const [skill,code] of invalid){
 const out=compiler.compileSkill(skill,registry);
 assert.strictEqual(out.ok,false,`${skill.id}: expected reject`);
 assert.ok(out.errors.some(e=>e.code===code),`${skill.id}: missing ${code}: ${JSON.stringify(out.errors)}`);
}
console.log('PASS counter data-driven formal validation GA-B486.30');
