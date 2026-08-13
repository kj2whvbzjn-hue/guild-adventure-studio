const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const base=(id,effect)=>({schemaVersion:1,id,name:'Revive Rate Formal',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[effect],resource:{mpCost:0,cooldown:0}});
const rate=compiler.compileSkill(base('SKL-9221',{type:'REVIVE',hpRate:0.25}),registry);
assert.strictEqual(rate.ok,true,JSON.stringify(rate.errors));
assert.deepStrictEqual(rate.compiledSkill.runtimeContracts.effectContracts,[{type:'REVIVE',hp:null,hpRate:0.25}]);
const fixed=compiler.compileSkill(base('SKL-9222',{type:'REVIVE',hp:75}),registry);assert.strictEqual(fixed.ok,true,JSON.stringify(fixed.errors));
for(const [id,effect,code] of [
 ['SKL-9223',{type:'REVIVE'},'REVIVE_VALUE_REQUIRED'],
 ['SKL-9224',{type:'REVIVE',hp:75,hpRate:0.25},'REVIVE_VALUE_REQUIRED'],
 ['SKL-9225',{type:'REVIVE',hp:0},'REVIVE_HP_INVALID'],
 ['SKL-9226',{type:'REVIVE',hpRate:0},'REVIVE_HP_RATE_INVALID'],
 ['SKL-9227',{type:'REVIVE',hpRate:1.01},'REVIVE_HP_RATE_INVALID']
]){const out=compiler.compileSkill(base(id,effect),registry);assert.strictEqual(out.ok,false,`${id} unexpectedly accepted`);assert.ok(out.errors.some(x=>x.code===code),`${id} missing ${code}: ${JSON.stringify(out.errors)}`)}
const ctx={console,battle:{tick:0,units:[],log:[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const runtimeCompiled=ctx.compileSkillForRuntime(rate.compiledSkill);assert.strictEqual(runtimeCompiled.ok,true,JSON.stringify(runtimeCompiled.errors));
const actor={id:'SRC',name:'Source',side:'ally',alive:true};const target={id:'TGT',name:'Target',side:'ally',alive:false,hp:0,maxHp:1000,gauge:10};
assert.strictEqual(ctx.executeRuntimeReviveRuntime(actor,target,runtimeCompiled).ok,true);assert.strictEqual(target.hp,250);assert.strictEqual(target.gauge,0);
const tiny=compiler.compileSkill(base('SKL-9228',{type:'REVIVE',hpRate:0.000001}),registry);assert.strictEqual(tiny.ok,true,JSON.stringify(tiny.errors));const tinyCompiled=ctx.compileSkillForRuntime(tiny.compiledSkill);target.alive=false;target.hp=0;target.maxHp=100;assert.strictEqual(ctx.executeRuntimeReviveRuntime(actor,target,tinyCompiled).ok,true);assert.strictEqual(target.hp,1);
console.log('REVIVE_RATE_FORMAL_VALIDATION_GA_B486_22_OK');
