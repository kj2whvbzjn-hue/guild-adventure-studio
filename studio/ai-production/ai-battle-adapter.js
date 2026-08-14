(function(root,factory){
  const engine=typeof module==='object'&&module.exports?require('./ai-decision-engine.js'):root&&root.GKSAIDecisionEngine;
  const api=factory(engine);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIBattleAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Engine){
  'use strict';
  if(!Engine)throw new Error('GKSAIDecisionEngine is required');
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  function snapshot(input){
    const units=(input?.units||[]).map((unit)=>({id:String(unit.id),side:String(unit.side||''),alive:unit.alive!==false,hp:Number(unit.hp)||0,max_hp:Math.max(1,Number(unit.maxHp??unit.max_hp)||1),mp:Number(unit.mp)||0,max_mp:Math.max(0,Number(unit.maxMp??unit.max_mp)||0),defense:Number(unit.defense)||0,statuses:clone(unit.statuses||[]),cooldowns:clone(unit.cooldowns||{}),skills:clone(unit.skills||[])}));
    return {battle_id:String(input?.battle_id||'studio-battle'),tick:Math.max(0,Number(input?.tick)||0),phase:input?.phase||'reservation',seed:input?.seed??0,actor_id:String(input?.actor_id||''),units,mp_cost_multiplier:Math.max(0,Number(input?.mp_cost_multiplier)||1)};
  }
  function seeded(seed){let x=(Number(seed)||1)>>>0;return()=>{x=(x+0x6D2B79F5)|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function createHandlers(){
    let random=null,randomSeed;
    const unit=(ctx,id)=>ctx.units.find((row)=>row.id===id),actor=(ctx)=>unit(ctx,ctx.actor_id),allies=(ctx)=>ctx.units.filter((row)=>row.alive&&row.side===actor(ctx)?.side),enemies=(ctx)=>ctx.units.filter((row)=>row.alive&&row.side!==actor(ctx)?.side);
    function rnd(ctx){if(randomSeed!==ctx.seed){randomSeed=ctx.seed;random=seeded(ctx.seed);}return random();}
    return {
      condition(evaluator,params,ctx){const self=actor(ctx);if(!self)return false;if(evaluator==='condition.always')return true;if(evaluator==='condition.hp_below')return self.hp/self.max_hp<Number(params.threshold);if(evaluator==='condition.ally_hp_below')return allies(ctx).some((row)=>row.hp/row.max_hp<Number(params.threshold));if(evaluator==='condition.enemy_count_at_most')return enemies(ctx).length<=Number(params.count);if(evaluator==='condition.mp_at_least')return self.mp>=Number(params.amount);return false;},
      target(evaluator,params,ctx){const self=actor(ctx);let pool=[];if(evaluator==='target.self')pool=self?[self]:[];else if(evaluator.startsWith('target.ally'))pool=allies(ctx);else pool=enemies(ctx);if(!pool.length)return {target_id:null,candidates:[]};const candidates=pool.map((row)=>row.id);let selected;if(evaluator.endsWith('defense_lowest'))selected=pool.slice().sort((a,b)=>a.defense-b.defense||a.id.localeCompare(b.id))[0];else if(evaluator.endsWith('lowest'))selected=pool.slice().sort((a,b)=>a.hp/a.max_hp-b.hp/b.max_hp||a.id.localeCompare(b.id))[0];else if(evaluator.endsWith('highest'))selected=pool.slice().sort((a,b)=>b.hp/b.max_hp-a.hp/a.max_hp||a.id.localeCompare(b.id))[0];else if(evaluator.endsWith('random'))selected=pool[Math.floor(rnd(ctx)*pool.length)];else selected=pool[0];return {target_id:selected.id,candidates};},
      action(evaluator,params,ctx){const self=actor(ctx);if(!self)return {action_id:null,reason:'actor_not_found'};if(evaluator==='action.wait')return {wait:true};if(evaluator==='action.attack')return {action_id:'attack'};if(evaluator==='action.skill'){const skillId=String(params.skill_id||''),skill=self.skills.find((row)=>String(typeof row==='string'?row:row.id)===skillId);if(!skill)return {action_id:null,reason:'skill_not_owned'};const definition=typeof skill==='string'?{id:skill}:{...skill},cost=Math.max(0,Number(definition.mp_cost)||0)*ctx.mp_cost_multiplier,readyAt=Number(self.cooldowns[skillId]||0);if(self.mp<cost)return {action_id:null,reason:'cost_shortage'};if(ctx.tick<readyAt)return {action_id:null,reason:'cooldown'};return {action_id:`skill:${skillId}`};}return {action_id:null,reason:'unsupported_action'};}
    };
  }
  function decide(runtime,battleInput,handlers){const context=snapshot(battleInput),trace=Engine.execute(runtime,context,handlers||createHandlers());return {proposal:{status:trace.outcome.status,action_id:trace.outcome.action_id,target_id:trace.outcome.target_id,reason:trace.outcome.reason},trace};}
  return Object.freeze({snapshot,createHandlers,decide});
});
