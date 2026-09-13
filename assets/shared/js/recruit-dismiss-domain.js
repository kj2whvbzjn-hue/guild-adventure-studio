(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKRecruitDismissDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const STAT_KEYS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function text(value,path){const out=String(value==null?'':value).trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path});return out}
 function nonNegativeInt(value,path){if(!Number.isInteger(value)||value<0)throw Object.assign(new Error(`${path} は0以上の整数が必要です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path});return value}
 function positiveInt(value,path){if(!Number.isInteger(value)||value<1)throw Object.assign(new Error(`${path} は1以上の整数が必要です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path});return value}
 function stringSet(value,path){if(!Array.isArray(value))throw Object.assign(new Error(`${path} が必要です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path});const out=new Set();for(let i=0;i<value.length;i++)out.add(text(value[i],`${path}[${i}]`));return out}
 function normalizeDefaults(input){
  if(!isObject(input))throw Object.assign(new Error('character_defaults が必要です。'),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:'character_defaults'});
  const stats={};if(!isObject(input.stats))throw Object.assign(new Error('character_defaults.stats が必要です。'),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:'character_defaults.stats'});
  for(const key of STAT_KEYS)stats[key]=nonNegativeInt(input.stats[key],`character_defaults.stats.${key}`);
  return Object.freeze({level:positiveInt(input.level,'character_defaults.level'),stats:Object.freeze(stats),skill_points:nonNegativeInt(input.skill_points,'character_defaults.skill_points'),formation_position:text(input.formation_position,'character_defaults.formation_position')});
 }
 function normalizeCharacters(value){if(!Array.isArray(value))throw Object.assign(new Error('characters が配列ではありません。'),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:'characters'});const ids=new Set();return value.map((row,i)=>{if(!isObject(row))throw Object.assign(new Error(`characters[${i}] が不正です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:`characters[${i}]`});const id=text(row.id,`characters[${i}].id`);if(ids.has(id))throw Object.assign(new Error(`冒険者個体IDが重複しています: ${id}`),{code:'DUPLICATE_CHARACTER_ID',character_id:id});ids.add(id);return row})}
 function normalizeInventory(value){const source=isObject(value)?value:{};const equipment=Array.isArray(source.equipment_instances)?source.equipment_instances.map((row,i)=>{if(!isObject(row))throw Object.assign(new Error(`inventory.equipment_instances[${i}] が不正です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:`inventory.equipment_instances[${i}]`});return{...clone(row),instance_id:text(row.instance_id,`inventory.equipment_instances[${i}].instance_id`),equipment_id:text(row.equipment_id,`inventory.equipment_instances[${i}].equipment_id`),owner_id:row.owner_id==null||String(row.owner_id).trim()===''?null:String(row.owner_id).trim()}}):[];const resourceStacks=Array.isArray(source.resource_stacks)?clone(source.resource_stacks):[];return{equipment_instances:equipment,resource_stacks:resourceStacks}}
 function occupiedSlots(inventory){return inventory.equipment_instances.length+inventory.resource_stacks.length}
 function planHire(input){
  const source=isObject(input)?input:{};let characters,unlockedTypes,unlockedJobs,memberCapacity,defaults,gold,typeId,jobId,name,now;
  try{characters=normalizeCharacters(source.characters);unlockedTypes=stringSet(source.unlocked_type_ids,'unlocked_type_ids');unlockedJobs=stringSet(source.unlocked_job_ids,'unlocked_job_ids');memberCapacity=positiveInt(source.member_capacity,'member_capacity');defaults=normalizeDefaults(source.character_defaults);gold=nonNegativeInt(source.gold,'gold');typeId=text(source.type_id,'type_id');jobId=text(source.job_id,'job_id');name=text(source.name,'name');now=text(source.now,'now')}catch(error){return fail(error.code||'RECRUIT_DISMISS_INPUT_INVALID',String(error.message||error),{path:error.path||''})}
  if(characters.length>=memberCapacity)return fail('GUILD_MEMBER_CAPACITY_REACHED','所属人数上限に達しているため雇用できません。',{member_capacity:memberCapacity,current_members:characters.length});
  if(!unlockedTypes.has(typeId))return fail('ADVENTURER_TYPE_LOCKED','冒険者種別が未解放です。',{type_id:typeId});
  if(!unlockedJobs.has(jobId))return fail('RECRUIT_JOB_LOCKED','初期Jobが未解放です。',{job_id:jobId});
  if(typeof source.job_exists!=='function'||!source.job_exists(jobId))return fail('RECRUIT_JOB_UNKNOWN','初期Jobが正式Job Masterに存在しません。',{job_id:jobId});
  if(typeof source.issue_character_id!=='function')return fail('CHARACTER_ID_ISSUER_REQUIRED','新規個体ID発行器が必要です。');
  let id;try{id=text(source.issue_character_id({type_id:typeId,job_id:jobId,name}),'character_id')}catch(error){return fail(error.code||'CHARACTER_ID_ISSUE_FAILED',String(error.message||error))}
  if(characters.some(row=>String(row.id)===id))return fail('DUPLICATE_CHARACTER_ID','発行された冒険者個体IDが既存個体と重複しています。',{character_id:id});
  const character={id,name,adventurer_type:typeId,level:defaults.level,job:jobId,stats:{...defaults.stats},skillPoints:defaults.skill_points,skillPointSpend:{skill:{},passive:{}},skills:[],passives:[],equippedSkillId:null,equippedSkillIds:[],equippedPassiveIds:[],equipment:{weapon1:null,weapon2:null,head:null,body:null,hands:null,feet:null,accessory:null},jobHistory:[{job:jobId,level:defaults.level,at:now}],growthHistory:[],formation_position:defaults.formation_position,createdAt:now};
  const nextCharacters=clone(characters);nextCharacters.push(character);
  return{ok:true,operation:'HIRE',cost_gold:0,gold_before:gold,gold_after:gold,character:clone(character),next_state:{characters:nextCharacters,gold}};
 }
 function planDismiss(input){
  const source=isObject(input)?input:{};let characters,characterId,partyIds,inventory,inventoryCapacity,equippedInstances;
  try{characters=normalizeCharacters(source.characters);characterId=text(source.character_id,'character_id');partyIds=stringSet(source.party_ids,'party_ids');inventory=normalizeInventory(source.inventory);inventoryCapacity=nonNegativeInt(source.inventory_capacity,'inventory_capacity');if(!Array.isArray(source.equipped_instances))throw Object.assign(new Error('equipped_instances が必要です。'),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:'equipped_instances'});equippedInstances=source.equipped_instances.map((row,i)=>{if(!isObject(row))throw Object.assign(new Error(`equipped_instances[${i}] が不正です。`),{code:'RECRUIT_DISMISS_INPUT_INVALID',path:`equipped_instances[${i}]`});return{...clone(row),instance_id:text(row.instance_id,`equipped_instances[${i}].instance_id`),equipment_id:text(row.equipment_id,`equipped_instances[${i}].equipment_id`),owner_id:text(row.owner_id,`equipped_instances[${i}].owner_id`)}})}catch(error){return fail(error.code||'RECRUIT_DISMISS_INPUT_INVALID',String(error.message||error),{path:error.path||''})}
  const target=characters.find(row=>String(row.id)===characterId);if(!target)return fail('DISMISS_CHARACTER_NOT_FOUND','解雇対象の冒険者が存在しません。',{character_id:characterId});
  if(partyIds.has(characterId))return fail('DISMISS_PARTY_MEMBER','パーティ所属中の冒険者は解雇できません。',{character_id:characterId});
  const allIds=new Map();for(const row of inventory.equipment_instances){if(allIds.has(row.instance_id))return fail('DUPLICATE_EQUIPMENT_INSTANCE','装備個体IDが重複しています。',{instance_id:row.instance_id});allIds.set(row.instance_id,'inventory')}
  for(const row of equippedInstances){if(allIds.has(row.instance_id))return fail('DUPLICATE_EQUIPMENT_INSTANCE','装備個体IDが重複しています。',{instance_id:row.instance_id});allIds.set(row.instance_id,'equipped');if(row.owner_id!==characterId)return fail('EQUIPMENT_OWNER_MISMATCH','解雇時に返却する装備個体の所有者が対象冒険者と一致しません。',{instance_id:row.instance_id,actual_owner_id:row.owner_id,expected_owner_id:characterId})}
  const occupiedBefore=occupiedSlots(inventory),requiredSlots=equippedInstances.length,occupiedAfter=occupiedBefore+requiredSlots;if(occupiedAfter>inventoryCapacity)return fail('DISMISS_INVENTORY_FULL','装備返却後の所持品容量が不足しています。',{inventory_capacity:inventoryCapacity,occupied_slots:occupiedBefore,return_slots:requiredSlots,required_slots:occupiedAfter});
  const nextInventory=clone(inventory);for(const row of equippedInstances)nextInventory.equipment_instances.push({...row,owner_id:null,slot:null});
  const nextCharacters=clone(characters.filter(row=>String(row.id)!==characterId));
  return{ok:true,operation:'DISMISS',character_id:characterId,returned_equipment_instance_ids:equippedInstances.map(row=>row.instance_id),next_state:{characters:nextCharacters,inventory:nextInventory}};
 }
 return Object.freeze({VERSION:'GS-05-1',STAT_KEYS,occupiedSlots,planHire,planDismiss});
});
