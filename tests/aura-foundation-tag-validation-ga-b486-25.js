'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const spec=JSON.parse(fs.readFileSync('docs/design/P01-06_AURA_CURRENT_SPEC.json','utf8'));
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

function aura(id,{side='ALLY',effectId='ATK_UP',power=10,priority=0,excludeSelf=false,conditions=[]}={}){
 return {
  schemaVersion:1,id,name:id,skillLevel:5,
  trigger:{type:'WHILE_SOURCE_ALIVE',scope:'SELF',priority},conditions,
  target:{side,range:'ALL',...(excludeSelf?{excludeSelf:true}:{})},
  effects:[{type:'APPLY',effectId,...(power===undefined?{}:{power})}],
  resource:{mpCost:0,cooldown:0,activationPriority:0}
 };
}

const valid=[
 aura('AURA-ALLY-ATK',{effectId:'ATK_UP',power:10}),
 aura('AURA-ALLY-DEF-EX',{effectId:'DEF_UP',power:15,excludeSelf:true}),
 aura('AURA-ENEMY-ATK-DOWN',{side:'ENEMY',effectId:'ATK_DOWN',power:20})
];
for(const skill of valid){
 const out=compiler.compileSkill(skill,registry);
 assert.strictEqual(out.ok,true,`${skill.id}: ${JSON.stringify(out.errors)}`);
 const c=out.compiledSkill.runtimeContracts;
 assert.strictEqual(c.triggerContract.dispatchMode,'AURA');
 assert.strictEqual(c.targetContract.range,'ALL');
 assert.strictEqual(c.auraEffectContract.logic,'AURA');
 assert.strictEqual(c.auraEffectContract.stack,'highest');
}

const ctx={console,battle:{tick:0,units:[],log:[]}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
for(const skill of valid){
 const formal=compiler.compileSkill(skill,registry).compiledSkill;
 const out=ctx.compileSkillForRuntime(formal);
 assert.strictEqual(out.ok,true,`${skill.id}: ${JSON.stringify(out.errors)}`);
 assert.deepStrictEqual(Array.from(out.definition.logicOrder),['AURA']);
 assert.strictEqual(out.definition.parameters.auraStack,'highest');
}

const invalid=[
 [aura('BAD-STATUS',{side:'ENEMY',effectId:'STUN',power:10}),'AURA_EFFECT_KIND_UNSUPPORTED'],
 [aura('BAD-NO-VALUE',{power:null}),'AURA_POWER_REQUIRED'],
 [{...aura('BAD-TARGET'),target:{side:'SELF',range:'ALL'}},'AURA_TARGET_SIDE_REQUIRED'],
 [{...aura('BAD-RANGE'),target:{side:'ALLY',range:'SINGLE'}},'AURA_TARGET_RANGE_REQUIRED'],
 [aura('BAD-EXCLUDE-ENEMY',{side:'ENEMY',effectId:'ATK_DOWN',power:10,excludeSelf:true}),'AURA_EXCLUDE_SELF_INVALID'],
 [aura('BAD-CONDITION',{conditions:[{scope:'SELF',property:'SELF_HP_RATE',operator:'<=',value:0.5}]}),'AURA_CONDITION_UNSUPPORTED'],
 [{...aura('BAD-COMBINED'),effects:[{type:'APPLY',effectId:'ATK_UP',power:10},{type:'APPLY',effectId:'DEF_UP',power:10}]},'AURA_SINGLE_EFFECT_REQUIRED']
];
for(const [skill,code] of invalid){
 const out=compiler.compileSkill(skill,registry);
 assert.strictEqual(out.ok,false,`${skill.id}: expected reject`);
 assert.ok(out.errors.some(e=>e.code===code),`${skill.id}: missing ${code}: ${JSON.stringify(out.errors)}`);
}
assert.ok(/^GA-B\d+(?:\.\d+)+$/.test(build.game_build||''),`build=${build.game_build}`);
assert.ok(spec.runtime_application===true,'historical Aura spec must retain runtime_application=true');
console.log('AURA_FOUNDATION_FORMAL_VALIDATION_GA_B486_25_OK');
