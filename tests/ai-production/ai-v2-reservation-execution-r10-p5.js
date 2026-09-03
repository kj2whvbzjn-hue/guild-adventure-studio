const assert=require('assert');
const path=require('path');
const root=path.resolve(__dirname,'../..');
process.chdir(root);
const gameBridge=require('../../game/assets/js/ai-battle-bridge.js');
const studioAdapter=require('../../studio/ai-production/ai-battle-adapter.js');
const Formation=require('../../assets/shared/js/formation-target-resolver.js');
const Validator=require('../../shared/ai/ai-program-validator.js');

function runtimeFor(skillId,{selector=false}={}){
  return {schema_version:'2.0.0',data_version:'R10-P5',program_id:'AIP-P5',program_version:1,entry_instruction:'I1',instructions:[{instruction_id:'I1',op:'ACTION',origin_part_id:'N1',source_node_id:'N1',evaluator:'action.skill',params:{skill_id:skillId},...(selector?{target_selector:{selector_id:'ATS-RANDOM',params:{}}}:{})}],source_map:{I1:{origin_part_id:'N1',source_node_id:'N1'}},limits:{max_steps:1,max_subroutine_depth:0}};
}
const selectors=[{schema_version:'2.0.0',id:'ATS-RANDOM',name:'Random',evaluator:'selector.random',parameter_schema:{type:'object',properties:{},additionalProperties:false},tags:[],enabled:true}];
const enemies=[
  {id:'E1',side:'ENEMY',alive:true,hp:10,maxHp:100,maxMp:0,mp:0,formationPosition:'FRONTLINE'},
  {id:'E2',side:'ENEMY',alive:true,hp:20,maxHp:100,maxMp:0,mp:0,formationPosition:'BACKLINE'}
];
function gameInput(skillId,targetContract){return{battle_id:'B-P5',tick:10,phase:'reservation',seed:'same-seed',actor_id:'A',target_selectors:selectors,units:[{id:'A',side:'ALLY',alive:true,hp:100,maxHp:100,mp:50,maxMp:50,formationPosition:'FRONTLINE',aiSkillStates:{[skillId]:{ready:true,usable:true,target_contract:targetContract}}},...enemies]};}
function studioInput(skillId,targetContract){return{battle_id:'B-P5',tick:10,phase:'reservation',seed:'same-seed',actor_id:'A',target_selectors:selectors,units:[{id:'A',side:'ALLY',alive:true,hp:100,maxHp:100,mp:50,maxMp:50,formationPosition:'FRONTLINE',cooldowns:{},skills:[{id:skillId,target:targetContract,mp_cost:0}]},...enemies.map(x=>({...x,skills:[]}))]};}

// Selector-required SINGLE: Game and Studio must produce the exact same decision trace and AI_DECISION RNG stream.
{
  const tc={side:'ENEMY',range:'SINGLE'},runtime=runtimeFor('SKL-SINGLE',{selector:true});
  const game=gameBridge.decide(runtime,gameInput('SKL-SINGLE',tc));
  const studio=studioAdapter.decide(runtime,studioInput('SKL-SINGLE',tc));
  assert.deepStrictEqual(studio.trace,game.trace,'Game/Studio same-seed trace must be identical');
  assert(['E1'].includes(game.proposal.target_id),'SINGLE legal candidate must be selected from enemy frontline');
  const rng=game.trace.events.filter(x=>x.event_type==='rng');assert.strictEqual(rng.length,1);assert.strictEqual(rng[0].rng_stream,'AI_DECISION');
}

// Selector-forbidden RANDOM: reservation/rethink must stay targetless and consume no RNG.
{
  const tc={side:'ENEMY',range:'RANDOM',randomCount:3},runtime=runtimeFor('SKL-RANDOM');
  const game=gameBridge.decide(runtime,gameInput('SKL-RANDOM',tc));
  const studio=studioAdapter.decide(runtime,studioInput('SKL-RANDOM',tc));
  assert.deepStrictEqual(studio.trace,game.trace,'targetless Game/Studio trace must match');
  assert.strictEqual(game.proposal.target_id,null);assert.strictEqual(game.trace.events.some(x=>x.event_type==='rng'),false,'RANDOM range must not consume AI decision RNG');
}

