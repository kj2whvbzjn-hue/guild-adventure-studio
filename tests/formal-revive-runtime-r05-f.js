const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
const events=[];
const ctx={console,battle:{tick:0,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
for(const [index,effect,expected] of [[1,{type:'REVIVE',hp:35},35],[2,{type:'REVIVE',hpRate:0.25},50]]){
 const skill={schemaVersion:1,id:`SKL-955${index}`,name:'R05-F Formal Revive',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[effect],resource:{mpCost:0,cooldown:0}};
 const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
 const compiled=ctx.compileSkillForRuntime(out.compiledSkill);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
 const actor={id:'S',name:'Source',side:'ally',alive:true};
 const target={id:'T',name:'Target',side:'ally',alive:false,hp:0,maxHp:200};
 const result=ctx.executeRuntimeReviveRuntime(actor,target,compiled);assert.strictEqual(result.ok,true);assert.strictEqual(target.hp,expected);
}
assert.ok(events.some(x=>x.type==='skill_revive_executed'));
console.log('FORMAL_REVIVE_RUNTIME_R05_F_PASS');
