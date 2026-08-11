const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');

assert.ok(/^R04-[BCD]/.test(registry.phase),`unexpected phase ${registry.phase}`);
assert.ok(/^R04-[BCD]/.test(generic.VERSION),`unexpected compiler version ${generic.VERSION}`);
assert.strictEqual(registry.triggers.ON_HIT_RECEIVED.legacy_supported,true);
assert.strictEqual(registry.triggers.ON_HIT_RECEIVED.dispatch_mode,'LEGACY_COUNTER_ADAPTER');

const sample={
  schemaVersion:1,
  id:'R04B1-COUNTER',
  name:'R04B1 Counter',
  trigger:{type:'ON_HIT_RECEIVED',scope:'SELF',priority:7},
  target:{side:'ENEMY',range:'SINGLE'},
  effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  resource:{mpCost:0,cooldown:0}
};

for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
  const ctx={console,battle:{tick:0,units:[],log:[]}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
  const out=generic.compileGenericSkill(sample,registry,ctx.compileTaggedSkill);
  assert.strictEqual(out.ok,true,`${runtimePath}: ${JSON.stringify(out.errors)}`);
  for(const tag of [
    'COUNTER','ATTACK','敵','単体','COUNTER_TRIGGER=hit','COUNTER_TARGET=attacker',
    'COUNTER_REQUIRE_ALIVE=true','COUNTER_ALLOW_ZERO_DAMAGE=true',
    'COUNTER_LIMIT=1','COUNTER_PRIORITY=7','DAMAGE=100'
  ])assert.ok(out.legacySkill.tags.includes(tag),`${runtimePath}: missing ${tag}`);
  const compiled=ctx.compileTaggedSkill(out.legacySkill);
  assert.strictEqual(compiled.ok,true,`${runtimePath}: legacy compile ${JSON.stringify(compiled.errors)}`);
  assert.ok(compiled.definition.logicOrder.includes('COUNTER'));
  assert.ok(compiled.definition.logicOrder.includes('ATTACK'));
  assert.strictEqual(compiled.definition.parameters.counterTrigger,'hit');
  assert.strictEqual(compiled.definition.parameters.counterTarget,'attacker');
  assert.strictEqual(compiled.definition.parameters.counterLimit,1);
  assert.strictEqual(compiled.definition.parameters.counterPriority,7);

  const manual={id:'MANUAL',name:'Manual',tags:[
    'COUNTER','ATTACK','敵','単体','物理','DAMAGE=100',
    'COUNTER_TRIGGER=hit','COUNTER_TARGET=attacker','COUNTER_LIMIT=1','COUNTER_PRIORITY=7',
    'COUNTER_REQUIRE_ALIVE=true','COUNTER_ALLOW_ZERO_DAMAGE=true','MP_COST=0','COOLDOWN=0'
  ]};
  const legacy=ctx.compileTaggedSkill(manual);
  assert.strictEqual(legacy.ok,true,`${runtimePath}: manual legacy compile failed`);
  for(const key of ['counterTrigger','counterTarget','counterLimit','counterPriority','damage']){
    assert.deepStrictEqual(compiled.definition.parameters[key],legacy.definition.parameters[key],`${runtimePath}: mismatch ${key}`);
  }
}

const badRange=JSON.parse(JSON.stringify(sample));badRange.target.range='ALL';
let bad=generic.compileGenericSkill(badRange,registry);
assert.strictEqual(bad.ok,false);
assert.ok(bad.errors.some(e=>e.code==='COUNTER_TARGET_RANGE_REQUIRED'));

const noDamage=JSON.parse(JSON.stringify(sample));noDamage.effects=[{type:'HEAL',power:10}];
bad=generic.compileGenericSkill(noDamage,registry);
assert.strictEqual(bad.ok,false);
assert.ok(bad.errors.some(e=>e.code==='COUNTER_DAMAGE_EFFECT_REQUIRED'));

const badLimit=JSON.parse(JSON.stringify(sample));badLimit.trigger.limit=2;
bad=generic.compileGenericSkill(badLimit,registry);
assert.strictEqual(bad.ok,false);
assert.ok(bad.errors.some(e=>e.code==='COUNTER_LIMIT_INVALID'));

console.log('GENERIC_COUNTER_ADAPTER_R04_B1_PASS');
