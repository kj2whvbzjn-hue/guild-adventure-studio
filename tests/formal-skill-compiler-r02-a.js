'use strict';
const assert=require('assert');
const fs=require('fs');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

const cases=[
 {id:'damage-status',skill:{schemaVersion:1,id:'GEN-001',name:'魔法攻撃+行動不能',trigger:{type:'ON_USE',scope:'SELF'},conditions:[{scope:'SELF',property:'SELF_HP_RATE',operator:'<=',value:0.5}],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:120,damageType:'MAGICAL'},{type:'APPLY',effectId:'STUN',duration:300}],resource:{mpCost:8,cooldown:10}}},
 {id:'dot',skill:{schemaVersion:1,id:'GEN-002',name:'火傷',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:15,duration:300}],resource:{mpCost:0,cooldown:0}}},
 {id:'buff',skill:{schemaVersion:1,id:'GEN-003',name:'攻撃強化',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'ATK_UP',power:20,duration:300}],resource:{mpCost:0,cooldown:0}}},
 {id:'shield',skill:{schemaVersion:1,id:'GEN-004',name:'障壁',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power:100,duration:300}],resource:{mpCost:0,cooldown:0}}},
 {id:'cleanse',skill:{schemaVersion:1,id:'GEN-005',name:'解除',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'REMOVE',category:'STATUS',count:1}],resource:{mpCost:0,cooldown:0}}},
 {id:'revive',skill:{schemaVersion:1,id:'GEN-006',name:'蘇生',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'REVIVE',hpRate:0.25}],resource:{mpCost:0,cooldown:0}}}
];
for(const c of cases){
 const out=compiler.compileSkill(c.skill,registry);
 assert.strictEqual(out.ok,true,`${c.id}: ${JSON.stringify(out.errors)}`);
 assert.ok(out.compiledSkill.runtimeContracts,`${c.id}: runtimeContracts missing`);
 assert.ok(!('tags' in out.compiledSkill),`${c.id}: Legacy tags leaked`);
 assert.ok(!('genericRuntime' in out.compiledSkill),`${c.id}: genericRuntime leaked`);
 assert.ok(!('legacyValidation' in out),`${c.id}: legacyValidation leaked`);
 assert.ok(!('legacySkill' in out),`${c.id}: legacySkill leaked`);
}
const invalid=[
 {skill:{schemaVersion:99,id:'X',name:'bad',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1}],resource:{}},code:'UNSUPPORTED_SCHEMA'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'NO_SUCH_TRIGGER',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1}],resource:{}},code:'UNKNOWN_TRIGGER'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'NO_SUCH',duration:1}],resource:{}},code:'UNKNOWN_EFFECT_ID'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'RESOURCE_CHANGE',resource:'HP',amount:10}],resource:{}},code:'RESOURCE_CHANGE_RESOURCE_UNSUPPORTED'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_USE',scope:'SELF'},conditions:[{scope:'TARGET',property:'SELF_HP',operator:'<',value:10}],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1}],resource:{}},code:'CONDITION_SCOPE_UNSUPPORTED'}
];
for(const x of invalid){
 const out=compiler.compileSkill(x.skill,registry);
 assert.strictEqual(out.ok,false,'invalid accepted: '+x.code);
 assert.ok(out.errors.some(e=>e.code===x.code),'missing '+x.code+': '+JSON.stringify(out.errors));
}
console.log('FORMAL_SKILL_COMPILER_R02_A_PASS');
