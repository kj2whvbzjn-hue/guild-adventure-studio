(function(global){
'use strict';
const GENERATOR_VERSION='1.3.0';
const ILV_NAMES=['','木の','鉄の','鋼鉄の','銀の','ダイヤの','ミスリルの','アダマンタイトの','オリハルコンの','巨人の','竜の','星鋼の'];
const DEFAULT_BASE_NAME_ROWS=()=>ILV_NAMES.slice(1).map((name,i)=>({level:i+1,name}));
const DEFAULT_BASE_NAME_SETS=()=>({weapon:{active_preset:'標準武器',presets:{'標準武器':DEFAULT_BASE_NAME_ROWS()}},armor:{active_preset:'標準防具',presets:{'標準防具':DEFAULT_BASE_NAME_ROWS()}}});
const AI_FORBIDDEN_NUMERIC_FIELDS=['required_str','required_dex','required_int','required_vit','required_mnd','required_agi','attack','accuracy','magic_weapon_bonus','base_critical_rate','hp_bonus','mp_bonus','evasion'];
let rules=null,config=null,defaultConfig=null,baseNameSets=null,preview=null,batchPreview=null,lastRequestPayload=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=v=>Number.isFinite(Number(v));
const stamp=()=>new Date().toISOString();
const hostData=()=>global.GKSEquipmentHost?.getData?.()||global.data;
const hostPersist=message=>global.GKSEquipmentHost?.persist?.(message)??(typeof global.persist==='function'?global.persist(message):undefined);
async function loadJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' の読込に失敗しました: '+r.status);return r.json();}
async function initialize(){if(!rules)rules=await loadJson('./equipment/equipment-generation-rules.json');if(!defaultConfig)defaultConfig=await loadJson('./equipment/equipment-balance-config.json');if(!config){const saved=hostData()?.equipment_generation?.active_config;config=clone(saved||defaultConfig);}if(!baseNameSets){const savedSets=hostData()?.equipment_generation?.base_name_sets;baseNameSets=normalizeBaseNameSets(savedSets||DEFAULT_BASE_NAME_SETS());}syncItemLevelMaxFromBaseSets(false);validateConfig();return {rules:clone(rules),config:clone(config),base_name_sets:clone(baseNameSets)};}
function validateConfig(){
  if(!rules||!config)throw new Error('Generation Rules / Balance Config が未読込です。');
  if(config.status!=='active')throw new Error('Active Balance Configではありません。');
  if(!config.config_id||!config.config_version)throw new Error('Balance Config metadataが不足しています。');
  const values=[config.item_level?.min,config.item_level?.max,config.weapon?.performance?.attack_multiplier,config.weapon?.performance?.accuracy_multiplier,config.weapon?.performance?.base_critical_rate];
  Object.values(config.weapon?.requirement_coefficients||{}).forEach(c=>values.push(c.str,c.dex,c.int));
  Object.values(config.armor?.requirement_coefficients||{}).forEach(c=>values.push(c.vit,c.mnd,c.agi));
  Object.values(config.armor?.slot_coefficients||{}).forEach(v=>values.push(v));
  if(values.some(v=>!finite(v)||Number(v)<0))throw new Error('生成係数に0以上の数値ではない項目があります。');
}
function generationMeta(input,trace){return {generator_version:GENERATOR_VERSION,generation_rules_version:rules.generation_rules_version,config_id:config.config_id,config_version:config.config_version,source_spec_version:rules.source_spec_version,seed:String(input.seed??'0'),base_item_type:String(input.base_item_type||''),item_level:Number(input.item_level),generated_at:stamp(),generation_input:clone(input),calculation_trace:trace};}
function levelRange(){const r=config?.item_level||{};return {min:Number(r.min),max:Number(r.max)};}
function normalizeNameRows(rows){
  if(!Array.isArray(rows))throw new Error('ベースアイテムセットの行形式が不正です。');
  const out=rows.map(r=>({level:Number(r.level),name:String(r.name??r.prefix??'').trim()}));
  if(out.some(r=>!Number.isInteger(r.level)||r.level<1||!r.name))throw new Error('ベースアイテムセットは「レベル」と「名前」が必要です。');
  const seen=new Set();for(const r of out){if(seen.has(r.level))throw new Error('同じレベルが重複しています: '+r.level);seen.add(r.level);}
  return out.sort((a,b)=>a.level-b.level);
}
function normalizeBaseNameSets(value){
  const src=clone(value||DEFAULT_BASE_NAME_SETS()),out={};
  for(const kind of ['weapon','armor']){
    const part=src[kind]||{},presets={};
    for(const [name,rows] of Object.entries(part.presets||{})){const n=String(name).trim();if(n)presets[n]=normalizeNameRows(rows);}
    if(!Object.keys(presets).length){const d=DEFAULT_BASE_NAME_SETS()[kind];Object.assign(presets,d.presets);}
    let active=String(part.active_preset||'');if(!presets[active])active=Object.keys(presets)[0];
    out[kind]={active_preset:active,presets};
  }
  return out;
}
function getBaseNameSets(){return clone(baseNameSets||DEFAULT_BASE_NAME_SETS());}
function activeBaseNameRows(kind){const part=(baseNameSets||DEFAULT_BASE_NAME_SETS())[kind];return clone(part?.presets?.[part?.active_preset]||[]);}
function activeBaseName(kind,itemLevel){const row=activeBaseNameRows(kind).find(r=>Number(r.level)===Number(itemLevel));return row?.name||ILV_NAMES[Number(itemLevel)]||'';}
function syncItemLevelMaxFromBaseSets(persist=true){
  if(!config||!baseNameSets)return;
  const levels=['weapon','armor'].flatMap(k=>activeBaseNameRows(k).map(r=>Number(r.level))).filter(Number.isFinite),max=Math.max(Number(config.item_level?.max||1),...(levels.length?levels:[1]));
  config.item_level=config.item_level||{min:1,max};config.item_level.max=max;
  if(persist){const root=hostData();if(root){root.equipment_generation=root.equipment_generation||{};root.equipment_generation.active_config=clone(config);root.equipment_generation.updated_at=stamp();}}
}
function persistBaseNameSets(){const root=hostData();if(root){root.equipment_generation=root.equipment_generation||{};root.equipment_generation.base_name_sets=clone(baseNameSets);root.equipment_generation.active_config=clone(config);root.equipment_generation.updated_at=stamp();hostPersist('装備ベースアイテムセットを更新');}}
function saveBaseNameSet(kind,presetName,rows,{activate=true}={}){
  if(!['weapon','armor'].includes(kind))throw new Error('ベースアイテムセット区分が不正です。');
  const name=String(presetName||'').trim();if(!name)throw new Error('プリセット名を入力してください。');
  baseNameSets=normalizeBaseNameSets(baseNameSets||DEFAULT_BASE_NAME_SETS());baseNameSets[kind].presets[name]=normalizeNameRows(rows);if(activate)baseNameSets[kind].active_preset=name;
  syncItemLevelMaxFromBaseSets(false);validateConfig();persistBaseNameSets();return getBaseNameSets();
}
function activateBaseNamePreset(kind,presetName){
  if(!['weapon','armor'].includes(kind))throw new Error('ベースアイテムセット区分が不正です。');const name=String(presetName||'');if(!baseNameSets?.[kind]?.presets?.[name])throw new Error('プリセットがありません: '+name);baseNameSets[kind].active_preset=name;syncItemLevelMaxFromBaseSets(false);persistBaseNameSets();return getBaseNameSets();
}

