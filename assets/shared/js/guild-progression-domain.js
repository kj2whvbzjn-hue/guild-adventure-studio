(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKGuildProgressionDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FACILITY_IDS=Object.freeze(['tavern','training','warehouse','board']);
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function int(value,path,{min=0}={}){if(!Number.isInteger(value)||value<min)throw Object.assign(new Error(`${path} が不正です。`),{code:'GUILD_PROGRESSION_CONFIG_INVALID',path});return value}
 function object(value,path){if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error(`${path} が必要です。`),{code:'GUILD_PROGRESSION_CONFIG_INVALID',path});return value}
 function normalizeConfig(input){
  const source=object(input,'guild_progression'),id=String(source.id||'').trim();if(!id)throw Object.assign(new Error('guild_progression.id が必要です。'),{code:'GUILD_PROGRESSION_CONFIG_INVALID',path:'guild_progression.id'});
  const initialLevel=int(source.initial_level,'guild_progression.initial_level',{min:1}),maxLevel=int(source.max_level,'guild_progression.max_level',{min:initialLevel}),rows=source.level_definitions;
  if(!Array.isArray(rows)||!rows.length)throw Object.assign(new Error('guild_progression.level_definitions が必要です。'),{code:'GUILD_PROGRESSION_CONFIG_INVALID',path:'guild_progression.level_definitions'});
  const levelDefinitions=new Map();
  for(let i=0;i<rows.length;i++){
   const row=object(rows[i],`guild_progression.level_definitions[${i}]`),level=int(row.level,`guild_progression.level_definitions[${i}].level`,{min:initialLevel});
   if(level>maxLevel||levelDefinitions.has(level))throw Object.assign(new Error(`guild_progression.level_definitions[${i}].level が範囲外または重複です。`),{code:'GUILD_PROGRESSION_CONFIG_INVALID',path:`guild_progression.level_definitions[${i}].level`});
   levelDefinitions.set(level,Object.freeze({level,min_experience:int(row.min_experience,`guild_progression.level_definitions[${i}].min_experience`),warehouse_capacity:int(row.warehouse_capacity,`guild_progression.level_definitions[${i}].warehouse_capacity`),member_capacity:int(row.member_capacity,`guild_progression.level_definitions[${i}].member_capacity`,{min:1})}));
  }
  for(let level=initialLevel;level<=maxLevel;level++)if(!levelDefinitions.has(level))throw Object.assign(new Error(`guild_progression.level_definitions にLevel ${level} がありません。`),{code:'GUILD_PROGRESSION_CONFIG_INVALID',path:'guild_progression.level_definitions'});
  const facilities=object(source.facilities,'guild_progression.facilities'),normalizedFacilities={};
  for(const facilityId of FACILITY_IDS){const row=object(facilities[facilityId],`guild_progression.facilities.${facilityId}`);normalizedFacilities[facilityId]=Object.freeze({required_guild_level:int(row.required_guild_level,`guild_progression.facilities.${facilityId}.required_guild_level`,{min:initialLevel})});}
  const playerAi=object(source.player_ai,'guild_progression.player_ai');
  return Object.freeze({id,initial_level:initialLevel,max_level:maxLevel,level_definitions:levelDefinitions,facilities:Object.freeze(normalizedFacilities),player_ai:Object.freeze({required_guild_level:int(playerAi.required_guild_level,'guild_progression.player_ai.required_guild_level',{min:initialLevel})})});
 }
 function evaluateRequirement(currentLevel,requiredLevel){return Number.isInteger(currentLevel)&&Number.isInteger(requiredLevel)&&currentLevel>=requiredLevel}
 function normalizeGuildState(guild,config){const source=object(guild,'guild'),level=int(source.level,'guild.level',{min:config.initial_level}),experience=int(source.experience,'guild.experience');if(level>config.max_level)return fail('GUILD_LEVEL_OUT_OF_RANGE','Guild Levelが設定範囲外です。',{level,max_level:config.max_level});const definition=config.level_definitions.get(level);if(!definition)return fail('GUILD_LEVEL_DEFINITION_MISSING','Guild Level定義がありません。',{level});return{ok:true,level,experience,definition}}
 function resolveFacility(configInput,guildInput,facilityId){let config;try{config=normalizeConfig(configInput)}catch(error){return fail(error.code||'GUILD_PROGRESSION_CONFIG_INVALID',String(error.message||error),{path:error.path||''})}const id=String(facilityId||'').trim();if(!FACILITY_IDS.includes(id))return fail('GUILD_FACILITY_UNKNOWN','未定義の施設です。',{facility_id:id});const state=normalizeGuildState(guildInput,config);if(!state.ok)return state;const required=config.facilities[id].required_guild_level,unlocked=evaluateRequirement(state.level,required);return{ok:true,facility_id:id,unlocked,current_guild_level:state.level,required_guild_level:required,warehouse_capacity:state.definition.warehouse_capacity,member_capacity:state.definition.member_capacity}}
 function enterFacility(config,guild,facilityId){const access=resolveFacility(config,guild,facilityId);if(!access.ok)return access;if(!access.unlocked)return fail('GUILD_FACILITY_LOCKED','施設は未解放です。',{facility_id:access.facility_id,current_guild_level:access.current_guild_level,required_guild_level:access.required_guild_level});return{...access,entered:true}}
 function resolvePlayerAi(configInput,guildInput){let config;try{config=normalizeConfig(configInput)}catch(error){return fail(error.code||'GUILD_PROGRESSION_CONFIG_INVALID',String(error.message||error),{path:error.path||''})}const state=normalizeGuildState(guildInput,config);if(!state.ok)return state;const required=config.player_ai.required_guild_level;return{ok:true,unlocked:evaluateRequirement(state.level,required),current_guild_level:state.level,required_guild_level:required}}
 function resolveCapacities(configInput,guildInput){let config;try{config=normalizeConfig(configInput)}catch(error){return fail(error.code||'GUILD_PROGRESSION_CONFIG_INVALID',String(error.message||error),{path:error.path||''})}const state=normalizeGuildState(guildInput,config);if(!state.ok)return state;return{ok:true,guild_level:state.level,warehouse_capacity:state.definition.warehouse_capacity,member_capacity:state.definition.member_capacity}}
 function facilityViewModel(config,guild,facilityId){const access=resolveFacility(config,guild,facilityId);return access.ok?{facility_id:access.facility_id,enabled:access.unlocked,current_guild_level:access.current_guild_level,required_guild_level:access.required_guild_level,reason:access.unlocked?'':'GUILD_FACILITY_LOCKED'}:{facility_id:String(facilityId||''),enabled:false,reason:access.code,required_guild_level:null,current_guild_level:null}}
 return Object.freeze({VERSION:'GS-28-1',FACILITY_IDS,normalizeConfig,evaluateRequirement,resolveFacility,enterFacility,resolvePlayerAi,resolveCapacities,facilityViewModel});
});
