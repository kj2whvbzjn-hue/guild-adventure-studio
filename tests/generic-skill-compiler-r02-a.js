const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
function loadLegacy(path){const src=fs.readFileSync(path,'utf8'),ctx={console};vm.createContext(ctx);vm.runInContext(src,ctx);return ctx.compileTaggedSkill;}
const generic=require('../assets/shared/js/generic-skill-compiler.js');
function ok(v,msg){if(!v)throw new Error(msg)}
const legacyCompilers=['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js'].map(loadLegacy);
const cases=[
 {id:'damage-status',skill:{schemaVersion:1,id:'GEN-001',name:'魔法攻撃+行動不能',trigger:{type:'ON_USE'},conditions:[{scope:'SELF',property:'SELF_HP_RATE',operator:'<=',value:0.5}],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:120,damageType:'MAGICAL'},{type:'APPLY',effectId:'STUN',duration:300}],resource:{mpCost:8,cooldown:10}}},
 {id:'dot',skill:{schemaVersion:1,id:'GEN-002',name:'火傷',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:15,duration:300}]}},
 {id:'buff',skill:{schemaVersion:1,id:'GEN-003',name:'攻撃強化',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'ATK_UP',power:20,duration:300}]}},
 {id:'shield',skill:{schemaVersion:1,id:'GEN-004',name:'障壁',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power:100,duration:300}]}},
 {id:'cleanse',skill:{schemaVersion:1,id:'GEN-005',name:'解除',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'REMOVE',category:'STATUS',count:1}]}},
 {id:'revive',skill:{schemaVersion:1,id:'GEN-006',name:'蘇生',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'REVIVE',hpRate:0.25}]}}
];
for(const legacyCompile of legacyCompilers){for(const c of cases){const r=generic.compileGenericSkill(c.skill,registry,legacyCompile);ok(r.ok,`${c.id}: ${r.errors.map(x=>x.code+':'+x.message).join('|')}`);ok(r.legacyValidation&&r.legacyValidation.ok,`${c.id}: legacy validation missing`);}}
const invalid=[
 {skill:{schemaVersion:99,id:'X',name:'bad',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1}]},code:'UNSUPPORTED_SCHEMA'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_DEATH'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1}]},code:'LEGACY_TRIGGER_UNSUPPORTED'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'NO_SUCH',duration:1}]},code:'UNKNOWN_EFFECT_ID'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'RESOURCE_CHANGE',resource:'HP',amount:10}]},code:'RESOURCE_CHANGE_RESOURCE_UNSUPPORTED'},
 {skill:{schemaVersion:1,id:'X',name:'bad',trigger:{type:'ON_USE'},conditions:[{scope:'TARGET',property:'SELF_HP',operator:'<',value:10}],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1}]},code:'CONDITION_SCOPE_UNSUPPORTED'}
];
for(const x of invalid){const r=generic.compileGenericSkill(x.skill,registry,legacyCompilers[0]);ok(!r.ok,'invalid accepted: '+x.code);ok(r.errors.some(e=>e.code===x.code),'missing error '+x.code+': '+JSON.stringify(r.errors));}
console.log('GENERIC_SKILL_COMPILER_R02_A_PASS');
