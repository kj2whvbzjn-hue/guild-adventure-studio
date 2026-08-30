const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const triggerEngine=require(path.join(ROOT,'assets/shared/js/trigger-engine.js'));

// Game: execute the actual dispatcher from the runtime in a VM with a minimal formal passive contract.
{
  const battle={tick:10,units:[],log:[],formalRandomSequence:0,p0113TieSeed:'TASK7E-DYNAMIC'};
  const events=[];
  const ctx={console,battle,GKSTriggerEngine:triggerEngine,recordValidationEvent:(kind,payload)=>events.push({kind,payload})};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'game/assets/js/tag-skill-runtime.js'),'utf8'),ctx);

  const attacker={
    id:'A',name:'Attacker',alive:true,side:'ENEMY',
    mp:77,cooldowns:{'SKILL:SKL-NORMAL-ATTACK':123},
    castingSkillId:'KEEP-CAST',castRemainingTicks:9,rangeCostSpent:41,
    damageDealt:0,damageTaken:0
  };
  const defender={
    id:'D',name:'Defender',alive:true,side:'ALLY',
    mp:55,cooldowns:{'SKILL:SKL-NORMAL-ATTACK':456},
    castingSkillId:'KEEP-DEF-CAST',castRemainingTicks:7,rangeCostSpent:31,
    damageDealt:0,damageTaken:0,formalPassiveRuntimeContracts:[]
  };
  battle.units=[attacker,defender];

  const make=(chance=1)=>({
    passiveId:'PAS-COUNTER',
    runtimeContracts:{
      schemaVersion:1,
      triggerContract:{
        type:'ON_HIT_RECEIVED',engineEvent:'hit_received',dispatchMode:'COUNTER',
        priority:5,activationChance:chance,cooldownTicks:0
      },
      targetContract:{mode:'EVENT_CONTEXT',eventTarget:'ATTACKER'},
      executionContract:{
        referencedSkillId:'SKL-NORMAL-ATTACK',
        effectContracts:[],applyContracts:[],
        // These are deliberate sentinels: Passive execution must not forward/consume Active Skill costs.
        mpCost:999,cooldownTicks:999,castTimeTicks:999,rangeCost:999
      }
    }
  });

  // The synthetic execution view must only borrow effects; Active Skill cost fields must not be forwarded.
  defender.formalPassiveRuntimeContracts=[make(1)];
  const executionView=ctx.currentBattlePassiveExecutionView(defender.formalPassiveRuntimeContracts[0]);
  assert.strictEqual(executionView.ok,true);
  assert.strictEqual(executionView.definition.id,'SKL-NORMAL-ATTACK');
  for(const forbidden of ['mpCost','cooldownTicks','castTimeTicks','rangeCost']){
    assert.strictEqual(Object.prototype.hasOwnProperty.call(executionView.definition.runtimeContracts,forbidden),false,
      `Game passive execution must not forward Active Skill cost field ${forbidden}`);
  }

  // Direct activation, 100% chance, no RNG, and no Active Skill resource/cooldown/cast/range-state mutation.
  const beforeCosts={
    attackerMp:attacker.mp, defenderMp:defender.mp,
    attackerSkillCd:attacker.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    defenderSkillCd:defender.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    attackerCast:attacker.castingSkillId, defenderCast:defender.castingSkillId,
    attackerCastTicks:attacker.castRemainingTicks, defenderCastTicks:defender.castRemainingTicks,
    attackerRange:attacker.rangeCostSpent, defenderRange:defender.rangeCostSpent
  };

  let action=triggerEngine.createActionContext({actionId:'g1'});
  let beforeSeq=battle.formalRandomSequence;

  // Force a nested same-Passive dispatch while the outer activation key is held.
  const originalExecute=ctx.executeCurrentBattlePassiveAction;
  let nestedReason=null;
  let nestedOnce=false;
  ctx.executeCurrentBattlePassiveAction=(entry,eventContext,actionContext)=>{
    if(!nestedOnce){
      nestedOnce=true;
      const nested=ctx.dispatchCurrentBattlePassiveCounters(
        attacker,defender,{definition:{id:'NESTED'}},{ok:true},
        {triggerActionContext:actionContext,hitIndex:99}
      );
      nestedReason=nested.results[0]?.reason||null;
    }
    return {ok:true,targets:[]};
  };

  let r=ctx.dispatchCurrentBattlePassiveCounters(
    attacker,defender,{definition:{id:'INCOMING'}},{ok:true},
    {triggerActionContext:action,hitIndex:0}
  );
  ctx.executeCurrentBattlePassiveAction=originalExecute;

  assert.strictEqual(r.processed,1);
  assert.strictEqual(r.results[0].ok,true);
  assert.strictEqual(battle.formalRandomSequence,beforeSeq,'Game chance=1 must not consume RNG');
  assert.ok(['TRIGGER_REENTRY_BLOCKED','TRIGGER_ACTIVE_REENTRY'].includes(nestedReason),
    `Game same-Passive re-entry must be blocked, got ${nestedReason}`);
  assert.ok(events.some(e=>e.kind==='passive_counter_executed'&&
    e.payload.referenced_skill_id==='SKL-NORMAL-ATTACK'&&e.payload.ok===true));

  assert.deepStrictEqual({
    attackerMp:attacker.mp, defenderMp:defender.mp,
    attackerSkillCd:attacker.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    defenderSkillCd:defender.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    attackerCast:attacker.castingSkillId, defenderCast:defender.castingSkillId,
    attackerCastTicks:attacker.castRemainingTicks, defenderCastTicks:defender.castRemainingTicks,
    attackerRange:attacker.rangeCostSpent, defenderRange:defender.rangeCostSpent
  },beforeCosts,'Game Passive Counter must not consume referenced Active Skill MP/CD/Cast/Range cost state');

  // 0% chance: no execution and no RNG.
  defender.formalPassiveRuntimeContracts=[make(0)];
  action=triggerEngine.createActionContext({actionId:'g0'});
  beforeSeq=battle.formalRandomSequence;
  r=ctx.dispatchCurrentBattlePassiveCounters(
    attacker,defender,{definition:{id:'INCOMING'}},{ok:true},
    {triggerActionContext:action,hitIndex:0}
  );
  assert.strictEqual(r.results[0].reason,'ACTIVATION_CHANCE_ZERO');
  assert.strictEqual(battle.formalRandomSequence,beforeSeq,'Game chance=0 must not consume RNG');

  // Multi-hit: release after Hit 0 must allow same Passive on Hit 1 in the same actionContext.
  defender.formalPassiveRuntimeContracts=[make(1)];
  action=triggerEngine.createActionContext({actionId:'gmulti'});
  const a=ctx.dispatchCurrentBattlePassiveCounters(
    attacker,defender,{definition:{id:'INCOMING'}},{ok:true},
    {triggerActionContext:action,hitIndex:0}
  );
  const b=ctx.dispatchCurrentBattlePassiveCounters(
    attacker,defender,{definition:{id:'INCOMING'}},{ok:true},
    {triggerActionContext:action,hitIndex:1}
  );
  assert.strictEqual(a.results[0].ok,true);
  assert.strictEqual(b.results[0].ok,true,'Game released activeKey must allow next Hit Safe Point');
}

