(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKCharacterExperienceDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='GS-04-1';
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function integer(value,path,{min=0,max=null}={}){const n=Number(value);if(!Number.isInteger(n)||n<min||(max!=null&&n>max))throw Object.assign(new Error(`${path} が不正です。`),{code:'CHARACTER_EXPERIENCE_INPUT_INVALID',path});return n}
 function text(value,path){const out=String(value??'').trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'CHARACTER_EXPERIENCE_INPUT_INVALID',path});return out}
 function normalizeRequiredExpTable(value){
  if(!isObject(value))throw Object.assign(new Error('required_exp_by_level object が必要です。'),{code:'EXP_TABLE_REQUIRED',path:'required_exp_by_level'});
  const out={};for(const [rawLevel,rawRequired] of Object.entries(value)){const level=integer(Number(rawLevel),`required_exp_by_level.${rawLevel}.level`,{min:1}),required=integer(rawRequired,`required_exp_by_level.${rawLevel}`,{min:1});out[level]=required;}
  return Object.freeze(out);
 }
 function normalizePartyIds(value){if(!Array.isArray(value))throw Object.assign(new Error('party_ids 配列が必要です。'),{code:'CHARACTER_EXPERIENCE_INPUT_INVALID',path:'party_ids'});const ids=value.map((id,i)=>text(id,`party_ids[${i}]`));return [...new Set(ids)]}
 function normalizeEndStates(value){
  if(value instanceof Map)return new Map([...value].map(([id,state])=>[String(id),clone(state)]));
  if(!isObject(value))throw Object.assign(new Error('end_state_by_character object または Map が必要です。'),{code:'CHARACTER_EXPERIENCE_INPUT_INVALID',path:'end_state_by_character'});
  return new Map(Object.entries(value).map(([id,state])=>[String(id),clone(state)]));
 }
 function eligibleRecipients({partyIds,endStateByCharacter}={}){
  let ids,states;try{ids=normalizePartyIds(partyIds);states=normalizeEndStates(endStateByCharacter)}catch(error){return fail(error.code||'CHARACTER_EXPERIENCE_INPUT_INVALID',String(error.message||error),{path:error.path||''})}
  const recipients=[];for(const id of ids){const state=states.get(id);if(!state||typeof state!=='object')continue;const alive=state.alive===true||(Number.isFinite(Number(state.hp))&&Number(state.hp)>0);if(alive)recipients.push(id)}
  return{ok:true,recipient_ids:recipients,recipient_count:recipients.length};
 }
 function distributeAdventureExperience({totalExperience,partyIds,endStateByCharacter}={}){
  let total;try{total=integer(totalExperience,'total_experience',{min:0})}catch(error){return fail(error.code||'CHARACTER_EXPERIENCE_INPUT_INVALID',String(error.message||error),{path:error.path||''})}
  const eligibility=eligibleRecipients({partyIds,endStateByCharacter});if(!eligibility.ok)return eligibility;
  const count=eligibility.recipient_count,per=count>0?Math.floor(total/count):0,distributed=per*count,remainder=total-distributed,awards={};for(const id of eligibility.recipient_ids)awards[id]=per;
  return{ok:true,total_experience:total,recipient_ids:[...eligibility.recipient_ids],recipient_count:count,experience_per_recipient:per,distributed_experience:distributed,discarded_remainder:remainder,awards};
 }
 function resolveCharacterProgression({character,awardedExperience,requiredExpByLevel,maxLevel,skillPointsPerLevel=1,resolveGrowth}={}){
  if(!isObject(character))return fail('CHARACTER_REQUIRED','character が必要です。');
  let idValue,level,experience,award,cap,spPerLevel,table;try{idValue=text(character.id,'character.id');level=integer(character.level,'character.level',{min:1});experience=integer(character.experience??0,'character.experience',{min:0});award=integer(awardedExperience,'awarded_experience',{min:0});cap=integer(maxLevel,'max_level',{min:1});spPerLevel=integer(skillPointsPerLevel,'skill_points_per_level',{min:0});table=normalizeRequiredExpTable(requiredExpByLevel)}catch(error){return fail(error.code||'CHARACTER_EXPERIENCE_INPUT_INVALID',String(error.message||error),{path:error.path||''})}
  if(level>cap)return fail('CHARACTER_LEVEL_OUT_OF_RANGE','character.level が max_level を超えています。',{character_id:idValue,level,max_level:cap});
  const source=clone(character),next=clone(character);next.experience=experience;next.skillPoints=integer(next.skillPoints??0,'character.skillPoints',{min:0});
  if(level>=cap){next.level=cap;next.experience=0;return{ok:true,character_id:idValue,awarded_experience:award,consumed_experience:0,discarded_experience:experience+award,levels_gained:0,skill_points_gained:0,growth_results:[],next_character:next};}
  if(typeof resolveGrowth!=='function')return fail('GROWTH_RESOLVER_REQUIRED','Level上昇時のGS-02成長Resolverが必要です。',{character_id:idValue});
  let pool=experience+award,currentLevel=level,levelsGained=0,consumed=0,skillPointsGained=0;const growthResults=[];
  while(currentLevel<cap){
   const required=table[currentLevel];if(!Number.isInteger(required)||required<1){if(levelsGained>0)break;return fail('REQUIRED_EXP_LEVEL_MISSING','現在Levelの必要EXP設定がありません。',{character_id:idValue,level:currentLevel});}
   if(pool<required)break;
   const growth=resolveGrowth({character:clone(next),fromLevel:currentLevel,toLevel:currentLevel+1,levelIndex:levelsGained});
   if(!growth||growth.ok!==true||!isObject(growth.next_character))return fail('GROWTH_RESOLUTION_FAILED','GS-02成長結果を確定できません。',{character_id:idValue,level:currentLevel,growth_result:clone(growth)});
   pool-=required;consumed+=required;currentLevel++;levelsGained++;skillPointsGained+=spPerLevel;
   const grown=clone(growth.next_character);for(const [key,value] of Object.entries(grown))next[key]=value;next.id=idValue;next.level=currentLevel;next.skillPoints=integer(next.skillPoints??0,'growth.next_character.skillPoints',{min:0});
   growthResults.push(clone(growth));
   if(currentLevel>=cap){pool=0;break;}
  }
  next.level=currentLevel;next.experience=pool;next.skillPoints=integer(next.skillPoints??0,'next_character.skillPoints',{min:0})+skillPointsGained;
  const discarded=(level+levelsGained>=cap)?Math.max(0,experience+award-consumed):0;
  return{ok:true,character_id:idValue,awarded_experience:award,consumed_experience:consumed,discarded_experience:discarded,levels_gained:levelsGained,skill_points_gained:skillPointsGained,growth_results:growthResults,next_character:next,source_character:source};
 }
 function buildReturnProgressionProposal({characters,distribution,requiredExpByLevel,maxLevel,skillPointsPerLevel=1,resolveGrowth}={}){
  if(!Array.isArray(characters))return fail('CHARACTERS_REQUIRED','characters 配列が必要です。');if(!distribution?.ok)return fail('EXP_DISTRIBUTION_REQUIRED','成功したEXP配分結果が必要です。');
  const byId=new Map();for(const row of characters){if(!isObject(row))return fail('CHARACTER_INVALID','characters に不正な要素があります。');const idValue=String(row.id||'').trim();if(!idValue)return fail('CHARACTER_ID_REQUIRED','character.id が必要です。');if(byId.has(idValue))return fail('CHARACTER_ID_DUPLICATED','character.id が重複しています。',{character_id:idValue});byId.set(idValue,row)}
  const updates=[],untouched=[];for(const row of characters){const idValue=String(row.id),award=Number(distribution.awards?.[idValue]||0);if(!distribution.recipient_ids.includes(idValue)){untouched.push(idValue);continue}const resolved=resolveCharacterProgression({character:row,awardedExperience:award,requiredExpByLevel,maxLevel,skillPointsPerLevel,resolveGrowth});if(!resolved.ok)return resolved;updates.push(resolved)}
  return{ok:true,contract:'GS04_RETURN_PROGRESSION_PROPOSAL',contract_version:1,distribution:clone(distribution),character_updates:updates,untouched_character_ids:untouched};
 }
 return Object.freeze({VERSION,normalizeRequiredExpTable,eligibleRecipients,distributeAdventureExperience,resolveCharacterProgression,buildReturnProgressionProposal});
});
