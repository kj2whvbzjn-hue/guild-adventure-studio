(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSFormalContribution=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EQUIPMENT_FIELDS=Object.freeze(['attack','accuracy','magic_weapon_bonus','weapon_critical_rate','block_rate','block_damage_cut_rate','hp_bonus','mp_bonus','evasion']);
  const BLOCK_FIELDS=Object.freeze(['block_rate','block_damage_cut_rate']);
  const ADDITIVE_EQUIPMENT_FIELDS=Object.freeze(EQUIPMENT_FIELDS.filter(k=>!BLOCK_FIELDS.includes(k)));
  const REQUIREMENT_FIELDS=Object.freeze(['required_str','required_dex','required_int','required_vit','required_mnd','required_agi']);
  const MOD_FIELDS=Object.freeze(['id','category','tags','effect_type','target','operation','parameters','balance_key','enabled','schema_version']);
  const PASSIVE_STATS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
  const PASSIVE_COMBAT_CAPABILITIES=Object.freeze(['DUAL_WIELD']);
  const PASSIVE_COMBAT_CAPABILITY_OWNER=Object.freeze({DUAL_WIELD:'PAS-DUAL-WIELD-001'});
  const NUMERIC_OPERATIONS=Object.freeze(['RELATIVE_PERCENT','FLAT_ADD','ADDITIVE_POINT','SUBTRACTIVE_POINT']);
  const TARGET_TO_FIELD=Object.freeze({ATTACK:'attack',ACCURACY:'accuracy',MAGIC_WEAPON_BONUS:'magic_weapon_bonus',HP_BONUS:'hp_bonus',MP_BONUS:'mp_bonus',EVASION:'evasion'});
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
  function req(v,label){const s=String(v??'').trim();if(!s)throw new Error(label+'が必要です。');return s}
  function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+'は有限なnumber型で指定してください。');return v}
  function strings(v,label){if(v==null)return[];if(!Array.isArray(v))throw new Error(label+'は配列で指定してください。');const out=v.map((x,i)=>req(x,`${label}[${i}]`));if(new Set(out).size!==out.length)throw new Error(label+'に重複があります。');return out}
  function containsDeprecatedStatusSuccess(value){return /status[_ -]?success|状態異常成功率/i.test(JSON.stringify(value??{}))}
  function validateFormalEquipment(record){
    if(!object(record))throw new Error('Equipment recordが必要です。');
    if(Object.prototype.hasOwnProperty.call(record,'base_critical_rate'))throw Object.assign(new Error('Equipment field base_critical_rateはCurrent Contractで廃止されています。weapon_critical_rateを使用してください。'),{code:'FORMAL_EQUIPMENT_BASE_CRITICAL_RATE_FORBIDDEN'});
    const id=req(record.id,'equipment.id');
    const hasFormal=EQUIPMENT_FIELDS.some(k=>Object.prototype.hasOwnProperty.call(record,k));
    if(!hasFormal&&object(record.params?.stats))throw Object.assign(new Error(`Formal Equipment ${id}はlegacy params.statsを使用できません。`),{code:'FORMAL_EQUIPMENT_LEGACY_STATS_FORBIDDEN'});
    if(!hasFormal)throw new Error(`Formal Equipment ${id}に正式Contribution fieldがありません。`);
    for(const key of [...EQUIPMENT_FIELDS,...REQUIREMENT_FIELDS])if(Object.prototype.hasOwnProperty.call(record,key))finite(record[key],`equipment.${key}`);
    const type=String(record?.generation?.base_item_type??record?.generation?.generation_input?.base_item_type??'');if(type!=='盾'&&BLOCK_FIELDS.some(k=>(Number(record?.[k])||0)>0))throw Object.assign(new Error('Block性能は盾Equipmentだけが所有できます。'),{code:'FORMAL_EQUIPMENT_BLOCK_OWNER_INVALID'});
    const modIds=strings(record.mod_ids,'equipment.mod_ids');
    return {...clone(record),id,mod_ids:modIds};
  }
  function baseEquipmentContribution(record){
    const checked=validateFormalEquipment(record),out={};
    EQUIPMENT_FIELDS.forEach(k=>out[k]=checked[k]==null?0:finite(checked[k],`equipment.${k}`));
    return out;
  }
  function validateModDefinition(definition,options={}){
    if(!object(definition))throw new Error('MOD Definitionが必要です。');
    const out=clone(definition);out.id=req(out.id,'mod.id');out.category=req(out.category,'mod.category');out.tags=strings(out.tags,'mod.tags');
    out.effect_type=req(out.effect_type,'mod.effect_type');out.target=req(out.target,'mod.target');out.balance_key=req(out.balance_key,'mod.balance_key');
    out.enabled=out.enabled!==false;out.schema_version=req(out.schema_version,'mod.schema_version');out.parameters=object(out.parameters)?out.parameters:{};
    if(out.effect_type==='numeric_modifier'){
      out.operation=req(out.operation,'mod.operation');
      if(!NUMERIC_OPERATIONS.includes(out.operation))throw new Error(`MOD ${out.id}のoperationはCurrent numeric operationではありません: ${out.operation}`);
    }
    const tagIds=options.tagIds instanceof Set?options.tagIds:null;
    if(tagIds)for(const tag of out.tags)if(!tagIds.has(tag))throw new Error(`MOD ${out.id}が未登録Tagを参照しています: ${tag}`);
    const rules=Array.isArray(options.requiredTagRules)?options.requiredTagRules:[];
    if(rules.length)throw new Error('required_tag_rulesの具体RuleはCurrentで未選定です。空配列だけを正式正常系として扱います。');
    return out;
  }
  function validateModCandidate(data,options={}){
    if(!object(data))throw new Error('MOD Candidate dataが必要です。');
    const definition=validateModDefinition(data.definition||data,options);
    const balance=object(data.balance)?data.balance:null;
    if(!balance)throw Object.assign(new Error(`MOD Candidate ${definition.id}にBalance値がありません。Definitionの数値を推測しません。`),{code:'FORMAL_MOD_BALANCE_REQUIRED'});
    const key=req(balance.balance_key||balance.key,'mod.balance.balance_key');
    if(key!==definition.balance_key)throw new Error(`MOD ${definition.id}のbalance_keyがDefinitionとCandidateで一致しません。`);
    const value=finite(balance.value,'mod.balance.value');
    return {definition,balance:{balance_key:key,value,version:String(balance.version||'candidate')}};
  }
  function applyEquipmentMods(base,modCandidates){
    const out=clone(base),groups=new Map();
    for(const item of modCandidates||[]){
      const checked=validateModCandidate(item),d=checked.definition;
      if(d.enabled===false)continue;
      if(d.effect_type!=='numeric_modifier')throw Object.assign(new Error(`Equipment MOD ${d.id}のeffect_typeはP3-3 static contribution resolver未対応です: ${d.effect_type}`),{code:'FORMAL_EQUIPMENT_MOD_EFFECT_UNSUPPORTED'});
      const field=TARGET_TO_FIELD[d.target];
      if(!field)throw Object.assign(new Error(`Equipment MOD ${d.id}のtargetをEquipment Contributionへ推測接続できません: ${d.target}`),{code:'FORMAL_EQUIPMENT_MOD_TARGET_UNSUPPORTED'});
      if(d.target==='CRITICAL_RATE'&&d.operation!=='RELATIVE_PERCENT')throw new Error(`CRITICAL_RATE MOD ${d.id}はRELATIVE_PERCENTだけを使用できます。`);
      if(d.target!=='CRITICAL_RATE'&&!['RELATIVE_PERCENT','FLAT_ADD'].includes(d.operation))throw new Error(`Equipment performance MOD ${d.id}はRELATIVE_PERCENT/FLAT_ADDだけを使用できます。`);
      const key=field+'|'+d.operation;groups.set(key,(groups.get(key)||0)+checked.balance.value);
    }
    for(const field of EQUIPMENT_FIELDS){
      const baseValue=Number(out[field])||0,percent=groups.get(field+'|RELATIVE_PERCENT')||0,flat=groups.get(field+'|FLAT_ADD')||0;
      out[field]=baseValue+(baseValue*percent)+flat;
    }
    return out;
  }
  function resolveEquipmentContribution(record,modCandidatesById={},options={}){
    const checked=validateFormalEquipment(record),ids=checked.mod_ids||[];
    if(new Set(ids).size!==ids.length)throw new Error(`Equipment ${checked.id}に同一MODが重複しています。`);
    const mods=ids.map(id=>{const v=modCandidatesById instanceof Map?modCandidatesById.get(id):modCandidatesById[id];if(!v)throw new Error(`Equipment ${checked.id}が参照するMOD Candidateがありません: ${id}`);return v});
    const staticMods=[],runtimeModifiers=[];
    for(const item of mods){
      const candidate=validateModCandidate(item),d=candidate.definition,field=TARGET_TO_FIELD[d.target];
      if(d.effect_type!=='numeric_modifier'||!field){
        if(options.deferRuntimeTargets===true){runtimeModifiers.push(candidate);continue}
        return {equipment_id:checked.id,base:baseEquipmentContribution(checked),modified:applyEquipmentMods(baseEquipmentContribution(checked),mods),mod_ids:ids.slice()};
      }
      if(d.target==='CRITICAL_RATE'&&d.operation!=='RELATIVE_PERCENT')throw new Error(`CRITICAL_RATE MOD ${d.id}はRELATIVE_PERCENTだけを使用できます。`);
      if(d.target!=='CRITICAL_RATE'&&!['RELATIVE_PERCENT','FLAT_ADD'].includes(d.operation))throw new Error(`Equipment performance MOD ${d.id}はRELATIVE_PERCENT/FLAT_ADDだけを使用できます。`);
      staticMods.push(item);
    }
    const base=baseEquipmentContribution(checked),modified=applyEquipmentMods(base,staticMods);
    return {equipment_id:checked.id,base,modified,mod_ids:ids.slice(),runtime_modifiers:runtimeModifiers};
  }
  function validateFormalPassive(record,options={}){
    if(!object(record))throw new Error('Passive recordが必要です。');
    const rawParams=object(record.params)?record.params:{};
    const rawConditions=rawParams.ability_conditions==null?[]:rawParams.ability_conditions;
    if(!Array.isArray(rawConditions))throw new Error(`Passive ${req(record.id,'passive.id')}.params.ability_conditionsは配列にしてください。`);
    const checkedConditions=rawConditions.map((c,i)=>{if(!object(c))throw new Error(`Passive ${req(record.id,'passive.id')}.ability_conditions[${i}]が不正です。`);const stat=req(c.stat,`passive.ability_conditions[${i}].stat`).toUpperCase();if(!PASSIVE_STATS.includes(stat))throw new Error(`Passive ${req(record.id,'passive.id')}の能力条件statが不正です: ${stat}`);return {stat,min:finite(c.min,`passive.ability_conditions[${i}].min`)};});
    const out=clone(record);out.id=req(out.id,'passive.id');out.name=req(out.name,'passive.name');out.tags=strings(out.tags,'passive.tags');
    out.params=object(out.params)?out.params:{};
    if(containsDeprecatedStatusSuccess(record))throw Object.assign(new Error(`Passive ${out.id}はCurrent非採用の状態異常成功率上昇を使用できません。`),{code:'FORMAL_PASSIVE_STATUS_SUCCESS_FORBIDDEN'});
    for(const key of ['level','passive_level','plv','exp','experience'])if(Object.prototype.hasOwnProperty.call(rawParams,key))throw new Error(`Passive ${out.id}は自身の成長fieldを持てません: params.${key}`);
    out.params.ability_conditions=checkedConditions;
    out.params.mod_ids=strings(out.params.mod_ids,'passive.params.mod_ids');out.params.effect_ids=strings(out.params.effect_ids,'passive.params.effect_ids');
    out.params.combat_capabilities=strings(out.params.combat_capabilities,'passive.params.combat_capabilities').map(x=>x.toUpperCase());
    for(const capability of out.params.combat_capabilities){if(!PASSIVE_COMBAT_CAPABILITIES.includes(capability))throw new Error(`Passive ${out.id}のcombat capabilityはCurrent未対応です: ${capability}`);const owner=PASSIVE_COMBAT_CAPABILITY_OWNER[capability];if(owner&&out.id!==owner)throw new Error(`Combat capability ${capability}は${owner}だけが所有できます: ${out.id}`);}
    const tagIds=options.tagIds instanceof Set?options.tagIds:null;if(tagIds)for(const tag of out.tags)if(!tagIds.has(tag))throw new Error(`Passive ${out.id}が未登録Tagを参照しています: ${tag}`);
    return out;
  }
  function resolvePassiveContribution(record,modCandidatesById={}){
    const checked=validateFormalPassive(record),modifiers=checked.params.mod_ids.map(id=>{const data=modCandidatesById instanceof Map?modCandidatesById.get(id):modCandidatesById[id];if(!data)throw new Error(`Passive ${checked.id}が参照するMOD Candidateがありません: ${id}`);return validateModCandidate(data)});
    return {passive_id:checked.id,tags:checked.tags.slice(),ability_conditions:clone(checked.params.ability_conditions),modifier_ids:checked.params.mod_ids.slice(),modifiers,effect_ids:checked.params.effect_ids.slice(),combat_capabilities:checked.params.combat_capabilities.slice()};
  }
  function sumEquipmentContributions(rows){const total=Object.fromEntries(EQUIPMENT_FIELDS.map(k=>[k,0])),blockOwners=[];for(const row of rows||[]){for(const k of ADDITIVE_EQUIPMENT_FIELDS)total[k]+=Number(row?.modified?.[k])||0;if(BLOCK_FIELDS.some(k=>(Number(row?.modified?.[k])||0)>0))blockOwners.push(row);}if(blockOwners.length>1)throw Object.assign(new Error('Block性能を持つEquipmentを複数合算できません。'),{code:'FORMAL_EQUIPMENT_MULTI_BLOCK_SOURCE_FORBIDDEN',count:blockOwners.length});if(blockOwners.length===1)for(const k of BLOCK_FIELDS)total[k]=Number(blockOwners[0]?.modified?.[k])||0;return total}
  return Object.freeze({EQUIPMENT_FIELDS,BLOCK_FIELDS,ADDITIVE_EQUIPMENT_FIELDS,REQUIREMENT_FIELDS,MOD_FIELDS,PASSIVE_STATS,PASSIVE_COMBAT_CAPABILITIES,PASSIVE_COMBAT_CAPABILITY_OWNER,NUMERIC_OPERATIONS,TARGET_TO_FIELD,validateFormalEquipment,baseEquipmentContribution,validateModDefinition,validateModCandidate,applyEquipmentMods,resolveEquipmentContribution,validateFormalPassive,resolvePassiveContribution,sumEquipmentContributions});
});
