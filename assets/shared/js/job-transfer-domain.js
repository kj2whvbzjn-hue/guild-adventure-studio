(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKJobTransferDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEFAULT_STAT_KEYS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
 const REQUIRED_JOB_COUNT=7;
 const REQUIRED_GROWTH_TOTAL=60;
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function normalizeCatalog(input,{statKeys=DEFAULT_STAT_KEYS}={}){
  const rows=input instanceof Map?[...input.values()]:Array.isArray(input)?input:[];
  if(rows.length!==REQUIRED_JOB_COUNT)throw Object.assign(new Error(`正式Jobは${REQUIRED_JOB_COUNT}件必要です。現在 ${rows.length}件です。`),{code:'JOB_CATALOG_COUNT_INVALID'});
  const byId=new Map(),byName=new Map();
  for(const row of rows){
   if(!row||typeof row!=='object'||Array.isArray(row))throw Object.assign(new Error('Job定義が不正です。'),{code:'JOB_DEFINITION_INVALID'});
   const id=String(row.id||'').trim(),name=String(row.name||'').trim();
   if(!id||!name)throw Object.assign(new Error('Job ID / name が必要です。'),{code:'JOB_DEFINITION_INVALID'});
   if(byId.has(id))throw Object.assign(new Error(`Job IDが重複しています: ${id}`),{code:'JOB_ID_DUPLICATED',job_id:id});
   if(byName.has(name))throw Object.assign(new Error(`Job nameが重複しています: ${name}`),{code:'JOB_NAME_DUPLICATED',job_name:name});
   const aptitudes=row.aptitudes&&typeof row.aptitudes==='object'&&!Array.isArray(row.aptitudes)?row.aptitudes:null;
   if(!aptitudes)throw Object.assign(new Error(`Job ${id} の成長値がありません。`),{code:'JOB_GROWTH_MISSING',job_id:id});
   let total=0;
   for(const stat of statKeys){const value=aptitudes[stat];if(!Number.isInteger(value)||value<0)throw Object.assign(new Error(`Job ${id}.${stat} の成長値が不正です。`),{code:'JOB_GROWTH_INVALID',job_id:id,stat});total+=value;}
   if(total!==REQUIRED_GROWTH_TOTAL)throw Object.assign(new Error(`Job ${id} の成長値合計は${REQUIRED_GROWTH_TOTAL}である必要があります。現在 ${total}です。`),{code:'JOB_GROWTH_TOTAL_INVALID',job_id:id,total});
   byId.set(id,row);byName.set(name,row);
  }
  return Object.freeze({rows:Object.freeze([...rows]),byId,byName,stat_keys:Object.freeze([...statKeys])});
 }
 function resolveJob(catalog,ref){const key=String(ref||'').trim();if(!key||!catalog)return null;return catalog.byId?.get(key)||catalog.byName?.get(key)||null}
 function evaluateGuildEditState({phase,activeQuestRunId}={}){
  if(String(phase||'')!=='base')return fail('GUILD_EDIT_NOT_IN_BASE','ギルド編集は拠点でのみ実行できます。',{phase:String(phase||'')});
  if(String(activeQuestRunId||'').trim())return fail('GUILD_EDIT_ADVENTURE_ACTIVE','冒険進行中はギルド編集できません。',{active_quest_run_id:String(activeQuestRunId)});
  return{ok:true};
 }
 function prepareJobChange({character,nextJobRef,catalog,editState,now}={}){
  if(!editState?.ok)return fail(editState?.code||'GUILD_EDIT_UNAVAILABLE',editState?.message||'ギルド編集できない状態です。');
  if(!character||typeof character!=='object')return fail('JOB_CHANGE_CHARACTER_MISSING','転職対象が存在しません。');
  const current=resolveJob(catalog,character.job);if(!current)return fail('JOB_CHANGE_CURRENT_JOB_UNKNOWN','現在Jobが正式Job Masterにありません。',{job_ref:String(character.job||'')});
  const next=resolveJob(catalog,nextJobRef);if(!next)return fail('JOB_CHANGE_TARGET_JOB_UNKNOWN','転職先Jobが正式Job Masterにありません。',{job_ref:String(nextJobRef||'')});
  if(next.id===current.id)return fail('JOB_CHANGE_SAME_JOB','現在と同じJobには転職しません。',{job_id:next.id});
  if(!Number.isInteger(character.level)||character.level<1)return fail('JOB_CHANGE_LEVEL_INVALID','転職対象のLevelが不正です。',{level:character.level});
  const at=String(now||'').trim();if(!at)return fail('JOB_CHANGE_TIME_REQUIRED','転職時刻が必要です。');
  const historyEntry=Object.freeze({job:next.id,level:character.level,from:current.id,from_job:current.id,to_job:next.id,cost_gold:0,at});
  return{ok:true,from_job:current,to_job:next,history_entry:historyEntry};
 }
 return Object.freeze({VERSION:'GS-03-2',DEFAULT_STAT_KEYS,REQUIRED_JOB_COUNT,REQUIRED_GROWTH_TOTAL,normalizeCatalog,resolveJob,evaluateGuildEditState,prepareJobChange});
});
