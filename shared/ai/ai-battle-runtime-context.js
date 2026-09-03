(function(root,factory){
  const Engine=typeof module==='object'&&module.exports?require('./ai-decision-engine.js'):root?.GKSAIDecisionEngine;
  const Formation=typeof module==='object'&&module.exports?require('../../assets/shared/js/formation-target-resolver.js'):root?.GKSFormationTargetResolver;
  const api=factory(Engine,Formation);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIBattleRuntimeContext=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Engine,Formation){
  'use strict';
  if(!Engine)throw new Error('Formal AI Decision Engine is required');
  if(!Formation)throw new Error('Formation Target Resolver is required');
  const EFFECT_SCOPE_MAP=Object.freeze({STATUS:'statusEffects',DOT:'dotStacks',MODIFIER:'modifierStacks',SHIELD:'shieldEffects',COVER:'coverEffects'});
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const nonEmpty=value=>typeof value==='string'&&value.trim().length>0;
  function canonicalEffect(row){
    if(!isObject(row))return null;
    const sourceSkillId=String(row.source_skill_id||''),sourceEffectIndex=Number(row.source_effect_index),tags=Array.isArray(row.effect_tag_ids)?row.effect_tag_ids.map(x=>String(x||'')):null;
    if(!nonEmpty(sourceSkillId)||!Number.isInteger(sourceEffectIndex)||sourceEffectIndex<0||!tags||tags.some(id=>!/^TAG-\d{4}$/.test(id)))return null;
    return Object.freeze({source_skill_id:sourceSkillId,source_effect_index:sourceEffectIndex,effect_tag_ids:Object.freeze(tags.slice()),...(nonEmpty(String(row.source_effect_id||''))?{source_effect_id:String(row.source_effect_id)}:{})});
  }
  function snapshotEffects(unit,key){return Object.freeze((Array.isArray(unit?.[key])?unit[key]:[]).map(canonicalEffect).filter(Boolean));}
  function normalizeSkillStates(value){
    const source=isObject(value)?value:{},out={};
    for(const [id,row] of Object.entries(source)){
      if(!nonEmpty(String(id))||!isObject(row))continue;
      const tc=isObject(row.target_contract)?clone(row.target_contract):null;
      out[String(id)]=Object.freeze({ready:row.ready===true,usable:row.usable===true,target_contract:tc,reason:row.reason==null?null:String(row.reason)});
    }
    return Object.freeze(out);
  }
  function snapshot(input){
    const units=(input?.units||[]).map(unit=>Object.freeze({
      id:String(unit.id||''),side:String(unit.side||''),alive:unit.alive!==false,hp:Number(unit.hp)||0,max_hp:Math.max(1,Number(unit.maxHp??unit.max_hp)||1),mp:Number(unit.mp)||0,max_mp:Math.max(0,Number(unit.maxMp??unit.max_mp)||0),
      formationPosition:Formation.normalizeFormationPosition(unit.formationPosition??unit.formation_position),skill_states:normalizeSkillStates(unit.aiSkillStates??unit.skill_states),
      statusEffects:snapshotEffects(unit,'statusEffects'),dotStacks:snapshotEffects(unit,'dotStacks'),modifierStacks:snapshotEffects(unit,'modifierStacks'),shieldEffects:snapshotEffects(unit,'shieldEffects'),coverEffects:snapshotEffects(unit,'coverEffects')
    }));
    return Object.freeze({battle_id:String(input?.battle_id||'formal-ai-battle'),tick:Math.max(0,Number(input?.tick)||0),phase:['reservation','execution','rethink'].includes(input?.phase)?input.phase:'reservation',seed:input?.seed??0,actor_id:String(input?.actor_id||''),units:Object.freeze(units),target_selectors:Object.freeze(clone(Array.isArray(input?.target_selectors)?input.target_selectors:[]))});
  }
  function compareNumber(actual,operator,expected){if(!Number.isFinite(actual)||!Number.isFinite(expected))return false;if(operator==='<')return actual<expected;if(operator==='<=')return actual<=expected;if(operator==='>')return actual>expected;if(operator==='>=')return actual>=expected;if(operator==='=')return actual===expected;return false;}
  function effectRows(subject,scope){const normalized=String(scope||'').toUpperCase();if(normalized==='ANY_ACTIVE_EFFECT')return Object.values(EFFECT_SCOPE_MAP).flatMap(key=>Array.isArray(subject?.[key])?subject[key]:[]);const key=EFFECT_SCOPE_MAP[normalized];return key&&Array.isArray(subject?.[key])?subject[key]:[];}
  function predicate(evaluator,params,subject,subjectKind){
    const name=String(evaluator||'');if(name==='condition.always')return true;
    if(name==='condition.hp_ratio_compare'){if(subjectKind==='BATTLE')return false;const ratio=Number(subject?.hp||0)/Math.max(1,Number(subject?.max_hp??subject?.maxHp)||1);return compareNumber(ratio,String(params?.operator||''),Number(params?.value));}
    if(name==='condition.skill_ready'||name==='condition.skill_usable'){if(subjectKind==='BATTLE')return false;const state=subject?.skill_states?.[String(params?.skill_id||'')];return name==='condition.skill_ready'?state?.ready===true:state?.usable===true;}
    if(name==='condition.active_effect_has_tag'){if(subjectKind==='BATTLE')return false;const tagId=String(params?.tag_id||'');if(!/^TAG-\d{4}$/.test(tagId))return false;return effectRows(subject,params?.effect_scope).some(row=>Array.isArray(row?.effect_tag_ids)&&row.effect_tag_ids.includes(tagId));}
    return false;
  }
  function actorOf(ctx){return (ctx?.units||[]).find(row=>String(row?.id||'')===String(ctx?.actor_id||''))||null;}
  function legalCandidates(ctx,targetContract){const actor=actorOf(ctx);if(!actor||!isObject(targetContract))return[];try{return Formation.resolveLegalTargetCandidates({actor,units:ctx.units,targetContract});}catch(_){return[];}}
  function action(evaluator,params,ctx){
    const name=String(evaluator||'');if(name==='action.wait')return{wait:true,reason:'wait'};
    if(name==='action.attack'){const targetContract={side:'ENEMY',range:'SINGLE'};return{action_id:'attack',target_contract:targetContract,legal_candidates:legalCandidates(ctx,targetContract)};}
    if(name==='action.skill'){const skillId=String(params?.skill_id||'').trim(),self=actorOf(ctx),state=self?.skill_states?.[skillId];if(!skillId)return{action_id:null,reason:'skill_id_missing'};if(!state?.ready)return{action_id:null,reason:state?.reason||'skill_not_ready'};if(!isObject(state.target_contract))return{action_id:null,reason:'skill_target_contract_missing'};return{action_id:`skill:${skillId}`,target_contract:clone(state.target_contract),legal_candidates:legalCandidates(ctx,state.target_contract)};}
    return{action_id:null,reason:'unsupported_action'};
  }
  function fnv1a32(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
  function createDecisionRng(seed){let index=0;return()=>fnv1a32(`${String(seed)}|AI_DECISION|${index++}`)/0x100000000;}
  function createHandlers(context){return Object.freeze({predicate,action,target_selector_master(id,ctx){return(ctx?.target_selectors||[]).find(row=>String(row?.id||'')===String(id||''))||null;},ai_decision_rng:createDecisionRng(context?.seed??0)});}
  function decide(runtime,battleInput){const context=snapshot(battleInput),trace=Engine.execute(runtime,context,createHandlers(context));return{proposal:clone(trace.outcome),trace};}
  return Object.freeze({EFFECT_SCOPE_MAP,clone,canonicalEffect,snapshotEffects,normalizeSkillStates,snapshot,compareNumber,effectRows,predicate,actorOf,legalCandidates,action,createDecisionRng,createHandlers,decide});
});
