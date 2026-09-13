(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKEquipmentModRarityDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const RARITIES=Object.freeze(['NORMAL','MAGIC','RARE','UNIQUE','LEGENDARY','MYTHIC']);
 const NORMAL_ROUTE_BLOCKED_RARITIES=Object.freeze(['UNIQUE','LEGENDARY','MYTHIC']);
 const SLOT_KINDS=Object.freeze(['ATTACK','DEFENSE','ABILITY']);
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function text(value,path){const out=String(value??'').trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'MOD_RARITY_INPUT_INVALID',path});return out}
 function nonNegativeInteger(value,path){const n=Number(value);if(!Number.isInteger(n)||n<0)throw Object.assign(new Error(`${path} は0以上の整数が必要です。`),{code:'MOD_RARITY_CONFIG_INVALID',path});return n}
 function positiveWeight(value,path){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Object.assign(new Error(`${path} は0より大きい有限値が必要です。`),{code:'MOD_RARITY_CONFIG_INVALID',path});return n}
 function normalizeTags(value,path){if(value==null)return[];if(!Array.isArray(value))throw Object.assign(new Error(`${path} は配列が必要です。`),{code:'MOD_RARITY_INPUT_INVALID',path});return[...new Set(value.map((x,i)=>text(x,`${path}[${i}]`)))].sort()}
 function normalizeWeighted(value,path,{idKey='id',allowCount=false}={}){
  if(!Array.isArray(value)||!value.length)throw Object.assign(new Error(`${path} に1件以上の候補が必要です。`),{code:'MOD_RARITY_CONFIG_MISSING',path});
  return value.map((row,i)=>{if(!isObject(row))throw Object.assign(new Error(`${path}[${i}] が不正です。`),{code:'MOD_RARITY_CONFIG_INVALID',path:`${path}[${i}]`});const raw=row[idKey];const id=allowCount?nonNegativeInteger(raw,`${path}[${i}].${idKey}`):text(raw,`${path}[${i}].${idKey}`);return{...clone(row),[idKey]:id,weight:positiveWeight(row.weight,`${path}[${i}].weight`)}})
 }
 function normalizeConfig(config){
  if(!isObject(config))throw Object.assign(new Error('config が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config'});
  const schemaVersion=text(config.schema_version,'config.schema_version');
  const balanceRef=text(config.balance_ref,'config.balance_ref');
  const instanceIdPrefix=text(config.instance_id_prefix,'config.instance_id_prefix');
  if(!isObject(config.routes))throw Object.assign(new Error('config.routes が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.routes'});
  if(!isObject(config.mod_count_by_rarity))throw Object.assign(new Error('config.mod_count_by_rarity が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.mod_count_by_rarity'});
  if(!isObject(config.normal_slot_allocations))throw Object.assign(new Error('config.normal_slot_allocations が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.normal_slot_allocations'});
  if(!isObject(config.category_weights))throw Object.assign(new Error('config.category_weights が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.category_weights'});
  if(!isObject(config.tier_weights))throw Object.assign(new Error('config.tier_weights が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.tier_weights'});
  if(!isObject(config.quality_to_rarity))throw Object.assign(new Error('config.quality_to_rarity が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.quality_to_rarity'});
  const allowedSchemas=normalizeTags(config.allowed_mod_schema_versions,'config.allowed_mod_schema_versions');if(!allowedSchemas.length)throw Object.assign(new Error('config.allowed_mod_schema_versions が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.allowed_mod_schema_versions'});
  return{...clone(config),schema_version:schemaVersion,balance_ref:balanceRef,instance_id_prefix:instanceIdPrefix,allowed_mod_schema_versions:allowedSchemas};
 }
 function hashString(value){let h=2166136261>>>0;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
 function createRng(seed){let state=hashString(String(seed));if(state===0)state=0x9e3779b9;return function(){state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296}}
 function weightedPick(rows,rng,stage,history){const total=rows.reduce((s,row)=>s+row.weight,0);if(!(total>0))throw Object.assign(new Error(`${stage} の重み合計が不正です。`),{code:'MOD_RARITY_CONFIG_INVALID',path:stage});const roll=rng()*total;let cursor=0;let chosen=rows[rows.length-1];for(const row of rows){cursor+=row.weight;if(roll<cursor){chosen=row;break}}history.push({stage,roll,total,selected:clone(chosen)});return chosen}
 function routeKey(value){const key=text(value,'route').toUpperCase();if(key!=='NORMAL'&&key!=='LOOT')throw Object.assign(new Error(`route が不正です: ${key}`),{code:'MOD_RARITY_ROUTE_INVALID',route:key});return key}
 function validateRarity(value,path){const out=text(value,path).toUpperCase();if(!RARITIES.includes(out))throw Object.assign(new Error(`${path} が不正です: ${out}`),{code:'MOD_RARITY_CONFIG_INVALID',path,rarity:out});return out}
 function normalizeModDefinition(row,index,config){
  if(!isObject(row))throw Object.assign(new Error(`mods[${index}] が不正です。`),{code:'MOD_DEFINITION_INVALID',index});
  const id=text(row.id,`mods[${index}].id`),schema=text(row.schema_version,`mods[${index}].schema_version`),balanceRef=text(row.balance_ref,`mods[${index}].balance_ref`),slotKind=text(row.slot_kind,`mods[${index}].slot_kind`).toUpperCase(),category=text(row.category,`mods[${index}].category`);
  if(!config.allowed_mod_schema_versions.includes(schema))throw Object.assign(new Error(`未対応MOD Schemaです: ${schema}`),{code:'MOD_SCHEMA_UNSUPPORTED',mod_id:id,schema_version:schema});
  if(balanceRef!==config.balance_ref)throw Object.assign(new Error(`MODのBalance参照が設定と一致しません: ${id}`),{code:'MOD_BALANCE_REF_MISMATCH',mod_id:id,balance_ref:balanceRef,expected_balance_ref:config.balance_ref});
  if(!SLOT_KINDS.includes(slotKind))throw Object.assign(new Error(`MOD slot_kind が不正です: ${slotKind}`),{code:'MOD_SLOT_KIND_INVALID',mod_id:id,slot_kind:slotKind});
  return{...clone(row),id,schema_version:schema,balance_ref:balanceRef,slot_kind:slotKind,category,required_tags:normalizeTags(row.required_tags,`mods[${index}].required_tags`),any_tags:normalizeTags(row.any_tags,`mods[${index}].any_tags`),forbidden_tags:normalizeTags(row.forbidden_tags,`mods[${index}].forbidden_tags`)};
 }
 function tagCompatible(mod,itemTags){const set=new Set(itemTags);if(mod.required_tags.some(tag=>!set.has(tag)))return false;if(mod.any_tags.length&&mod.any_tags.every(tag=>!set.has(tag)))return false;if(mod.forbidden_tags.some(tag=>set.has(tag)))return false;return true}
 function normalizeMods(mods,config){if(!Array.isArray(mods))throw Object.assign(new Error('mods が必要です。'),{code:'MOD_RARITY_INPUT_INVALID',path:'mods'});const ids=new Set();return mods.map((row,i)=>{const out=normalizeModDefinition(row,i,config);if(ids.has(out.id))throw Object.assign(new Error(`MOD IDが重複しています: ${out.id}`),{code:'MOD_ID_DUPLICATE',mod_id:out.id});ids.add(out.id);return out})}
 function qualityRarity(config,quality,explicitRarity){
  if(explicitRarity!=null&&String(explicitRarity).trim()!==''){const rarity=validateRarity(explicitRarity,'equipment_rarity');if(rarity==='MYTHIC')return{ok:true,rarity,source:'explicit_equipment_rarity'};return{ok:true,rarity,source:'explicit_equipment_rarity'}}
  const key=text(quality,'quality');if(!Object.prototype.hasOwnProperty.call(config.quality_to_rarity,key))return fail('QUALITY_RARITY_MAPPING_MISSING','報酬品質に対応する装備レアリティがありません。',{quality:key});
  const rarity=validateRarity(config.quality_to_rarity[key],`config.quality_to_rarity.${key}`);if(rarity==='MYTHIC')return fail('MYTHIC_REQUIRES_EXPLICIT_RARITY','MYTHICはequipment_rarityの明示指定が必要です。',{quality:key});return{ok:true,rarity,source:'quality_mapping'};
 }
 function resolveRarity(config,route,rng,history,requestedRarity){
  if(requestedRarity!=null&&String(requestedRarity).trim()!==''){const rarity=validateRarity(requestedRarity,'requested_rarity');if(route==='NORMAL'&&NORMAL_ROUTE_BLOCKED_RARITIES.includes(rarity))throw Object.assign(new Error(`通常作成では${rarity}を生成できません。`),{code:'NORMAL_ROUTE_RARITY_FORBIDDEN',rarity});history.push({stage:'rarity',selected:{id:rarity},source:'explicit'});return rarity}
  const routeConfig=config.routes[route];if(!isObject(routeConfig))throw Object.assign(new Error(`config.routes.${route} が必要です。`),{code:'MOD_RARITY_CONFIG_MISSING',path:`config.routes.${route}`});let rows=normalizeWeighted(routeConfig.rarity_weights,`config.routes.${route}.rarity_weights`);rows=rows.map(row=>({...row,id:validateRarity(row.id,`config.routes.${route}.rarity_weights.id`)}));if(route==='NORMAL')rows=rows.filter(row=>!NORMAL_ROUTE_BLOCKED_RARITIES.includes(row.id));if(!rows.length)throw Object.assign(new Error(`${route} の生成可能レアリティ候補がありません。`),{code:'RARITY_CANDIDATE_EXHAUSTED',route});return weightedPick(rows,rng,'rarity',history).id;
 }
 function pickCount(config,rarity,rng,history){const rows=normalizeWeighted(config.mod_count_by_rarity[rarity],`config.mod_count_by_rarity.${rarity}`,{idKey:'count',allowCount:true});return weightedPick(rows,rng,'mod_count',history).count}
 function pickAbilityCount(config,rarity,total,rng,history){
  if(!isObject(config.ability_slot))throw Object.assign(new Error('config.ability_slot が必要です。'),{code:'MOD_RARITY_CONFIG_MISSING',path:'config.ability_slot'});
  if(config.ability_slot.enabled!==true){history.push({stage:'ability_slot_count',selected:{count:0},source:'disabled'});return 0}
  const rows=normalizeWeighted(config.ability_slot.count_by_rarity?.[rarity],`config.ability_slot.count_by_rarity.${rarity}`,{idKey:'count',allowCount:true}).filter(row=>row.count<=total);
  if(!rows.length)throw Object.assign(new Error('能力値MOD枠の候補が総MOD数を超えています。'),{code:'ABILITY_SLOT_COUNT_INVALID',rarity,total_mod_count:total});return weightedPick(rows,rng,'ability_slot_count',history).count;
 }
 function allocateNormalSlots(config,rarity,count,rng,history){if(count===0){history.push({stage:'attack_defense_allocation',selected:{attack:0,defense:0},source:'zero'});return{attack:0,defense:0}}const rows=normalizeWeighted(config.normal_slot_allocations[rarity],`config.normal_slot_allocations.${rarity}`).map((row,i)=>{const attack=nonNegativeInteger(row.attack,`config.normal_slot_allocations.${rarity}[${i}].attack`),defense=nonNegativeInteger(row.defense,`config.normal_slot_allocations.${rarity}[${i}].defense`);return{...row,attack,defense}}).filter(row=>row.attack+row.defense===count);if(!rows.length)throw Object.assign(new Error(`通常MOD枠${count}件に一致する攻防割当がありません。`),{code:'NORMAL_SLOT_ALLOCATION_MISSING',rarity,normal_mod_count:count});const chosen=weightedPick(rows,rng,'attack_defense_allocation',history);return{attack:chosen.attack,defense:chosen.defense}}
 function pickCategory(config,slotKind,rng,history,index){const rows=normalizeWeighted(config.category_weights[slotKind],`config.category_weights.${slotKind}`);return weightedPick(rows,rng,`category:${slotKind}:${index}`,history).id}
 function pickTier(config,mod,rng,history,index){const source=config.tier_weights[mod.id]??config.tier_weights[mod.category]??config.tier_weights[mod.slot_kind];const rows=normalizeWeighted(source,`config.tier_weights.${mod.id}|${mod.category}|${mod.slot_kind}`);return weightedPick(rows,rng,`tier:${index}`,history).id}
 function generate(input){
  const source=isObject(input)?input:{};let config,route,baseItem,mods,seed,itemTags;
  try{config=normalizeConfig(source.config);route=routeKey(source.route);if(!isObject(source.base_item))throw Object.assign(new Error('base_item が必要です。'),{code:'MOD_RARITY_INPUT_INVALID',path:'base_item'});baseItem=clone(source.base_item);baseItem.id=text(baseItem.id,'base_item.id');seed=text(source.seed,'seed');itemTags=normalizeTags(baseItem.tags,'base_item.tags');mods=normalizeMods(source.mods,config)}catch(error){return fail(error.code||'MOD_RARITY_INPUT_INVALID',String(error.message||error),{path:error.path,mod_id:error.mod_id,rarity:error.rarity,route:error.route})}
  const history=[],rng=createRng(seed);let rarity,totalCount,abilityCount,allocation;
  try{rarity=resolveRarity(config,route,rng,history,source.requested_rarity);totalCount=pickCount(config,rarity,rng,history);abilityCount=pickAbilityCount(config,rarity,totalCount,rng,history);allocation=allocateNormalSlots(config,rarity,totalCount-abilityCount,rng,history)}catch(error){return fail(error.code||'MOD_RARITY_GENERATION_ERROR',String(error.message||error),{path:error.path,rarity:error.rarity,route:error.route,total_mod_count:error.total_mod_count,normal_mod_count:error.normal_mod_count})}
  const slots=[];for(let i=0;i<abilityCount;i++)slots.push({kind:'ABILITY',index:i});for(let i=0;i<allocation.attack;i++)slots.push({kind:'ATTACK',index:i});for(let i=0;i<allocation.defense;i++)slots.push({kind:'DEFENSE',index:i});
  const used=new Set(),selected=[];
  try{for(let i=0;i<slots.length;i++){const slot=slots[i],category=pickCategory(config,slot.kind,rng,history,i),candidates=mods.filter(mod=>!used.has(mod.id)&&mod.slot_kind===slot.kind&&mod.category===category&&tagCompatible(mod,itemTags));if(!candidates.length)throw Object.assign(new Error(`MOD候補が不足しています: ${slot.kind}/${category}`),{code:'MOD_CANDIDATE_EXHAUSTED',slot_kind:slot.kind,category,selected_mod_ids:[...used]});const weighted=candidates.map(mod=>({id:mod.id,weight:positiveWeight(mod.weight,`mods.${mod.id}.weight`),mod}));const picked=weightedPick(weighted,rng,`mod:${i}`,history).mod;used.add(picked.id);const tier=pickTier(config,picked,rng,history,i);selected.push({mod_id:picked.id,slot_kind:slot.kind,category,tier})}}
  catch(error){return fail(error.code||'MOD_RARITY_GENERATION_ERROR',String(error.message||error),{slot_kind:error.slot_kind,category:error.category,selected_mod_ids:error.selected_mod_ids||[...used]})}
  const fingerprint=hashString(JSON.stringify({base_item_id:baseItem.id,route,seed,config_schema:config.schema_version,balance_ref:config.balance_ref,rarity,mods:selected})).toString(16).padStart(8,'0');
  return{ok:true,base_item_id:baseItem.id,instance_id:`${config.instance_id_prefix}${fingerprint}`,route,rarity,mod_count:selected.length,mods:selected,draw_history:history,contract_snapshot:{config_schema_version:config.schema_version,balance_ref:config.balance_ref,seed}};
 }
 return Object.freeze({VERSION:'GS-09-1',RARITIES,NORMAL_ROUTE_BLOCKED_RARITIES,SLOT_KINDS,createRng,qualityRarity,generate});
});
