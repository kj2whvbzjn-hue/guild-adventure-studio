(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameCharacterGuildProgressionSaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CHARACTER_STATE_KEYS=Object.freeze(['id','name','level','job','stats','jobHistory','growthHistory','createdAt']);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function assertRoot(save){
    if(!isObject(save))throw new Error('Domain Save Bridge: save root object is required.');
    if(!Array.isArray(save.characters))throw new Error('Domain Save Bridge: characters array is required.');
    if(!Array.isArray(save.partyIds))throw new Error('Domain Save Bridge: partyIds array is required.');
    if(!isObject(save.guild))throw new Error('Domain Save Bridge: guild object is required.');
  }
  function captureCharacter(character,index){
    if(!isObject(character))throw new Error(`Domain Save Bridge: characters[${index}] object is required.`);
    const state={};
    for(const key of CHARACTER_STATE_KEYS){
      if(!own(character,key))throw new Error(`Domain Save Bridge: characters[${index}].${key} is required.`);
      state[key]=clone(character[key]);
    }
    return state;
  }
  function capture(save){
    assertRoot(save);
    return{
      characters:save.characters.map(captureCharacter),
      partyIds:clone(save.partyIds),
      guild:clone(save.guild)
    };
  }
  function assertPreserved(before,after){
    const expected=capture(before),actual=capture(after);
    if(!same(expected,actual)){
      const error=new Error('Domain Save Bridge: Character / Guild / Progression state changed across Save/Load boundary.');
      error.code='CHARACTER_GUILD_PROGRESSION_PERSISTENCE_MISMATCH';
      error.expected=expected;error.actual=actual;throw error;
    }
    return actual;
  }
  return Object.freeze({CHARACTER_STATE_KEYS,capture,assertPreserved});
});
