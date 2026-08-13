'use strict';
const assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
function skill(id,condition){return{schemaVersion:1,id:`SKL-${id}`,name:id,skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[condition],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:120,damageType:'PHYSICAL'}],resource:{mpCost:0,cooldown:0,activationPriority:0}}}
const valid=[
 {scope:'SELF',property:'SELF_HP_RATE',operator:'<=',value:0.5},
 {scope:'SELF',property:'SELF_MP',operator:'>=',value:20},
 {scope:'SELF',property:'ENEMY_COUNT',operator:'>=',value:3},
 {scope:'SELF',property:'ALLY_COUNT',operator:'!=',value:1},
 {scope:'SELF',property:'BATTLE_TICK',operator:'>',value:5}
];
for(const [i,condition] of valid.entries()){
 const r=compiler.compileSkill(skill(`COND-${i+1}`,condition),registry);assert.strictEqual(r.ok,true,JSON.stringify(r.errors));assert.strictEqual(r.compiledSkill.runtimeContracts.conditionContracts.length,1,'condition contract missing');
}
const invalid=[
 [{scope:'SELF',property:'SELF_HP_RATE',operator:'<=',value:1.1},'INVALID_CONDITION_RATE'],
 [{scope:'SELF',property:'ENEMY_COUNT',operator:'>=',value:1.5},'INVALID_CONDITION_INTEGER'],
 [{scope:'SELF',property:'SELF_MP',operator:'~',value:20},'UNKNOWN_OPERATOR']
];
for(const [i,[condition,code]] of invalid.entries()){
 const r=compiler.compileSkill(skill(`BAD-${i+1}`,condition),registry);assert.strictEqual(r.ok,false,`${code} accepted`);assert(r.errors.some(x=>x.code===code),`${code} missing: ${JSON.stringify(r.errors)}`);
}
console.log('SKILL_CONDITION_FORMAL_VALIDATION_GA_B486_PASS');
