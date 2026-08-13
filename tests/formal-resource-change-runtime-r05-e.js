const assert=require('assert'),fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8')),generic=require('../assets/shared/js/skill-compiler.js');
assert.strictEqual(generic.VERSION,'R05-H');
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],ctx={console,battle:{tick:0,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 for(const [amount,before,expected] of [[30,80,100],[-40,25,0]]){const skill={schemaVersion:1,id:`R05E-${amount}`,name:'Resource',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'RESOURCE_CHANGE',resource:'MP',amount}],resource:{mpCost:0,cooldown:0}};const out=generic.compileSkill(skill,registry,ctx.compileTaggedSkill);assert.strictEqual(out.ok,true,JSON.stringify(out.errors));const compiled=ctx.compileTaggedSkill(out.compiledSkill);assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));const target={id:'T',alive:true,mp:before,maxMp:100};const result=ctx.executeGenericResourceChangeRuntime({id:'S'},target,compiled);assert.strictEqual(result.ok,true);assert.strictEqual(target.mp,expected);}
 assert.ok(events.some(x=>x.type==='generic_resource_change_executed'));
}
console.log('GENERIC_RESOURCE_CHANGE_RUNTIME_R05_E_PASS');
