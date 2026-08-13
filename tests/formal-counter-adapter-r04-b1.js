const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');

assert.strictEqual(registry.phase,'FORMAL-SKILL-1');
assert.strictEqual(compiler.VERSION,'FORMAL-SKILL-1');
assert.strictEqual(registry.triggers.ON_HIT_RECEIVED.enabled,true);
assert.strictEqual(registry.triggers.ON_HIT_RECEIVED.dispatch_mode,'COUNTER');

const sample={
  schemaVersion:1,
  id:'R04B1-COUNTER',
  name:'R04B1 Formal Counter',
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority:7},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

const out=compiler.compileSkill(sample,registry);
assert.strictEqual(out.ok,true,JSON.stringify(out.errors));
assert.deepStrictEqual(out.compiledSkill.runtimeContracts.triggerContract,{
  type:'ON_HIT_RECEIVED',scope:'SELF',engineEvent:'hit_received',dispatchMode:'COUNTER',priority:7
});
assert.deepStrictEqual(out.compiledSkill.runtimeContracts.targetContract,{
  side:'ENEMY',range:'SINGLE',randomCount:null,excludeSelf:false
});
assert.deepStrictEqual(out.compiledSkill.runtimeContracts.effectContracts,[
  {type:'DAMAGE',power:100,damageType:'PHYSICAL'}
]);
assert.ok(!Object.prototype.hasOwnProperty.call(out.compiledSkill,'tags'),'Formal compiled skill must not emit Legacy tags');

const ctx={console,battle:{tick:0,units:[],log:[]}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
assert.strictEqual(typeof ctx.compileSkillForRuntime,'function');
const compiled=ctx.compileSkillForRuntime(out.compiledSkill);
assert.strictEqual(compiled.ok,true,JSON.stringify(compiled.errors));
assert.ok(compiled.definition.logicOrder.includes('COUNTER'));
assert.ok(compiled.definition.logicOrder.includes('ATTACK'));
assert.strictEqual(compiled.definition.parameters.counterTrigger,'hit');
assert.strictEqual(compiled.definition.parameters.counterTarget,'attacker');
assert.strictEqual(compiled.definition.parameters.counterLimit,1);
assert.strictEqual(compiled.definition.parameters.counterPriority,7);
assert.strictEqual(compiled.definition.parameters.counterRequireAlive,'true');
assert.strictEqual(compiled.definition.parameters.counterAllowZeroDamage,'true');
assert.strictEqual(compiled.definition.parameters.damage,100);
assert.ok(Array.isArray(compiled.definition.sourceTags));
assert.strictEqual(compiled.definition.sourceTags.length,0);

const badRange=JSON.parse(JSON.stringify(sample));badRange.target.range='ALL';
let bad=compiler.compileSkill(badRange,registry);
assert.strictEqual(bad.ok,false);
assert.ok(bad.errors.some(e=>e.code==='COUNTER_TARGET_RANGE_REQUIRED'));

const noDamage=JSON.parse(JSON.stringify(sample));noDamage.effects=[{type:'HEAL',power:10}];
bad=compiler.compileSkill(noDamage,registry);
assert.strictEqual(bad.ok,false);
assert.ok(bad.errors.some(e=>e.code==='COUNTER_DAMAGE_EFFECT_REQUIRED'));

console.log('FORMAL_COUNTER_CONTRACT_R04_B1_PASS');
