(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GKAdventureBattleCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function normalizeFormation(rows){return(Array.isArray(rows)?rows:[]).map(x=>({monster_id:String(x?.monster_id||''),count:Math.max(1,Math.floor(Number(x?.count)||1))})).filter(x=>x.monster_id);}
function monsterStats(monster){const p=monster?.params&&typeof monster.params==='object'?monster.params:{};return{name:String(monster?.name||monster?.id||'Monster'),maxHp:Math.max(1,Math.floor(Number(p.maxHp??p.max_hp??p.hp??monster?.maxHp??monster?.max_hp??monster?.hp)||100)),attack:Math.max(0,Math.floor(Number(p.attack??p.atk??monster?.attack??monster?.atk)||10)),agi:Math.max(1,Math.floor(Number(p.agi??monster?.agi)||10)),aiPolicy:String((p.aiPolicy??p.ai_policy??monster?.aiPolicy??monster?.ai_policy)||'lowestHp'),defaultSkillId:String((p.defaultSkillId??p.default_skill_id??monster?.defaultSkillId??monster?.default_skill_id)||'SKL-TEST-ATTACK')};}
function expandFormation(formation,monsters){const byId=new Map((monsters||[]).map(m=>[String(m.id),m])),out=[];for(const row of normalizeFormation(formation)){const master=byId.get(row.monster_id);if(!master)throw new Error(`Monster not found: ${row.monster_id}`);for(let i=0;i<row.count;i++)out.push({monster_id:row.monster_id,instance_index:i+1,...monsterStats(master)});}return out;}
function validationEventsToPlaybackEvents(events){
 const out=[],committedActionStartKeys=new Set();
 const actionKey=e=>`${Number(e?.tick)||0}\u0000${String(e?.source_id??'')}`;
 for(const e of events||[]){
  const base={at_tick:Number(e.tick)||0};
  switch(e.type){
   case'battle_started':out.push({...base,type:'battle_start',seed:e.seed??null});break;
   case'action_execution_committed':{
    const skillId=e.skill_id??null,key=actionKey(e);
    out.push({...base,type:'action_start',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:skillId});
    committedActionStartKeys.add(key);
    if(skillId!==null&&String(skillId).trim()!=='')out.push({...base,type:'skill_cast',source_id:e.source_id??null,target_id:e.target_id??null,skill_id:skillId});
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

function seededRandom(seed){let x=(Number(seed)>>>0)||0x9e3779b9;return()=>{x=(x+0x6D2B79F5)|0;let t=Math.imul(x^(x>>>15),1|x);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function normalizePartySnapshot(party){return(Array.isArray(party)?party:[]).map((u,i)=>({id:String(u?.id||u?.character_id||`A${i}`),character_id:String(u?.character_id||u?.id||''),name:String(u?.name||`Adventurer ${i+1}`),side:'味方',maxHp:Math.max(1,Math.floor(Number(u?.maxHp??u?.max_hp??u?.hp)||100)),attack:Math.max(1,Math.floor(Number(u?.attack??u?.atk)||10)),agi:Math.max(1,Math.floor(Number(u?.agi)||10))}));}
function simulateBasicBattle({party,formation,monsters,seed=1,maxActions=10000}={}){const random=seededRandom(seed),allies=normalizePartySnapshot(party).map((u,i)=>({...u,id:`A${i}`,hp:u.maxHp,alive:true,damageDealt:0,damageTaken:0})),enemies=expandFormation(formation,monsters).map((u,i)=>({...u,id:`E${i}`,side:'敵',maxHp:u.maxHp,hp:u.maxHp,alive:true,damageDealt:0,damageTaken:0}));if(!allies.length)throw new Error('Party Snapshot is empty');if(!enemies.length)throw new Error('Enemy Formation is empty');const units=[...allies,...enemies],events=[{type:'battle_start',at_tick:0,seed}],debug=[],cap=Math.max(1,Math.floor(Number(maxActions)||10000));let actions=0,tick=0;const living=side=>units.filter(u=>u.side===side&&u.alive);while(living('味方').length&&living('敵').length&&actions<cap){const order=units.filter(u=>u.alive).map(u=>({u,tie:random()})).sort((a,b)=>b.u.agi-a.u.agi||a.tie-b.tie);for(const row of order){const actor=row.u;if(!actor.alive)continue;const targets=living(actor.side==='味方'?'敵':'味方');if(!targets.length)break;tick++;const minRatio=Math.min(...targets.map(t=>t.hp/t.maxHp)),pool=targets.filter(t=>Math.abs(t.hp/t.maxHp-minRatio)<1e-9),target=pool[Math.floor(random()*pool.length)]||targets[0],damage=Math.max(1,Math.floor(actor.attack));events.push({type:'action_start',at_tick:tick,source_id:actor.id,target_id:target.id,skill_id:null},{type:'hit',at_tick:tick,source_id:actor.id,target_id:target.id,skill_id:null});target.hp=Math.max(0,target.hp-damage);actor.damageDealt+=damage;target.damageTaken+=damage;events.push({type:'damage',at_tick:tick,source_id:actor.id,target_id:target.id,skill_id:null,value:damage,hp_after:target.hp});debug.push(`${tick}:${actor.name}->${target.name} ${damage}`);actions++;if(target.hp<=0){target.alive=false;events.push({type:'ko',at_tick:tick,source_id:actor.id,target_id:target.id});}if(!living('味方').length||!living('敵').length||actions>=cap)break;}}const victory=living('敵').length===0&&living('味方').length>0,result=victory?'味方勝利':'敵勝利';events.push({type:'battle_end',at_tick:tick,result});return{victory,result,seed,enemy_formation:normalizeFormation(formation),unit_final_state:units.map(u=>({id:u.id,character_id:u.character_id||null,monster_id:u.monster_id||null,name:u.name,side:u.side,hp:u.hp,max_hp:u.maxHp,alive:u.alive,damage_dealt:u.damageDealt,damage_taken:u.damageTaken})),statistics:{ticks:tick,actions,ally_damage:allies.reduce((n,u)=>n+u.damageDealt,0),enemy_damage:enemies.reduce((n,u)=>n+u.damageDealt,0),action_cap_reached:actions>=cap},debug_logs:debug,playback_events:events,reward:{}};}

return{clone,normalizeFormation,monsterStats,expandFormation,validationEventsToPlaybackEvents,buildBattleResult,seededRandom,normalizePartySnapshot,simulateBasicBattle};
});
