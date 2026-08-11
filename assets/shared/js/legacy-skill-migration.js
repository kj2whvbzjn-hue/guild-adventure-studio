/* GKS Legacy Skill Migration — R06-A dry-run only. No data mutation. */
(function(root){
'use strict';
const VERSION='R06-A';
function own(o,k){return Object.prototype.hasOwnProperty.call(o||{},k)}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function upper(v){return String(v==null?'':v).toUpperCase()}
function sortedTags(skill){return (Array.isArray(skill?.tags)?skill.tags:[]).map(x=>String(x).trim()).filter(Boolean).sort()}
function issue(code,message,detail){return{code,message,...(detail?{detail}: {})}}
function reverseMap(obj,value){for(const [k,v] of Object.entries(obj||{}))if(v===value)return k;return null}
function numericConditionMap(registry){const out={};for(const [property,def] of Object.entries(registry?.conditions||{}))if(def?.legacy_tag)out[String(def.legacy_tag).toUpperCase()]={property,def};return out}
function effectCandidates(registry,kind,predicate){return Object.entries(registry?.effects||{}).filter(([,d])=>d?.kind===kind&&(!predicate||predicate(d))).map(([id])=>id)}
function chooseApplyEffect(compiled,registry,logic,issues){
 const p=compiled.definition?.parameters||{},rawContracts=compiled.definition?.genericRuntime?.applyContracts||[];
 const fromContract=rawContracts.find(x=>upper(x?.logic)===logic)?.effectId;if(fromContract&&registry.effects?.[fromContract])return fromContract;
 let ids=[];
 if(logic==='STATUS')ids=effectCandidates(registry,'STATUS',d=>String(d?.legacy?.statusId||'')===String(p.statusId||''));
 else if(logic==='BUFF')ids=effectCandidates(registry,'BUFF',d=>String(d?.legacy?.modifierStat||'')===String(p.modifierStat||''));
 else if(logic==='DEBUFF')ids=effectCandidates(registry,'DEBUFF',d=>String(d?.legacy?.modifierStat||'')===String(p.modifierStat||''));
 else if(logic==='SHIELD')ids=effectCandidates(registry,'SHIELD');
 else if(logic==='DOT')ids=effectCandidates(registry,'DOT');
 if(ids.length===1)return ids[0];
 issues.push(issue(ids.length?'APPLY_EFFECT_AMBIGUOUS':'APPLY_EFFECT_UNMAPPED',`${logic} を一意なGeneric Effectへ変換できません`,{candidates:ids,statusId:p.statusId||null,modifierStat:p.modifierStat||null}));return null;
}
function buildCandidate(skill,compiled,registry,issues){
 const d=compiled.definition||{},p=d.parameters||{},logic=Array.isArray(d.logicOrder)?d.logicOrder:[],sourceTags=new Set(Array.isArray(skill.tags)?skill.tags:[]),candidate={schemaVersion:1,id:String(skill.id||''),name:String(skill.name||''),trigger:{type:'ON_USE',scope:'SELF'},target:{side:null,range:null},effects:[],resource:{}};
 if(logic.includes('COUNTER'))candidate.trigger={type:'ON_HIT_RECEIVED',scope:'SELF',priority:Number.isInteger(p.counterPriority)?p.counterPriority:0};
 else if(logic.includes('FOLLOW_UP'))candidate.trigger={type:'ON_ALLY_ATTACK',scope:'SELF',priority:Number.isInteger(p.activationPriority)?p.activationPriority:0};
 else if(logic.includes('AURA'))candidate.trigger={type:'WHILE_SOURCE_ALIVE',scope:'SELF',priority:Number.isInteger(p.auraPriority)?p.auraPriority:0};
 if(logic.includes('AURA')){
  const side=p.auraTarget==='ally'?'ALLY':p.auraTarget==='enemy'?'ENEMY':null;candidate.target.side=side;candidate.target.range='ALL';if(p.auraScope==='allies_excluding_self')candidate.target.excludeSelf=true;
 }else{
  candidate.target.side=reverseMap(registry?.targets?.sides,{self:'自分',ally:'味方',enemy:'敵',corpse:'死体',point:'地点'}[String(d.target?.side||'')])||upper(d.target?.side);
  candidate.target.range=reverseMap(registry?.targets?.ranges,{single:'単体',all:'全体',front:'前列',back:'後列',random:'ランダム',pierce:'貫通'}[String(d.target?.range||'')])||upper(d.target?.range);
  if(candidate.target.range==='RANDOM'&&Number.isFinite(compiled.parsed?.numericTags?.RANDOM_COUNT?.value))candidate.target.randomCount=compiled.parsed.numericTags.RANDOM_COUNT.value;
 }
 if(!registry?.targets?.sides?.[candidate.target.side])issues.push(issue('TARGET_SIDE_UNMAPPED','対象sideをGenericへ変換できません',{legacy:d.target?.side||null}));
 if(!registry?.targets?.ranges?.[candidate.target.range])issues.push(issue('TARGET_RANGE_UNMAPPED','対象rangeをGenericへ変換できません',{legacy:d.target?.range||null}));
 const condMap=numericConditionMap(registry);candidate.conditions=[];
 for(const row of p.conditions||[]){const key=upper(row.key),mapped=condMap[key];if(!mapped){issues.push(issue('CONDITION_UNMAPPED',`${key} をGeneric Conditionへ変換できません`));continue}candidate.conditions.push({scope:'SELF',property:mapped.property,operator:row.operator,value:row.value});}
 if(sourceTags.has('CONDITION_POISONED'))candidate.conditions.push({scope:'TARGET',property:'TARGET_POISONED',operator:'=',value:true});
 if(logic.includes('ATTACK')||logic.includes('FOLLOW_UP')||logic.includes('COUNTER'))candidate.effects.push({type:'DAMAGE',power:p.damage,damageType:p.damageType?upper(p.damageType):undefined});
 if(logic.includes('HEAL'))candidate.effects.push({type:'HEAL',power:p.heal});
 if(logic.includes('CLEANSE'))candidate.effects.push({type:'REMOVE',category:'STATUS',...(p.cleanseAll?{all:true}:{count:p.cleanseCount})});
 if(logic.includes('REVIVE'))candidate.effects.push({type:'REVIVE',...(p.reviveHp!=null?{hp:p.reviveHp}:{hpRate:p.reviveHpRate})});
 if(logic.includes('COVER')){
  const lifetime=upper(p.coverLifetime);const e={type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:p.coverPriority,removable:String(p.coverRemovable)==='true',lifetime};if(lifetime==='USES')e.uses=p.coverUses;if(lifetime==='DURATION')e.duration=p.coverDuration;candidate.effects.push(e);
 }
 for(const applyLogic of ['DOT','BUFF','DEBUFF','SHIELD','STATUS'])if(logic.includes(applyLogic)){
  const effectId=chooseApplyEffect(compiled,registry,applyLogic,issues);if(!effectId)continue;const e={type:'APPLY',effectId};
  if(applyLogic==='DOT'){e.power=p.dotPower;e.duration=p.dotDuration;e.interval=p.dotInterval;e.stackGain=p.stackGain;}
  else if(applyLogic==='BUFF'||applyLogic==='DEBUFF'){e.power=p.modifierPower;e.duration=p.modifierDuration;e.stackGain=compiled.parsed?.numericTags?.STACK_GAIN?.value;}
  else if(applyLogic==='SHIELD'){e.power=p.shield;e.duration=p.shieldDuration;}
  else if(applyLogic==='STATUS'){e.duration=p.statusDuration;}
  if(logic.includes('AURA')){e.power=p.auraValue;delete e.duration;delete e.stackGain;}
  candidate.effects.push(e);
 }
 if(logic.includes('RESOURCE_CHANGE')){
  const c=(d.genericRuntime?.effectContracts||[]).find(x=>upper(x?.type)==='RESOURCE_CHANGE');if(c)candidate.effects.push({type:'RESOURCE_CHANGE',resource:upper(c.resource),amount:c.amount});else issues.push(issue('RESOURCE_CHANGE_CONTRACT_REQUIRED','Legacy RESOURCE_CHANGEはGeneric contractなしではamountを復元できません'));
 }
 const nt=compiled.parsed?.numericTags||{};if(nt.MP_COST)candidate.resource.mpCost=p.mpCost;if(nt.COOLDOWN)candidate.resource.cooldown=p.cooldown;if(nt.ACTIVATION_PRIORITY)candidate.resource.activationPriority=p.activationPriority;
 for(const e of candidate.effects)for(const k of Object.keys(e))if(e[k]===undefined)delete e[k];
 return candidate;
}
function dryRunLegacySkill(skill,{registry,legacyCompile,genericCompile}={}){
 const issues=[],warnings=[];
 if(!registry||typeof registry!=='object')issues.push(issue('REGISTRY_REQUIRED','Generic Skill Registryが必要です'));
 if(typeof legacyCompile!=='function')issues.push(issue('LEGACY_COMPILER_REQUIRED','legacyCompileが必要です'));
 if(typeof genericCompile!=='function')issues.push(issue('GENERIC_COMPILER_REQUIRED','genericCompileが必要です'));
 if(!skill||typeof skill!=='object'||Array.isArray(skill))issues.push(issue('INVALID_SKILL','Legacy Skill objectが必要です'));
 if(issues.length)return result(null,null,null);
 let legacy;try{legacy=legacyCompile(skill)}catch(e){issues.push(issue('LEGACY_COMPILE_EXCEPTION',e?.message||String(e)));return result(null,null,null)}
 if(!legacy?.ok){issues.push(issue('LEGACY_COMPILE_REJECTED','現行Legacy compilerがSkillを受理しません',{errors:clone(legacy?.errors||[])}));return result(null,legacy,null)}
 const candidate=buildCandidate(skill,legacy,registry,issues);
 let roundtrip=null;
 if(!issues.length){try{roundtrip=genericCompile(candidate,registry,legacyCompile)}catch(e){issues.push(issue('GENERIC_COMPILE_EXCEPTION',e?.message||String(e)))}}
 if(roundtrip&&!roundtrip.ok)issues.push(issue('GENERIC_COMPILE_REJECTED','Generic変換候補がcompilerを通過しません',{errors:clone(roundtrip.errors||[])}));
 if(roundtrip?.ok){const before=sortedTags(skill),after=sortedTags(roundtrip.legacySkill);if(JSON.stringify(before)!==JSON.stringify(after)){issues.push(issue('TAG_ROUNDTRIP_MISMATCH','Generic往復後のLegacyタグが一致しません',{before,after,missing:before.filter(x=>!after.includes(x)),added:after.filter(x=>!before.includes(x))}));}}
 return result(candidate,legacy,roundtrip);
 function result(candidate,legacy,roundtrip){return{ok:issues.length===0,version:VERSION,mode:'DRY_RUN',mutated:false,skillId:String(skill?.id||''),issues,warnings,genericSkill:candidate?clone(candidate):null,legacyValidation:legacy?{ok:!!legacy.ok,errors:clone(legacy.errors||[])}:null,roundtripValidation:roundtrip?{ok:!!roundtrip.ok,errors:clone(roundtrip.errors||[])}:null}}
}
function dryRunLegacySkills(skills,opts={}){const rows=(Array.isArray(skills)?skills:[]).map(s=>dryRunLegacySkill(s,opts)),ok=rows.filter(x=>x.ok).length;return{version:VERSION,mode:'DRY_RUN',mutated:false,summary:{total:rows.length,convertible:ok,blocked:rows.length-ok},items:rows}}
const api={VERSION,dryRunLegacySkill,dryRunLegacySkills};root.GKSLegacySkillMigration=Object.freeze(api);if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