// Studio: execute actual passive execution-skill builder + actual dispatcher body with controlled effect executor.
{
  const html=fs.readFileSync(path.join(ROOT,'studio/index.html'),'utf8');

  const skillMatch=html.match(/function formalBattlePassiveExecutionSkill\([\s\S]*?\nfunction formalBattleExecutePassiveAction/);
  assert.ok(skillMatch,'Studio passive execution skill builder not found');
  const skillFn=skillMatch[0].replace(/\nfunction formalBattleExecutePassiveAction[\s\S]*$/,'');

  const dispatchMatch=html.match(/function formalBattleDispatchPassiveCounters\([\s\S]*?\nfunction formalBattleFlushPassiveReactive/);
  assert.ok(dispatchMatch,'Studio Formal Passive Counter dispatcher not found');
  const dispatchFn=dispatchMatch[0].replace(/\nfunction formalBattleFlushPassiveReactive[\s\S]*$/,'');

  const calls=[];
  let rndCalls=0;
  let nestedReason=null;
  let nestedOnce=false;

  const actionContext={pendingReactive:[],activeKeys:new Set(),activationCount:0,history:[]};
  const engine={
    canActivate:(ctx,key)=>{
      calls.push('can');
      return ctx.activeKeys.has(key)?{ok:false,reason:'TRIGGER_ACTIVE_REENTRY'}:{ok:true,key};
    },
    commitActivation:(ctx,key)=>{
      calls.push('commit');
      if(ctx.activeKeys.has(key))return{ok:false,reason:'TRIGGER_ACTIVE_REENTRY'};
      ctx.activeKeys.add(key);
      return{ok:true,release:()=>ctx.activeKeys.delete(key)};
    }
  };

  const row={
    passiveId:'PAS-COUNTER',
    contract:{
      type:'ON_HIT_RECEIVED',engineEvent:'hit_received',dispatchMode:'COUNTER',
      activationChance:1,cooldownTicks:0
    },
    runtimeContracts:{
      executionContract:{
        referencedSkillId:'SKL-NORMAL-ATTACK',
        effectContracts:[],applyContracts:[],
        mpCost:999,cooldownTicks:999,castTimeTicks:999,rangeCost:999
      }
    }
  };

  const attacker={
    id:'A',mp:77,cooldowns:{'SKILL:SKL-NORMAL-ATTACK':123},
    castingSkillId:'KEEP-CAST',castRemainingTicks:9,rangeCostSpent:41
  };
  const defender={
    id:'D',alive:true,mp:55,cooldowns:{'SKILL:SKL-NORMAL-ATTACK':456},
    castingSkillId:'KEEP-DEF-CAST',castRemainingTicks:7,rangeCostSpent:31
  };
  const units=[attacker,defender];
  const trace=[];

  const ctx={
    console,structuredClone,
    window:{GKSTriggerEngine:engine},
    formalBattleEnsurePendingReactive:x=>x,
    formalBattleCounterPassiveEntries:()=>[row],
    tracePush:(trace,e)=>trace.push(e)
  };
  vm.createContext(ctx);
  vm.runInContext(skillFn,ctx);

  // Studio synthetic execution skill must not forward Active Skill cost fields.
  const borrowedSkill=ctx.formalBattlePassiveExecutionSkill(row);
  assert.strictEqual(borrowedSkill.id,'SKL-NORMAL-ATTACK');
  for(const forbidden of ['mpCost','cooldownTicks','castTimeTicks','rangeCost']){
    assert.strictEqual(Object.prototype.hasOwnProperty.call(borrowedSkill.runtimeContracts,forbidden),false,
      `Studio passive execution must not forward Active Skill cost field ${forbidden}`);
  }

  ctx.formalBattleExecutePassiveAction=(entry,event,eventActionContext)=>{
    calls.push(`execute:${event.hitIndex}`);
    if(!nestedOnce){
      nestedOnce=true;
      const nested=ctx.formalBattleDispatchPassiveCounters(
        attacker,defender,{id:'NESTED'},{ok:true},
        {actionContext:eventActionContext,hitIndex:99,tick:1,units,rnd:()=>{rndCalls++;return .25},trace}
      );
      nestedReason=nested.results[0]?.reason||null;
    }
    return{ok:true,targets:[],referencedSkillId:'SKL-NORMAL-ATTACK'};
  };
  vm.runInContext(dispatchFn,ctx);

  const beforeCosts={
    attackerMp:attacker.mp, defenderMp:defender.mp,
    attackerSkillCd:attacker.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    defenderSkillCd:defender.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    attackerCast:attacker.castingSkillId, defenderCast:defender.castingSkillId,
    attackerCastTicks:attacker.castRemainingTicks, defenderCastTicks:defender.castRemainingTicks,
    attackerRange:attacker.rangeCostSpent, defenderRange:defender.rangeCostSpent
  };

  let r=ctx.formalBattleDispatchPassiveCounters(
    attacker,defender,{id:'INCOMING'},{ok:true},
    {actionContext,hitIndex:0,tick:1,units,rnd:()=>{rndCalls++;return .25},trace}
  );
  assert.strictEqual(r.results[0].ok,true);
  assert.deepStrictEqual(calls.slice(0,3),['can','commit','execute:0']);
  assert.strictEqual(rndCalls,0,'Studio chance=1 must not consume RNG');
  assert.strictEqual(nestedReason,'TRIGGER_ACTIVE_REENTRY','Studio same-Passive re-entry must be blocked');
  assert.ok(trace.some(x=>x.kind==='formal_passive_counter_executed'&&
    x.referenced_skill_id==='SKL-NORMAL-ATTACK'));

  assert.deepStrictEqual({
    attackerMp:attacker.mp, defenderMp:defender.mp,
    attackerSkillCd:attacker.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    defenderSkillCd:defender.cooldowns['SKILL:SKL-NORMAL-ATTACK'],
    attackerCast:attacker.castingSkillId, defenderCast:defender.castingSkillId,
    attackerCastTicks:attacker.castRemainingTicks, defenderCastTicks:defender.castRemainingTicks,
    attackerRange:attacker.rangeCostSpent, defenderRange:defender.rangeCostSpent
  },beforeCosts,'Studio Passive Counter must not consume referenced Active Skill MP/CD/Cast/Range cost state');

  // 0% chance: no execution and no RNG.
  calls.length=0;
  row.contract.activationChance=0;
  r=ctx.formalBattleDispatchPassiveCounters(
    attacker,defender,{id:'INCOMING'},{ok:true},
    {actionContext,hitIndex:1,tick:1,units,rnd:()=>{rndCalls++;return .25},trace}
  );
  assert.strictEqual(r.results[0].reason,'ACTIVATION_CHANCE_ZERO');
  assert.strictEqual(rndCalls,0,'Studio chance=0 must not consume RNG');

  // Multi-hit: after release, Hit 2 is independently eligible.
  calls.length=0;
  row.contract.activationChance=1;
  const hit2=ctx.formalBattleDispatchPassiveCounters(
    attacker,defender,{id:'INCOMING'},{ok:true},
    {actionContext,hitIndex:2,tick:1,units,rnd:()=>{rndCalls++;return .25},trace}
  );
  assert.strictEqual(hit2.results[0].ok,true,'Studio released activeKey must allow next Hit Safe Point');
}

console.log('TASK7E_FORMAL_PASSIVE_COUNTER_DYNAMIC_PASS');
