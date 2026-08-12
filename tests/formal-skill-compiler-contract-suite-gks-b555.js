'use strict';
const assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const base=(id,target,effects,extra={})=>({
 schemaVersion:1,id,name:id,skillLevel:5,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],
 target, effects, resource:{mpCost:0,cooldown:0,activationPriority:0},...extra
});
const cases=[
 base('DAMAGE',{side:'ENEMY',range:'SINGLE'},[{type:'DAMAGE',power:120,damageType:'PHYSICAL'}]),
 base('HEAL',{side:'ALLY',range:'SINGLE'},[{type:'HEAL',power:100}]),
 base('DOT',{side:'ENEMY',range:'SINGLE'},[{type:'APPLY',effectId:'BURN',power:3,duration:20,interval:100,stackGain:1}]),
 base('BUFF',{side:'ALLY',range:'SINGLE'},[{type:'APPLY',effectId:'ATK_UP',power:5,duration:30,stackGain:1}]),
 base('SHIELD',{side:'ALLY',range:'SINGLE'},[{type:'APPLY',effectId:'BARRIER',power:100,duration:50}]),
 base('REMOVE',{side:'ALLY',range:'SINGLE'},[{type:'REMOVE',category:'STATUS',count:1}]),
 base('RESOURCE',{side:'ALLY',range:'SINGLE'},[{type:'RESOURCE_CHANGE',resource:'MP',amount:20}]),
 base('REVIVE',{side:'ALLY',range:'SINGLE'},[{type:'REVIVE',hp:100}]),
 base('COVER',{side:'ALLY',range:'SINGLE'},[{type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'PERSISTENT'}]),
 base('COMPOSITE',{side:'ENEMY',range:'SINGLE'},[{type:'DAMAGE',power:78,damageType:'PHYSICAL'},{type:'APPLY',effectId:'BURN',power:3,duration:20,interval:100,stackGain:1}])
];
for(const skill of cases){
 const out=compiler.compileSkill(skill,registry);
 assert(out.ok,`${skill.id}: ${JSON.stringify(out.errors)}`);
 const c=out.compiledSkill;
 assert(c?.runtimeContracts,`${skill.id}: runtimeContracts missing`);
 assert(!('tags' in c),`${skill.id}: tag representation leaked into formal compiler`);
 assert(!('genericRuntime' in c),`${skill.id}: genericRuntime leaked into formal compiler`);
 assert(!('legacySkill' in out),`${skill.id}: legacySkill leaked into formal result`);
}
const composite=compiler.compileSkill(cases.at(-1),registry).compiledSkill.runtimeContracts;
assert.strictEqual(composite.effectContracts[0].type,'DAMAGE');
assert.strictEqual(composite.applyContracts[0].logic,'DOT');
console.log('FORMAL_SKILL_COMPILER_CONTRACT_SUITE_PASS');
