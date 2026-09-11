(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameSkillLoadout=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DEFAULT_SKILL_IDS=Object.freeze([]);
  const FORMAL_SKILL_ID=/^SKL-\d{4}$/;
  const asId=value=>typeof value==='string'?value.trim():'';
  function normalizeSkillIds(value,{fallback=DEFAULT_SKILL_IDS}={}){
    const source=Array.isArray(value)?value:[];
    const seen=new Set(),ids=[];
    for(const row of source){const id=asId(row);if(!id||seen.has(id))continue;seen.add(id);ids.push(id);}
    if(ids.length)return ids;
    return (Array.isArray(fallback)?fallback:[]).map(asId).filter(Boolean).filter((id,index,rows)=>rows.indexOf(id)===index);
  }
  function validateActiveSkillLoadout(character,{capacity=null}={}){
    if(!character||typeof character!=='object')return{ok:false,reason:'CHARACTER_REQUIRED',ids:[]};
    const owned=normalizeSkillIds(character.skills,{fallback:[]}),raw=character.skillLoadoutIds;
    if(raw==null)return{ok:true,ids:[],ownedSkillIds:owned,capacity:capacity==null?null:Number(capacity)};
    if(!Array.isArray(raw))return{ok:false,reason:'SKILL_LOADOUT_ARRAY_REQUIRED',ids:[],ownedSkillIds:owned};
    const ids=[],seen=new Set();
    for(const row of raw){const id=asId(row);if(!id)return{ok:false,reason:'SKILL_LOADOUT_ID_REQUIRED',ids:[...ids],ownedSkillIds:owned};if(seen.has(id))return{ok:false,reason:'SKILL_LOADOUT_DUPLICATE',id,ids:[...ids],ownedSkillIds:owned};seen.add(id);ids.push(id);}
    const limit=capacity==null?null:Number(capacity);if(limit!=null&&(!Number.isInteger(limit)||limit<1))return{ok:false,reason:'SKILL_LOADOUT_CAPACITY_INVALID',capacity};
    if(limit!=null&&ids.length>limit)return{ok:false,reason:'SKILL_LOADOUT_CAPACITY_EXCEEDED',capacity:limit,count:ids.length,ids,ownedSkillIds:owned};
    const missing=ids.filter(id=>!owned.includes(id));if(missing.length)return{ok:false,reason:'SKILL_LOADOUT_NOT_OWNED',missing,ids,ownedSkillIds:owned,capacity:limit};
    return{ok:true,ids,ownedSkillIds:owned,capacity:limit};
  }
  function normalizeCharacterSkillState(character,{fallback=DEFAULT_SKILL_IDS,capacity=null}={}){
    if(!character||typeof character!=='object')throw new Error('character is required');
    const skills=normalizeSkillIds(character.skills,{fallback});
    const requested=asId(character.equippedSkillId);
    const equippedSkillId=requested&&skills.includes(requested)?requested:(skills[0]||'');
    character.skills=skills;character.equippedSkillId=equippedSkillId;
    const loadout=validateActiveSkillLoadout(character,{capacity});if(!loadout.ok)throw Object.assign(new Error(loadout.reason),{code:loadout.reason,details:loadout});
    return character;
  }
  function selectedSkillIds(character,{capacity=null}={}){const result=validateActiveSkillLoadout(character,{capacity});if(!result.ok)throw Object.assign(new Error(result.reason),{code:result.reason,details:result});return result.ids;}
  function formalProductionSkillCheck(skill,compileSkill){
    if(!skill||typeof skill!=='object')return{ok:false,reason:'SKILL_NOT_FOUND'};
    const id=asId(skill.id);if(!FORMAL_SKILL_ID.test(id))return{ok:false,reason:'FORMAL_SKILL_ID_REQUIRED'};
    if(String(skill.source||'')!=='studio_export')return{ok:false,reason:'STUDIO_EXPORT_REQUIRED'};
    if(String(skill.environment||'production').toLowerCase()!=='production')return{ok:false,reason:'PRODUCTION_SKILL_REQUIRED'};
    if(!skill.runtimeContracts||Number(skill.schemaVersion)!==1)return{ok:false,reason:'FORMAL_RUNTIME_CONTRACT_REQUIRED'};
    if(typeof compileSkill==='function'){const compiled=compileSkill(skill);if(!compiled?.ok)return{ok:false,reason:'SKILL_COMPILE_FAILED',errors:[...(compiled?.errors||[])]};}
    return{ok:true,id};
  }
  function assignFormalProductionSkill(character,skill,compileSkill){
    normalizeCharacterSkillState(character);const checked=formalProductionSkillCheck(skill,compileSkill);if(!checked.ok)return{...checked,changed:false};
    if(character.skills.includes(checked.id))return{ok:true,changed:false,id:checked.id,alreadyOwned:true};character.skills.push(checked.id);return{ok:true,changed:true,id:checked.id,alreadyOwned:false};
  }
  function setSkillSelected(character,skillId,selected,{capacity,resolveSkill,compileSkill}={}){
    if(!character||typeof character!=='object')return{ok:false,reason:'CHARACTER_REQUIRED',changed:false};
    const id=asId(skillId);if(!id)return{ok:false,reason:'SKILL_ID_REQUIRED',changed:false};
    const before=validateActiveSkillLoadout(character,{capacity});if(!before.ok)return{...before,changed:false};
    if(!before.ownedSkillIds.includes(id))return{ok:false,reason:'SKILL_NOT_OWNED',id,changed:false};
    if(selected){const skill=typeof resolveSkill==='function'?resolveSkill(id):null;if(typeof resolveSkill==='function'&&!skill)return{ok:false,reason:'SKILL_NOT_AVAILABLE',id,changed:false};if(skill&&typeof compileSkill==='function'&&!compileSkill(skill)?.ok)return{ok:false,reason:'SKILL_COMPILE_FAILED',id,changed:false};if(before.ids.includes(id))return{ok:true,changed:false,id,selected:true,ids:before.ids,capacity:before.capacity};if(before.capacity!=null&&before.ids.length>=before.capacity)return{ok:false,reason:'SKILL_LOADOUT_CAPACITY_EXCEEDED',id,capacity:before.capacity,count:before.ids.length,changed:false};character.skillLoadoutIds=[...before.ids,id];return{ok:true,changed:true,id,selected:true,ids:[...character.skillLoadoutIds],capacity:before.capacity};}
    if(!before.ids.includes(id))return{ok:true,changed:false,id,selected:false,ids:before.ids,capacity:before.capacity};character.skillLoadoutIds=before.ids.filter(x=>x!==id);return{ok:true,changed:true,id,selected:false,ids:[...character.skillLoadoutIds],capacity:before.capacity};
  }
  function skillUseCheck(character,skillId,{requireEquipped=true,requireSelected=false,capacity=null}={}){
    if(!character||typeof character!=='object')return{ok:false,reason:'CHARACTER_REQUIRED'};const id=asId(skillId);if(!id)return{ok:false,reason:'SKILL_ID_REQUIRED'};
    const owned=normalizeSkillIds(character.skills,{fallback:[]});if(!owned.includes(id))return{ok:false,reason:'SKILL_NOT_OWNED',id,ownedSkillIds:owned};
    if(requireSelected){const loadout=validateActiveSkillLoadout(character,{capacity});if(!loadout.ok)return loadout;if(!loadout.ids.includes(id))return{ok:false,reason:'SKILL_NOT_SELECTED',id,selectedSkillIds:loadout.ids,ownedSkillIds:owned};}
    const equippedSkillId=asId(character.equippedSkillId);if(requireEquipped&&equippedSkillId!==id)return{ok:false,reason:'SKILL_NOT_EQUIPPED',id,equippedSkillId,ownedSkillIds:owned};
    return{ok:true,id,equippedSkillId,ownedSkillIds:owned,...(requireSelected?{selectedSkillIds:selectedSkillIds(character,{capacity})}:{})};
  }
  function equipOwnedSkill(character,skillId,resolveSkill,compileSkill){
    normalizeCharacterSkillState(character);const id=asId(skillId);if(!id||!character.skills.includes(id))return{ok:false,reason:'SKILL_NOT_OWNED',changed:false};
    const skill=typeof resolveSkill==='function'?resolveSkill(id):null;if(!skill)return{ok:false,reason:'SKILL_NOT_AVAILABLE',changed:false};if(typeof compileSkill==='function'){const compiled=compileSkill(skill);if(!compiled?.ok)return{ok:false,reason:'SKILL_COMPILE_FAILED',errors:[...(compiled?.errors||[])],changed:false};}
    const changed=character.equippedSkillId!==id;character.equippedSkillId=id;return{ok:true,changed,id,skill};
  }
  function unavailableOwnedSkillIds(character,resolveSkill,compileSkill){normalizeCharacterSkillState(character);return character.skills.filter(id=>{const skill=typeof resolveSkill==='function'?resolveSkill(id):null;if(!skill)return true;if(typeof compileSkill!=='function')return false;return !compileSkill(skill)?.ok;});}
  return Object.freeze({DEFAULT_SKILL_IDS,FORMAL_SKILL_ID,normalizeSkillIds,validateActiveSkillLoadout,selectedSkillIds,normalizeCharacterSkillState,formalProductionSkillCheck,assignFormalProductionSkill,setSkillSelected,skillUseCheck,equipOwnedSkill,unavailableOwnedSkillIds});
});
