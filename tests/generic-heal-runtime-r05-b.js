const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');

const sample={
  schemaVersion:1,
  id:'R05B-HEAL',
  name:'R05-B Generic Heal',
  trigger:{type:'ON_USE',scope:'SELF'},
  target:{side:'ALLY',range:'SINGLE'},
  effects:[{type:'HEAL',power:120}],
  resource:{mpCost:0,cooldown:0}
};

assert.strictEqual(generic.VERSION,'R05-E');
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const events=[];
  const ctx={console,battle:{tick:0,units:[],log:[]},recordValidationEvent:(type,payload)=>events.push({type,payload})};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
  const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);
  assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
  assert.deepStrictEqual(out.legacySkill.genericRuntime.effectContracts,[{type:'HEAL',power:120}]);
  const tampered=JSON.parse(JSON.stringify(out.legacySkill));
  tampered.tags=tampered.tags.map(x=>x==='HEAL=120'?'HEAL=999':x);
  const compiled=ctx.compileTaggedSkill(tampered);
  assert.strictEqual(compiled.ok,true,`${runtimePath}: ${JSON.stringify(compiled.errors)}`);
  const resolved=ctx.resolveGenericHealContract(compiled);
  assert.strictEqual(resolved.ok,true);
  assert.strictEqual(resolved.contract.power,120,'Generic HEAL must not read the Legacy HEAL tag');
  const source={id:'SOURCE',name:'Source'},target={id:'TARGET',name:'Target',alive:true,hp:30,maxHp:100};
  const result=ctx.executeGenericHealRuntime(source,target,compiled);
  assert.strictEqual(result.ok,true);
  assert.strictEqual(result.requested,120);
  assert.strictEqual(result.healed,70);
  assert.strictEqual(result.overheal,50);
  assert.strictEqual(target.hp,100);
  assert.ok(events.some(x=>x.type==='generic_heal_executed'&&x.payload.power===120));
  const sourceText=fs.readFileSync(runtimePath,'utf8');
  assert.ok(sourceText.includes("executeGenericHealRuntime(actor"),`${runtimePath}: direct Generic HEAL executor missing`);
}

console.log('GENERIC_HEAL_RUNTIME_R05_B_PASS');
