(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKEquipmentLoadoutDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SLOT_IDS=Object.freeze(['weapon1','weapon2','head','armor','gloves','feet','amulet','ring1','ring2','belt']);
 const WEAPON_SLOTS=Object.freeze(['weapon1','weapon2']);
 const WEAPON_STYLES=Object.freeze(['single','two_hand','dual_wield','weapon_shield','bow_quiver']);
 const STAT_KEYS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function text(value,path){const out=String(value??'').trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path});return out}
 function number(value,path,{min=0}={}){const n=Number(value);if(!Number.isFinite(n)||n<min)throw Object.assign(new Error(`${path} が不正です。`),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path});return n}
 function normalizeStats(value){if(!isObject(value))throw Object.assign(new Error('stats が必要です。'),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path:'stats'});const out={};for(const key of STAT_KEYS)out[key]=number(value[key]??0,`stats.${key}`);return out}
 function normalizeCapabilities(value){if(!Array.isArray(value))throw Object.assign(new Error('combat_capabilities が必要です。'),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path:'combat_capabilities'});return new Set(value.map((x,i)=>text(x,`combat_capabilities[${i}]`).toUpperCase()))}
 function normalizeInstance(row,path){if(!isObject(row))throw Object.assign(new Error(`${path} が不正です。`),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path});return{...clone(row),instance_id:text(row.instance_id,`${path}.instance_id`),equipment_id:text(row.equipment_id,`${path}.equipment_id`),owner_id:row.owner_id==null||String(row.owner_id).trim()===''?null:String(row.owner_id).trim()}}
 function normalizeInstances(value){if(!Array.isArray(value))throw Object.assign(new Error('equipment_instances が必要です。'),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path:'equipment_instances'});const ids=new Set();return value.map((row,i)=>{const out=normalizeInstance(row,`equipment_instances[${i}]`);if(ids.has(out.instance_id))throw Object.assign(new Error(`装備個体IDが重複しています: ${out.instance_id}`),{code:'DUPLICATE_EQUIPMENT_INSTANCE',instance_id:out.instance_id});ids.add(out.instance_id);return out})}
 function normalizeSlots(value){if(!isObject(value))throw Object.assign(new Error('slots が必要です。'),{code:'EQUIPMENT_LOADOUT_INPUT_INVALID',path:'slots'});const unknown=Object.keys(value).filter(k=>!SLOT_IDS.includes(k));if(unknown.length)throw Object.assign(new Error(`仕様外の装備スロットがあります: ${unknown.join(', ')}`),{code:'EQUIPMENT_SLOT_UNKNOWN',slots:unknown});const missing=SLOT_IDS.filter(k=>!Object.prototype.hasOwnProperty.call(value,k));if(missing.length)throw Object.assign(new Error(`装備スロットが不足しています: ${missing.join(', ')}`),{code:'EQUIPMENT_SLOT_MISSING',slots:missing});const out={};for(const slot of SLOT_IDS){const v=value[slot];out[slot]=v==null||String(v).trim()===''?null:String(v).trim()}return out}
 function expectedSlot(def){const slot=String(def?.slot||'').trim();return slot}
 function slotCompatible(slot,def){const expected=expectedSlot(def);if(expected==='weapon')return WEAPON_SLOTS.includes(slot);if(expected==='ring')return slot==='ring1'||slot==='ring2';return expected===slot}
 function required(def,key){return Math.max(0,Number(def?.required?.[key])||0)}
 function baseItemType(def){return String(def?.generation?.base_item_type??def?.generation?.generation_input?.base_item_type??def?.base_item_type??'').trim()}
 function isShield(def){return baseItemType(def)==='盾'}
 function isBow(def){return['弓','大弓'].includes(baseItemType(def))}
 function isQuiver(def){return baseItemType(def)==='矢筒'}
 function requirementsFor(def){const out={};for(const key of STAT_KEYS)out[key]=required(def,key);return out}
 function checkRequirements(stats,def,{twoHandStrMultiplier=2,allowTwoHandRelief=false}={}){
  const missing=[];let usedTwoHandRelief=false;
  for(const key of STAT_KEYS){const req=required(def,key),actual=Number(stats[key])||0;if(actual>=req)continue;if(key==='STR'&&allowTwoHandRelief&&actual*twoHandStrMultiplier>=req){usedTwoHandRelief=true;continue}missing.push({stat:key,required:req,actual});}
  return{ok:missing.length===0,missing,used_two_hand_str_relief:usedTwoHandRelief};
 }
 function resolve(input){
  const source=isObject(input)?input:{};let characterId,stats,capabilities,instances,slots,style,twoHandStrMultiplier;
  try{characterId=text(source.character_id,'character_id');stats=normalizeStats(source.stats);capabilities=normalizeCapabilities(source.combat_capabilities);instances=normalizeInstances(source.equipment_instances);slots=normalizeSlots(source.slots);style=text(source.weapon_style,'weapon_style');if(!WEAPON_STYLES.includes(style))throw Object.assign(new Error(`weapon_style が不正です: ${style}`),{code:'EQUIPMENT_WEAPON_STYLE_INVALID',weapon_style:style});twoHandStrMultiplier=number(source.two_hand_str_multiplier,'two_hand_str_multiplier',{min:1});}
  catch(error){return fail(error.code||'EQUIPMENT_LOADOUT_INPUT_INVALID',String(error.message||error),{path:error.path||'',instance_id:error.instance_id,slots:error.slots,weapon_style:error.weapon_style})}
  if(typeof source.resolve_equipment!=='function')return fail('EQUIPMENT_RESOLVER_REQUIRED','正式Equipment Resolverが必要です。');
  const byId=new Map(instances.map(row=>[row.instance_id,row])),assignments=[];
  for(const slot of SLOT_IDS){const instanceId=slots[slot];if(!instanceId)continue;const instance=byId.get(instanceId);if(!instance)return fail('EQUIPMENT_INSTANCE_NOT_FOUND','装備枠が存在しない個体IDを参照しています。',{slot,instance_id:instanceId});if(instance.owner_id!==characterId)return fail('EQUIPMENT_OWNER_MISMATCH','装備個体の所有者がキャラクターと一致しません。',{slot,instance_id:instanceId,owner_id:instance.owner_id,character_id:characterId});let def;try{def=source.resolve_equipment(instance.equipment_id)}catch(error){return fail('EQUIPMENT_RESOLVE_FAILED',String(error.message||error),{equipment_id:instance.equipment_id})}if(!def)return fail('EQUIPMENT_DEFINITION_NOT_FOUND','正式Equipment定義が見つかりません。',{equipment_id:instance.equipment_id});if(!slotCompatible(slot,def))return fail('EQUIPMENT_SLOT_MISMATCH','装備個体と装備枠が一致しません。',{slot,instance_id:instanceId,equipment_id:instance.equipment_id,equipment_slot:expectedSlot(def)});assignments.push({slot,instance,definition:def});}
  const useCount=new Map();for(const row of assignments)useCount.set(row.instance.instance_id,(useCount.get(row.instance.instance_id)||0)+1);
  for(const [instanceId,count] of useCount){if(count<=1)continue;const validTwoHandDuplicate=style==='two_hand'&&count===2&&slots.weapon1===instanceId&&slots.weapon2===instanceId;if(!validTwoHandDuplicate)return fail('DUPLICATE_EQUIPMENT_INSTANCE_ASSIGNMENT','同じ装備個体を複数枠へ重複配置できません。',{instance_id:instanceId,count});}
  const weaponRows=assignments.filter(x=>WEAPON_SLOTS.includes(x.slot));
  const weaponUnique=[...new Map(weaponRows.map(x=>[x.instance.instance_id,x])).values()];
  if(style==='single'&&weaponUnique.length!==1)return fail('WEAPON_STYLE_LAYOUT_MISMATCH','singleは攻撃武器1個体が必要です。');
  if(style==='two_hand'){
   if(weaponUnique.length!==1||!slots.weapon1||slots.weapon1!==slots.weapon2)return fail('TWO_HAND_LAYOUT_INVALID','両手持ちは同じ武器個体でweapon1/weapon2の2枠を占有する必要があります。');
   const row=weaponUnique[0];if(isShield(row.definition)||isQuiver(row.definition))return fail('TWO_HAND_WEAPON_INVALID','盾・矢筒は両手持ちの攻撃武器にできません。');
  }
  if(style==='dual_wield'){
   if(!capabilities.has('DUAL_WIELD'))return fail('DUAL_WIELD_CAPABILITY_REQUIRED','二刀流にはDUAL_WIELD能力が必要です。');
   if(weaponUnique.length!==2)return fail('DUAL_WIELD_LAYOUT_INVALID','二刀流には異なる武器個体2件が必要です。');
   if(weaponUnique.some(x=>isShield(x.definition)||isQuiver(x.definition)))return fail('DUAL_WIELD_WEAPON_INVALID','盾・矢筒は二刀流Strikeの武器にできません。');
  }
  if(style==='weapon_shield'){
   if(weaponUnique.length!==2||weaponUnique.filter(x=>isShield(x.definition)).length!==1)return fail('WEAPON_SHIELD_LAYOUT_INVALID','武器＋盾は攻撃武器1件と盾1件が必要です。');
  }
  if(style==='bow_quiver'){
   if(weaponUnique.length!==2||weaponUnique.filter(x=>isBow(x.definition)).length!==1||weaponUnique.filter(x=>isQuiver(x.definition)).length!==1)return fail('BOW_QUIVER_LAYOUT_INVALID','弓＋矢筒は弓系1件と矢筒1件が必要です。');
  }
  for(const row of weaponUnique){const gate=checkRequirements(stats,row.definition,{twoHandStrMultiplier,allowTwoHandRelief:style==='two_hand'});if(!gate.ok)return fail('EQUIPMENT_REQUIREMENTS_NOT_MET','武器の装備条件を満たしていません。',{instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id,missing:gate.missing});}
  for(const row of assignments.filter(x=>!WEAPON_SLOTS.includes(x.slot))){const gate=checkRequirements(stats,row.definition,{twoHandStrMultiplier,allowTwoHandRelief:false});if(!gate.ok)return fail('EQUIPMENT_REQUIREMENTS_NOT_MET','装備条件を満たしていません。',{slot:row.slot,instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id,missing:gate.missing});}
  const strikes=[];
  if(style==='single'||style==='two_hand'){const row=weaponUnique[0];if(row&&!isShield(row.definition)&&!isQuiver(row.definition))strikes.push({hand:'MAIN',instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id});}
  else if(style==='dual_wield'){
   const bySlot=new Map(weaponRows.map(x=>[x.slot,x]));for(const [slot,hand] of [['weapon1','MAIN'],['weapon2','OFF']]){const row=bySlot.get(slot);strikes.push({hand,instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id});}
  }else if(style==='weapon_shield'){const row=weaponUnique.find(x=>!isShield(x.definition));if(row)strikes.push({hand:'MAIN',instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id});}
  else if(style==='bow_quiver'){const row=weaponUnique.find(x=>isBow(x.definition));if(row)strikes.push({hand:'MAIN',instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id});}
  return{ok:true,character_id:characterId,weapon_style:style,slots:clone(slots),unique_equipment_instance_ids:[...new Set(assignments.map(x=>x.instance.instance_id))],strikes,requirements:weaponUnique.map(row=>({instance_id:row.instance.instance_id,equipment_id:row.instance.equipment_id,required:requirementsFor(row.definition)})),bow_action_ready:style==='bow_quiver'};
 }
 return Object.freeze({VERSION:'GS-06-1',SLOT_IDS,WEAPON_SLOTS,WEAPON_STYLES,STAT_KEYS,checkRequirements,resolve,isShield,isBow,isQuiver});
});
