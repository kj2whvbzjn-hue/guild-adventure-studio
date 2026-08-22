(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameQuestRunSaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function fail(message,code='QUEST_RUN_SAVE_INVALID'){
    const error=new Error(`QuestRun Save Bridge: ${message}`);error.code=code;throw error;
  }
  function requireObject(value,path){if(!isObject(value))fail(`${path} object is required.`);return value;}
  function requireArray(value,path){if(!Array.isArray(value))fail(`${path} array is required.`);return value;}
  function requireString(value,path,{nonEmpty=false}={}){if(typeof value!=='string'||(nonEmpty&&!value))fail(`${path} ${nonEmpty?'non-empty ':''}string is required.`);return value;}
  function validateQuestRun(run,index){
    const path=`adventure.quest_runs[${index}]`;requireObject(run,path);
    requireString(run.quest_run_id,`${path}.quest_run_id`,{nonEmpty:true});
    for(const key of ['quest_id','section_id','chapter_id','playback_started_at'])requireString(run[key],`${path}.${key}`);
    if(!Number.isFinite(Date.parse(run.playback_started_at)))fail(`${path}.playback_started_at must be a valid timestamp.`);
    if(!Number.isFinite(Number(run.adventure_duration_seconds))||Number(run.adventure_duration_seconds)<=0)fail(`${path}.adventure_duration_seconds must be greater than 0.`);
    for(const key of ['party_snapshot','timeline_result','battle_results','exploration_results','event_results','scene_snapshots','random_selections','reward_history'])requireArray(run[key],`${path}.${key}`);
    for(const key of ['reward_result','flag_result','quest_progress_result','start_cost_result','difficulty_snapshot','reward_scaling_snapshot','final_result'])requireObject(run[key],`${path}.${key}`);
    if(typeof run.results_applied!=='boolean')fail(`${path}.results_applied boolean is required.`);
    if(!own(run,'seed')||run.seed==null||String(run.seed)==='')fail(`${path}.seed is required.`);
    return run.quest_run_id;
  }
  function validateStore(save){
    requireObject(save,'save');const adventure=requireObject(save.adventure,'adventure');
    const runs=requireArray(adventure.quest_runs,'adventure.quest_runs');
    requireString(adventure.active_quest_run_id,'adventure.active_quest_run_id');
    if(!Number.isInteger(Number(adventure.history_limit))||Number(adventure.history_limit)<1)fail('adventure.history_limit must be a positive integer.');
    if(own(adventure,'stone_selection_by_quest'))requireObject(adventure.stone_selection_by_quest,'adventure.stone_selection_by_quest');
    const ids=new Set();for(let i=0;i<runs.length;i++){const id=validateQuestRun(runs[i],i);if(ids.has(id))fail(`duplicate quest_run_id ${id}.`);ids.add(id);}
    if(adventure.active_quest_run_id&&!ids.has(adventure.active_quest_run_id))fail(`active_quest_run_id ${adventure.active_quest_run_id} does not reference a stored QuestRun.`);
    return adventure;
  }
  function capture(save){validateStore(save);return clone(save.adventure);}
  function assertStore(save){validateStore(save);return clone(save.adventure);}
  function assertCapturedPreserved(expected,after){
    const actual=capture(after);
    if(!same(expected,actual)){
      const error=new Error('QuestRun Save Bridge: QuestRun / Snapshot state changed across Save/Load boundary.');
      error.code='QUEST_RUN_SNAPSHOT_PERSISTENCE_MISMATCH';error.expected=clone(expected);error.actual=actual;throw error;
    }
    return actual;
  }
  function assertPreserved(before,after){return assertCapturedPreserved(capture(before),after);}
  return Object.freeze({validateStore,assertStore,capture,assertCapturedPreserved,assertPreserved});
});
