const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const events=[];const battle={tick:0,units:[],log:[],result:null,pendingResult:null};
const ctx={console,battle,queueSceneEvent:()=>{},finishIfNeeded:()=>false,recordValidationEvent:(type,payload={})=>events.push({tick:battle.tick,type,...payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const skill={schemaVersion:1,id:'SKL-9461',name:'Formal DOT defeat regression',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:20,duration:1000,interval:100,stackGain:1}],resource:{mpCost:0,cooldown:0}};
const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));const compiled=ctx.compileSkillForRuntime(out.compiledSkill);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
const source={id:'A',name:'Actor',side:'ally',alive:true,damageDealt:0},target={id:'E',name:'Enemy',side:'enemy',alive:true,hp:52,maxHp:100,damageTaken:0,gauge:0,dotStacks:[],statusEffects:[],modifierStacks:[],shieldEffects:[],coverEffects:[],cooldowns:{}};battle.units=[source,target];
const applied=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');assert.strictEqual(applied.result.ok,true);assert.strictEqual(target.dotStacks.length,1);
for(const tick of [100,200,300]){battle.tick=tick;ctx.processDotStacks();}
assert.strictEqual(target.hp,0);assert.strictEqual(target.alive,false);assert.strictEqual(source.damageDealt,52);assert.strictEqual(target.damageTaken,52);assert.strictEqual(target.dotStacks.length,0,'DOT stacks must clear on defeat');
const defeat=events.find(x=>x.type==='dot_defeat');assert.ok(defeat,'dot_defeat event missing');assert.strictEqual(defeat.tick,300);assert.strictEqual(defeat.cleared_dot_stacks,1);const damageCount=events.filter(x=>x.type==='dot_damage').length;assert.strictEqual(damageCount,3);
battle.tick=400;ctx.processDotStacks();assert.strictEqual(events.filter(x=>x.type==='dot_damage').length,damageCount,'post-defeat DOT damage occurred');
console.log('FORMAL_DOT_DEFEAT_GA_B460_PASS');
