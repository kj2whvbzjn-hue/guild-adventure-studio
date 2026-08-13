/* GKS Generic Skill Budget Engine — G04. Versioned, traceable authoring budget calculation. */
(function(root){
'use strict';
const VERSION='G04';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const num=v=>finite(v)?v:0;
const round=(v,d=2)=>{const p=10**d;return Math.round((v+Number.EPSILON)*p)/p};
function assertRules(rules){if(!rules||typeof rules!=='object')throw new Error('Skill Budget Rulesが必要です');if(!rules.budgetRuleVersion)throw new Error('budgetRuleVersionが必要です');return rules;}
async function loadRules({force=false,url='../assets/shared/config/skill-budget-rules.json'}={}){if(!force&&root.__GKS_SKILL_BUDGET_RULES__)return clone(root.__GKS_SKILL_BUDGET_RULES__);const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`Skill Budget Rules読込失敗: ${r.status}`);const rules=await r.json();assertRules(rules);root.__GKS_SKILL_BUDGET_RULES__=clone(rules);return clone(rules);}
function effectRegistryWeight(registry,effect){if(effect?.type!=='APPLY'||!effect?.effectId)return 1;const w=registry?.effects?.[effect.effectId]?.budgetWeight;return finite(w)&&w>0?w:1;}
function calcEffectCost(effect,rules,registry,trace){const type=String(effect?.type||'').toUpperCase(),def=rules.effect_type?.[type];if(!def)throw new Error(`Budget未定義Effect type: ${type||'(なし)'}`);if(def.disabled)throw new Error(`Budget対象外Effect type: ${type}`);const regWeight=effectRegistryWeight(registry,effect),weight=num(def.weight)||1;let raw=num(def.base_cost);
 const add=(name,value)=>{if(value){raw+=value;trace.push({kind:'effect_component',effect:type,component:name,value:round(value)});}};
 if(finite(effect?.power))add('power',Math.abs(effect.power)/(def.power_divisor||10));
 if(finite(effect?.amount))add('amount',Math.abs(effect.amount)/(def.amount_divisor||10));
 if(finite(effect?.duration))add('duration',Math.max(0,effect.duration)/(def.duration_divisor||100));
 if(finite(effect?.hp))add('hp',Math.max(0,effect.hp)/(def.hp_divisor||10));
 if(finite(effect?.hpRate))add('hpRate',Math.max(0,effect.hpRate)*(def.hp_rate_scale||30));
 if(finite(effect?.uses))add('uses',Math.max(0,effect.uses)*(def.uses_cost||0));
 const cost=raw*weight*regWeight;trace.push({kind:'effect_cost',effect:type,effectId:effect?.effectId||null,base:def.base_cost,ruleWeight:weight,registryEffectWeight:regWeight,raw:round(raw),cost:round(cost)});return cost;}
function calculate(skill,rules,registry,{manualOverride=false,overrideReason=''}={}){rules=assertRules(rules);skill=skill&&typeof skill==='object'?skill:{};const trace=[],errors=[];const levelRaw=Number(skill.skillLevel??skill.skill_level??1),level=Math.min(rules.limit.max_skill_level,Math.max(rules.limit.min_skill_level,Number.isFinite(levelRaw)?levelRaw:1));const limit=rules.limit.base+rules.limit.per_skill_level*level;trace.push({kind:'budget_limit',skillLevel:level,base:rules.limit.base,perSkillLevel:rules.limit.per_skill_level,limit:round(limit)});
 let effectCost=0;try{for(const effect of skill.effects||[])effectCost+=calcEffectCost(effect,rules,registry,trace);}catch(e){errors.push(e.message);}
 const range=String(skill.target?.range||'SINGLE').toUpperCase(),rangeMultiplier=rules.range_multiplier?.[range];if(!finite(rangeMultiplier))errors.push(`Budget未定義range: ${range}`);const rangedCost=effectCost*(finite(rangeMultiplier)?rangeMultiplier:1);trace.push({kind:'range',range,multiplier:finite(rangeMultiplier)?rangeMultiplier:1,before:round(effectCost),after:round(rangedCost)});
 const trigger=String(skill.trigger?.type||'ON_USE').toUpperCase(),triggerMultiplier=rules.trigger_multiplier?.[trigger];if(!finite(triggerMultiplier))errors.push(`Budget未定義trigger: ${trigger}`);const triggeredCost=rangedCost*(finite(triggerMultiplier)?triggerMultiplier:1);trace.push({kind:'trigger',trigger,multiplier:finite(triggerMultiplier)?triggerMultiplier:1,before:round(rangedCost),after:round(triggeredCost)});
 const conditionCount=Array.isArray(skill.conditions)?skill.conditions.length:0,conditionRate=Math.min(rules.refund.condition_rate_cap,conditionCount*rules.refund.condition_rate_each),conditionRefund=triggeredCost*conditionRate;trace.push({kind:'condition_refund',conditionCount,rate:round(conditionRate),refund:round(conditionRefund)});
 const mpCost=Math.max(0,num(skill.resource?.mpCost)),mpRefund=Math.min(rules.refund.mp_refund_cap,mpCost*rules.refund.mp_per_point);trace.push({kind:'mp_refund',mpCost,refund:round(mpRefund)});
 const cooldown=Math.max(0,num(skill.resource?.cooldown)),cooldownRefund=Math.min(rules.refund.cooldown_refund_cap,(cooldown/100)*rules.refund.cooldown_per_100_ticks);trace.push({kind:'cooldown_refund',cooldown,refund:round(cooldownRefund)});
 const finalCost=Math.max(0,triggeredCost-conditionRefund-mpRefund-cooldownRefund),withinBudget=finalCost<=limit;let overrideApplied=false,overrideAudit=null;if(manualOverride){const reason=String(overrideReason||'').trim(),min=rules.manual_override?.minimum_reason_length??1;if(rules.manual_override?.allowed!==true)errors.push('Budget manual overrideは無効です');else if(rules.manual_override?.reason_required&&reason.length<min)errors.push(`Budget manual override理由は${min}文字以上必要です`);else{overrideApplied=true;overrideAudit={applied:true,reason,budgetRuleVersion:rules.budgetRuleVersion,originalWithinBudget:withinBudget,originalCost:round(finalCost),limit:round(limit)};trace.push({kind:'manual_override',...overrideAudit});}}
 const accepted=errors.length===0&&(withinBudget||overrideApplied);if(!withinBudget&&!overrideApplied)errors.push(`SKILL_BUDGET_EXCEEDED cost=${round(finalCost)} limit=${round(limit)}`);
 return{ok:accepted,budgetRuleVersion:rules.budgetRuleVersion,skillLevel:level,cost:round(finalCost,rules.rounding?.digits??2),limit:round(limit,rules.rounding?.digits??2),withinBudget,manualOverrideApplied:overrideApplied,manualOverrideAudit:overrideAudit,calculationTrace:trace,errors};}
const api=Object.freeze({VERSION,loadRules,calculate});root.GKSSkillBudgetEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
