const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

const sample={
  schemaVersion:1,
  id:'SKL-9501',
  name:'R05-A Formal Damage',
  trigger:{type:'ON_USE',scope:'SELF'},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:120,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
const out=compiler.compileSkill(sample,registry);
assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
assert.deepStrictEqual(out.compiledSkill.runtimeContracts.effectContracts,[{type:'DAMAGE',power:120,damageType:'PHYSICAL'}]);

const events=[];
const ctx={
  console,
  battle:{tick:0,units:[],log:[]},
  recordValidationEvent:(type,payload)=>events.push({type,payload}),
  queueSceneEvent:()=>{},
  finishIfNeeded:()=>{}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.strictEqual(Array.isArray(compiled.definition.sourceTags),true);
assert.strictEqual(compiled.definition.sourceTags.length,0,'Formal runtime must not depend on Legacy tags');
const resolved=ctx.resolveRuntimeDamageContract(compiled);
assert.strictEqual(resolved.ok,true);
assert.strictEqual(resolved.contract.power,120);
assert.strictEqual(ctx.calculateSkillDamage({attack:100},resolved.contract),120);

const fixed={...sample,id:'SKL-9502',effects:[{type:'DAMAGE',power:37,damageType:'FIXED'}]};
const fixedOut=compiler.compileSkill(fixed,registry);
assert.strictEqual(fixedOut.ok,true,JSON.stringify(fixedOut.errors));
const fixedCompiled=ctx.compileSkillForRuntime(fixedOut.compiledSkill);
assert.strictEqual(fixedCompiled.ok,true,JSON.stringify(fixedCompiled.errors));
assert.strictEqual(ctx.calculateSkillDamage({attack:999},ctx.resolveRuntimeDamageContract(fixedCompiled).contract),37);

console.log('FORMAL_DAMAGE_RUNTIME_R05_A_PASS');
