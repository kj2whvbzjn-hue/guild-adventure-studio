/* GKS Legacy/Generic Runtime Comparison — R06-B validation only. No data mutation. */
(function(root){
'use strict';
const VERSION='R06-B';
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o}return v}
function stripEphemeral(v){
 if(Array.isArray(v))return v.map(stripEphemeral);
 if(!v||typeof v!=='object')return v;
 const out={};
 for(const [k,val] of Object.entries(v)){
  if(['instanceId','sequence','id','appliedAt','appliedTick','expiresAt','expiresTick','nextTick','genericRuntime','effectContract','calculatedDamage','lifecyclePolicy'].includes(k))continue;
  out[k]=stripEphemeral(val);
 }
 return out;
}
function normalizeUnit(unit){
 if(!unit||typeof unit!=='object')return null;
 const keys=['alive','hp','maxHp','mp','maxMp','damageDealt','damageTaken','actionDisabled','statusEffects','dotStacks','modifierStacks','shieldEffects','coverEffects','cooldowns'];
 const out={};for(const k of keys)if(Object.prototype.hasOwnProperty.call(unit,k))out[k]=stripEphemeral(clone(unit[k]));return stable(out);
}
function normalizeExecution(result){
 if(!result||typeof result!=='object')return result;
 const out={ok:!!result.ok,stage:result.stage||null,reason:result.reason||null,targetResults:[]};
 const rows=Array.isArray(result.targetResults)?result.targetResults:[];
 out.targetResults=rows.map(r=>stable(stripEphemeral({covered:!!r.covered,attackResult:r.attackResult,healResult:r.healResult,shieldResult:r.shieldResult,dotResult:r.dotResult,modifierResult:r.modifierResult,statusResult:r.statusResult,cleanseResult:r.cleanseResult,reviveResult:r.reviveResult,coverApplyResult:r.coverApplyResult})));
 return out;
}
function compareRuntimeExecution({skillId='',legacyRun,genericRun}={}){
 const issues=[];
 if(typeof legacyRun!=='function')issues.push({code:'LEGACY_RUN_REQUIRED',message:'legacyRunが必要です'});
 if(typeof genericRun!=='function')issues.push({code:'GENERIC_RUN_REQUIRED',message:'genericRunが必要です'});
 if(issues.length)return{ok:false,version:VERSION,mode:'EXECUTION_COMPARE',skillId:String(skillId||''),issues};
 let legacy,generic;try{legacy=legacyRun()}catch(e){issues.push({code:'LEGACY_RUN_EXCEPTION',message:e?.message||String(e)})}
 try{generic=genericRun()}catch(e){issues.push({code:'GENERIC_RUN_EXCEPTION',message:e?.message||String(e)})}
 if(issues.length)return{ok:false,version:VERSION,mode:'EXECUTION_COMPARE',skillId:String(skillId||''),issues,legacy:legacy||null,generic:generic||null};
 const ln={source:normalizeUnit(legacy.source),target:normalizeUnit(legacy.target),execution:normalizeExecution(legacy.result)},gn={source:normalizeUnit(generic.source),target:normalizeUnit(generic.target),execution:normalizeExecution(generic.result)};
 if(JSON.stringify(ln)!==JSON.stringify(gn))issues.push({code:'RUNTIME_RESULT_MISMATCH',message:'Legacy実行とGeneric実行の正規化結果が一致しません',detail:{legacy:ln,generic:gn}});
 return{ok:issues.length===0,version:VERSION,mode:'EXECUTION_COMPARE',skillId:String(skillId||''),issues,legacy:ln,generic:gn};
}
const api={VERSION,normalizeUnit,normalizeExecution,compareRuntimeExecution};root.GKSLegacyGenericRuntimeCompare=Object.freeze(api);if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
