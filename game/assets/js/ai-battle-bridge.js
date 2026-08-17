(function(root,factory){
  const Engine=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-decision-engine.js'):root?.GKSAIDecisionEngine;
  const api=factory(Engine);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAIBattleBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Engine){
  'use strict';
  if(!Engine)throw new Error('Formal AI Decision Engine is required');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  function snapshot(input){
    const units=(input?.units||[]).map(unit=>({
      id:String(unit.id||''),
      side:String(unit.side||''),
      alive:unit.alive!==false,
      hp:Number(unit.hp)||0,
      max_hp:Math.max(1,Number(unit.maxHp??unit.max_hp)||1),
      mp:Number(unit.mp)||0,
      max_mp:Math.max(0,Number(unit.maxMp??unit.max_mp)||0)
    }));
    return {
      battle_id:String(input?.battle_id||'game-battle'),
      tick:Math.max(0,Number(input?.tick)||0),
      phase:['reservation','execution','rethink'].includes(input?.phase)?input.phase:'reservation',
      seed:input?.seed??0,
      actor_id:String(input?.actor_id||''),
      units
    };
  }
  function createHandlers(){
    const unit=(ctx,id)=>ctx.units.find(row=>row.id===id),actor=ctx=>unit(ctx,ctx.actor_id);
    const sameSide=ctx=>{const self=actor(ctx);return self?ctx.units.filter(row=>row.alive&&row.side===self.side):[];};
    const enemies=ctx=>{const self=actor(ctx);return self?ctx.units.filter(row=>row.alive&&row.side!==self.side):[];};
    const lowest=rows=>rows.slice().sort((a,b)=>a.hp/a.max_hp-b.hp/b.max_hp||a.id.localeCompare(b.id))[0]||null;
    return Object.freeze({
      condition(evaluator,params,ctx){
        const self=actor(ctx);if(!self)return false;
        if(evaluator==='condition.always')return true;
        if(evaluator==='condition.hp_below')return self.hp/self.max_hp<Number(params?.threshold);
        if(evaluator==='condition.mp_at_least')return self.mp>=Number(params?.amount);
        return false;
      },
      target(evaluator,params,ctx){
        let selected=null,pool=[];
        if(evaluator==='target.self'){selected=actor(ctx);pool=selected?[selected]:[];}
        else if(evaluator==='target.ally_lowest'){pool=sameSide(ctx);selected=lowest(pool);}
        else if(evaluator==='target.enemy_lowest'){pool=enemies(ctx);selected=lowest(pool);}
        return {target_id:selected?.id||null,candidates:pool.map(row=>row.id)};
      },
      action(evaluator,params){
        if(evaluator==='action.wait')return {wait:true,reason:'wait'};
        if(evaluator==='action.attack')return {action_id:'attack'};
        if(evaluator==='action.skill'){
          const skillId=String(params?.skill_id||'').trim();
          return skillId?{action_id:`skill:${skillId}`}:{action_id:null,reason:'skill_id_missing'};
        }
        return {action_id:null,reason:'unsupported_action'};
      }
    });
  }
  function decide(runtime,battleInput){
    const context=snapshot(battleInput),trace=Engine.execute(runtime,context,createHandlers());
    return {proposal:clone(trace.outcome),trace};
  }
  return Object.freeze({snapshot,createHandlers,decide});
});
