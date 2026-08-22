(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameSkillPassiveAISaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const LEGACY_CHARACTER_AI_KEYS=Object.freeze(['aiGraph','aiPolicy','defaultSkillId']);
  const OPTIONAL_CHARACTER_DOMAIN_KEYS=Object.freeze(['passiveIds','skillLoadoutIds']);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function optionalField(value,key){return own(value,key)?{present:true,value:clone(value[key])}:{present:false};}
  function assertNoLegacyFallback(save){
    if(!isObject(save)||!Array.isArray(save.characters))throw new Error('Skill / Passive / AI Save Bridge: save characters are required.');
    for(const [index,character] of save.characters.entries()){
      if(!isObject(character))throw new Error(`Skill / Passive / AI Save Bridge: characters[${index}] object is required.`);
      for(const key of LEGACY_CHARACTER_AI_KEYS)if(own(character,key)){
        const error=new Error(`Skill / Passive / AI Save Bridge: legacy AI field is forbidden (${key}).`);
        error.code='LEGACY_AI_SKILL_FALLBACK_FORBIDDEN';error.path=`characters[${index}].${key}`;throw error;
      }
    }
    return true;
  }
  function capture(save){
    if(!isObject(save))throw new Error('Skill / Passive / AI Save Bridge: save root object is required.');
    if(!Array.isArray(save.characters))throw new Error('Skill / Passive / AI Save Bridge: characters array is required.');
    if(!Array.isArray(save.aiPrograms)||!Array.isArray(save.aiLayouts)||!Array.isArray(save.aiPresets))throw new Error('Skill / Passive / AI Save Bridge: Formal AI collections are required.');
    assertNoLegacyFallback(save);
    const characters=save.characters.map((character,index)=>{
      if(!isObject(character))throw new Error(`Skill / Passive / AI Save Bridge: characters[${index}] object is required.`);
      const characterId=String(character.id||'');if(!characterId)throw new Error(`Skill / Passive / AI Save Bridge: characters[${index}].id is required.`);
      if(!Array.isArray(character.skills))throw new Error(`Skill / Passive / AI Save Bridge: characters[${index}].skills array is required.`);
      if(typeof character.equippedSkillId!=='string')throw new Error(`Skill / Passive / AI Save Bridge: characters[${index}].equippedSkillId string is required.`);
      if(!own(character,'formalAiBinding'))throw new Error(`Skill / Passive / AI Save Bridge: characters[${index}].formalAiBinding is required.`);
      return{
        characterId,
        skills:clone(character.skills),
        equippedSkillId:character.equippedSkillId,
        passiveIds:optionalField(character,'passiveIds'),
        skillLoadoutIds:optionalField(character,'skillLoadoutIds'),
        formalAiBinding:clone(character.formalAiBinding)
      };
    });
    return{characters,aiPrograms:clone(save.aiPrograms),aiLayouts:clone(save.aiLayouts),aiPresets:clone(save.aiPresets)};
  }
  function assertCapturedPreserved(expected,after){
    const actual=capture(after);
    if(!same(expected,actual)){
      const error=new Error('Skill / Passive / AI Save Bridge: Skill / Passive / Loadout / Formal AI state changed across Save/Load boundary.');
      error.code='SKILL_PASSIVE_AI_PERSISTENCE_MISMATCH';error.expected=clone(expected);error.actual=actual;throw error;
    }
    return actual;
  }
  function assertPreserved(before,after){return assertCapturedPreserved(capture(before),after);}
  return Object.freeze({LEGACY_CHARACTER_AI_KEYS,OPTIONAL_CHARACTER_DOMAIN_KEYS,capture,assertCapturedPreserved,assertPreserved,assertNoLegacyFallback});
});
