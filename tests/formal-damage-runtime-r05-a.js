const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');

const sample={
  schemaVersion:1,
  id:'R05A-DAMAGE',
  name:'R05-A Generic Damage',
  trigger:{type:'ON_USE',scope:'SELF'},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:120,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

assert.strictEqual(generic.VERSION,'R05-H');
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const ctx={console,battle:{tick:0,units:[],log:[]}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
  const out=generic.compileSkill(sample,registry,ctx.compileTaggedSkill);
  assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
  assert.deepStrictEqual(out.compiledSkill.runtimeContracts.effectContracts,[{type:'DAMAGE',power:120,damageType:'PHYSICAL'}]);
  const tampered=JSON.parse(JSON.stringify(out.compiledSkill));
  tampered.tags=tampered.tags.map(x=>x==='DAMAGE=120'?'DAMAGE=999':x);
  const compiled=ctx.compileTaggedSkill(tampered);
  assert.strictEqual(compiled.ok,true,`${runtimePath}: ${JSON.stringify(compiled.errors)}`);
  const resolved=ctx.resolveGenericDamageContract(compiled);
  assert.strictEqual(resolved.ok,true);
  assert.strictEqual(resolved.contract.power,120,'Generic DAMAGE must not read the Legacy DAMAGE tag');
  assert.strictEqual(ctx.calculateGenericDamage({attack:100},resolved.contract),120);
  const source=fs.readFileSync(runtimePath,'utf8');
  assert.ok(source.includes('executeGenericDamageRuntime'),`${runtimePath}: direct Generic DAMAGE executor missing`);
  assert.ok(source.includes('generic_damage_executed'),`${runtimePath}: Generic DAMAGE audit event missing`);
}

const fixed={...sample,id:'R05A-FIXED',effects:[{type:'DAMAGE',power:37,damageType:'FIXED'}]};
const fixedOut=generic.compileSkill(fixed,registry,null);
assert.strictEqual(fixedOut.ok,true,JSON.stringify(fixedOut.errors));
assert.deepStrictEqual(fixedOut.compiledSkill.runtimeContracts.effectContracts,[{type:'DAMAGE',power:37,damageType:'FIXED'}]);

console.log('GENERIC_DAMAGE_RUNTIME_R05_A_PASS');
