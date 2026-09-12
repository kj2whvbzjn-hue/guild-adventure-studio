(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKNewGameDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const text=(value,path)=>{const out=String(value??'').trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'NEW_GAME_CONFIG_INVALID',path});return out};
 function buildStarterEquipmentInstances(characters,starterRoster,{issueId,equipmentExists}={}){
  if(!Array.isArray(characters)||!Array.isArray(starterRoster)||characters.length!==starterRoster.length)throw Object.assign(new Error('初期冒険者とstarter_rosterの件数が一致しません。'),{code:'NEW_GAME_ROSTER_MISMATCH'});
  if(typeof issueId!=='function')throw Object.assign(new Error('装備個体ID発行器が必要です。'),{code:'NEW_GAME_INSTANCE_ID_ISSUER_REQUIRED'});
  if(typeof equipmentExists!=='function')throw Object.assign(new Error('Equipment参照検証器が必要です。'),{code:'NEW_GAME_EQUIPMENT_RESOLVER_REQUIRED'});
  const rows=[],ids=new Set();
  for(let index=0;index<characters.length;index++){
   const character=characters[index],ownerId=text(character?.id,`characters[${index}].id`),configured=isObject(starterRoster[index]?.starter_equipment)?starterRoster[index].starter_equipment:{};
   for(const [slot,rawEquipmentId] of Object.entries(configured)){
    const equipmentId=String(rawEquipmentId??'').trim();if(!equipmentId)continue;
    if(!equipmentExists(equipmentId))throw Object.assign(new Error(`初期装備が正式Equipment Masterに存在しません: ${equipmentId}`),{code:'NEW_GAME_EQUIPMENT_UNKNOWN',equipment_id:equipmentId,owner_id:ownerId,slot});
    const instanceId=text(issueId({owner_id:ownerId,equipment_id:equipmentId,slot,index}),`starter_equipment_instances[${rows.length}].instance_id`);
    if(ids.has(instanceId))throw Object.assign(new Error(`初期装備個体IDが重複しています: ${instanceId}`),{code:'NEW_GAME_EQUIPMENT_INSTANCE_DUPLICATE',instance_id:instanceId});
    ids.add(instanceId);rows.push({instance_id:instanceId,equipment_id:equipmentId,owner_id:ownerId,slot:String(slot)});
   }
  }
  return rows;
 }
 function validateStarterEquipmentInstances(characters,starterRoster,instances,{equipmentExists}={}){
  if(typeof equipmentExists!=='function')throw Object.assign(new Error('Equipment参照検証器が必要です。'),{code:'NEW_GAME_EQUIPMENT_RESOLVER_REQUIRED'});
  if(!Array.isArray(instances))throw Object.assign(new Error('starter_equipment_instances が配列ではありません。'),{code:'NEW_GAME_EQUIPMENT_INSTANCES_INVALID'});
  const expected=[];
  for(let index=0;index<(Array.isArray(characters)?characters.length:0);index++){
   const ownerId=text(characters[index]?.id,`characters[${index}].id`),configured=isObject(starterRoster?.[index]?.starter_equipment)?starterRoster[index].starter_equipment:{};
   for(const [slot,rawEquipmentId] of Object.entries(configured)){const equipmentId=String(rawEquipmentId??'').trim();if(equipmentId)expected.push({owner_id:ownerId,equipment_id:equipmentId,slot:String(slot)});}
  }
  if(instances.length!==expected.length)throw Object.assign(new Error(`初期装備個体数が一致しません: ${instances.length}/${expected.length}`),{code:'NEW_GAME_EQUIPMENT_INSTANCE_COUNT_MISMATCH'});
  const ids=new Set(),keys=new Set();
  for(let i=0;i<instances.length;i++){
   const row=instances[i];if(!isObject(row))throw Object.assign(new Error(`starter_equipment_instances[${i}] が不正です。`),{code:'NEW_GAME_EQUIPMENT_INSTANCES_INVALID'});
   const instanceId=text(row.instance_id,`starter_equipment_instances[${i}].instance_id`),equipmentId=text(row.equipment_id,`starter_equipment_instances[${i}].equipment_id`),ownerId=text(row.owner_id,`starter_equipment_instances[${i}].owner_id`),slot=text(row.slot,`starter_equipment_instances[${i}].slot`);
   if(ids.has(instanceId))throw Object.assign(new Error(`初期装備個体IDが重複しています: ${instanceId}`),{code:'NEW_GAME_EQUIPMENT_INSTANCE_DUPLICATE',instance_id:instanceId});ids.add(instanceId);
   if(!equipmentExists(equipmentId))throw Object.assign(new Error(`初期装備が正式Equipment Masterに存在しません: ${equipmentId}`),{code:'NEW_GAME_EQUIPMENT_UNKNOWN',equipment_id:equipmentId});
   const key=`${ownerId}\u0000${slot}`;if(keys.has(key))throw Object.assign(new Error(`同じ冒険者・装備枠へ複数個体が割り当てられています: ${ownerId}/${slot}`),{code:'NEW_GAME_EQUIPMENT_SLOT_DUPLICATE',owner_id:ownerId,slot});keys.add(key);
   if(!expected.some(x=>x.owner_id===ownerId&&x.equipment_id===equipmentId&&x.slot===slot))throw Object.assign(new Error(`初期装備個体がstarter_rosterと一致しません: ${ownerId}/${slot}/${equipmentId}`),{code:'NEW_GAME_EQUIPMENT_INSTANCE_MISMATCH',owner_id:ownerId,slot,equipment_id:equipmentId});
  }
  return{ok:true,count:instances.length,instances:clone(instances)};
 }
 return Object.freeze({VERSION:'GS-30-1',buildStarterEquipmentInstances,validateStarterEquipmentInstances});
});
