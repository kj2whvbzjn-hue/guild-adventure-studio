(function(root,factory){
  const Boundary=typeof module==='object'&&module.exports?require('./runtime-boundary-contracts.js'):root?.GKRuntimeBoundaryContracts;
  const api=factory(Boundary);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKFormalRuntimeGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Boundary){
'use strict';
const VERSION='F04-1';
const REQUIRED_SETTING_PATHS=Object.freeze([
  ['GS-01','game_runtime.character.party_max_size','integer'],['GS-02','game_runtime.character.initial_stats','object'],['GS-02','game_runtime.character.max_level','integer'],
  ['GS-04','game_runtime.skill_progression.skill_points_per_level','number'],['GS-06','game_runtime.equipment_rules.weapon.str_requirement_two_hand_multiplier','number'],
  ['GS-14','game_runtime.battle_flow.action_gauge.max','number'],['GS-14','game_runtime.battle_flow.action_gauge.ai_reevaluation_ratio','number'],
  ['GS-14','game_runtime.battle_flow.action_gauge.successful_action_consume_ratio','number'],['GS-14','game_runtime.battle_flow.action_gauge.failed_execution_consume_ratio','number'],
  ['GS-15','game_runtime.battle_flow.casting.default_skill_duration_ticks','integer'],['GS-25','encounter.default_spawn_weight','number'],['GS-25','encounter.max_units','integer'],
  ['GS-25','fixed_formation_scaling.hp_per_ratio','number'],['GS-25','fixed_formation_scaling.attack_per_ratio','number'],['GS-25','fixed_formation_scaling.agi_per_ratio','number'],
  ['GS-26','reward_scaling.bonus_per_budget','number'],['GS-26','reward_scaling.amount_rounding','string'],['GS-26','exploration.default_success_rate','number'],
  ['GS-30','game_runtime.new_game.starting_gold','integer'],['GS-30','game_runtime.new_game.starter_roster','array'],
  ['GS-34','game_runtime.skill_loadout.active_skill_slots','integer'],['GS-34','game_runtime.skill_loadout.passive_slots','integer'],
  ['GS-34','game_runtime.skill_progression.acquisition_cost.skill_default','number'],['GS-34','game_runtime.skill_progression.acquisition_cost.passive_default','number'],
  ['GS-34','game_runtime.skill_progression.respec_gold.skill','number'],['GS-34','game_runtime.skill_progression.respec_gold.passive','number'],['GS-34','game_runtime.skill_progression.respec_gold.all','number']
].map(([spec,path,type])=>Object.freeze({spec,path,type,required:true})));
function issue(code,path,message,{spec=null,masterId=null}={}){return Object.freeze({code:String(code),path:String(path||''),message:String(message||code),spec_ref:spec,master_id:masterId});}
function getPath(value,path){let cur=value;for(const key of String(path).split('.')){if(cur==null||typeof cur!=='object'||!(key in cur))return{found:false,value:undefined};cur=cur[key];}return{found:true,value:cur};}
function typeOk(value,type){if(type==='array')return Array.isArray(value);if(type==='object')return !!value&&typeof value==='object'&&!Array.isArray(value);if(type==='integer')return Number.isInteger(value);if(type==='number')return Number.isFinite(Number(value));if(type==='string')return typeof value==='string';return true;}
function finish(masterId,errors,schemaVersion='1.0.0'){
  const normalized=errors.map(x=>Object.freeze({...x}));
  if(Boundary?.createMasterValidationResult)return Boundary.createMasterValidationResult({schemaVersion,masterId,ok:normalized.length===0,errors:normalized});
  return Object.freeze({contract:'C06',schema_version:1,master_schema_version:String(schemaVersion),master_id:String(masterId),ok:normalized.length===0,errors:Object.freeze(normalized)});
}
function envelopeData(payload,masterId,errors){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)){errors.push(issue('MASTER_ENVELOPE_REQUIRED',masterId,'Export envelope object が必要です。',{masterId}));return null;}
  if(typeof payload.schema_version!=='string'||!payload.schema_version.trim())errors.push(issue('MASTER_SCHEMA_VERSION_REQUIRED',`${masterId}.schema_version`,'schema_version が必要です。',{masterId}));
  if(!Object.prototype.hasOwnProperty.call(payload,'data'))errors.push(issue('MASTER_DATA_REQUIRED',`${masterId}.data`,'data が必要です。',{masterId}));
  return payload.data;
}
function validateAdventureSettingsPayload(payload,{canonicalId='ADV-0001'}={}){
  const errors=[],data=envelopeData(payload,'system/adventure_settings',errors),rows=Array.isArray(data)?data:[];
  if(data!==null&&!Array.isArray(data))errors.push(issue('ADVENTURE_SETTINGS_DATA_ARRAY_REQUIRED','data','Adventure Settings data は配列が必要です。',{masterId:'system/adventure_settings'}));
  const matches=rows.filter(row=>String(row?.id||'')===String(canonicalId));
  if(matches.length!==1)errors.push(issue('ADVENTURE_SETTINGS_CANONICAL_COUNT','data',`正式Adventure Settings ${canonicalId} は1件必要です。現在 ${matches.length}件です。`,{masterId:'system/adventure_settings'}));
  const row=matches[0],params=row?.params;
  if(row&&(!params||typeof params!=='object'||Array.isArray(params)))errors.push(issue('ADVENTURE_SETTINGS_PARAMS_REQUIRED',`data.${canonicalId}.params`,'params object が必要です。',{masterId:'system/adventure_settings'}));
  if(params)for(const req of REQUIRED_SETTING_PATHS){const hit=getPath(params,req.path);if(!hit.found){errors.push(issue('REQUIRED_SETTING_MISSING',`params.${req.path}`,`${req.spec} 必須設定がありません: ${req.path}`,{spec:req.spec,masterId:'system/adventure_settings'}));continue;}if(!typeOk(hit.value,req.type))errors.push(issue('REQUIRED_SETTING_TYPE_INVALID',`params.${req.path}`,`${req.spec} 設定型が不正です: ${req.path} (${req.type})`,{spec:req.spec,masterId:'system/adventure_settings'}));}
  return finish('system/adventure_settings',errors,payload?.schema_version||'1.0.0');
}
function ids(rows){return new Set((Array.isArray(rows)?rows:[]).map(x=>String(x?.id||'').trim()).filter(Boolean));}
function validateRuntimeBundle(bundle,{canonicalId='ADV-0001'}={}){
  const errors=[];
  if(!bundle||typeof bundle!=='object'||Array.isArray(bundle))return finish('runtime_bundle',[issue('RUNTIME_BUNDLE_REQUIRED','bundle','Runtime bundle が必要です。',{masterId:'runtime_bundle'})]);
  const settingsRows=Array.isArray(bundle.adventureSettings)?bundle.adventureSettings:[],row=settingsRows.find(x=>String(x?.id||'')===String(canonicalId));
  if(!row)errors.push(issue('RUNTIME_SETTINGS_CANONICAL_MISSING','adventureSettings',`正式Adventure Settings ${canonicalId} がありません。`,{masterId:'runtime_bundle'}));
  else { const pseudo={schema_version:String(bundle.schema_version||'1.0.0'),data:[row]}; const result=validateAdventureSettingsPayload(pseudo,{canonicalId}); errors.push(...(result.errors||[])); }
  const jobIds=ids(bundle.jobs),equipmentIds=ids(bundle.equipment),skillIds=ids(bundle.skills),passiveIds=ids(bundle.passives),monsterIds=ids(bundle.monsters),mapIds=ids(bundle.maps),eventIds=ids(bundle.events),sceneIds=ids(bundle.scenes),flagIds=ids(bundle.flags),dropTableIds=ids(bundle.dropTables);
  const gr=row?.params?.game_runtime||{};
  for(const [i,starter] of (Array.isArray(gr?.new_game?.starter_roster)?gr.new_game.starter_roster:[]).entries()){
    const base=`adventureSettings.${canonicalId}.params.game_runtime.new_game.starter_roster[${i}]`;
    if(starter?.job_id&&!jobIds.has(String(starter.job_id)))errors.push(issue('UNKNOWN_JOB_ID',`${base}.job_id`,`存在しないJob参照です: ${starter.job_id}`,{spec:'GS-30',masterId:'runtime_bundle'}));
    for(const [slot,id] of Object.entries(starter?.starter_equipment||{}))if(id&&!equipmentIds.has(String(id)))errors.push(issue('UNKNOWN_EQUIPMENT_ID',`${base}.starter_equipment.${slot}`,`存在しないEquipment参照です: ${id}`,{spec:'GS-30',masterId:'runtime_bundle'}));
  }
  for(const id of gr?.character?.starter_skill_ids||[])if(!skillIds.has(String(id)))errors.push(issue('UNKNOWN_SKILL_ID','game_runtime.character.starter_skill_ids',`存在しないSkill参照です: ${id}`,{spec:'GS-30',masterId:'runtime_bundle'}));
  for(const id of gr?.character?.starter_passive_ids||[])if(!passiveIds.has(String(id)))errors.push(issue('UNKNOWN_PASSIVE_ID','game_runtime.character.starter_passive_ids',`存在しないPassive参照です: ${id}`,{spec:'GS-30',masterId:'runtime_bundle'}));
  for(const [i,q] of (bundle.quests||[]).entries()){
    const base=`quests[${i}]`;
    if(q?.context?.map_id&&!mapIds.has(String(q.context.map_id)))errors.push(issue('UNKNOWN_MAP_ID',`${base}.context.map_id`,`存在しないMap参照です: ${q.context.map_id}`,{spec:'GS-23',masterId:'runtime_bundle'}));
    for(const id of q?.required_flags||[])if(!flagIds.has(String(id)))errors.push(issue('UNKNOWN_FLAG_ID',`${base}.required_flags`,`存在しないFlag参照です: ${id}`,{spec:'GS-23',masterId:'runtime_bundle'}));
    for(const box of q?.boxes||[])for(const key of ['pre_scene_id','mid_scene_id','post_scene_id'])if(box?.[key]&&!sceneIds.has(String(box[key])))errors.push(issue('UNKNOWN_SCENE_ID',`${base}.boxes.${key}`,`存在しないScene参照です: ${box[key]}`,{spec:'GS-23',masterId:'runtime_bundle'}));
  }
  for(const [i,e] of (bundle.events||[]).entries()){
    const base=`events[${i}]`;for(const id of e?.required_flags||[])if(!flagIds.has(String(id)))errors.push(issue('UNKNOWN_FLAG_ID',`${base}.required_flags`,`存在しないFlag参照です: ${id}`,{spec:'GS-23',masterId:'runtime_bundle'}));
    for(const id of e?.required_monsters||[])if(!monsterIds.has(String(id?.monster_id||id)))errors.push(issue('UNKNOWN_MONSTER_ID',`${base}.required_monsters`,`存在しないMonster参照です: ${id?.monster_id||id}`,{spec:'GS-23',masterId:'runtime_bundle'}));
    if(e?.drop_table_id&&!dropTableIds.has(String(e.drop_table_id)))errors.push(issue('UNKNOWN_DROP_TABLE_ID',`${base}.drop_table_id`,`存在しないDropTable参照です: ${e.drop_table_id}`,{spec:'GS-26',masterId:'runtime_bundle'}));
  }
  return finish('runtime_bundle',errors,String(bundle.schema_version||'1.0.0'));
}
function assertValid(result,{code='FORMAL_RUNTIME_GATE_REJECTED'}={}){if(result?.ok===true)return result;const first=result?.errors?.[0];const error=new Error(first?.message||'Formal Runtime Gate rejected invalid data.');error.code=code;error.validation=result;throw error;}
return Object.freeze({VERSION,REQUIRED_SETTING_PATHS,validateAdventureSettingsPayload,validateRuntimeBundle,assertValid});
});
