(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GKAdventureStorySystem=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BOX_TYPES=new Set(['scene','event','random_event','random_battle']);
const PLAYBACK_EVENT_TYPES=new Set(['battle_start','action_start','skill_cast','hit','damage','heal','status_apply','status_remove','ko','battle_end']);
const QUEST_RUN_HISTORY_LIMIT=20;
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function hashSeed(value){let h=2166136261,s=String(value??'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let x=(Number(seed)>>>0)||0x9e3779b9;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function normalizeBox(box,index){const b=box&&typeof box==='object'?box:{};return{id:String(b.id||`BOX-${String(index+1).padStart(4,'0')}`),type:BOX_TYPES.has(b.type)?b.type:'scene',ref_id:String(b.ref_id||'')};}
function defaultBoxes(count=5){return Array.from({length:Math.max(0,count)},(_,i)=>normalizeBox({},i));}
function normalizeSection(section,{isNew=false}={}){const s=section&&typeof section==='object'?section:{};s.adventure_duration_seconds=Math.max(1,Number(s.adventure_duration_seconds)||300);s.boxes=Array.isArray(s.boxes)?s.boxes.map(normalizeBox):(isNew?defaultBoxes(5):[]);return s;}
function normalizeChapter(chapter){const c=chapter&&typeof chapter==='object'?chapter:{};c.available_monster_ids=Array.isArray(c.available_monster_ids)?c.available_monster_ids.map(String):[];c.random_event_candidates=Array.isArray(c.random_event_candidates)?c.random_event_candidates.map(x=>typeof x==='string'?{event_id:x,weight:1}:{event_id:String(x?.event_id||x?.id||''),weight:Math.max(0,Number(x?.weight)||1)}).filter(x=>x.event_id):[];return c;}
function normalizeEvent(event){const e=event&&typeof event==='object'?event:{};e.battle_formation=Array.isArray(e.battle_formation)?e.battle_formation.map(x=>({monster_id:String(x?.monster_id||''),count:Math.max(1,Math.floor(Number(x?.count)||1))})).filter(x=>x.monster_id):[];return e;}
function monsterBudgetCost(monster){return Math.max(1,Number(monster?.enemy_budget_cost??monster?.budget_cost??monster?.params?.enemy_budget_cost??monster?.params?.budget_cost)||1);}
function chooseWeighted(rows,random){const valid=(rows||[]).filter(x=>Number(x.weight)>0);if(!valid.length)return null;const total=valid.reduce((n,x)=>n+Number(x.weight),0);let roll=random()*total;for(const row of valid){roll-=Number(row.weight);if(roll<0)return row;}return valid[valid.length-1];}
function generateRandomBattle({budget,monsterIds,monsters,random,maxUnits=100}){let remaining=Math.max(0,Number(budget)||0);const byId=new Map((monsters||[]).map(m=>[String(m.id),m]));const formation=[];let guard=0;while(remaining>0&&guard++<maxUnits){const candidates=(monsterIds||[]).map(id=>byId.get(String(id))).filter(Boolean).filter(m=>monsterBudgetCost(m)<=remaining);if(!candidates.length)break;const m=candidates[Math.floor(random()*candidates.length)];const cost=monsterBudgetCost(m);remaining-=cost;const found=formation.find(x=>x.monster_id===String(m.id));if(found)found.count++;else formation.push({monster_id:String(m.id),count:1});}return{formation,budget:Number(budget)||0,remaining_budget:remaining};}
function assignTimeline(processed,duration){const rows=processed||[],d=Math.max(1,Number(duration)||300);if(!rows.length)return[];const step=d/rows.length;return rows.map((x,i)=>({...x,at_seconds:Math.min(d,Math.round(step*(i+1)*1000)/1000)}));}
function eventConditionsMet(event,flags,check){return typeof check==='function'?Boolean(check(event,flags)):true;}
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
     if(event.type==='battle'){const formation=normalizeEvent(clone(event)).battle_formation,battleSeed=Math.floor(random()*0xffffffff),br=typeof opts.simulateBattle==='function'?opts.simulateBattle({formation:clone(formation),seed:battleSeed,box,quest,event:clone(event)}):{victory:true,formation:clone(formation),reward:{},playback_events:[]};battle_results.push({...clone(br),formation:clone(formation),seed:br?.seed??battleSeed,event_id:String(event.id||'')});mergeReward(br?.reward);event_results.push({event_id:event.id,type:'battle',battle_result_index:battle_results.length-1,success:br?.victory!==false,reward:clone(br?.reward||{})});processed.push({...base,resolved_ref_id:event.id,result_index:event_results.length-1,battle_result_index:battle_results.length-1});if(br?.victory===false)failed={reason:br.reason||'battle_lost',box_id:box.id,event_id:event.id};continue;}
     const er=typeof opts.resolveEvent==='function'?opts.resolveEvent({event:clone(event),flags:clone(workingFlags),random}):{success:true,reward:{},flags:{}};event_results.push({event_id:event.id,...clone(er)});mergeReward(er?.reward);applyFlags(er?.flags);processed.push({...base,resolved_ref_id:event.id,result_index:event_results.length-1});if(er?.failed||er?.success===false)failed={reason:er.reason||'event_failed',box_id:box.id};continue;}
   if(box.type==='random_battle'){const budget=typeof opts.enemyBudget==='function'?Number(opts.enemyBudget({quest,section,chapter,box}))||0:Number(opts.enemyBudget)||0;const generated=generateRandomBattle({budget,monsterIds:chapter.available_monster_ids,monsters,random,maxUnits:opts.maxRandomBattleUnits||100});const br=typeof opts.simulateBattle==='function'?opts.simulateBattle({formation:generated.formation,seed:Math.floor(random()*0xffffffff),box,quest}):{victory:true,formation:generated.formation,reward:{},playback_events:[]};battle_results.push({...clone(br),formation:clone(generated.formation),budget:generated.budget});mergeReward(br?.reward);processed.push({...base,result_index:battle_results.length-1});if(br?.victory===false)failed={reason:br.reason||'battle_lost',box_id:box.id};}
 }catch(error){failed={reason:'simulation_error',message:String(error?.message||error),box_id:box.id};}}
 const success=!failed,run={quest_run_id:String(opts.questRunId||`QR-${Date.now()}-${String(seed).slice(-6)}`),quest_id:String(quest.id||''),section_id:String(section.id||''),chapter_id:String(chapter.id||''),party_snapshot:clone(opts.partySnapshot||[]),seed,playback_started_at:opts.playbackStartedAt||new Date().toISOString(),adventure_duration_seconds:section.adventure_duration_seconds,timeline_result:assignTimeline(processed,section.adventure_duration_seconds),battle_results,event_results,scene_snapshots,reward_result:success?aggregateReward:{},reward_history:rewardHistory,flag_result:flagChanges,final_result:{success,failure:failed},results_applied:false};return run;
}
function playbackState(run,nowMs=Date.now()){const start=Date.parse(run?.playback_started_at||'');const elapsed=Math.max(0,Number.isFinite(start)?(nowMs-start)/1000:0),duration=Math.max(1,Number(run?.adventure_duration_seconds)||300);return{elapsed_seconds:elapsed,duration_seconds:duration,complete:elapsed>=duration,visible_timeline:(run?.timeline_result||[]).filter(x=>Number(x.at_seconds)<=elapsed)};}
function commitQuestRun(run,save,{applyReward,applyFlags}={}){if(!run||run.results_applied)return{applied:false,reason:'already_applied'};if(!run.final_result?.success){run.results_applied=true;return{applied:true,success:false};}if(typeof applyReward==='function')applyReward(save,clone(run.reward_result||{}));if(typeof applyFlags==='function')applyFlags(save,clone(run.flag_result||{}));run.results_applied=true;return{applied:true,success:true};}
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
 r.final_result=r.final_result&&typeof r.final_result==='object'?r.final_result:{success:false,failure:{reason:'incomplete_run'}};
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
function commitStoredQuestRun(save,runId,handlers={}){const store=ensureQuestRunStore(save),run=store.quest_runs.find(r=>r.quest_run_id===String(runId||store.active_quest_run_id));if(!run)return{applied:false,reason:'quest_run_not_found'};const result=commitQuestRun(run,save,handlers);if(result.applied)finishQuestRunPlayback(save,run.quest_run_id);return result;}
return{BOX_TYPES:[...BOX_TYPES],PLAYBACK_EVENT_TYPES:[...PLAYBACK_EVENT_TYPES],QUEST_RUN_HISTORY_LIMIT,clone,hashSeed,rng,normalizeBox,defaultBoxes,normalizeSection,normalizeChapter,normalizeEvent,monsterBudgetCost,chooseWeighted,generateRandomBattle,assignTimeline,simulateQuest,playbackState,commitQuestRun,validatePlaybackEvents,normalizeQuestRun,ensureQuestRunStore,saveQuestRun,activeQuestRun,questRunHistory,startQuestRunPlayback,resumeQuestRun,finishQuestRunPlayback,commitStoredQuestRun};
});
