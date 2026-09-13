(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../../assets/shared/config/tutorial-onboarding-config.js'):root?.GKTutorialOnboardingConfig);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GKTutorialHelpDomain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(defaultConfig){'use strict';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fail(code,message,details={}){const e=new Error(message);e.code=code;Object.assign(e,details);throw e;}
function configOf(config){const c=config||defaultConfig;if(!isObject(c)||String(c.id||'')!=='TUTORIAL-ONBOARDING-1.0'||!Array.isArray(c.stages)||c.stages.length!==7)fail('TUTORIAL_CONFIG_INVALID','TUTORIAL-ONBOARDING-1.0 Config が必要です。');const ids=new Set();let order=0;for(const s of c.stages){if(!isObject(s)||!String(s.id||'')||!String(s.help_text||''))fail('TUTORIAL_CONFIG_STAGE_INVALID','Tutorial stage Config が不正です。');if(ids.has(s.id)||Number(s.order)<=order)fail('TUTORIAL_CONFIG_ORDER_INVALID','Tutorial stage ID/順序が不正です。');ids.add(s.id);order=Number(s.order);}if(c.allow_full_skip!==false)fail('TUTORIAL_FULL_SKIP_FORBIDDEN','Tutorial全体Skipは許可されません。');return c;}
function emptyProgress(config=null){const c=configOf(config);return{config_id:c.id,current_stage_id:c.stages[0].id,completed_stage_ids:[],unlocked_help_ids:[],stage_state:{},completed:false};}
function normalizeProgress(value,config=null){const c=configOf(config),src=isObject(value)?value:{},ids=c.stages.map(s=>s.id),valid=new Set(ids),completed=[...new Set(Array.isArray(src.completed_stage_ids)?src.completed_stage_ids.map(String).filter(id=>valid.has(id)):[])];const ordered=ids.filter(id=>completed.includes(id));let prefix=0;while(prefix<ids.length&&completed.includes(ids[prefix]))prefix++;const canonicalCompleted=ids.slice(0,prefix);const finished=prefix===ids.length,current=finished?'':ids[prefix];const help=canonicalCompleted.filter(id=>Array.isArray(src.unlocked_help_ids)?src.unlocked_help_ids.map(String).includes(id):true);const stageState=isObject(src.stage_state)?clone(src.stage_state):{};return{config_id:c.id,current_stage_id:current,completed_stage_ids:canonicalCompleted,unlocked_help_ids:[...new Set([...help,...canonicalCompleted])],stage_state:finished?{}:stageState,completed:finished};}
function restoreFromSave(save,config=null){if(!isObject(save))fail('TUTORIAL_SAVE_REQUIRED','Save root が必要です。');return normalizeProgress(save.tutorialProgress||{},config);}
function stageById(id,config=null){const c=configOf(config);return c.stages.find(s=>s.id===id)||null;}
function currentStage(progress,context={},config=null){const c=configOf(config),p=normalizeProgress(progress,c);if(p.completed)return{stage:null,available:false,waiting_reason:'COMPLETE'};const stage=stageById(p.current_stage_id,c);let available=true,waiting='';if(stage.start_condition==='SKILL_ACQUISITION_AVAILABLE'&&!context.skill_acquisition_available){available=false;waiting='SKILL_ACQUISITION_NOT_AVAILABLE';}return{stage:clone(stage),available,waiting_reason:waiting};}
function markComplete(p,c){const id=p.current_stage_id;if(!id)return p;const ids=c.stages.map(s=>s.id),completed=[...p.completed_stage_ids,id],nextIndex=completed.length;return{config_id:c.id,current_stage_id:nextIndex<ids.length?ids[nextIndex]:'',completed_stage_ids:completed,unlocked_help_ids:[...new Set([...p.unlocked_help_ids,id])],stage_state:{},completed:nextIndex>=ids.length};}
function successful(event){return isObject(event)&&event.success===true;}
function eventType(event){return String(event?.type||'').trim();}
function sameInstance(a,b){return !!a&&!!b&&String(a)===String(b);}
function applyEvent(progress,event,context={},config=null){const c=configOf(config),p=normalizeProgress(progress,c),before=clone(p);if(p.completed)return{changed:false,completed_stage:false,progress:p};const stage=stageById(p.current_stage_id,c),availability=currentStage(p,context,c);if(!availability.available)return{changed:false,completed_stage:false,progress:p,waiting_reason:availability.waiting_reason};if(!successful(event))return{changed:false,completed_stage:false,progress:p};const t=eventType(event),s=clone(p.stage_state||{});let completed=false;
 switch(stage.id){
  case 'TUT-PARTY-01': completed=t==='PARTY_FORMATION_SAVED';break;
  case 'TUT-EQUIPMENT-02':
   if(t==='EQUIPMENT_DETAIL_CONFIRMED'){const id=String(event.equipment_instance_id||'');if(id){s.inspected_instance_id=id;s.unequipped_instance_id='';}}
   else if(t==='EQUIPMENT_UNEQUIPPED'&&sameInstance(s.inspected_instance_id,event.equipment_instance_id)){s.unequipped_instance_id=String(event.equipment_instance_id);}
   else if(t==='EQUIPMENT_EQUIPPED'&&sameInstance(s.inspected_instance_id,event.equipment_instance_id)&&sameInstance(s.unequipped_instance_id,event.equipment_instance_id)&&event.requirements_met===true)completed=true;
   break;
  case 'TUT-AI-03': completed=t==='FORMAL_AI_PARTY_READY'&&event.all_party_bindings_valid===true&&event.basic_attack_reachable===true;break;
  case 'TUT-STONE-04': completed=t==='STONE_OPTIONALITY_CONFIRMED'&&event.quest_prepare_viewed===true&&event.zero_selection_allowed===true;break;
  case 'TUT-QUEST-05': completed=t==='QUEST_RUN_STARTED'&&!!String(event.quest_run_id||'');break;
  case 'TUT-WAREHOUSE-REWARD-06':
   if(t==='RETURN_REWARD_COMMITTED'&&event.quest_success===true)s.return_reward_committed=true;
   else if(t==='WAREHOUSE_OPENED'&&s.return_reward_committed===true)completed=true;
   break;
  case 'TUT-SKILL-07':
   if(t==='ACTIVE_SKILL_SCREEN_VIEWED')s.active_viewed=true;
   else if(t==='PASSIVE_SKILL_SCREEN_VIEWED')s.passive_viewed=true;
   else if(t==='SKILL_ACQUIRED'&&s.active_viewed===true&&s.passive_viewed===true){const kind=String(event.kind||'').toUpperCase(),id=String(event.skill_id||'');if(id&&(kind==='ACTIVE'||kind==='PASSIVE')){s.acquired_kind=kind;s.acquired_id=id;if(kind==='PASSIVE')completed=true;}}
   else if(t==='ACTIVE_SKILL_SELECTED'&&s.acquired_kind==='ACTIVE'&&sameInstance(s.acquired_id,event.skill_id))completed=true;
   break;
  default: fail('TUTORIAL_STAGE_UNKNOWN',`未知のTutorial段階です: ${stage.id}`);
 }
 let next={...p,stage_state:s};if(completed)next=markComplete(next,c);const changed=JSON.stringify(before)!==JSON.stringify(next);return{changed,completed_stage:completed,completed_stage_id:completed?stage.id:'',progress:next};}
function proposeEvent(save,event,context={},config=null){if(!isObject(save))fail('TUTORIAL_SAVE_REQUIRED','Save root が必要です。');const c=configOf(config),before=restoreFromSave(save,c),result=applyEvent(before,event,context,c),next=clone(save);next.tutorialProgress=result.progress;return Object.freeze({operation:'TUTORIAL_PROGRESS_EVENT',changed:result.changed,completed_stage:result.completed_stage,completed_stage_id:result.completed_stage_id,next_save:next,progress:clone(result.progress),waiting_reason:result.waiting_reason||''});}
function helpEntries(progress,config=null){const c=configOf(config),p=normalizeProgress(progress,c),allowed=new Set(p.unlocked_help_ids);return c.stages.filter(s=>allowed.has(s.id)).map(s=>Object.freeze({stage_id:s.id,title:s.title,topic:s.topic,help_text:s.help_text}));}
function readHelp(progress,stageId,config=null){const rows=helpEntries(progress,config),row=rows.find(x=>x.stage_id===String(stageId||''));if(!row)fail('TUTORIAL_HELP_LOCKED','未学習のHelpは閲覧できません。',{stage_id:String(stageId||'')});return clone(row);}
return Object.freeze({VERSION:'GS-33-1',CONFIG_ID:'TUTORIAL-ONBOARDING-1.0',emptyProgress,normalizeProgress,restoreFromSave,currentStage,applyEvent,proposeEvent,helpEntries,readHelp});
});