function normalizeArmorCategory(type){const raw=String(type||'');return String(config?.armor?.category_aliases?.[raw]||raw);}
function growthMultiplier(kind,metric,itemLevel){
  const g=config?.growth?.[kind];
  if(!g||g.enabled!==true)return 1;
  const values=g[metric]||g.default||{};
  const raw=values[String(itemLevel)]??values[itemLevel]??1;
  const n=Number(raw);if(!finite(n)||n<0)throw new Error(`Growth設定が不正です: ${kind}.${metric}.iLv${itemLevel}`);return n;
}
function generateWeapon(input){
  const i=Number(input.item_level),type=String(input.base_item_type||''),c=config.weapon.requirement_coefficients[type];
  if(!c)throw new Error('未定義の武器種です: '+type);
  const required_str=i*Number(c.str),required_dex=i*Number(c.dex),required_int=i*Number(c.int),perf=config.weapon.performance||{};
  const gmAttack=growthMultiplier('weapon','attack',i),gmAccuracy=growthMultiplier('weapon','accuracy',i),gmMagic=growthMultiplier('weapon','magic_weapon_bonus',i);
  const attack=required_str*Number(perf.attack_multiplier)*gmAttack;
  const accuracy=required_dex*Number(perf.accuracy_multiplier)*gmAccuracy;
  const magicMultiplier=perf.magic_int_multiplier_source==='weapon_str_requirement_coefficient'?Number(c.str):NaN;
  const magic_weapon_bonus=required_int*magicMultiplier*gmMagic;
  const base_critical_rate=Number(perf.base_critical_rate);
  const trace=[`required_str=${i}*${c.str}=${required_str}`,`required_dex=${i}*${c.dex}=${required_dex}`,`required_int=${i}*${c.int}=${required_int}`,`attack=${required_str}*${perf.attack_multiplier}*growth(${gmAttack})=${attack}`,`accuracy=${required_dex}*${perf.accuracy_multiplier}*growth(${gmAccuracy})=${accuracy}`,`magic_weapon_bonus=${required_int}*weapon_str_coefficient(${c.str})*growth(${gmMagic})=${magic_weapon_bonus}`,`base_critical_rate=${base_critical_rate}`];
  const baseName=activeBaseName('weapon',i);
  const out={id:String(input.id||''),name:String(input.name||`${baseName}${type}`),status:'draft',tags:Array.isArray(input.tags)?clone(input.tags):[],params:{},description:String(input.description||''),mod_ids:[],item_level:i,required_str,required_dex,required_int,attack,accuracy,magic_weapon_bonus,base_critical_rate};
  out.generation=generationMeta(input,trace);return out;
}
function generateArmor(input){
  const i=Number(input.item_level),rawType=String(input.base_item_type||''),type=normalizeArmorCategory(rawType),slot=String(input.armor_slot||'');
  const c=config.armor.requirement_coefficients[type];if(!c)throw new Error('未定義の防具カテゴリです: '+rawType);
  const slotCoefficient=Number(config.armor.slot_coefficients?.[slot]);if(!finite(slotCoefficient))throw new Error('未定義の防具部位です: '+slot);
  const required_vit=i*Number(c.vit),required_mnd=i*Number(c.mnd),required_agi=i*Number(c.agi);
  const hpGrowth=growthMultiplier('armor','hp',i),mpGrowth=growthMultiplier('armor','mp',i),evasionGrowth=growthMultiplier('armor','evasion',i);
  const hp_bonus=required_vit*slotCoefficient*hpGrowth,mp_bonus=required_mnd*slotCoefficient*mpGrowth,evasion=required_agi*slotCoefficient*evasionGrowth;
  const trace=[`armor_category=${type}`,`armor_slot=${slot}`,`required_vit=${i}*${c.vit}=${required_vit}`,`required_mnd=${i}*${c.mnd}=${required_mnd}`,`required_agi=${i}*${c.agi}=${required_agi}`,`slot_coefficient=${slotCoefficient}`,`hp_bonus=${required_vit}*${slotCoefficient}*growth(${hpGrowth})=${hp_bonus}`,`mp_bonus=${required_mnd}*${slotCoefficient}*growth(${mpGrowth})=${mp_bonus}`,`evasion=${required_agi}*${slotCoefficient}*growth(${evasionGrowth})=${evasion}`];
  const baseName=activeBaseName('armor',i);
  const out={id:String(input.id||''),name:String(input.name||`${baseName}${type}${slot}`),status:'draft',tags:Array.isArray(input.tags)?clone(input.tags):[],params:{},description:String(input.description||''),mod_ids:[],item_level:i,armor_category:type,armor_slot:slot,required_vit,required_mnd,required_agi,hp_bonus,mp_bonus,evasion};
  out.generation=generationMeta({...input,base_item_type:type},trace);return out;
}
function validate(record,input={}){
  const errors=[],warnings=[];if(!record||typeof record!=='object')return {ok:false,errors:['生成結果がありません。'],warnings};
  if(!record.id)errors.push('装備IDがありません。');else if(!/^EQP-\d{4}$/.test(String(record.id)))errors.push('装備IDは EQP-0001 形式で指定してください。');if(!record.name)errors.push('名称がありません。');
  const i=Number(record.item_level),range=levelRange();if(!Number.isInteger(i)||!finite(range.min)||!finite(range.max)||i<range.min||i>range.max)errors.push(`アイテムレベルは${range.min}〜${range.max}です。`);
  if(config.status!=='active')errors.push('Balance Configがactiveではありません。');
  for(const f of rules.forbidden_fields||[])if(Object.prototype.hasOwnProperty.call(record,f))errors.push('禁止fieldを検出: '+f);
  const kind=String(input.kind||record.generation?.generation_input?.kind||'');if(kind!=='weapon'&&kind!=='armor')errors.push('装備区分が不正です。');
  const required=kind==='armor'?rules.armor.required_fields:rules.weapon.required_fields,performance=kind==='armor'?rules.armor.performance_fields:rules.weapon.performance_fields;
  for(const f of required){if(!finite(record[f])||Number(record[f])<0)errors.push('要求値が不正: '+f);}for(const f of performance){if(!finite(record[f]))errors.push('正式性能が未確定: '+f);}
  if(kind==='weapon'&&String(input.base_item_type)==='杖'){
    const exists=Array.isArray(hostData()?.tags)&&hostData().tags.some(t=>String(t.id)==='WEAPON_STAFF');
    if(!exists)errors.push('必須Tag WEAPON_STAFF がTag Masterに存在しません。Tag工程で正式IDを登録してから生成してください。');
    if(exists&&!record.tags.includes('WEAPON_STAFF'))errors.push('杖にはWEAPON_STAFF Tagが必要です。');
  }
  if(!record.generation?.generator_version||!record.generation?.generation_rules_version||!record.generation?.config_id||!record.generation?.config_version||!record.generation?.source_spec_version||!record.generation?.generated_at)errors.push('generation metadataが不足しています。');
  Object.entries(record).forEach(([k,v])=>{if(typeof v==='number'&&!Number.isFinite(v))errors.push('非有限値: '+k)});return {ok:errors.length===0,errors,warnings};
}
function generateRecord(input){const i=Number(input.item_level),range=levelRange();if(!Number.isInteger(i)||!finite(range.min)||!finite(range.max)||i<range.min||i>range.max)throw new Error(`アイテムレベルは${range.min}〜${range.max}で指定してください。`);return input.kind==='armor'?generateArmor(input):generateWeapon(input);}
function generate(input){validateConfig();const record=generateRecord(input),validation=validate(record,input);preview={record,validation,input:clone(input)};return clone(preview);}
function getPreview(){return clone(preview);}function getBatchPreview(){return clone(batchPreview);}
function writeEquipment(row){const idx=hostData().masters.equipment.findIndex(x=>String(x.id)===String(row.id));if(idx>=0)hostData().masters.equipment[idx]=row;else hostData().masters.equipment.push(row);}
function commit(){if(!preview)throw new Error('確認データがありません。');if(!preview.validation.ok)throw new Error('検証エラーがあるため保存できません。');if(!hostData()?.masters?.equipment)throw new Error('装備マスターが利用できません。');const row=clone(preview.record);row.updated_at=stamp();if(!row.created_at)row.created_at=row.updated_at;writeEquipment(row);hostPersist('equipment generator commit');preview=null;return clone(row);}
function idsForBatch(request,count,reservedIds=[]){const used=new Set([...(hostData()?.masters?.equipment||[]).map(x=>String(x?.id||'')),...(reservedIds||[]).map(String)]),out=[];let n=1;while(out.length<count&&n<=9999){const id=`EQP-${String(n).padStart(4,'0')}`;if(!used.has(id)){out.push(id);used.add(id);}n++;}if(out.length!==count)throw new Error('装備IDの自動採番上限（EQP-9999）に達しました。');return out;}
function normalizeList(v){if(Array.isArray(v))return v.map(String).map(x=>x.trim()).filter(Boolean);return String(v||'').split(',').map(x=>x.trim()).filter(Boolean);}
function expandBatchInputs(request={},reservedIds=[]){
  validateConfig();const kind=String(request.kind||'weapon');if(!['weapon','armor'].includes(kind))throw new Error('区分は武器または防具です。');
  const range=levelRange(),min=Number(request.item_level_min??request.item_level?.min??range.min),max=Number(request.item_level_max??request.item_level?.max??min);
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<range.min||max>range.max||min>max)throw new Error(`アイテムレベル帯は${range.min}〜${range.max}内で指定してください。`);
  let types=normalizeList(request.base_item_types||request.base_item_type);if(!types.length)types=kind==='armor'?Object.keys(config.armor.requirement_coefficients):Object.keys(config.weapon.requirement_coefficients);
  let slots=kind==='armor'?normalizeList(request.armor_slots||request.armor_slot):[''];if(kind==='armor'&&!slots.length)slots=Object.keys(config.armor.slot_coefficients);
  const combos=[];for(const type of types)for(const slot of slots)for(let i=min;i<=max;i++)combos.push({kind,base_item_type:type,armor_slot:kind==='armor'?slot:'',item_level:i});
  const limit=request.count==null?combos.length:Number(request.count);if(!Number.isInteger(limit)||limit<1)throw new Error('生成数は1以上の整数です。');
  const selected=combos.slice(0,Math.min(limit,combos.length)),ids=idsForBatch(request,selected.length,reservedIds),seedPrefix=String(request.seed_prefix??request.seed??'0');
  return selected.map((x,i)=>({...x,id:ids[i],seed:`${seedPrefix}:${i+1}`,tags:[]}));
}
function summarize(entries){
  const ok=entries.filter(x=>x.validation.ok).length,metrics={};for(const e of entries){for(const [k,v] of Object.entries(e.record)){if(typeof v!=='number'||['item_level'].includes(k))continue;(metrics[k]||(metrics[k]=[])).push(v);}}
  const summaryMetrics={};for(const [k,vals] of Object.entries(metrics)){const total=vals.reduce((a,b)=>a+b,0);summaryMetrics[k]={min:Math.min(...vals),max:Math.max(...vals),average:vals.length?total/vals.length:0};}
  return {count:entries.length,valid:ok,invalid:entries.length-ok,metrics:summaryMetrics};
}
function generateBatch(request={},options={}){const inputs=expandBatchInputs(request,options.reservedIds||[]),entries=inputs.map(input=>{if(input.kind==='weapon'&&input.base_item_type==='杖'&&Array.isArray(hostData()?.tags)&&hostData().tags.some(t=>String(t.id)==='WEAPON_STAFF'))input.tags.push('WEAPON_STAFF');const record=generateRecord(input);return {input:clone(input),record,validation:validate(record,input)};});batchPreview={request:clone(request),entries,summary:summarize(entries),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};return clone(batchPreview);}
function simulateBatch(request={}){const result=generateBatch(request);return clone({...result,mode:'simulation',commit_allowed:false});}
function commitBatch(){if(!batchPreview)throw new Error('一括確認データがありません。');if(batchPreview.entries.some(x=>!x.validation.ok))throw new Error('検証エラーがあるため一括保存できません。');if(!hostData()?.masters?.equipment)throw new Error('装備マスターが利用できません。');const rows=batchPreview.entries.map(x=>{const row=clone(x.record);row.updated_at=stamp();if(!row.created_at)row.created_at=row.updated_at;writeEquipment(row);return row;});hostPersist('equipment generator batch commit');batchPreview=null;return clone(rows);}
function prepareAiRequest(request={}){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new Error('AI入力はオブジェクト形式で指定してください。');
  const forbidden=AI_FORBIDDEN_NUMERIC_FIELDS.filter(k=>Object.prototype.hasOwnProperty.call(request,k));if(forbidden.length)throw new Error('AI入力では正式な数値項目を直接指定できません: '+forbidden.join(', '));
  const allowed=new Set(['kind','base_item_type','base_item_types','armor_slot','armor_slots','item_level','item_level_min','item_level_max','count','seed','seed_prefix','id_prefix']);
  const unknown=Object.keys(request).filter(k=>!allowed.has(k));if(unknown.length)throw new Error('AI入力に許可されていない項目があります: '+unknown.join(', '));
  return generateBatch(request);
}
function setConfigForTest(next){config=clone(next);}
function getConfig(){return clone(config);}
function saveActiveConfig(next){
  const candidate=clone(next);const before=config;config=candidate;
  try{validateConfig();}catch(e){config=before;throw e;}
  config.updated_at=stamp();
  const root=hostData();if(root){root.equipment_generation=root.equipment_generation||{};root.equipment_generation.active_config=clone(config);root.equipment_generation.updated_at=stamp();hostPersist('装備生成設定を更新');}
  return clone(config);
}
function resetActiveConfig(){if(!defaultConfig)throw new Error('初期設定が未読込です。');return saveActiveConfig(defaultConfig);}
function validateAiRequest(request={}){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new Error('AI入力はオブジェクト形式で指定してください。');
  const forbidden=AI_FORBIDDEN_NUMERIC_FIELDS.filter(k=>Object.prototype.hasOwnProperty.call(request,k));if(forbidden.length)throw new Error('AI入力では正式な数値項目を直接指定できません: '+forbidden.join(', '));
  const allowed=new Set(['kind','base_item_type','base_item_types','armor_slot','armor_slots','item_level','item_level_min','item_level_max','count','seed','seed_prefix','id_prefix']);
  const unknown=Object.keys(request).filter(k=>!allowed.has(k));if(unknown.length)throw new Error('AI入力に許可されていない項目があります: '+unknown.join(', '));
  return clone(request);
}
function normalizeRequestPayload(payload){
  if(Array.isArray(payload))return payload.map(validateAiRequest);
  if(!payload||typeof payload!=='object')throw new Error('JSONの形式が不正です。');
  if(Array.isArray(payload.requests))return payload.requests.map(validateAiRequest);
  if(Array.isArray(payload.generation_requests))return payload.generation_requests.map(validateAiRequest);
  return [validateAiRequest(payload)];
}
function generateRequestPayload(payload){
  validateConfig();const requests=normalizeRequestPayload(payload),entries=[],reservedIds=[];
  requests.forEach((req,requestIndex)=>{const part=generateBatch(req,{reservedIds});part.entries.forEach(e=>{entries.push({...e,request_index:requestIndex});reservedIds.push(String(e.record.id||''));});});
  const ids=new Set();for(const e of entries){const id=String(e.record.id||'');if(ids.has(id))throw new Error('JSON内で装備IDが重複しています: '+id);ids.add(id);}
  batchPreview={request:{schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:clone(requests)},entries,summary:summarize(entries),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};lastRequestPayload=clone(batchPreview.request);return clone(batchPreview);
}
function requestTemplate(){return {schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:[{kind:'weapon',base_item_types:['片手剣','短剣'],item_level:{min:1,max:3},seed:'ai-weapon'},{kind:'armor',base_item_types:['重装'],armor_slots:['鎧','頭'],item_level:{min:1,max:3},seed:'ai-armor'}]};}
function workingPackage(){if(!batchPreview)throw new Error('先に試算または生成確認を実行してください。');return {schema:'GKS_EQUIPMENT_GENERATION_WORK',version:'1.1.0',generated_at:stamp(),active_config:clone(config),base_name_sets:getBaseNameSets(),generation_requests:clone(lastRequestPayload?.requests||[batchPreview.request]),summary:clone(batchPreview.summary),equipment:batchPreview.entries.map(e=>clone(e.record))};}
async function managementEnvelope(){
  if(!batchPreview)throw new Error('先に生成確認を実行してください。');if(batchPreview.summary.invalid)throw new Error('検証エラーがあるため完成JSONを作れません。');if(!global.GKSDataExchange?.buildEnvelope)throw new Error('Data Exchange基盤を利用できません。');
  const rows=batchPreview.entries.map(e=>clone(e.record)),root=clone(hostData()||{});root.project=root.project||{id:'PROJECT'};root.masters=root.masters||{};root.masters.equipment=rows;
  return global.GKSDataExchange.buildEnvelope({rootData:root,dataset:'equipment',ids:rows.map(x=>x.id),dependencyMode:'direct',studioVersion:String(global.GKSEquipmentHost?.getBuild?.()||global.DISTRIBUTION_BUILD||'')});
}
function downloadJson(filename,obj){const text=JSON.stringify(obj,null,2);if(typeof global.downloadText==='function'){global.downloadText(filename,text,'application/json;charset=utf-8');return;}const blob=new Blob([text],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function optionHtml(values){return values.map(v=>`<option value="${v}">${v}</option>`).join('');}
function metricHtml(record){const kind=record.generation?.generation_input?.kind;const pairs=kind==='armor'?[['VIT要求',record.required_vit],['MND要求',record.required_mnd],['AGI要求',record.required_agi],['HP補正',record.hp_bonus],['MP補正',record.mp_bonus],['回避',record.evasion]]:[['STR要求',record.required_str],['DEX要求',record.required_dex],['INT要求',record.required_int],['攻撃力',record.attack],['命中力',record.accuracy],['魔法上昇',record.magic_weapon_bonus],['基礎クリ率',record.base_critical_rate]];return pairs.map(([k,v])=>`<div><span class="small">${k}</span><br><b>${Number.isFinite(Number(v))?Number(v):'-'}</b></div>`).join('');}
function renderResult(section,result){const root=section.querySelector('#eqgResult');if(!root)return;const entries=result?.entries||[];if(!entries.length){root.innerHTML='<div class="item">生成結果はありません。</div>';return;}root.innerHTML=`<div class="item"><b>${entries.length}件</b> / 正常 ${result.summary.valid} / エラー ${result.summary.invalid}<br><span class="small">使用設定: ${result.config_id} / ${result.config_version}</span></div><div class="eqg-result-list">${entries.map((e,i)=>`<details class="card" ${i===0?'open':''}><summary><b>${e.record.id}</b>　${e.record.name}　iLv${e.record.item_level}　${e.validation.ok?'✓ 正常':'⚠ エラー'}</summary><div class="eqg-metrics">${metricHtml(e.record)}</div>${e.validation.errors.length?`<p class="small">${e.validation.errors.map(x=>'・'+x).join('<br>')}</p>`:''}<details><summary>計算過程</summary><pre style="white-space:pre-wrap">${(e.record.generation?.calculation_trace||[]).join('\n')}</pre></details></details>`).join('')}</div>`;}
function renderPanel(){
  const workspace=document.querySelector('main.workspace');if(!workspace||document.getElementById('view-equipment-generator'))return;
  const style=document.createElement('style');style.textContent=`#view-equipment-generator .eqg-step{border-left:4px solid var(--accent,#3b82f6)}#view-equipment-generator .eqg-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}#view-equipment-generator .eqg-metrics>div{padding:10px;border:1px solid var(--line,#ddd);border-radius:10px}#view-equipment-generator textarea{width:100%;box-sizing:border-box}#view-equipment-generator .eqg-actions button,#view-equipment-generator .button-like{min-height:44px}#view-equipment-generator .eqg-name-row{display:grid;grid-template-columns:72px 1fr;gap:8px;align-items:end;margin:8px 0}#view-equipment-generator .eqg-name-row input{width:100%;box-sizing:border-box}#view-equipment-generator .eqg-kind-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}#view-equipment-generator .eqg-kind-panel{padding:12px;border:1px solid var(--line,#ddd);border-radius:12px;margin-top:8px}#view-equipment-generator .eqg-output-guide{display:grid;gap:10px}#view-equipment-generator .eqg-output-guide .item{margin:0}#view-equipment-generator .eqg-touch-stack{display:grid;gap:12px;margin-top:12px}#view-equipment-generator .eqg-touch-details{border:1px solid var(--line,#d8dee8);border-radius:14px;background:var(--panel,#fff);overflow:hidden}#view-equipment-generator .eqg-touch-details>summary{min-height:52px;box-sizing:border-box;display:flex;align-items:center;padding:12px 14px;cursor:pointer;list-style-position:inside;touch-action:manipulation}#view-equipment-generator .eqg-touch-details>summary b{line-height:1.35}#view-equipment-generator .eqg-touch-details[open]>summary{border-bottom:1px solid var(--line,#d8dee8);background:rgba(59,130,246,.06)}#view-equipment-generator .eqg-touch-details>.eqg-detail-body{padding:14px}#view-equipment-generator .eqg-json-paste{margin:14px 0}#view-equipment-generator .eqg-json-paste>summary{min-height:52px;font-weight:700}#view-equipment-generator .eqg-json-paste>textarea{display:block;margin-top:0;border:0;border-top:1px solid var(--line,#d8dee8);border-radius:0;padding:12px}#view-equipment-generator .eqg-kind-panel>.item{margin:12px 0}#view-equipment-generator .eqg-kind-panel>.eqg-actions{margin-top:14px;gap:10px}#view-equipment-generator .eqg-file-picker{margin:12px 0 14px}#view-equipment-generator .eqg-file-picker input[type=file]{display:block;width:100%;min-height:52px;box-sizing:border-box;border:1px solid var(--line,#d8dee8);border-radius:14px;background:var(--panel,#fff);padding:10px 12px;font:inherit;color:inherit}#view-equipment-generator .eqg-file-picker input[type=file]::file-selector-button{min-height:34px;margin-right:12px;padding:6px 12px;border:0;border-radius:999px;background:#eef1f5;color:inherit;font:inherit;cursor:pointer}#view-equipment-generator .eqg-template-row{margin-top:10px}@media(min-width:700px){#view-equipment-generator .eqg-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}}`;document.head.appendChild(style);
  const section=document.createElement('section');section.id='view-equipment-generator';section.className='view hidden';section.innerHTML=`
  <div class="view-heading"><div><h1>装備生成</h1><p class="small">①生成設定 → ②武器／防具を分けて入力 → ③試算・数値確認 → ④JSON出力。完成品の登録は「管理 → 読込」から行います。</p></div></div>
  <div class="card eqg-step"><h2>① 生成設定</h2><div id="eqgConfigStatus" class="item"></div><div class="eqg-touch-stack">
    <details class="eqg-touch-details"><summary><b>係数を変更する</b></summary><div class="eqg-detail-body"><div class="grid" style="margin-top:12px"><div class="field"><label>設定バージョン</label><input id="eqgConfigVersion"></div><div class="field"><label>攻撃力倍率</label><input id="eqgAttackMul" type="number" step="any"></div><div class="field"><label>命中力倍率</label><input id="eqgAccuracyMul" type="number" step="any"></div><div class="field"><label>基礎クリティカル率</label><input id="eqgCrit" type="number" step="any"></div><div class="field"><label>武器種</label><select id="eqgCfgWeaponType"></select></div><div class="field"><label>STR係数</label><input id="eqgCfgStr" type="number" step="any"></div><div class="field"><label>DEX係数</label><input id="eqgCfgDex" type="number" step="any"></div><div class="field"><label>INT係数</label><input id="eqgCfgInt" type="number" step="any"></div><div class="field"><label>防具カテゴリ</label><select id="eqgCfgArmorType"></select></div><div class="field"><label>VIT係数</label><input id="eqgCfgVit" type="number" step="any"></div><div class="field"><label>MND係数</label><input id="eqgCfgMnd" type="number" step="any"></div><div class="field"><label>AGI係数</label><input id="eqgCfgAgi" type="number" step="any"></div><div class="field"><label>防具部位</label><select id="eqgCfgSlot"></select></div><div class="field"><label>部位係数</label><input id="eqgCfgSlotValue" type="number" step="any"></div></div><div class="toolbar eqg-actions"><button class="primary" id="eqgSaveConfig">この設定を生成基準にする</button><button id="eqgExportConfig">設定JSON出力</button><label class="button-like" for="eqgConfigFile">設定JSON読込</label><input id="eqgConfigFile" type="file" accept=".json,application/json" hidden></div></div></details>
    <details class="eqg-touch-details" open><summary><b>武器ベースアイテムセット</b></summary><div class="eqg-detail-body"><p class="small">レベルごとの名前を武器種の前に付けます。例:「2 鉄の」＋「片手剣」→「鉄の片手剣」。</p><div class="field"><label>プリセット</label><select id="eqgWeaponPreset"></select></div><div class="toolbar"><button id="eqgWeaponPresetUse">選択プリセットを使用</button></div><div id="eqgWeaponNameRows"></div><button id="eqgWeaponAddRow">＋ 追加</button><div class="grid" style="margin-top:12px"><div class="field"><label>新しいプリセット名</label><input id="eqgWeaponPresetName" placeholder="例: 高級武器"></div></div><div class="toolbar eqg-actions"><button id="eqgWeaponPresetSave">現在の内容をプリセット登録</button><button class="primary" id="eqgWeaponSetConfirm">設定を確定</button></div><div id="eqgWeaponSetStatus" class="item"></div></div></details>
    <details class="eqg-touch-details"><summary><b>防具ベースアイテムセット</b></summary><div class="eqg-detail-body"><p class="small">武器とは別の名前セットです。防具カテゴリ・部位の前に付けます。</p><div class="field"><label>プリセット</label><select id="eqgArmorPreset"></select></div><div class="toolbar"><button id="eqgArmorPresetUse">選択プリセットを使用</button></div><div id="eqgArmorNameRows"></div><button id="eqgArmorAddRow">＋ 追加</button><div class="grid" style="margin-top:12px"><div class="field"><label>新しいプリセット名</label><input id="eqgArmorPresetName" placeholder="例: 高級防具"></div></div><div class="toolbar eqg-actions"><button id="eqgArmorPresetSave">現在の内容をプリセット登録</button><button class="primary" id="eqgArmorSetConfirm">設定を確定</button></div><div id="eqgArmorSetStatus" class="item"></div></div></details></div>
  </div>
  <div class="card eqg-step"><h2>② AI・JSON一括入力</h2><p class="small">武器と防具を分けて扱います。AIには種別・iLv帯・件数などを指定させ、装備IDはStudioがEQP-0001形式で自動採番し、攻撃力や要求値もStudioが計算します。</p>
    <details open><summary><b>武器を一括生成</b></summary><div class="eqg-kind-panel"><div class="eqg-file-picker"><input id="eqgWeaponJsonFile" type="file" accept=".json,application/json" aria-label="武器JSONを選択"></div><div class="toolbar eqg-actions eqg-template-row"><button id="eqgWeaponTemplate">武器AIテンプレート出力</button></div><details class="eqg-touch-details eqg-json-paste"><summary>JSONを貼り付ける</summary><textarea id="eqgWeaponJsonText" rows="9"></textarea></details><div class="toolbar eqg-actions"><button id="eqgWeaponSimulate">武器を試算（保存なし）</button><button class="primary" id="eqgWeaponGenerate">武器の生成内容を確定確認</button></div><div id="eqgWeaponJsonStatus" class="item">未実行</div></div></details>
    <details><summary><b>防具を一括生成</b></summary><div class="eqg-kind-panel"><div class="eqg-file-picker"><input id="eqgArmorJsonFile" type="file" accept=".json,application/json" aria-label="防具JSONを選択"></div><div class="toolbar eqg-actions eqg-template-row"><button id="eqgArmorTemplate">防具AIテンプレート出力</button></div><details class="eqg-touch-details eqg-json-paste"><summary>JSONを貼り付ける</summary><textarea id="eqgArmorJsonText" rows="9"></textarea></details><div class="toolbar eqg-actions"><button id="eqgArmorSimulate">防具を試算（保存なし）</button><button class="primary" id="eqgArmorGenerate">防具の生成内容を確定確認</button></div><div id="eqgArmorJsonStatus" class="item">未実行</div></div></details>
  </div>
  <div class="card"><details><summary><b>手動で1件作る</b></summary><div class="grid" style="margin-top:12px"><div class="field"><label>区分</label><select id="eqgKind"><option value="weapon">武器</option><option value="armor">防具</option></select></div><div class="field"><label>基本装備種別</label><select id="eqgType"></select></div><div class="field" id="eqgArmorSlotField"><label>防具部位</label><select id="eqgArmorSlot"></select></div><div class="field"><label>アイテムレベル</label><input id="eqgIlv" type="number"></div><div class="field"><label>装備ID</label><input id="eqgId" placeholder="EQP-0001"></div><div class="field"><label>名称（空欄ならセットから自動）</label><input id="eqgName"></div></div><div class="toolbar"><button id="eqgGenerate">生成して確認</button></div><div id="eqgStatus" class="item">未実行</div></details></div>
  <div class="card eqg-step"><h2>③ 試算・生成数値の確認</h2><div id="eqgResult"><div class="item">まだ生成されていません。</div></div></div>
  <div class="card eqg-step"><h2>④ JSON出力</h2><div class="eqg-output-guide"><div class="item"><b>調整用JSON</b><br><span class="small">生成条件・使用設定・生成結果をまとめて保存します。バランステストとの往復やAIでの再調整に使います。</span></div><div class="item"><b>完成装備JSON</b><br><span class="small">調整完了後の最終装備です。登録は既存の「管理 → 読込」から行います。</span></div></div><div class="toolbar eqg-actions" style="margin-top:12px"><button id="eqgWorkExport" disabled>調整用JSONを書き出す</button><button class="primary" id="eqgFinalExport" disabled>完成装備JSONを書き出す</button></div><div id="eqgExportStatus" class="item">先に生成内容を確認してください。</div></div>`;
  workspace.appendChild(section);
  const q=id=>section.querySelector('#'+id),kind=q('eqgKind'),type=q('eqgType'),slot=q('eqgArmorSlot'),slotField=q('eqgArmorSlotField'),ilv=q('eqgIlv');
  let loadedWeaponPayload=null,loadedArmorPayload=null;
  slot.innerHTML=optionHtml(Object.keys(config.armor.slot_coefficients));
  function refreshLevelRange(){const range=levelRange();ilv.min=range.min;ilv.max=range.max;if(!ilv.value||Number(ilv.value)>range.max)ilv.value=range.min;}
  function configStatus(){q('eqgConfigStatus').innerHTML=`<b>${config.config_id}</b> / ${config.config_version} / ${config.status}<br><span class="small">このプロジェクトの生成基準。現在の生成上限 iLv${levelRange().max}。変更後の新規生成から反映され、既存の完成データは自動変更しません。</span>`;}
  function fillConfig(){q('eqgConfigVersion').value=config.config_version;q('eqgAttackMul').value=config.weapon.performance.attack_multiplier;q('eqgAccuracyMul').value=config.weapon.performance.accuracy_multiplier;q('eqgCrit').value=config.weapon.performance.base_critical_rate;q('eqgCfgWeaponType').innerHTML=optionHtml(Object.keys(config.weapon.requirement_coefficients));q('eqgCfgArmorType').innerHTML=optionHtml(Object.keys(config.armor.requirement_coefficients));q('eqgCfgSlot').innerHTML=optionHtml(Object.keys(config.armor.slot_coefficients));syncWeaponCfg();syncArmorCfg();syncSlotCfg();refreshLevelRange();configStatus();}
  function syncWeaponCfg(){const c=config.weapon.requirement_coefficients[q('eqgCfgWeaponType').value]||{};q('eqgCfgStr').value=c.str??'';q('eqgCfgDex').value=c.dex??'';q('eqgCfgInt').value=c.int??'';}
  function syncArmorCfg(){const c=config.armor.requirement_coefficients[q('eqgCfgArmorType').value]||{};q('eqgCfgVit').value=c.vit??'';q('eqgCfgMnd').value=c.mnd??'';q('eqgCfgAgi').value=c.agi??'';}
  function syncSlotCfg(){q('eqgCfgSlotValue').value=config.armor.slot_coefficients[q('eqgCfgSlot').value]??'';}
  q('eqgCfgWeaponType').addEventListener('change',syncWeaponCfg);q('eqgCfgArmorType').addEventListener('change',syncArmorCfg);q('eqgCfgSlot').addEventListener('change',syncSlotCfg);fillConfig();
  q('eqgSaveConfig').addEventListener('click',()=>{try{const next=clone(config),wt=q('eqgCfgWeaponType').value,at=q('eqgCfgArmorType').value,sl=q('eqgCfgSlot').value;next.config_version=q('eqgConfigVersion').value.trim()||next.config_version;next.weapon.performance.attack_multiplier=Number(q('eqgAttackMul').value);next.weapon.performance.accuracy_multiplier=Number(q('eqgAccuracyMul').value);next.weapon.performance.base_critical_rate=Number(q('eqgCrit').value);next.weapon.requirement_coefficients[wt]={str:Number(q('eqgCfgStr').value),dex:Number(q('eqgCfgDex').value),int:Number(q('eqgCfgInt').value)};next.armor.requirement_coefficients[at]={vit:Number(q('eqgCfgVit').value),mnd:Number(q('eqgCfgMnd').value),agi:Number(q('eqgCfgAgi').value)};next.armor.slot_coefficients[sl]=Number(q('eqgCfgSlotValue').value);saveActiveConfig(next);fillConfig();q('eqgConfigStatus').innerHTML='<b>生成基準を保存しました。</b><br>'+q('eqgConfigStatus').innerHTML;}catch(e){alert('生成設定を保存できません: '+e.message);}});
  q('eqgExportConfig').addEventListener('click',()=>downloadJson(`Equipment_Generation_Config_${config.config_version}.json`,config));
  q('eqgConfigFile').addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;saveActiveConfig(JSON.parse(await f.text()));fillConfig();}catch(err){alert('設定JSONを読み込めません: '+err.message);}finally{e.target.value='';}});
  function rowsFromEditor(kindName){const root=q(kindName==='weapon'?'eqgWeaponNameRows':'eqgArmorNameRows');return [...root.querySelectorAll('.eqg-name-row')].map(row=>({level:Number(row.querySelector('[data-role="level"]').value),name:row.querySelector('[data-role="name"]').value.trim()}));}
  function renderNameEditor(kindName,rows){const root=q(kindName==='weapon'?'eqgWeaponNameRows':'eqgArmorNameRows');root.innerHTML=rows.map(r=>`<div class="eqg-name-row"><div class="field"><label>Lv</label><input data-role="level" type="number" min="1" value="${Number(r.level)}"></div><div class="field"><label>名前</label><input data-role="name" value="${String(r.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"></div></div>`).join('');}
  function fillPresetSelect(kindName){const sel=q(kindName==='weapon'?'eqgWeaponPreset':'eqgArmorPreset'),part=baseNameSets[kindName];sel.innerHTML=optionHtml(Object.keys(part.presets));sel.value=part.active_preset;renderNameEditor(kindName,part.presets[part.active_preset]);const status=q(kindName==='weapon'?'eqgWeaponSetStatus':'eqgArmorSetStatus');status.innerHTML=`使用中: <b>${part.active_preset}</b> / ${part.presets[part.active_preset].length}段階`;}
  function addNameRow(kindName){const rows=rowsFromEditor(kindName),next=Math.max(0,...rows.map(r=>Number(r.level)||0))+1;rows.push({level:next,name:''});renderNameEditor(kindName,rows);const root=q(kindName==='weapon'?'eqgWeaponNameRows':'eqgArmorNameRows');root.querySelector('.eqg-name-row:last-child [data-role="name"]')?.focus();}
  function usePreset(kindName){try{const sel=q(kindName==='weapon'?'eqgWeaponPreset':'eqgArmorPreset');activateBaseNamePreset(kindName,sel.value);fillPresetSelect(kindName);fillConfig();}catch(e){alert('プリセットを切り替えられません: '+e.message);}}
  function confirmSet(kindName){try{const part=baseNameSets[kindName],name=part.active_preset;saveBaseNameSet(kindName,name,rowsFromEditor(kindName),{activate:true});fillPresetSelect(kindName);fillConfig();const status=q(kindName==='weapon'?'eqgWeaponSetStatus':'eqgArmorSetStatus');status.innerHTML=`<b>設定を確定しました。</b> 使用中: ${name} / 生成上限 iLv${levelRange().max}`;}catch(e){alert('ベースアイテムセットを確定できません: '+e.message);}}
  function registerPreset(kindName){try{const input=q(kindName==='weapon'?'eqgWeaponPresetName':'eqgArmorPresetName'),name=input.value.trim();saveBaseNameSet(kindName,name,rowsFromEditor(kindName),{activate:true});input.value='';fillPresetSelect(kindName);fillConfig();}catch(e){alert('プリセット登録できません: '+e.message);}}
  q('eqgWeaponAddRow').addEventListener('click',()=>addNameRow('weapon'));q('eqgArmorAddRow').addEventListener('click',()=>addNameRow('armor'));q('eqgWeaponPresetUse').addEventListener('click',()=>usePreset('weapon'));q('eqgArmorPresetUse').addEventListener('click',()=>usePreset('armor'));q('eqgWeaponSetConfirm').addEventListener('click',()=>confirmSet('weapon'));q('eqgArmorSetConfirm').addEventListener('click',()=>confirmSet('armor'));q('eqgWeaponPresetSave').addEventListener('click',()=>registerPreset('weapon'));q('eqgArmorPresetSave').addEventListener('click',()=>registerPreset('armor'));fillPresetSelect('weapon');fillPresetSelect('armor');
  const syncTypes=()=>{const armor=kind.value==='armor',vals=armor?Object.keys(config.armor.requirement_coefficients):Object.keys(config.weapon.requirement_coefficients);type.innerHTML=optionHtml(vals);slotField.style.display=armor?'':'none';};kind.addEventListener('change',syncTypes);syncTypes();
  q('eqgGenerate').addEventListener('click',()=>{try{const input={kind:kind.value,base_item_type:type.value,armor_slot:kind.value==='armor'?slot.value:'',item_level:Number(ilv.value),seed:'manual',id:q('eqgId').value.trim()||(typeof global.nextMasterId==='function'?global.nextMasterId('equipment'):idsForBatch({},1)[0]),name:q('eqgName').value.trim(),tags:[]};const p=generate(input);batchPreview={request:clone(input),entries:[{input:p.input,record:p.record,validation:p.validation}],summary:summarize([{input:p.input,record:p.record,validation:p.validation}]),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};lastRequestPayload={schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:[input]};renderResult(section,batchPreview);q('eqgStatus').textContent=p.validation.ok?'生成・検証完了':'エラー: '+p.validation.errors.join(' / ');q('eqgWorkExport').disabled=false;q('eqgFinalExport').disabled=!p.validation.ok;updateExportStatus('confirmed');}catch(e){q('eqgStatus').textContent='生成エラー: '+e.message;}});
  function templateFor(kindName){return {schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:kindName==='weapon'?[{kind:'weapon',base_item_types:['片手剣','短剣'],item_level:{min:1,max:3},seed:'ai-weapon'}]:[{kind:'armor',base_item_types:['重装'],armor_slots:['鎧','頭'],item_level:{min:1,max:3},seed:'ai-armor'}]};}
  function ensureKindPayload(value,kindName){const reqs=normalizeRequestPayload(value);if(reqs.some(r=>r.kind!==kindName))throw new Error(kindName==='weapon'?'武器欄には武器要求だけを入れてください。':'防具欄には防具要求だけを入れてください。');return {schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:reqs};}
  function bindJsonKind(kindName){const cap=kindName==='weapon'?'Weapon':'Armor',file=q(`eqg${cap}JsonFile`),text=q(`eqg${cap}JsonText`),status=q(`eqg${cap}JsonStatus`);q(`eqg${cap}Template`).addEventListener('click',()=>downloadJson(`Equipment_AI_${cap}_Request_Template.json`,templateFor(kindName)));file.addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;const parsed=JSON.parse(await f.text()),normalized=ensureKindPayload(parsed,kindName);if(kindName==='weapon')loadedWeaponPayload=normalized;else loadedArmorPayload=normalized;text.value=JSON.stringify(normalized,null,2);status.textContent=`${f.name} を読み込みました。試算してください。`;}catch(err){if(kindName==='weapon')loadedWeaponPayload=null;else loadedArmorPayload=null;status.textContent='JSON読込エラー: '+err.message;}});const getPayload=()=>{const t=text.value.trim(),fallback=kindName==='weapon'?loadedWeaponPayload:loadedArmorPayload;return ensureKindPayload(t?JSON.parse(t):fallback||templateFor(kindName),kindName);};q(`eqg${cap}Simulate`).addEventListener('click',()=>{try{const p=generateRequestPayload(getPayload()),sim={...p,mode:'simulation',commit_allowed:false};renderResult(section,sim);status.textContent=`試算完了: ${p.summary.count}件 / 正常 ${p.summary.valid} / エラー ${p.summary.invalid} / 保存なし`;q('eqgWorkExport').disabled=false;q('eqgFinalExport').disabled=true;updateExportStatus('simulation');}catch(e){status.textContent='試算エラー: '+e.message;}});q(`eqg${cap}Generate`).addEventListener('click',()=>{try{const p=generateRequestPayload(getPayload());renderResult(section,p);status.textContent=`生成確認完了: ${p.summary.count}件 / 正常 ${p.summary.valid} / エラー ${p.summary.invalid}`;q('eqgWorkExport').disabled=false;q('eqgFinalExport').disabled=p.summary.invalid>0;updateExportStatus(p.summary.invalid?'error':'confirmed');}catch(e){status.textContent='生成エラー: '+e.message;}});}
  bindJsonKind('weapon');bindJsonKind('armor');
  function updateExportStatus(state){if(!batchPreview){q('eqgExportStatus').textContent='先に生成内容を確認してください。';return;}const n=batchPreview.summary?.count||0;if(state==='simulation'){q('eqgExportStatus').innerHTML=`<b>${n}件を試算済み。</b><br>調整用JSONは出力できます。完成装備JSONは「生成内容を確定確認」後に出力できます。`;}else if(state==='confirmed'){q('eqgExportStatus').innerHTML=`<b>${n}件の生成内容を確認済み。</b><br>調整用JSONと完成装備JSONを書き出せます。`;}else if(state==='error'){q('eqgExportStatus').innerHTML=`<b>${n}件を確認しましたがエラーがあります。</b><br>完成装備JSONはエラー解消後に出力できます。`;} }
  q('eqgWorkExport').addEventListener('click',()=>{try{downloadJson(`Equipment_Adjustment_Work_${Date.now()}.json`,workingPackage());q('eqgExportStatus').textContent='調整用JSONを書き出しました。バランステストとの往復・AI再編集に使用できます。';}catch(e){q('eqgExportStatus').textContent='出力エラー: '+e.message;}});
  q('eqgFinalExport').addEventListener('click',async()=>{try{const env=await managementEnvelope();downloadJson(`Equipment_Final_${Date.now()}.json`,env);q('eqgExportStatus').innerHTML='<b>完成装備JSONを書き出しました。</b><br>登録は「管理 → 読込」から行ってください。';}catch(e){q('eqgExportStatus').textContent='完成装備JSON出力エラー: '+e.message;}});
}

const api={GENERATOR_VERSION,initialize,generate,validate,getPreview,commit,expandBatchInputs,generateBatch,simulateBatch,getBatchPreview,commitBatch,prepareAiRequest,setConfigForTest,getConfig,saveActiveConfig,resetActiveConfig,normalizeRequestPayload,generateRequestPayload,requestTemplate,workingPackage,managementEnvelope,getBaseNameSets,saveBaseNameSet,activateBaseNamePreset};global.GKSEquipmentGenerator=api;
function boot(){initialize().then(()=>renderPanel()).catch(e=>{console.error('[EquipmentGenerator]',e);renderPanel();const s=document.getElementById('eqgStatus');if(s)s.textContent='初期化失敗: '+e.message;});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