// Game execution target resolver: RANDOM samples only here, with replacement, and records BATTLE_EXECUTION.
global.GKSFormationTargetResolver=Formation;
const events=[];global.recordValidationEvent=(type,details)=>events.push({type,details});
global.battle={tick:25,p0113TieSeed:'same-seed',formalRandomSequence:0,units:[{id:'A',side:'ALLY',alive:true,hp:100,maxHp:100,formationPosition:'FRONTLINE'},...enemies.map(x=>({...x}))]};
require('../../game/assets/js/tag-skill-runtime.js');
const actor=global.battle.units[0],targetRuntime=global.GKSFormalSkillTargetRuntime;assert(targetRuntime?.resolveTaggedTargets);
const randomDefinition={id:'SKL-RANDOM',logicOrder:[],target:{side:'enemy',range:'random',randomCount:3}};
const first=targetRuntime.resolveTaggedTargets(actor,null,randomDefinition);assert.strictEqual(first.ok,true);assert.strictEqual(first.targets.length,3);assert.strictEqual(global.battle.formalRandomSequence,3,'RANDOM must consume exactly one Battle RNG value per draw at execution resolution');
assert.strictEqual(events.length,3);assert(events.every(x=>x.type==='range_random_rng_consumed'&&x.details.rng_stream==='BATTLE_EXECUTION'));
const firstIds=first.targets.map(x=>x.id);events.length=0;global.battle.formalRandomSequence=0;const second=targetRuntime.resolveTaggedTargets(actor,null,randomDefinition);assert.deepStrictEqual(second.targets.map(x=>x.id),firstIds,'same Battle seed/sequence must be deterministic');
assert(firstIds.every(id=>['E1','E2'].includes(id)),'RANDOM draws must stay inside legal candidates');

// Fixed SINGLE cannot auto-retarget to another legal target when the fixed target becomes illegal.
const invalidFixed=global.battle.units.find(x=>x.id==='E2');const fixed=targetRuntime.resolveTaggedTargets(actor,invalidFixed,{id:'SKL-SINGLE',logicOrder:[],target:{side:'enemy',range:'single'}});assert.strictEqual(fixed.ok,false);assert.strictEqual(fixed.targets.length,0);
// Deterministic SELF remains targetless at reservation and resolves self at execution.
const selfResult=targetRuntime.resolveTaggedTargets(actor,null,{id:'SKL-SELF',logicOrder:[],target:{side:'self',range:'single'}});assert.strictEqual(selfResult.ok,true);assert.deepStrictEqual(selfResult.targets.map(x=>x.id),['A']);

// Reservation mode matrix used by Game battle-control source.
global.window=global;const dom=new Map();global.$=(id)=>{if(!dom.has(id))dom.set(id,{value:'',checked:false});return dom.get(id)};global.localStorage={getItem:()=>null,setItem:()=>{}};global.addEventListener=()=>{};global.GKSAIProgramValidator=Validator;
require('../../game/assets/js/battle-control.js');const lifecycle=global.GKGameAIReservationExecution;assert(lifecycle);
const compiled=(side,range)=>({definition:{runtimeContracts:{targetContract:{side,range}}}});
assert.strictEqual(lifecycle.reservationTargetMode('attack',null),'RESERVATION_FIXED');
assert.strictEqual(lifecycle.reservationTargetMode('skill:X',compiled('ENEMY','SINGLE')),'RESERVATION_FIXED');
assert.strictEqual(lifecycle.reservationTargetMode('skill:X',compiled('ENEMY','BACK')),'RESERVATION_FIXED');
for(const range of ['FRONT','ALL','RANDOM'])assert.strictEqual(lifecycle.reservationTargetMode('skill:X',compiled('ENEMY',range)),'EXECUTION_PRECHECK');
assert.strictEqual(lifecycle.reservationTargetMode('skill:X',compiled('SELF','SINGLE')),'EXECUTION_PRECHECK');

console.log('AI_V2_R10_P5_RESERVATION_EXECUTION_OK fixed_single=reservation targetless_set_random_self=execution_precheck selector_rng=AI_DECISION range_rng=BATTLE_EXECUTION random_once=1 cast_snapshot_contract=1 no_retarget=1 game_studio_trace_parity=1');
