(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GKAdventureStorySystem=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BOX_TYPES=new Set(['scene','event','random_event','random_battle']);
const PLAYBACK_EVENT_TYPES=new Set(['battle_start','action_start','skill_cast','hit','damage','heal','status_apply','status_remove','ko','battle_end']);
const QUEST_EVENT_PLACEMENT_KINDS=new Set(['fixed_event','random_event']);
const QUEST_EVENT_FAILURE_POLICIES=new Set(['continue','quest_fail']);
const QUEST_EVENT_USAGES=new Set(['story','random','common']);
const QUEST_EVENT_TYPES=new Set(['battle','exploration','choice','special']);
const QUEST_EVENT_INTENSITIES=new Set(['low','normal','high','extreme']);
const QUEST_RUN_HISTORY_LIMIT=20;
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function hashSeed(value){let h=2166136261,s=String(value??'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let x=(Number(seed)>>>0)||0x9e3779b9;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function normalizeBox(box,index){const b=box&&typeof box==='object'?box:{};return{id:String(b.id||`BOX-${String(index+1).padStart(4,'0')}`),type:BOX_TYPES.has(b.type)?b.type:'scene',ref_id:String(b.ref_id||'')};}
function defaultBoxes(count=5){return Array.from({length:Math.max(0,count)},(_,i)=>normalizeBox({},i));}
function normalizeSection(section,{isNew=false}={}){const s=section&&typeof section==='object'?section:{};s.adventure_duration_seconds=Math.max(1,Number(s.adventure_duration_seconds)||300);s.boxes=Array.isArray(s.boxes)?s.boxes.map(normalizeBox):(isNew?defaultBoxes(5):[]);return s;}
function normalizeChapter(chapter){const c=chapter&&typeof chapter==='object'?chapter:{};c.available_monster_ids=Array.isArray(c.available_monster_ids)?c.available_monster_ids.map(String):[];c.random_event_candidates=Array.isArray(c.random_event_candidates)?c.random_event_candidates.map(x=>{if(typeof x==='string')return{event_id:x,weight:1};const raw=x?.weight,weight=raw===undefined||raw===null||raw===''?1:Math.max(0,Number(raw)||0);return{event_id:String(x?.event_id||x?.id||''),weight};}).filter(x=>x.event_id):[];return c;}
function stringList(value){return Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean):[];}
function normalizeQuestEventPlacement(placement,index){
 const source=placement&&typeof placement==='object'?placement:{},p={...source};
 const rawKind=String(source.kind||source.placement_type||'').trim();
 const randomLike=rawKind==='random_event'||rawKind==='random'||source.random_event_slot===true||source.random===true||(!source.event_id&&(source.filter||source.allow_none!==undefined||source.required!==undefined));
 p.kind=randomLike?'random_event':'fixed_event';
 p.order=Math.max(1,Math.floor(Number(source.order)||index+1));
 p.failure_policy=QUEST_EVENT_FAILURE_POLICIES.has(source.failure_policy)?source.failure_policy:'continue';
 if(p.kind==='fixed_event'){p.event_id=String(source.event_id||source.ref_id||'');}
 else{
  const rawFilter=source.filter&&typeof source.filter==='object'?source.filter:{};
  p.filter={...rawFilter,event_type:rawFilter.event_type==null?null:String(rawFilter.event_type),group:rawFilter.group==null?null:String(rawFilter.group),tags:stringList(rawFilter.tags)};
  p.allow_none=source.allow_none===undefined?true:Boolean(source.allow_none);
  p.required=Boolean(source.required);
  p.box_side_individual_probability_override=Boolean(source.box_side_individual_probability_override);
 }
 return p;
}
function questBoxZone(source,canonical,alias){const rows=Array.isArray(source[canonical])?source[canonical]:(Array.isArray(source[alias])?source[alias]:[]);return rows.map(normalizeQuestEventPlacement);}
function normalizeQuestBox(box,index){
 const source=box&&typeof box==='object'?box:{},b={...source},scenes=source.scenes&&typeof source.scenes==='object'?source.scenes:{};
 b.box_id=String(source.box_id||source.id||`BOX-${String(index+1).padStart(4,'0')}`);
 b.name=String(source.name||'');b.order=Math.max(1,Math.floor(Number(source.order)||index+1));
 b.pre_scene_id=source.pre_scene_id==null?(scenes.pre_scene_id==null?null:String(scenes.pre_scene_id)):String(source.pre_scene_id);
 b.mid_scene_id=source.mid_scene_id==null?(scenes.mid_scene_id==null?null:String(scenes.mid_scene_id)):String(source.mid_scene_id);
 b.post_scene_id=source.post_scene_id==null?(scenes.post_scene_id==null?null:String(scenes.post_scene_id)):String(source.post_scene_id);
 b.event_zone_before_pre=questBoxZone(source,'event_zone_before_pre','event_before_pre');
 b.event_zone_pre_to_mid=questBoxZone(source,'event_zone_pre_to_mid','event_pre_to_mid');
 b.event_zone_mid_to_post=questBoxZone(source,'event_zone_mid_to_post','event_mid_to_post');
 b.event_zone_after_post=questBoxZone(source,'event_zone_after_post','event_after_post');
 if(source.scenes&&typeof source.scenes==='object')b.scenes={...source.scenes,pre_scene_id:b.pre_scene_id,mid_scene_id:b.mid_scene_id,post_scene_id:b.post_scene_id};
 return b;
}
function normalizeQuest(quest){const q=quest&&typeof quest==='object'?quest:{};q.context=q.context&&typeof q.context==='object'?q.context:{};if(Array.isArray(q.context.tags))q.context.tags=stringList(q.context.tags);q.boxes=Array.isArray(q.boxes)?q.boxes.map(normalizeQuestBox):[];return q;}
function normalizeEvent(event){
 const e=event&&typeof event==='object'?event:{};
 e.battle_formation=Array.isArray(e.battle_formation)?e.battle_formation.map(x=>({monster_id:String(x?.monster_id||''),count:Math.max(1,Math.floor(Number(x?.count)||1))})).filter(x=>x.monster_id):[];
 if(e.usage!==undefined){
  if(Array.isArray(e.usage))e.usage=[...new Set(stringList(e.usage).filter(x=>QUEST_EVENT_USAGES.has(x)))];
  else{const usage=String(e.usage||'');e.usage=QUEST_EVENT_USAGES.has(usage)?usage:'common';}
  if(e.type!==undefined&&!QUEST_EVENT_TYPES.has(String(e.type)))e.type='special';
 }
 if(e.group!==undefined)e.group=String(e.group||'');
 if(e.tags!==undefined)e.tags=stringList(e.tags);
 if(e.intensity!==undefined)e.intensity=QUEST_EVENT_INTENSITIES.has(e.intensity)?e.intensity:String(e.intensity||'');
 if(e.random_base_weight!==undefined)e.random_base_weight=Math.max(0,Number(e.random_base_weight)||0);
 if(e.generation_profile_ref!==undefined&&e.generation_profile_ref!==null)e.generation_profile_ref=String(e.generation_profile_ref);
 if(e.enabled!==undefined)e.enabled=Boolean(e.enabled);
 if(Array.isArray(e.conditions))e.conditions=e.conditions.map(clone);
 return e;
}
function monsterBudgetCost(monster){return Math.max(1,Number(monster?.enemy_budget_cost??monster?.budget_cost??monster?.params?.enemy_budget_cost??monster?.params?.budget_cost)||1);}
function tabletEnemyBudgetBonus(tablet){return Math.max(0,Number(tablet?.enemy_budget_bonus??tablet?.params?.enemy_budget_bonus)||0);}
function resolveEnemyBudget({quest,section,startCostResources={},tablets=[]}={}){const qb=Math.max(0,Number(quest?.enemy_budget)||0),sb=Math.max(0,Number(section?.enemy_budget)||0),base=qb>0?qb:sb;let bonus=0;for(const[id,count]of Object.entries(startCostResources||{})){const tablet=(tablets||[]).find(x=>String(x.id)===String(id));if(tablet)bonus+=tabletEnemyBudgetBonus(tablet)*Math.max(0,Number(count)||0);}return Math.max(0,Math.floor(base+bonus));}
function normalizeQuestStartCost(quest){const raw=quest?.start_cost&&typeof quest.start_cost==='object'?quest.start_cost:{};const resources=raw.resources&&typeof raw.resources==='object'?Object.fromEntries(Object.entries(raw.resources).map(([k,v])=>[String(k),Math.max(0,Math.floor(Number(v)||0))]).filter(([,v])=>v>0)):{};return{gold:Math.max(0,Math.floor(Number(raw.gold)||0)),resources};}
function questStartRequirements(quest,{completedQuestIds=[],flags={}}={}){const completed=new Set((completedQuestIds||[]).map(String)),missing_prerequisite_ids=(quest?.prerequisite_ids||[]).map(String).filter(id=>!completed.has(id)),missing_required_flags=(quest?.required_flags||[]).map(String).filter(id=>!flags?.[id]);return{ok:missing_prerequisite_ids.length===0&&missing_required_flags.length===0,missing_prerequisite_ids,missing_required_flags};}
function canAffordQuestStartCost(save,cost){const c=cost||{gold:0,resources:{}},gold=Math.max(0,Number(save?.guild?.gold)||0),resources=save?.quest_resources&&typeof save.quest_resources==='object'?save.quest_resources:{};const missing_resources=Object.entries(c.resources||{}).filter(([id,n])=>Math.max(0,Number(resources[id])||0)<Number(n)).map(([id,n])=>({id,required:Number(n),available:Math.max(0,Number(resources[id])||0)}));return{ok:gold>=Number(c.gold||0)&&missing_resources.length===0,required_gold:Number(c.gold||0),available_gold:gold,missing_resources};}
function consumeQuestStartCost(save,cost){const c={gold:Math.max(0,Math.floor(Number(cost?.gold)||0)),resources:{...(cost?.resources||{})}},afford=canAffordQuestStartCost(save,c);if(!afford.ok)return{consumed:false,reason:'insufficient_start_cost',...afford};save.guild=save.guild&&typeof save.guild==='object'?save.guild:{};save.guild.gold=Math.max(0,Number(save.guild.gold)||0)-c.gold;save.quest_resources=save.quest_resources&&typeof save.quest_resources==='object'?save.quest_resources:{};for(const[id,n]of Object.entries(c.resources)){const count=Math.max(0,Math.floor(Number(n)||0));save.quest_resources[id]=Math.max(0,Number(save.quest_resources[id])||0)-count;}return{consumed:true,cost:clone(c)};}
function questProgressResult(quest,success){return{complete_quest_id:success?String(quest?.id||''):'',unlock_quest_ids:success?(quest?.next_quest_ids||[]).map(String):[],set_flags:success?Object.fromEntries((quest?.set_flags||[]).map(id=>[String(id),true])):{}};}
function chooseWeighted(rows,random){const valid=(rows||[]).filter(x=>Number(x.weight)>0);if(!valid.length)return null;const total=valid.reduce((n,x)=>n+Number(x.weight),0);let roll=random()*total;for(const row of valid){roll-=Number(row.weight);if(roll<0)return row;}return valid[valid.length-1];}
function generateRandomBattle({budget,monsterIds,monsters,random,maxUnits=100}){let remaining=Math.max(0,Number(budget)||0);const byId=new Map((monsters||[]).map(m=>[String(m.id),m]));const formation=[];let guard=0;while(remaining>0&&guard++<maxUnits){const candidates=(monsterIds||[]).map(id=>byId.get(String(id))).filter(Boolean).filter(m=>monsterBudgetCost(m)<=remaining);if(!candidates.length)break;const m=candidates[Math.floor(random()*candidates.length)];const cost=monsterBudgetCost(m);remaining-=cost;const found=formation.find(x=>x.monster_id===String(m.id));if(found)found.count++;else formation.push({monster_id:String(m.id),count:1});}return{formation,budget:Number(budget)||0,remaining_budget:remaining};}
function assignTimeline(processed,duration){const rows=processed||[],d=Math.max(1,Number(duration)||300);if(!rows.length)return[];const step=d/rows.length;return rows.map((x,i)=>({...x,at_seconds:Math.min(d,Math.round(step*(i+1)*1000)/1000)}));}
function eventConditionsMet(event,flags,check){return typeof check==='function'?Boolean(check(event,flags)):true;}
function assertBattlePlaybackEvents(result){const events=Array.isArray(result?.playback_events)?result.playback_events:[];if(!validatePlaybackEvents(events)){const invalid=[...new Set(events.map(x=>String(x?.type||'')).filter(type=>!PLAYBACK_EVENT_TYPES.has(type)))];throw new Error(`Invalid Battle Playback Event type: ${invalid.join(', ')||'unknown'}`);}return events;}
function simulateQuest(opts){
 const quest=opts.quest||{},section=normalizeSection(clone(opts.section||{})),chapter=normalizeChapter(clone(opts.chapter||{}));
 const events=opts.events||[],scenes=opts.scenes||[],monsters=opts.monsters||[],eventById=new Map(events.map(e=>[String(e.id),e])),sceneById=new Map(scenes.map(s=>[String(s.id),s]));
 const seed=opts.seed??hashSeed(`${quest.id||''}|${Date.now()}`),random=rng(seed),workingFlags={...(opts.flags||{})},processed=[],battle_results=[],event_results=[],scene_snapshots=[],rewardHistory=[];let failed=null;
 const aggregateReward={};const flagChanges={};
 function mergeReward(r){if(!r||typeof r!=='object')return;for(const[k,v]of Object.entries(r)){if(typeof v==='number')aggregateReward[k]=(aggregateReward[k]||0)+v;else aggregateReward[k]=clone(v);}rewardHistory.push(clone(r));}
 function applyFlags(delta){if(!delta||typeof delta!=='object')return;for(const[k,v]of Object.entries(delta)){workingFlags[k]=v;flagChanges[k]=v;}}
 for(const box of section.boxes){if(failed)break;const base={box_id:box.id,type:box.type,ref_id:box.ref_id};try{
   if(box.type==='scene'){const scene=sceneById.get(box.ref_id);if(!scene)throw new Error(`Scene not found: ${box.ref_id}`);const snap=typeof opts.snapshotScene==='function'?opts.snapshotScene(scene):{scene_id:scene.id,dialogues:clone(scene.dialogues||[])};scene_snapshots.push(snap);processed.push({...base,result_index:scene_snapshots.length-1});continue;}
   let event=null;
   if(box.type==='event'){event=eventById.get(box.ref_id);if(!event)throw new Error(`Event not found: ${box.ref_id}`);}
   if(box.type==='random_event'){const candidates=chapter.random_event_candidates.map(c=>({...c,event:eventById.get(c.event_id)})).filter(x=>x.event&&eventConditionsMet(x.event,workingFlags,opts.checkEventCondition));const chosen=chooseWeighted(candidates,random);if(!chosen)throw new Error('No eligible random event');event=chosen.event;}
   if(event){
     if(event.type==='battle'){const formation=normalizeEvent(clone(event)).battle_formation,battleSeed=Math.floor(random()*0xffffffff),br=typeof opts.simulateBattle==='function'?opts.simulateBattle({formation:clone(formation),seed:battleSeed,box,quest,event:clone(event)}):{victory:true,formation:clone(formation),reward:{},playback_events:[]};assertBattlePlaybackEvents(br);battle_results.push({...clone(br),formation:clone(formation),seed:br?.seed??battleSeed,event_id:String(event.id||'')});mergeReward(br?.reward);event_results.push({event_id:event.id,type:'battle',battle_result_index:battle_results.length-1,success:br?.victory!==false,reward:clone(br?.reward||{})});processed.push({...base,resolved_ref_id:event.id,result_index:event_results.length-1,battle_result_index:battle_results.length-1});if(br?.victory===false)failed={reason:br.reason||'battle_lost',box_id:box.id,event_id:event.id};continue;}
     const er=typeof opts.resolveEvent==='function'?opts.resolveEvent({event:clone(event),flags:clone(workingFlags),random}):{success:true,reward:{},flags:{}};event_results.push({event_id:event.id,...clone(er)});mergeReward(er?.reward);applyFlags(er?.flags);processed.push({...base,resolved_ref_id:event.id,result_index:event_results.length-1});if(er?.failed||er?.success===false)failed={reason:er.reason||'event_failed',box_id:box.id};continue;}
   if(box.type==='random_battle'){const budget=typeof opts.enemyBudget==='function'?Number(opts.enemyBudget({quest,section,chapter,box}))||0:Number(opts.enemyBudget)||0;const generated=generateRandomBattle({budget,monsterIds:chapter.available_monster_ids,monsters,random,maxUnits:opts.maxRandomBattleUnits||100}),battleSeed=Math.floor(random()*0xffffffff),br=typeof opts.simulateBattle==='function'?opts.simulateBattle({formation:generated.formation,seed:battleSeed,box,quest}):{victory:true,formation:generated.formation,reward:{},playback_events:[]};assertBattlePlaybackEvents(br);battle_results.push({...clone(br),formation:clone(generated.formation),budget:generated.budget,seed:br?.seed??battleSeed});mergeReward(br?.reward);processed.push({...base,result_index:battle_results.length-1});if(br?.victory===false)failed={reason:br.reason||'battle_lost',box_id:box.id};}
 }catch(error){failed={reason:'simulation_error',message:String(error?.message||error),box_id:box.id};}}
 const success=!failed,finalState={status:success?'success':'failure',processed_box_count:processed.length,last_processed_box_id:String(processed.at(-1)?.box_id||'')},run={quest_run_id:String(opts.questRunId||`QR-${Date.now()}-${String(seed).slice(-6)}`),quest_id:String(quest.id||''),section_id:String(section.id||''),chapter_id:String(chapter.id||''),party_snapshot:clone(opts.partySnapshot||[]),seed,playback_started_at:opts.playbackStartedAt||new Date().toISOString(),adventure_duration_seconds:section.adventure_duration_seconds,timeline_result:assignTimeline(processed,section.adventure_duration_seconds),battle_results,event_results,scene_snapshots,reward_result:success?aggregateReward:{},reward_history:rewardHistory,flag_result:flagChanges,quest_progress_result:questProgressResult(quest,success),start_cost_result:clone(opts.startCostResult||{}),final_result:{success,failure:failed,final_state:finalState},results_applied:false};return run;
}
function playbackState(run,nowMs=Date.now()){const start=Date.parse(run?.playback_started_at||'');const elapsed=Math.max(0,Number.isFinite(start)?(nowMs-start)/1000:0),duration=Math.max(1,Number(run?.adventure_duration_seconds)||300);return{elapsed_seconds:elapsed,duration_seconds:duration,complete:elapsed>=duration,visible_timeline:(run?.timeline_result||[]).filter(x=>Number(x.at_seconds)<=elapsed)};}
function commitQuestRun(run,save,{applyReward,applyFlags,applyQuestProgress}={}){if(!run||run.results_applied)return{applied:false,reason:'already_applied'};const success=run.final_result?.success===true;if(typeof applyFlags==='function')applyFlags(save,clone(run.flag_result||{}));if(success){if(typeof applyReward==='function')applyReward(save,clone(run.reward_result||{}));if(typeof applyQuestProgress==='function')applyQuestProgress(save,clone(run.quest_progress_result||{}));}run.results_applied=true;return{applied:true,success};}
function validatePlaybackEvents(events){return(events||[]).every(e=>PLAYBACK_EVENT_TYPES.has(e?.type));}

function normalizeQuestRun(run){
 const r=run&&typeof run==='object'?run:{};
 r.quest_run_id=String(r.quest_run_id||'');
 r.quest_id=String(r.quest_id||'');r.section_id=String(r.section_id||'');r.chapter_id=String(r.chapter_id||'');
 r.party_snapshot=Array.isArray(r.party_snapshot)?r.party_snapshot:[];
 r.timeline_result=Array.isArray(r.timeline_result)?r.timeline_result:[];
 r.battle_results=Array.isArray(r.battle_results)?r.battle_results:[];
 r.event_results=Array.isArray(r.event_results)?r.event_results:[];
 r.scene_snapshots=Array.isArray(r.scene_snapshots)?r.scene_snapshots:[];
 r.reward_result=r.reward_result&&typeof r.reward_result==='object'?r.reward_result:{};
 r.flag_result=r.flag_result&&typeof r.flag_result==='object'?r.flag_result:{};
 r.quest_progress_result=r.quest_progress_result&&typeof r.quest_progress_result==='object'?r.quest_progress_result:{complete_quest_id:'',unlock_quest_ids:[],set_flags:{}};
 r.start_cost_result=r.start_cost_result&&typeof r.start_cost_result==='object'?r.start_cost_result:{};
 r.final_result=r.final_result&&typeof r.final_result==='object'?r.final_result:{success:false,failure:{reason:'incomplete_run'}};
 const inferredStatus=r.final_result.success===true?'success':'failure',lastTimeline=r.timeline_result.at(-1);
 r.final_result.final_state=r.final_result.final_state&&typeof r.final_result.final_state==='object'?r.final_result.final_state:{status:inferredStatus,processed_box_count:r.timeline_result.length,last_processed_box_id:String(lastTimeline?.box_id||'')};
 r.final_result.final_state.status=r.final_result.final_state.status==='success'?'success':'failure';
 r.final_result.final_state.processed_box_count=Math.max(0,Math.floor(Number(r.final_result.final_state.processed_box_count)||0));
 r.final_result.final_state.last_processed_box_id=String(r.final_result.final_state.last_processed_box_id||'');
 r.results_applied=Boolean(r.results_applied);
 r.adventure_duration_seconds=Math.max(1,Number(r.adventure_duration_seconds)||300);
 r.playback_started_at=String(r.playback_started_at||new Date().toISOString());
 return r;
}
function ensureQuestRunStore(save,{historyLimit=QUEST_RUN_HISTORY_LIMIT}={}){
 const target=save&&typeof save==='object'?save:{};
 const current=target.adventure&&typeof target.adventure==='object'?target.adventure:{};
 const limit=Math.max(1,Math.floor(Number(historyLimit)||QUEST_RUN_HISTORY_LIMIT));
 current.quest_runs=Array.isArray(current.quest_runs)?current.quest_runs.map(normalizeQuestRun).filter(r=>r.quest_run_id):[];
 if(current.quest_runs.length>limit)current.quest_runs=current.quest_runs.slice(-limit);
 current.active_quest_run_id=String(current.active_quest_run_id||'');
 if(current.active_quest_run_id&&!current.quest_runs.some(r=>r.quest_run_id===current.active_quest_run_id))current.active_quest_run_id='';
 current.history_limit=limit;target.adventure=current;return current;
}
function saveQuestRun(save,run,{activate=true,historyLimit=QUEST_RUN_HISTORY_LIMIT}={}){
 const store=ensureQuestRunStore(save,{historyLimit}),normalized=normalizeQuestRun(clone(run));
 if(!normalized.quest_run_id)throw new Error('quest_run_id is required');
 const index=store.quest_runs.findIndex(r=>r.quest_run_id===normalized.quest_run_id);
 if(index>=0)store.quest_runs[index]=normalized;else store.quest_runs.push(normalized);
 if(store.quest_runs.length>store.history_limit)store.quest_runs.splice(0,store.quest_runs.length-store.history_limit);
 if(activate)store.active_quest_run_id=normalized.quest_run_id;
 return normalized;
}
function activeQuestRun(save){const store=ensureQuestRunStore(save);return store.quest_runs.find(r=>r.quest_run_id===store.active_quest_run_id)||null;}
function questRunHistory(save){return ensureQuestRunStore(save).quest_runs.slice().reverse();}
function startQuestRunPlayback(save,run,{startedAt=new Date().toISOString(),historyLimit=QUEST_RUN_HISTORY_LIMIT}={}){const next=normalizeQuestRun(clone(run));next.playback_started_at=startedAt;return saveQuestRun(save,next,{activate:true,historyLimit});}
function resumeQuestRun(save,nowMs=Date.now()){const run=activeQuestRun(save);return run?{run,playback:playbackState(run,nowMs)}:null;}
function finishQuestRunPlayback(save,runId){const store=ensureQuestRunStore(save);if(!runId||store.active_quest_run_id===String(runId))store.active_quest_run_id='';return store;}
function commitStoredQuestRun(save,runId,handlers={},nowMs=Date.now()){const store=ensureQuestRunStore(save),run=store.quest_runs.find(r=>r.quest_run_id===String(runId||store.active_quest_run_id));if(!run)return{applied:false,reason:'quest_run_not_found'};if(!run.results_applied&&!playbackState(run,nowMs).complete)return{applied:false,reason:'playback_incomplete'};const result=commitQuestRun(run,save,handlers);if(result.applied)finishQuestRunPlayback(save,run.quest_run_id);return result;}
return{BOX_TYPES:[...BOX_TYPES],PLAYBACK_EVENT_TYPES:[...PLAYBACK_EVENT_TYPES],QUEST_EVENT_PLACEMENT_KINDS:[...QUEST_EVENT_PLACEMENT_KINDS],QUEST_EVENT_FAILURE_POLICIES:[...QUEST_EVENT_FAILURE_POLICIES],QUEST_EVENT_USAGES:[...QUEST_EVENT_USAGES],QUEST_EVENT_TYPES:[...QUEST_EVENT_TYPES],QUEST_EVENT_INTENSITIES:[...QUEST_EVENT_INTENSITIES],QUEST_RUN_HISTORY_LIMIT,clone,hashSeed,rng,normalizeBox,defaultBoxes,normalizeSection,normalizeChapter,normalizeQuestEventPlacement,normalizeQuestBox,normalizeQuest,normalizeEvent,normalizeQuestStartCost,questStartRequirements,canAffordQuestStartCost,consumeQuestStartCost,questProgressResult,monsterBudgetCost,tabletEnemyBudgetBonus,resolveEnemyBudget,chooseWeighted,generateRandomBattle,assignTimeline,assertBattlePlaybackEvents,simulateQuest,playbackState,commitQuestRun,validatePlaybackEvents,normalizeQuestRun,ensureQuestRunStore,saveQuestRun,activeQuestRun,questRunHistory,startQuestRunPlayback,resumeQuestRun,finishQuestRunPlayback,commitStoredQuestRun};
});
