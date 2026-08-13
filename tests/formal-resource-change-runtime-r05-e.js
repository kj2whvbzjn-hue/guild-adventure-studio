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
for(const [index,amount,before,expected] of [[1,30,80,100],[2,-40,25,0]]){
 const skill={schemaVersion:1,id:`SKL-954${index}`,name:'R05-E Formal Resource',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'RESOURCE_CHANGE',resource:'MP',amount}],resource:{mpCost:0,cooldown:0}};
 const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
 const compiled=ctx.compileSkillForRuntime(out.compiledSkill);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
 const target={id:'T',alive:true,mp:before,maxMp:100};
 const result=ctx.executeRuntimeResourceChangeRuntime({id:'S'},target,compiled);assert.strictEqual(result.ok,true);assert.strictEqual(target.mp,expected);
}
assert.ok(events.some(x=>x.type==='skill_resource_change_executed'));
console.log('FORMAL_RESOURCE_CHANGE_RUNTIME_R05_E_PASS');
