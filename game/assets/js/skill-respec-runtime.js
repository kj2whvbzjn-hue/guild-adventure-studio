(function(root,factory){
  const Acquisition=typeof module==='object'&&module.exports?require('./skill-acquisition-runtime.js'):root?.GKGameSkillAcquisitionRuntime;
  const api=factory(Acquisition);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameSkillRespecRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Acquisition){
  'use strict';
  if(!Acquisition)throw new Error('Skill Acquisition Runtime is required');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  function integer(value,path,{min=0}={}){const n=Number(value);if(!Number.isInteger(n)||n<min)throw new Error(`${path} must be an integer >= ${min}`);return n;}
  function normalizeBalance(value){
    if(!isObject(value)||!isObject(value.respec_gold))throw new Error('respec_gold balance is required');
    return Object.freeze({skill:integer(value.respec_gold.skill,'respec_gold.skill',{min:1}),passive:integer(value.respec_gold.passive,'respec_gold.passive',{min:1}),all:integer(value.respec_gold.all,'respec_gold.all',{min:1})});
  }
  function normalizeSave(save){
    if(!isObject(save)||!isObject(save.guild))throw new Error('save.guild is required');
    save.guild.gold=integer(save.guild.gold,'save.guild.gold',{min:0});return save;
  }
  function normalizeCharacter(character){return Acquisition.normalizeCharacterState(character);}
  function costFor(kind,balanceValue){const b=normalizeBalance(balanceValue);if(!['skill','passive','all'].includes(kind))throw new Error(`unsupported respec kind: ${kind}`);return b[kind];}
  function affordability(save,cost){normalizeSave(save);return{ok:save.guild.gold>=cost,goldBefore:save.guild.gold,goldAfter:save.guild.gold>=cost?save.guild.gold-cost:save.guild.gold,cost};}
  function refundFor(character,kind,id){return Acquisition.spentSkillPoints(character,kind,id);}
  function removeSkillReferences(character,id){
    character.skills=character.skills.filter(x=>x!==id);if(String(character.equippedSkillId||'')===id)character.equippedSkillId=character.skills[0]||'';
    if(Array.isArray(character.skillLoadoutIds))character.skillLoadoutIds=character.skillLoadoutIds.filter(x=>String(x)!==id);
  }
  function validatePassiveRemoval(character,nextPassiveIds,validateAfterRemoval){
    if(typeof validateAfterRemoval!=='function')return{ok:true};
    const candidate=clone(character);candidate.passiveIds=[...nextPassiveIds];
    try{const result=validateAfterRemoval(candidate);if(result===false)return{ok:false,reason:'STATE_DEPENDENCY_BLOCKED'};if(result&&result.ok===false)return{ok:false,reason:result.reason||'STATE_DEPENDENCY_BLOCKED',detail:result};return{ok:true};}
    catch(error){return{ok:false,reason:error?.code||'STATE_DEPENDENCY_BLOCKED',error:String(error?.message||error)};}
  }
  function previewIndividual(save,character,kind,id,balanceValue,{validateAfterRemoval}={}){
    normalizeSave(save);normalizeCharacter(character);const target=String(id||'').trim();if(!target)return{ok:false,reason:'ID_REQUIRED'};
    const owned=kind==='skill'?character.skills:kind==='passive'?character.passives:null;if(!owned)return{ok:false,reason:'RESPEC_KIND_INVALID'};if(!owned.includes(target))return{ok:false,reason:kind==='skill'?'SKILL_NOT_OWNED':'PASSIVE_NOT_OWNED',id:target};
    if(kind==='passive'){const checked=validatePassiveRemoval(character,character.passiveIds.filter(x=>x!==target),validateAfterRemoval);if(!checked.ok)return{...checked,id:target};}
    const cost=costFor(kind,balanceValue),funds=affordability(save,cost);if(!funds.ok)return{ok:false,reason:'GOLD_SHORTAGE',id:target,kind,...funds};
    const skillPointsRefund=refundFor(character,kind,target),skillPointsBefore=character.skillPoints;
    return{ok:true,id:target,kind,...funds,skillPointsRefund,skillPointsBefore,skillPointsAfter:skillPointsBefore+skillPointsRefund};
  }
  function respecIndividual(save,character,kind,id,balanceValue,options={}){
    const preview=previewIndividual(save,character,kind,id,balanceValue,options);if(!preview.ok)return{...preview,changed:false};
    if(kind==='skill')removeSkillReferences(character,preview.id);else{character.passives=character.passives.filter(x=>x!==preview.id);character.passiveIds=character.passiveIds.filter(x=>x!==preview.id);}
    if(character.skillPointSpend?.[kind])delete character.skillPointSpend[kind][preview.id];
    character.skillPoints=preview.skillPointsAfter;save.guild.gold=preview.goldAfter;return{...preview,changed:true};
  }
  function previewAll(save,character,balanceValue,{validateAfterRemoval}={}){
    normalizeSave(save);normalizeCharacter(character);const skillIds=[...character.skills],passiveIds=[...character.passives];if(!skillIds.length&&!passiveIds.length)return{ok:false,reason:'NOTHING_TO_RESPEC'};
    const checked=validatePassiveRemoval(character,[],validateAfterRemoval);if(!checked.ok)return{...checked,skillIds,passiveIds};
    const cost=costFor('all',balanceValue),funds=affordability(save,cost);if(!funds.ok)return{ok:false,reason:'GOLD_SHORTAGE',kind:'all',skillIds,passiveIds,...funds};
    const refundById={skill:Object.fromEntries(skillIds.map(id=>[id,refundFor(character,'skill',id)])),passive:Object.fromEntries(passiveIds.map(id=>[id,refundFor(character,'passive',id)]))};
    const skillPointsRefund=[...Object.values(refundById.skill),...Object.values(refundById.passive)].reduce((sum,value)=>sum+value,0),skillPointsBefore=character.skillPoints;
    return{ok:true,kind:'all',skillIds,passiveIds,...funds,refundById,skillPointsRefund,skillPointsBefore,skillPointsAfter:skillPointsBefore+skillPointsRefund};
  }
  function respecAll(save,character,balanceValue,options={}){
    const preview=previewAll(save,character,balanceValue,options);if(!preview.ok)return{...preview,changed:false};
    character.skills=[];character.equippedSkillId='';if(Array.isArray(character.skillLoadoutIds))character.skillLoadoutIds=[];character.passives=[];character.passiveIds=[];character.skillPointSpend={skill:{},passive:{}};character.skillPoints=preview.skillPointsAfter;save.guild.gold=preview.goldAfter;
    return{...preview,changed:true};
  }
  return Object.freeze({normalizeBalance,costFor,refundFor,previewIndividual,respecIndividual,previewAll,respecAll});
});
