/* GKS Formal Passive Compiler.
 * Authoring/Master -> runtimeContracts only. Game Runtime consumes compiled contracts and never recompiles Passive authoring data.
 */
(function(root,factory){
  const api=factory(
    typeof require==='function'?require('./formal-contribution-resolver.js'):root.GKSFormalContribution,
    typeof require==='function'?require('./skill-compiler.js'):root.GKSSkillCompiler
  );
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSFormalPassiveCompiler=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FormalContribution,SkillCompiler){
  'use strict';
  const VERSION='FORMAL-PASSIVE-1';
  const STATS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
  const DISPATCH=Object.freeze(['RESOLVE_ONLY','COUNTER','FOLLOW_UP','AURA','ACTION']);
  const TARGET_MODES=Object.freeze(['EVENT_CONTEXT','FORMAL_TARGET']);
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
  function req(v,label){const s=String(v??'').trim();if(!s)throw new Error(label+'が必要です。');return s}
  function normalizeRequirements(value,label){
    if(value==null)return[];if(!Array.isArray(value))throw new Error(label+'は配列で指定してください。');
    const rows=value.map((c,i)=>{if(!object(c))throw new Error(`${label}[${i}]が不正です。`);const stat=req(c.stat,`${label}[${i}].stat`).toUpperCase();if(!STATS.includes(stat))throw new Error(`${label}[${i}].statが不正です: ${stat}`);const min=c.min;if(typeof min!=='number'||!Number.isFinite(min)||min<0)throw new Error(`${label}[${i}].minは0以上の有限numberが必要です。`);return{stat,min};});
    return rows;
  }
  function aggregateRequirements(rows){const map=new Map();for(const row of rows)map.set(row.stat,(map.get(row.stat)||0)+row.min);return STATS.filter(s=>map.has(s)).map(stat=>({stat,min:map.get(stat)}))}
  function sameRequirements(a,b){const aa=aggregateRequirements(a),bb=aggregateRequirements(b);return JSON.stringify(aa)===JSON.stringify(bb)}
  function skillMapOf(input){if(input instanceof Map)return input;const rows=Array.isArray(input)?input:Object.values(input||{});return new Map(rows.filter(Boolean).map(row=>[String(row.id||''),row]))}
  function registryTrigger(registry,type){const def=registry?.triggers?.[type];if(!def||typeof def!=='object'||def.enabled===false)throw new Error(`Passive Trigger Registryに有効定義がありません: ${type}`);return def}
  function compileTarget(raw){
    if(raw==null)return null;if(!object(raw))throw new Error('passive.params.targetはobjectで指定してください。');
    const mode=req(raw.mode,'passive.params.target.mode').toUpperCase();if(!TARGET_MODES.includes(mode))throw new Error(`Passive target.modeは未対応です: ${mode}`);
    if(mode==='EVENT_CONTEXT')return{mode,eventTarget:req(raw.eventTarget,'passive.params.target.eventTarget').toUpperCase()};
    const side=req(raw.side,'passive.params.target.side').toUpperCase(),range=req(raw.range,'passive.params.target.range').toUpperCase();
    return{mode,side,range,randomCount:raw.randomCount??null,excludeSelf:raw.excludeSelf===true};
  }
  function compilePassive(record,options={}){
    if(!FormalContribution?.validateFormalPassive)throw new Error('Formal Contribution Resolverが必要です。');
    const checked=FormalContribution.validateFormalPassive(record,{...(options.validation||{}),requireRuntimeContracts:false});
    const params=object(checked.params)?checked.params:{};
    const registry=options.registry||{};
    const skills=skillMapOf(options.skills||options.skillById||[]);
    const triggerRaw=params.trigger==null?null:params.trigger;
    let triggerContract=null,triggerRequirements=[];
    if(triggerRaw!=null){
      if(!object(triggerRaw))throw new Error('passive.params.triggerはobjectで指定してください。');
      const type=req(triggerRaw.type,'passive.params.trigger.type').toUpperCase(),def=registryTrigger(registry,type);
      const allowed=Array.isArray(def.allowed_scopes)?def.allowed_scopes.map(x=>String(x).toUpperCase()):[];
      const scope=String(triggerRaw.scope||'SELF').toUpperCase();if(allowed.length&&!allowed.includes(scope))throw new Error(`Passive ${checked.id}のTrigger scopeは未対応です: ${scope}`);
      const defaultDispatch=String(def.dispatch_mode||'RESOLVE_ONLY').toUpperCase();
      const allowedDispatch=Array.isArray(def.allowed_dispatch_modes)?def.allowed_dispatch_modes.map(x=>String(x).toUpperCase()):[defaultDispatch];
      const dispatchMode=String(triggerRaw.dispatchMode||defaultDispatch).toUpperCase();if(!DISPATCH.includes(dispatchMode)||!allowedDispatch.includes(dispatchMode))throw new Error(`Passive ${checked.id}のdispatchModeはRegistryで許可されていません: ${dispatchMode}`);
      triggerRequirements=normalizeRequirements(triggerRaw.thresholdRequirements,'passive.params.trigger.thresholdRequirements');
      triggerContract={type,scope,engineEvent:req(def.engine_event,`registry.triggers.${type}.engine_event`),dispatchMode,priority:Number.isInteger(triggerRaw.priority)?triggerRaw.priority:0,...(def.phase?{phase:String(def.phase).toUpperCase()}:{}),thresholdRequirements:clone(triggerRequirements)};
      if(Object.prototype.hasOwnProperty.call(triggerRaw,'activationChance')){const chance=triggerRaw.activationChance;if(typeof chance!=='number'||!Number.isFinite(chance)||chance<0||chance>1)throw new Error(`Passive ${checked.id}のactivationChanceは0以上1以下の有限numberが必要です。`);triggerContract.activationChance=chance;}
      if(Object.prototype.hasOwnProperty.call(triggerRaw,'cooldownTicks')){const cooldownTicks=triggerRaw.cooldownTicks;if(!Number.isInteger(cooldownTicks)||cooldownTicks<0)throw new Error(`Passive ${checked.id}のcooldownTicksは0以上の整数が必要です。`);triggerContract.cooldownTicks=cooldownTicks;}
      if(Object.prototype.hasOwnProperty.call(triggerRaw,'surviveHp')){const surviveHp=triggerRaw.surviveHp;if(!Number.isInteger(surviveHp)||surviveHp<1)throw new Error(`Passive ${checked.id}のsurviveHpは1以上の整数が必要です。`);if(type!=='ON_FATAL_DAMAGE')throw new Error(`Passive ${checked.id}のsurviveHpはON_FATAL_DAMAGEだけで使用できます。`);triggerContract.surviveHp=surviveHp;}
    }
    let periodicContract=null;
    if(params.periodic!=null){
      if(!object(params.periodic))throw new Error('passive.params.periodicはobjectで指定してください。');
      const resource=req(params.periodic.resource,'passive.params.periodic.resource').toUpperCase();
      if(!['HP','MP'].includes(resource))throw new Error(`Passive ${checked.id}のperiodic.resourceはHP/MPだけを使用できます: ${resource}`);
      const intervalTicks=params.periodic.intervalTicks;
      if(!Number.isInteger(intervalTicks)||intervalTicks<1)throw new Error(`Passive ${checked.id}のperiodic.intervalTicksは1以上の整数が必要です。`);
      const initialDelayTicks=Object.prototype.hasOwnProperty.call(params.periodic,'initialDelayTicks')?params.periodic.initialDelayTicks:intervalTicks;
      if(!Number.isInteger(initialDelayTicks)||initialDelayTicks<1)throw new Error(`Passive ${checked.id}のperiodic.initialDelayTicksは1以上の整数が必要です。`);
      const recoveryRate=params.periodic.recoveryRate;
      if(typeof recoveryRate!=='number'||!Number.isFinite(recoveryRate)||recoveryRate<=0||recoveryRate>1)throw new Error(`Passive ${checked.id}のperiodic.recoveryRateは0より大きく1以下の有限numberが必要です。`);
      periodicContract={resource,intervalTicks,initialDelayTicks,recoveryRate};
    }
    let lowHpContract=null;
    if(params.lowHp!=null){
      if(!object(params.lowHp))throw new Error('passive.params.lowHpはobjectで指定してください。');
      const hpThresholdRate=params.lowHp.hpThresholdRate;
      if(typeof hpThresholdRate!=='number'||!Number.isFinite(hpThresholdRate)||hpThresholdRate<=0||hpThresholdRate>1)throw new Error(`Passive ${checked.id}のlowHp.hpThresholdRateは0より大きく1以下の有限numberが必要です。`);
      const durationTicks=params.lowHp.durationTicks;
      if(!Number.isInteger(durationTicks)||durationTicks<1)throw new Error(`Passive ${checked.id}のlowHp.durationTicksは1以上の整数が必要です。`);
      const cooldownTicks=params.lowHp.cooldownTicks;
      if(!Number.isInteger(cooldownTicks)||cooldownTicks<0)throw new Error(`Passive ${checked.id}のlowHp.cooldownTicksは0以上の整数が必要です。`);
      const relativeBonus=params.lowHp.relativeBonus;
      if(typeof relativeBonus!=='number'||!Number.isFinite(relativeBonus)||relativeBonus<=0)throw new Error(`Passive ${checked.id}のlowHp.relativeBonusは0より大きい有限numberが必要です。`);
      const contributionTargets=Object.freeze(['PHYSICAL_DAMAGE','MAGIC_DAMAGE','ACCURACY','MAGIC_ACCURACY','EVASION','BLOCK_RATE','BLOCK_PERFORMANCE','CRITICAL_RATE','CRITICAL_DAMAGE','ACTION_GAUGE_GAIN']);
      lowHpContract={hpThresholdRate,durationTicks,cooldownTicks,relativeBonus,contributionTargets:[...contributionTargets]};
    }
    let executionContract=null,skillRequirements=[];
    if(params.execution!=null){
      if(!object(params.execution))throw new Error('passive.params.executionはobjectで指定してください。');
      const referencedSkillId=req(params.execution.referencedSkillId,'passive.params.execution.referencedSkillId');
      const skill=skills.get(referencedSkillId);if(!skill)throw new Error(`Passive ${checked.id}が参照するActive Skill Masterがありません: ${referencedSkillId}`);
      skillRequirements=normalizeRequirements(skill.abilityConditions,'activeSkill.abilityConditions');
      let runtime=skill.runtimeContracts;
      if(!runtime&&SkillCompiler?.compileSkill){const compiled=SkillCompiler.compileSkill(skill,registry);if(!compiled?.ok)throw new Error(`Referenced Active Skill ${referencedSkillId}をcompileできません: ${(compiled?.errors||[]).map(x=>x.message||x.code).join(' / ')}`);runtime=compiled.compiledSkill.runtimeContracts;}
      if(!runtime||typeof runtime!=='object')throw new Error(`Referenced Active Skill ${referencedSkillId}にruntimeContractsがありません。`);
      executionContract={referencedSkillId,effectContracts:clone(runtime.effectContracts||[]),applyContracts:clone(runtime.applyContracts||[]),auraEffectContract:clone(runtime.auraEffectContract||null)};
    }
    const finalRequirement=normalizeRequirements(params.ability_conditions,'passive.params.ability_conditions');
    const derivedSources=[...triggerRequirements,...skillRequirements];
    const consumed=derivedSources.length?aggregateRequirements(derivedSources):aggregateRequirements(finalRequirement);
    if(derivedSources.length&&!sameRequirements(finalRequirement,consumed))throw new Error(`Passive ${checked.id}のability_conditionsがTrigger+Referenced Skill Requirement合計と一致しません。`);
    const total=consumed.reduce((sum,row)=>sum+row.min,0);if(total>110)throw new Error(`Passive ${checked.id}の総Threshold消費${total}は上限110を超えています。`);
    const runtimeContracts={schemaVersion:1,registryPhase:String(registry?.phase||''),passiveSeriesId:checked.passiveSeriesId,abilityRequirementContracts:clone(finalRequirement),thresholdConsumption:{byStat:clone(consumed),total},triggerContract,targetContract:compileTarget(params.target),executionContract,periodicContract,lowHpContract,modifierRefs:{modIds:[...(params.mod_ids||[])],effectIds:[...(params.effect_ids||[])],combatCapabilities:[...(params.combat_capabilities||[])]}};
    return{ok:true,version:VERSION,compiledPassive:{...clone(checked),runtimeContracts}};
  }
  return Object.freeze({VERSION,STATS,DISPATCH,TARGET_MODES,normalizeRequirements,aggregateRequirements,compilePassive});
});
