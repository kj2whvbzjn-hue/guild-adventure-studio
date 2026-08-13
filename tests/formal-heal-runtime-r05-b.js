const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

const sample={
  schemaVersion:1,
  id:'SKL-9510',
  name:'R05-B Formal Heal',
  trigger:{type:'ON_USE',scope:'SELF'},
  target:{side:'ALLY',range:'SINGLE'},
  effects:[{type:'HEAL',power:120}],
  resource:{mpCost:0,cooldown:0}
};
assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
const out=compiler.compileSkill(sample,registry);
assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
assert.deepStrictEqual(out.compiledSkill.runtimeContracts.effectContracts,[{type:'HEAL',power:120}]);

const events=[];
const ctx={console,battle:{tick:0,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(Array.isArray(compiled.definition.sourceTags),true);
assert.strictEqual(compiled.definition.sourceTags.length,0);
const resolved=ctx.resolveRuntimeHealContract(compiled);
assert.strictEqual(resolved.ok,true);
assert.strictEqual(resolved.contract.power,120);
const source={id:'SOURCE',name:'Source'};
const target={id:'TARGET',name:'Target',alive:true,hp:30,maxHp:100};
const result=ctx.executeRuntimeHealRuntime(source,target,compiled);
assert.strictEqual(result.ok,true);
assert.strictEqual(result.requested,120);
assert.strictEqual(result.healed,70);
assert.strictEqual(result.overheal,50);
assert.strictEqual(target.hp,100);
assert.ok(events.some(x=>x.type==='skill_heal_executed'&&x.payload.power===120));
console.log('FORMAL_HEAL_RUNTIME_R05_B_PASS');
