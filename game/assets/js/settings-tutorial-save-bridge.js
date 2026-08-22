(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameSettingsTutorialSaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ROOT_STATE_KEYS=Object.freeze(['gameSettings','tutorialProgress']);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function optionalObject(save,key){
    if(!own(save,key))return{present:false};
    if(!isObject(save[key]))throw new Error(`Settings / Tutorial Save Bridge: ${key} object is required when present.`);
    return{present:true,value:clone(save[key])};
  }
  function capture(save){
    if(!isObject(save))throw new Error('Settings / Tutorial Save Bridge: save root object is required.');
    return{
      gameSettings:optionalObject(save,'gameSettings'),
      tutorialProgress:optionalObject(save,'tutorialProgress')
    };
  }
  function assertCapturedPreserved(expected,after){
    const actual=capture(after);
    if(!same(expected,actual)){
      const error=new Error('Settings / Tutorial Save Bridge: Game Settings / Tutorial progress changed across Save/Load boundary.');
      error.code='SETTINGS_TUTORIAL_PERSISTENCE_MISMATCH';error.expected=clone(expected);error.actual=actual;throw error;
    }
    return actual;
  }
  function assertPreserved(before,after){return assertCapturedPreserved(capture(before),after);}
  return Object.freeze({ROOT_STATE_KEYS,capture,assertCapturedPreserved,assertPreserved});
});
