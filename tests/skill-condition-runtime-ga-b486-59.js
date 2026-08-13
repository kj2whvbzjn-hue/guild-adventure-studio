'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const runtime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(runtime,ctx);
ctx.battle={tick:10,units:[{id:'A',name:'A',side:'ally',alive:true,hp:40,maxHp:100,mp:25,maxMp:100},{id:'B',name:'B',side:'ally',alive:true,hp:100,maxHp:100,mp:100,maxMp:100},{id:'E1',name:'E1',side:'enemy',alive:true,hp:100,maxHp:100},{id:'E2',name:'E2',side:'enemy',alive:true,hp:100,maxHp:100}]};
const actor=ctx.battle.units[0];
function makeSkill(conditions){return{schemaVersion:1,id:'SKL-COND-RUNTIME',name:'condition runtime',skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions,target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:1,damageType:'PHYSICAL'}],resource:{mpCost:0,cooldown:0,activationPriority:0}}}
function check(conditions,expected,label){
 const authored=compiler.compileSkill(makeSkill(conditions),registry);assert.strictEqual(authored.ok,true,`${label} formal compile ${JSON.stringify(authored.errors)}`);const compiled=ctx.compileSkillRuntime(authored.compiledSkill);assert.strictEqual(compiled.ok,true,`${label} runtime compile ${JSON.stringify(compiled.errors)}`);ctx.actor=actor;ctx.compiled=compiled;const r=vm.runInContext('evaluateTaggedSkillConditions(actor,compiled)',ctx);assert.strictEqual(r.ok,expected,`${label} expected ${expected} got ${r.ok} ${JSON.stringify(r.results)}`);
}
check([{scope:'SELF',property:'SELF_HP_RATE',operator:'<=',value:0.5}],true,'hp-rate');
check([{scope:'SELF',property:'SELF_MP',operator:'>',value:20},{scope:'SELF',property:'ENEMY_COUNT',operator:'=',value:2},{scope:'SELF',property:'ALLY_COUNT',operator:'>=',value:2},{scope:'SELF',property:'BATTLE_TICK',operator:'>=',value:10}],true,'and-pass');
check([{scope:'SELF',property:'SELF_MP',operator:'>',value:30}],false,'mp-fail');
check([{scope:'SELF',property:'ENEMY_COUNT',operator:'!=',value:2}],false,'not-equal-fail');
console.log('SKILL_CONDITION_FORMAL_RUNTIME_GA_B486_PASS');
