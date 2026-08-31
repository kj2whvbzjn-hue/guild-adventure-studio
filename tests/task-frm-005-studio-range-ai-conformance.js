'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const resolver=require(path.join(ROOT,'assets/shared/js/formation-target-resolver.js'));
const adapter=require(path.join(ROOT,'studio/ai-production/ai-battle-adapter.js'));
const genRules=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/shared/config/skill-ai-generation-rules.json'),'utf8'));
const budget=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/shared/config/skill-budget-rules.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/shared/config/skill-registry.json'),'utf8'));

assert.deepStrictEqual(Object.keys(registry.targets.ranges).sort(),['ALL','BACK','FRONT','RANDOM','SINGLE'].sort());
assert(!Object.prototype.hasOwnProperty.call(genRules.current_active.resource_policy.ranges,'PIERCE'));
assert(!Object.prototype.hasOwnProperty.call(budget.range_multiplier,'PIERCE'));
assert.throws(()=>resolver.normalizeFormationPosition(null),e=>e.code==='FORMATION_POSITION_INVALID');
assert.throws(()=>resolver.normalizeRange('PIERCE'),e=>e.code==='PIERCE_RANGE_ABOLISHED');

const units=[
 {id:'A',side:'味方',alive:true,formationPosition:'FRONTLINE'},
 {id:'E-F',side:'敵',alive:true,formationPosition:'FRONTLINE'},
 {id:'E-B',side:'敵',alive:true,formationPosition:'BACKLINE'}
];
const actor=units[0];
let pool=resolver.resolveLegalTargetCandidates({actor,units,targetContract:{side:'ENEMY',range:'SINGLE'}});
assert.deepStrictEqual(pool.map(x=>x.id),['E-F']);
pool=resolver.resolveLegalTargetCandidates({actor,units,targetContract:{side:'ENEMY',range:'BACK'}});
assert.deepStrictEqual(pool.map(x=>x.id),['E-F','E-B']);
pool=resolver.resolveLegalTargetCandidates({actor,units,targetContract:{side:'ENEMY',range:'FRONT'}});
assert.deepStrictEqual(pool.map(x=>x.id),['E-F']);
const randomPool=resolver.resolveLegalTargetCandidates({actor,units,targetContract:{side:'ENEMY',range:'RANDOM'}});
assert.deepStrictEqual(resolver.sampleTargetsWithReplacement(randomPool,2,()=>0.99).map(x=>x.id),['E-B','E-B']);
const advance=[{id:'F',side:'敵',alive:false,formationPosition:'FRONTLINE'},{id:'B',side:'敵',alive:true,formationPosition:'BACKLINE'}];
assert.strictEqual(resolver.applyForcedAdvance(advance,'敵'),true);assert.strictEqual(advance[1].formationPosition,'FRONTLINE');

const runtime={schema_version:'1.0.0',data_version:'1',program_id:'AI',program_version:1,entry_instruction:'I1',instructions:[
 {instruction_id:'I1',op:'TARGET',evaluator:'target.enemy_lowest',params:{},next:'I2'},
 {instruction_id:'I2',op:'ACTION',evaluator:'action.skill',params:{skill_id:'S1'}}
],source_map:{I1:'T',I2:'A'},limits:{max_steps:4}};
const battleInput={battle_id:'B',tick:1,phase:'reservation',seed:1,actor_id:'A',units:[
 {id:'A',side:'味方',alive:true,hp:100,maxHp:100,mp:100,formationPosition:'FRONTLINE',skills:[{id:'S1',resource:{mpCost:0},runtimeContracts:{targetContract:{side:'ENEMY',range:'SINGLE'}}}]},
 {id:'E-F',side:'敵',alive:true,hp:100,maxHp:100,formationPosition:'FRONTLINE'},
 {id:'E-B',side:'敵',alive:true,hp:1,maxHp:100,formationPosition:'BACKLINE'}
]};
const decision=adapter.decide(runtime,battleInput);
assert.strictEqual(decision.proposal.status,'selected');
assert.strictEqual(decision.proposal.action_id,'skill:S1');
assert.strictEqual(decision.proposal.target_id,'E-F','SINGLE must not choose lower-HP BACKLINE target');

const studio=fs.readFileSync(path.join(ROOT,'studio/index.html'),'utf8');
for(const text of ['formalBattleLegalCandidates','sampleTargetsWithReplacement','formalBattleApplyForcedAdvance','formationPosition','formation_multiplier:formationMultiplier'])assert(studio.includes(text),`Studio integration missing ${text}`);
console.log('TASK_FRM_005_STUDIO_RANGE_AI_CONFORMANCE_PASS');
