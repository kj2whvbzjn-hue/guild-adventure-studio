(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameInventoryEquipmentSaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function capture(save){
    if(!isObject(save))throw new Error('Inventory / Equipment Save Bridge: save root object is required.');
    if(!Array.isArray(save.inventory))throw new Error('Inventory / Equipment Save Bridge: inventory array is required.');
    if(!Array.isArray(save.characters))throw new Error('Inventory / Equipment Save Bridge: characters array is required.');
    const characterEquipment=save.characters.map((character,index)=>{
      if(!isObject(character))throw new Error(`Inventory / Equipment Save Bridge: characters[${index}] object is required.`);
      const characterId=String(character.id||'');
      if(!characterId)throw new Error(`Inventory / Equipment Save Bridge: characters[${index}].id is required.`);
      if(!isObject(character.equipment))throw new Error(`Inventory / Equipment Save Bridge: characters[${index}].equipment object is required.`);
      return{characterId,equipment:clone(character.equipment),weaponStyle:character.weaponStyle==null?null:String(character.weaponStyle)};
    });
    return{inventory:clone(save.inventory),characterEquipment};
  }
  function assertCapturedPreserved(expected,after){
    const actual=capture(after);
    if(!same(expected,actual)){
      const error=new Error('Inventory / Equipment Save Bridge: ownership state changed across Save/Load boundary.');
      error.code='INVENTORY_EQUIPMENT_OWNERSHIP_PERSISTENCE_MISMATCH';
      error.expected=clone(expected);error.actual=actual;throw error;
    }
    return actual;
  }
  function assertPreserved(before,after){return assertCapturedPreserved(capture(before),after);}
  return Object.freeze({capture,assertCapturedPreserved,assertPreserved});
});
