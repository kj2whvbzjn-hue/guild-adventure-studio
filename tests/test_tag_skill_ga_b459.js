const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const events=[];const battle={tick:0,units:[],log:[],result:null,pendingResult:null};
const ctx={console,battle,queueSceneEvent:()=>{},finishIfNeeded:()=>false,recordValidationEvent:(type,payload={})=>events.push({tick:battle.tick,type,...payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const skill={schemaVersion:1,id:'SKL-9459',name:'Formal DOT independent timer',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:1,duration:1000,interval:100,stackGain:1}],resource:{mpCost:0,cooldown:0}};
const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));const compiled=ctx.compileSkillForRuntime(out.compiledSkill);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
const source={id:'A',name:'Actor',side:'ally',alive:true,damageDealt:0},target={id:'E',name:'Enemy',side:'enemy',alive:true,hp:10000,maxHp:10000,damageTaken:0,dotStacks:[],statusEffects:[],modifierStacks:[],shieldEffects:[],coverEffects:[]};battle.units=[source,target];
const addAt=t=>{battle.tick=t;const r=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');assert.strictEqual(r.result.ok,true);return r.result.stacks[0];};
const s1=addAt(0);for(let t=50;t<=200;t+=50){battle.tick=t;ctx.processDotStacks();}const s2=addAt(250);for(let t=300;t<=550;t+=50){battle.tick=t;ctx.processDotStacks();}battle.tick=600;ctx.processDotStacks();const s3=addAt(600);for(let t=650;t<=1600;t+=50){battle.tick=t;ctx.processDotStacks();}
assert.deepStrictEqual([s1.appliedAt,s2.appliedAt,s3.appliedAt],[0,250,600]);assert.deepStrictEqual([s1.expiresAt,s2.expiresAt,s3.expiresAt],[1000,1250,1600]);
const damageTicks=id=>events.filter(x=>x.type==='dot_damage'&&x.stack_id===id).map(x=>x.tick);
assert.deepStrictEqual(damageTicks(s1.id),[100,200,300,400,500,600,700,800,900,1000]);assert.deepStrictEqual(damageTicks(s2.id),[350,450,550,650,750,850,950,1050,1150,1250]);assert.deepStrictEqual(damageTicks(s3.id),[700,800,900,1000,1100,1200,1300,1400,1500,1600]);assert.strictEqual(target.dotStacks.length,0);
console.log('FORMAL_DOT_INDEPENDENT_TIMER_GA_B459_PASS');
