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
  function normalizeCharacterSkillState(character,{fallback=DEFAULT_SKILL_IDS}={}){
    if(!character||typeof character!=='object')throw new Error('character is required');
    const skills=normalizeSkillIds(character.skills,{fallback});
    const requested=asId(character.equippedSkillId);
    const equippedSkillId=requested&&skills.includes(requested)?requested:(skills[0]||'');
    character.skills=skills;character.equippedSkillId=equippedSkillId;
    return character;
  }

  function normalizeLoadoutBalance(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('skill loadout balance is required');
    const active=Number(value.active_skill_slots),passive=Number(value.passive_slots);
    if(!Number.isInteger(active)||active<0)throw new Error('active_skill_slots must be a non-negative integer');
    if(!Number.isInteger(passive)||passive<0)throw new Error('passive_slots must be a non-negative integer');
    return Object.freeze({active_skill_slots:active,passive_slots:passive});
  }
  function selectedIds(character,key){return normalizeSkillIds(character?.[key],{fallback:[]});}
  function loadoutState(character,balanceValue){
    if(!character||typeof character!=='object')throw new Error('character is required');
    const balance=normalizeLoadoutBalance(balanceValue),ownedSkillIds=normalizeSkillIds(character.skills,{fallback:[]}),ownedPassiveIds=normalizeSkillIds(character.passiveIds,{fallback:[]}),activeSkillIds=selectedIds(character,'skillLoadoutIds'),passiveIds=selectedIds(character,'passiveLoadoutIds');
    const missingActive=activeSkillIds.filter(id=>!ownedSkillIds.includes(id)),missingPassive=passiveIds.filter(id=>!ownedPassiveIds.includes(id));
    if(missingActive.length)throw Object.assign(new Error(`Active Skill Loadout contains unowned ids: ${missingActive.join(', ')}`),{code:'ACTIVE_LOADOUT_NOT_OWNED',ids:missingActive});
    if(missingPassive.length)throw Object.assign(new Error(`Passive Loadout contains unowned ids: ${missingPassive.join(', ')}`),{code:'PASSIVE_LOADOUT_NOT_OWNED',ids:missingPassive});
    if(activeSkillIds.length>balance.active_skill_slots)throw Object.assign(new Error(`Active Skill Loadout exceeds capacity: ${activeSkillIds.length}/${balance.active_skill_slots}`),{code:'ACTIVE_LOADOUT_CAPACITY_EXCEEDED'});
    if(passiveIds.length>balance.passive_slots)throw Object.assign(new Error(`Passive Loadout exceeds capacity: ${passiveIds.length}/${balance.passive_slots}`),{code:'PASSIVE_LOADOUT_CAPACITY_EXCEEDED'});
    return{balance,ownedSkillIds,ownedPassiveIds,activeSkillIds,passiveIds};
  }
  function setSelected(character,key,ownedKey,id,capacity){
    if(!character||typeof character!=='object')return{ok:false,reason:'CHARACTER_REQUIRED',changed:false};
    const target=asId(id);if(!target)return{ok:false,reason:'ID_REQUIRED',changed:false};
    const owned=normalizeSkillIds(character[ownedKey],{fallback:[]});if(!owned.includes(target))return{ok:false,reason:ownedKey==='skills'?'SKILL_NOT_OWNED':'PASSIVE_NOT_OWNED',changed:false,id:target};
    const selected=selectedIds(character,key),index=selected.indexOf(target);
    if(index>=0){selected.splice(index,1);character[key]=selected;return{ok:true,changed:true,selected:false,id:target,ids:selected};}
    if(selected.length>=capacity)return{ok:false,reason:'LOADOUT_FULL',changed:false,id:target,capacity,ids:selected};
    selected.push(target);character[key]=selected;return{ok:true,changed:true,selected:true,id:target,ids:selected};
  }
  function toggleActiveSkill(character,skillId,balanceValue){const b=normalizeLoadoutBalance(balanceValue);return setSelected(character,'skillLoadoutIds','skills',skillId,b.active_skill_slots);}
  function togglePassive(character,passiveId,balanceValue){const b=normalizeLoadoutBalance(balanceValue);return setSelected(character,'passiveLoadoutIds','passiveIds',passiveId,b.passive_slots);}
  function formalProductionSkillCheck(skill,compileSkill){
    if(!skill||typeof skill!=='object')return{ok:false,reason:'SKILL_NOT_FOUND'};
    const id=asId(skill.id);if(!FORMAL_SKILL_ID.test(id))return{ok:false,reason:'FORMAL_SKILL_ID_REQUIRED'};
    if(String(skill.source||'')!=='studio_export')return{ok:false,reason:'STUDIO_EXPORT_REQUIRED'};
    if(String(skill.environment||'production').toLowerCase()!=='production')return{ok:false,reason:'PRODUCTION_SKILL_REQUIRED'};
    if(!skill.runtimeContracts||Number(skill.schemaVersion)!==1)return{ok:false,reason:'FORMAL_RUNTIME_CONTRACT_REQUIRED'};
    if(typeof compileSkill==='function'){
      const compiled=compileSkill(skill);if(!compiled?.ok)return{ok:false,reason:'SKILL_COMPILE_FAILED',errors:[...(compiled?.errors||[])]};
    }
    return{ok:true,id};
  }
  function assignFormalProductionSkill(character,skill,compileSkill){
    normalizeCharacterSkillState(character);
    const checked=formalProductionSkillCheck(skill,compileSkill);if(!checked.ok)return{...checked,changed:false};
    if(character.skills.includes(checked.id))return{ok:true,changed:false,id:checked.id,alreadyOwned:true};
    character.skills.push(checked.id);
    if(!character.equippedSkillId)character.equippedSkillId=checked.id;
    return{ok:true,changed:true,id:checked.id,alreadyOwned:false};
  }
  function skillUseCheck(character,skillId,{requireEquipped=true}={}){
    if(!character||typeof character!=='object')return{ok:false,reason:'CHARACTER_REQUIRED'};
    const id=asId(skillId);if(!id)return{ok:false,reason:'SKILL_ID_REQUIRED'};
    const owned=normalizeSkillIds(character.skills,{fallback:[]});
    if(!owned.includes(id))return{ok:false,reason:'SKILL_NOT_OWNED',id,ownedSkillIds:owned};
    const equippedSkillId=asId(character.equippedSkillId);
    if(requireEquipped&&equippedSkillId!==id)return{ok:false,reason:'SKILL_NOT_EQUIPPED',id,equippedSkillId,ownedSkillIds:owned};
    return{ok:true,id,equippedSkillId,ownedSkillIds:owned};
  }
  function equipOwnedSkill(character,skillId,resolveSkill,compileSkill){
    normalizeCharacterSkillState(character);
    const id=asId(skillId);if(!id||!character.skills.includes(id))return{ok:false,reason:'SKILL_NOT_OWNED',changed:false};
    const skill=typeof resolveSkill==='function'?resolveSkill(id):null;if(!skill)return{ok:false,reason:'SKILL_NOT_AVAILABLE',changed:false};
    if(typeof compileSkill==='function'){
      const compiled=compileSkill(skill);if(!compiled?.ok)return{ok:false,reason:'SKILL_COMPILE_FAILED',errors:[...(compiled?.errors||[])],changed:false};
    }
    const changed=character.equippedSkillId!==id;character.equippedSkillId=id;return{ok:true,changed,id,skill};
  }
  function unavailableOwnedSkillIds(character,resolveSkill,compileSkill){
    normalizeCharacterSkillState(character);
    return character.skills.filter(id=>{const skill=typeof resolveSkill==='function'?resolveSkill(id):null;if(!skill)return true;if(typeof compileSkill!=='function')return false;return !compileSkill(skill)?.ok;});
  }
  return Object.freeze({DEFAULT_SKILL_IDS,FORMAL_SKILL_ID,normalizeSkillIds,normalizeCharacterSkillState,normalizeLoadoutBalance,loadoutState,toggleActiveSkill,togglePassive,formalProductionSkillCheck,assignFormalProductionSkill,skillUseCheck,equipOwnedSkill,unavailableOwnedSkillIds});
});
