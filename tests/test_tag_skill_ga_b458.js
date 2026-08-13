const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const events=[];const battle={tick:0,units:[],log:[],result:null,pendingResult:null};
const ctx={console,battle,recordValidationEvent:(type,payload={})=>events.push({type,...payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const skill={schemaVersion:1,id:'SKL-9458',name:'Formal DOT stack cap',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:12,duration:1000,interval:100,stackGain:1}],resource:{mpCost:0,cooldown:0}};
const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));const compiled=ctx.compileSkillForRuntime(out.compiledSkill);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
const source={id:'A',name:'Actor',side:'ally',alive:true},target={id:'E',name:'Enemy',side:'enemy',alive:true,hp:5000,maxHp:5000,dotStacks:[]};battle.units=[source,target];
for(let i=0;i<5;i++){const r=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');assert.strictEqual(r.result.ok,true,`apply ${i+1}`);assert.strictEqual(r.result.current,i+1);}
const sixth=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');assert.strictEqual(sixth.result.ok,false);assert.strictEqual(sixth.result.reason,'MAX_STACK');assert.strictEqual(sixth.result.current,5);assert.strictEqual(target.dotStacks.length,5);
assert.strictEqual(events.filter(x=>x.type==='dot_stack_added').length,5);assert.strictEqual(events.filter(x=>x.type==='dot_stack_rejected'&&x.reason==='MAX_STACK').length,1);
console.log('FORMAL_DOT_STACK_CAP_GA_B458_PASS');
