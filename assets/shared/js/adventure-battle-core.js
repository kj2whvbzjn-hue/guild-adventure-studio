(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GKAdventureBattleCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
const FORMATION_POSITIONS=Object.freeze(['FRONTLINE','BACKLINE']);
function normalizeFormationPosition(value,{nullable=false}={}){const v=String(value||'').toUpperCase();if(FORMATION_POSITIONS.includes(v))return v;return nullable?null:'FRONTLINE';}
function normalizeFormation(rows){return(Array.isArray(rows)?rows:[]).map(x=>{const position=normalizeFormationPosition(x?.formation_position??x?.formationPosition,{nullable:true});return{monster_id:String(x?.monster_id||''),count:Math.max(1,Math.floor(Number(x?.count)||1)),...(position?{formation_position:position}:{})}}).filter(x=>x.monster_id);}
function normalizeSkillIds(value){const out=[],seen=new Set();for(const row of Array.isArray(value)?value:[]){const id=String(row||'').trim();if(!id||seen.has(id))continue;seen.add(id);out.push(id);}return out;}
function requiredMonsterCombatNumber(value,path,{min=0}={}){const n=Number(value);if(value==null||value===''||!Number.isFinite(n)||n<min)throw new Error(`${path} が不正です。`);return Math.floor(n);}
function monsterStats(monster){const p=monster?.params&&typeof monster.params==='object'?monster.params:{},skillIds=normalizeSkillIds(p.skill_ids??p.skillIds??monster?.skill_ids??monster?.skillIds),requestedDefault=String((p.defaultSkillId??p.default_skill_id??monster?.defaultSkillId??monster?.default_skill_id)||'').trim(),defaultSkillId=skillIds.length?(skillIds.includes(requestedDefault)?requestedDefault:skillIds[0]):(requestedDefault||'SKL-TEST-ATTACK'),monsterId=String(monster?.id||monster?.name||'Monster'),jobRef=String(p.job_code??p.job_id??p.job??monster?.job_code??monster?.job_id??monster?.job??'').trim(),levelValue=p.level??monster?.level,formalGenerated=!!jobRef&&Number.isFinite(Number(levelValue));const defaultFormationPosition=normalizeFormationPosition(monster?.default_formation_position??p.default_formation_position,{nullable:false});if(formalGenerated){const maxHp=requiredMonsterCombatNumber(p.maxHp??p.max_hp??p.hp??monster?.maxHp??monster?.max_hp??monster?.hp,`${monsterId}.maxHp`,{min:1}),maxMp=requiredMonsterCombatNumber(p.maxMp??p.max_mp??p.mp??monster?.maxMp??monster?.max_mp??monster?.mp,`${monsterId}.maxMp`,{min:0}),attack=requiredMonsterCombatNumber(p.attack??p.atk??monster?.attack??monster?.atk,`${monsterId}.attack`,{min:0}),agi=requiredMonsterCombatNumber(p.agi??monster?.agi,`${monsterId}.agi`,{min:0});return{name:String(monster?.name||monster?.id||'Monster'),defaultFormationPosition,maxHp,maxMp,attack,agi,aiPolicy:String((p.aiPolicy??p.ai_policy??monster?.aiPolicy??monster?.ai_policy)||'lowestHp'),...(skillIds.length?{skillIds}:{}),defaultSkillId,formalGenerated:true};}return{name:String(monster?.name||monster?.id||'Monster'),defaultFormationPosition,maxHp:Math.max(1,Math.floor(Number(p.maxHp??p.max_hp??p.hp??monster?.maxHp??monster?.max_hp??monster?.hp)||100)),attack:Math.max(0,Math.floor(Number(p.attack??p.atk??monster?.attack??monster?.atk)||10)),agi:Math.max(1,Math.floor(Number(p.agi??monster?.agi)||10)),aiPolicy:String((p.aiPolicy??p.ai_policy??monster?.aiPolicy??monster?.ai_policy)||'lowestHp'),...(skillIds.length?{skillIds}:{}),defaultSkillId};}
function expandFormation(formation,monsters){const byId=new Map((monsters||[]).map(m=>[String(m.id),m])),out=[];for(const row of normalizeFormation(formation)){const master=byId.get(row.monster_id);if(!master)throw new Error(`Monster not found: ${row.monster_id}`);for(let i=0;i<row.count;i++){const stats=monsterStats(master),formationPosition=normalizeFormationPosition(row.formation_position??stats.defaultFormationPosition,{nullable:false});out.push({monster_id:row.monster_id,instance_index:i+1,...stats,formationPosition})};}return out;}
function validationEventsToPlaybackEvents(events){
 const out=[],committedActionStartKeys=new Set();
 const actionKey=e=>`${Number(e?.tick)||0}\u0000${String(e?.source_id??'')}`;
 for(const e of events||[]){
  const base={at_tick:Number(e.tick)||0};
  switch(e.type){
   case'battle_started':out.push({...base,type:'battle_start',seed:e.seed??null});break;
   case'action_execution_committed':{
    const skillId=e.skill_id??null,key=actionKey(e);
    out.push({...base,type:'action_start',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:skillId,skill_name:e.skill_name??null});
    committedActionStartKeys.add(key);
    if(skillId!==null&&String(skillId).trim()!=='')out.push({...base,type:'skill_cast',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:skillId,skill_name:e.skill_name??null});
    break;
   }
   case'attack':out.push({...base,type:'hit',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:e.skill_id??null});out.push({...base,type:'damage',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:e.skill_id??null,value:Number(e.damage)||0,hp_after:e.hp_after??null});break;
   case'basic_attack':{
    const key=actionKey(e);
    if(!committedActionStartKeys.has(key))out.push({...base,type:'action_start',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:null});
    committedActionStartKeys.delete(key);
    out.push({...base,type:'hit',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:null});
    out.push({...base,type:'damage',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:null,value:Number(e.damage)||0,hp_after:e.hp_after??null});
    break;
   }
   case'heal':out.push({...base,type:'heal',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:e.skill_id??null,value:Number(e.applied)||0,hp_after:e.hp_after??null});break;
   case'status_applied':out.push({...base,type:'status_apply',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:e.skill_id??null,status_id:e.status_id??null});break;
   case'status_removed':out.push({...base,type:'status_remove',target_id:e.target_id??null,status_id:e.status_id??null,reason:e.reason??null});break;
   case'unit_death_reset':case'basic_attack_ko':case'dot_defeat':out.push({...base,type:'ko',target_id:e.target_id??null,source_id:e.source_id??null});break;
   case'battle_finished':out.push({...base,type:'battle_end',result:e.result??null});break;
   default:break;
  }
 }
 return out;
}
function buildBattleResult({battle,context={}}={}){const b=battle||{},units=Array.isArray(b.units)?b.units:[],result=String(b.result||b.pendingResult||'');return{victory:result==='味方勝利',result,seed:context.seed??b.p0113TieSeed??null,enemy_formation:clone(context.formation||[]),unit_final_state:units.map(u=>({id:u.id,character_id:u.characterId||null,monster_id:u.monsterId||null,name:u.name,side:u.side,hp:Number(u.hp)||0,max_hp:Number(u.maxHp)||0,mp:Number(u.mp)||0,max_mp:Number(u.maxMp)||0,alive:Boolean(u.alive),damage_dealt:Number(u.damageDealt)||0,damage_taken:Number(u.damageTaken)||0})),statistics:{ticks:Number(b.tick)||0,actions:Number(b.actions)||0,ally_damage:units.filter(u=>u.side==='味方').reduce((n,u)=>n+(Number(u.damageDealt)||0),0),enemy_damage:units.filter(u=>u.side==='敵').reduce((n,u)=>n+(Number(u.damageDealt)||0),0)},debug_logs:clone(b.log||[]),playback_events:validationEventsToPlaybackEvents(b.validationEvents||[])};}

return{clone,FORMATION_POSITIONS,normalizeFormationPosition,normalizeFormation,monsterStats,expandFormation,validationEventsToPlaybackEvents,buildBattleResult};
});
