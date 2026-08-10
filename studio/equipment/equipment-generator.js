(function(global){
'use strict';
const GENERATOR_VERSION='1.3.0';
const ILV_NAMES=['','木の','鉄の','鋼鉄の','銀の','ダイヤの','ミスリルの','アダマンタイトの','オリハルコンの','巨人の','竜の','星鋼の'];
const AI_FORBIDDEN_NUMERIC_FIELDS=['required_str','required_dex','required_int','required_vit','required_mnd','required_agi','attack','accuracy','magic_weapon_bonus','base_critical_rate','hp_bonus','mp_bonus','evasion'];
let rules=null,config=null,defaultConfig=null,preview=null,batchPreview=null,lastRequestPayload=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=v=>Number.isFinite(Number(v));
const stamp=()=>new Date().toISOString();
const hostData=()=>global.GKSEquipmentHost?.getData?.()||global.data;
const hostPersist=message=>global.GKSEquipmentHost?.persist?.(message)??(typeof global.persist==='function'?global.persist(message):undefined);
async function loadJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' の読込に失敗しました: '+r.status);return r.json();}
async function initialize(){if(!rules)rules=await loadJson('./equipment/equipment-generation-rules.json');if(!defaultConfig)defaultConfig=await loadJson('./equipment/equipment-balance-config.json');if(!config){const saved=hostData()?.equipment_generation?.active_config;config=clone(saved||defaultConfig);}validateConfig();return {rules:clone(rules),config:clone(config)};}
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
  const out={id:String(input.id||''),name:String(input.name||`${ILV_NAMES[i]||''}${type}`),status:'draft',tags:Array.isArray(input.tags)?clone(input.tags):[],params:{},description:String(input.description||''),mod_ids:[],item_level:i,required_str,required_dex,required_int,attack,accuracy,magic_weapon_bonus,base_critical_rate};
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
  const out={id:String(input.id||''),name:String(input.name||`${ILV_NAMES[i]||''}${type}${slot}`),status:'draft',tags:Array.isArray(input.tags)?clone(input.tags):[],params:{},description:String(input.description||''),mod_ids:[],item_level:i,armor_category:type,armor_slot:slot,required_vit,required_mnd,required_agi,hp_bonus,mp_bonus,evasion};
  out.generation=generationMeta({...input,base_item_type:type},trace);return out;
}
function validate(record,input={}){
  const errors=[],warnings=[];if(!record||typeof record!=='object')return {ok:false,errors:['生成結果がありません。'],warnings};
  if(!record.id)errors.push('装備IDがありません。');if(!record.name)errors.push('名称がありません。');
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
function idsForBatch(request,count){const prefix=String(request.id_prefix||'EQP-GEN');const width=Math.max(3,String(count).length);return Array.from({length:count},(_,i)=>`${prefix}-${String(i+1).padStart(width,'0')}`);}
function normalizeList(v){if(Array.isArray(v))return v.map(String).map(x=>x.trim()).filter(Boolean);return String(v||'').split(',').map(x=>x.trim()).filter(Boolean);}
function expandBatchInputs(request={}){
  validateConfig();const kind=String(request.kind||'weapon');if(!['weapon','armor'].includes(kind))throw new Error('区分は武器または防具です。');
  const range=levelRange(),min=Number(request.item_level_min??request.item_level?.min??range.min),max=Number(request.item_level_max??request.item_level?.max??min);
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<range.min||max>range.max||min>max)throw new Error(`アイテムレベル帯は${range.min}〜${range.max}内で指定してください。`);
  let types=normalizeList(request.base_item_types||request.base_item_type);if(!types.length)types=kind==='armor'?Object.keys(config.armor.requirement_coefficients):Object.keys(config.weapon.requirement_coefficients);
  let slots=kind==='armor'?normalizeList(request.armor_slots||request.armor_slot):[''];if(kind==='armor'&&!slots.length)slots=Object.keys(config.armor.slot_coefficients);
  const combos=[];for(const type of types)for(const slot of slots)for(let i=min;i<=max;i++)combos.push({kind,base_item_type:type,armor_slot:kind==='armor'?slot:'',item_level:i});
  const limit=request.count==null?combos.length:Number(request.count);if(!Number.isInteger(limit)||limit<1)throw new Error('生成数は1以上の整数です。');
  const selected=combos.slice(0,Math.min(limit,combos.length)),ids=idsForBatch(request,selected.length),seedPrefix=String(request.seed_prefix??request.seed??'0');
  return selected.map((x,i)=>({...x,id:ids[i],seed:`${seedPrefix}:${i+1}`,tags:[]}));
}
function summarize(entries){
  const ok=entries.filter(x=>x.validation.ok).length,metrics={};for(const e of entries){for(const [k,v] of Object.entries(e.record)){if(typeof v!=='number'||['item_level'].includes(k))continue;(metrics[k]||(metrics[k]=[])).push(v);}}
  const summaryMetrics={};for(const [k,vals] of Object.entries(metrics)){const total=vals.reduce((a,b)=>a+b,0);summaryMetrics[k]={min:Math.min(...vals),max:Math.max(...vals),average:vals.length?total/vals.length:0};}
  return {count:entries.length,valid:ok,invalid:entries.length-ok,metrics:summaryMetrics};
}
function generateBatch(request={}){const inputs=expandBatchInputs(request),entries=inputs.map(input=>{if(input.kind==='weapon'&&input.base_item_type==='杖'&&Array.isArray(hostData()?.tags)&&hostData().tags.some(t=>String(t.id)==='WEAPON_STAFF'))input.tags.push('WEAPON_STAFF');const record=generateRecord(input);return {input:clone(input),record,validation:validate(record,input)};});batchPreview={request:clone(request),entries,summary:summarize(entries),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};return clone(batchPreview);}
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
  validateConfig();const requests=normalizeRequestPayload(payload),entries=[];
  requests.forEach((req,requestIndex)=>{const part=generateBatch(req);part.entries.forEach(e=>entries.push({...e,request_index:requestIndex}));});
  const ids=new Set();for(const e of entries){const id=String(e.record.id||'');if(ids.has(id))throw new Error('JSON内で装備IDが重複しています: '+id);ids.add(id);}
  batchPreview={request:{schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:clone(requests)},entries,summary:summarize(entries),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};lastRequestPayload=clone(batchPreview.request);return clone(batchPreview);
}
function requestTemplate(){return {schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:[{kind:'weapon',base_item_types:['片手剣','短剣'],item_level:{min:1,max:3},id_prefix:'EQP-AI-W',seed:'ai-weapon'},{kind:'armor',base_item_types:['重装'],armor_slots:['鎧','頭'],item_level:{min:1,max:3},id_prefix:'EQP-AI-A',seed:'ai-armor'}]};}
function workingPackage(){if(!batchPreview)throw new Error('先に試算または生成確認を実行してください。');return {schema:'GKS_EQUIPMENT_GENERATION_WORK',version:'1.0.0',generated_at:stamp(),active_config:clone(config),generation_requests:clone(lastRequestPayload?.requests||[batchPreview.request]),summary:clone(batchPreview.summary),equipment:batchPreview.entries.map(e=>clone(e.record))};}
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
  const style=document.createElement('style');style.textContent=`#view-equipment-generator .eqg-step{border-left:4px solid var(--accent,#3b82f6)}#view-equipment-generator .eqg-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}#view-equipment-generator .eqg-metrics>div{padding:10px;border:1px solid var(--line,#ddd);border-radius:10px}#view-equipment-generator textarea{width:100%;box-sizing:border-box}#view-equipment-generator .eqg-actions button{min-height:44px}@media(min-width:700px){#view-equipment-generator .eqg-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}}`;document.head.appendChild(style);
  const section=document.createElement('section');section.id='view-equipment-generator';section.className='view hidden';section.innerHTML=`
  <div class="view-heading"><div><h1>装備生成</h1><p class="small">①生成設定 → ②JSON/手動入力 → ③試算・数値確認 → ④JSON出力。完成品の登録は「管理 → 読込」から行います。</p></div></div>
  <div class="card eqg-step"><h2>① 生成設定</h2><div id="eqgConfigStatus" class="item"></div><details><summary><b>係数を変更する</b></summary><div class="grid" style="margin-top:12px"><div class="field"><label>設定バージョン</label><input id="eqgConfigVersion"></div><div class="field"><label>攻撃力倍率</label><input id="eqgAttackMul" type="number" step="any"></div><div class="field"><label>命中力倍率</label><input id="eqgAccuracyMul" type="number" step="any"></div><div class="field"><label>基礎クリティカル率</label><input id="eqgCrit" type="number" step="any"></div><div class="field"><label>武器種</label><select id="eqgCfgWeaponType"></select></div><div class="field"><label>STR係数</label><input id="eqgCfgStr" type="number" step="any"></div><div class="field"><label>DEX係数</label><input id="eqgCfgDex" type="number" step="any"></div><div class="field"><label>INT係数</label><input id="eqgCfgInt" type="number" step="any"></div><div class="field"><label>防具カテゴリ</label><select id="eqgCfgArmorType"></select></div><div class="field"><label>VIT係数</label><input id="eqgCfgVit" type="number" step="any"></div><div class="field"><label>MND係数</label><input id="eqgCfgMnd" type="number" step="any"></div><div class="field"><label>AGI係数</label><input id="eqgCfgAgi" type="number" step="any"></div><div class="field"><label>防具部位</label><select id="eqgCfgSlot"></select></div><div class="field"><label>部位係数</label><input id="eqgCfgSlotValue" type="number" step="any"></div></div><div class="toolbar eqg-actions"><button class="primary" id="eqgSaveConfig">この設定を生成基準にする</button><button id="eqgExportConfig">設定JSON出力</button><label class="button-like" for="eqgConfigFile">設定JSON読込</label><input id="eqgConfigFile" type="file" accept=".json,application/json" hidden></div></details></div>
  <div class="card eqg-step"><h2>② AI・JSON一括入力</h2><p class="small">AIには装備種別・iLv帯・件数・ID接頭辞などを作らせます。攻撃力や要求値などの正式数値はStudioが現在の生成設定から計算します。</p><div class="toolbar eqg-actions"><label class="button-like" for="eqgJsonFile">JSONファイルを選択</label><input id="eqgJsonFile" type="file" accept=".json,application/json" hidden><button id="eqgTemplate">AI用テンプレート出力</button></div><div id="eqgJsonFileName" class="item">ファイル未選択</div><details><summary>JSONを貼り付ける</summary><textarea id="eqgJsonText" rows="10"></textarea></details><div class="toolbar eqg-actions"><button id="eqgJsonSimulate">試算する（保存なし）</button><button class="primary" id="eqgJsonGenerate">生成内容を確定確認</button></div><div id="eqgJsonStatus" class="item">未実行</div></div>
  <div class="card"><details><summary><b>手動で1件作る</b></summary><div class="grid" style="margin-top:12px"><div class="field"><label>区分</label><select id="eqgKind"><option value="weapon">武器</option><option value="armor">防具</option></select></div><div class="field"><label>基本装備種別</label><select id="eqgType"></select></div><div class="field" id="eqgArmorSlotField"><label>防具部位</label><select id="eqgArmorSlot"></select></div><div class="field"><label>アイテムレベル</label><input id="eqgIlv" type="number"></div><div class="field"><label>装備ID</label><input id="eqgId" placeholder="EQP-0001"></div><div class="field"><label>名称</label><input id="eqgName"></div></div><div class="toolbar"><button id="eqgGenerate">生成して確認</button></div><div id="eqgStatus" class="item">未実行</div></details></div>
  <div class="card eqg-step"><h2>③ 試算・生成数値の確認</h2><div id="eqgResult"><div class="item">まだ生成されていません。</div></div></div>
  <div class="card eqg-step"><h2>④ JSON出力</h2><p class="small">バランステストとの往復には「生成作業JSON」を使います。完成後は「完成JSON（管理読込用）」を書き出し、既存の「管理 → 読込」から登録します。</p><div class="toolbar eqg-actions"><button id="eqgWorkExport" disabled>生成作業JSON出力</button><button class="primary" id="eqgFinalExport" disabled>完成JSON（管理読込用）出力</button></div><div id="eqgExportStatus" class="item">生成確認後に出力できます。</div></div>`;
  workspace.appendChild(section);
  const q=id=>section.querySelector('#'+id),kind=q('eqgKind'),type=q('eqgType'),slot=q('eqgArmorSlot'),slotField=q('eqgArmorSlotField'),ilv=q('eqgIlv');let loadedPayload=null;
  const range=levelRange();ilv.min=range.min;ilv.max=range.max;ilv.value=range.min;slot.innerHTML=optionHtml(Object.keys(config.armor.slot_coefficients));
  function configStatus(){q('eqgConfigStatus').innerHTML=`<b>${config.config_id}</b> / ${config.config_version} / ${config.status}<br><span class="small">このプロジェクトの生成基準。変更後の新規生成から反映され、既存の完成データは自動変更しません。</span>`;}
  function fillConfig(){q('eqgConfigVersion').value=config.config_version;q('eqgAttackMul').value=config.weapon.performance.attack_multiplier;q('eqgAccuracyMul').value=config.weapon.performance.accuracy_multiplier;q('eqgCrit').value=config.weapon.performance.base_critical_rate;q('eqgCfgWeaponType').innerHTML=optionHtml(Object.keys(config.weapon.requirement_coefficients));q('eqgCfgArmorType').innerHTML=optionHtml(Object.keys(config.armor.requirement_coefficients));q('eqgCfgSlot').innerHTML=optionHtml(Object.keys(config.armor.slot_coefficients));syncWeaponCfg();syncArmorCfg();syncSlotCfg();configStatus();}
  function syncWeaponCfg(){const c=config.weapon.requirement_coefficients[q('eqgCfgWeaponType').value]||{};q('eqgCfgStr').value=c.str??'';q('eqgCfgDex').value=c.dex??'';q('eqgCfgInt').value=c.int??'';}
  function syncArmorCfg(){const c=config.armor.requirement_coefficients[q('eqgCfgArmorType').value]||{};q('eqgCfgVit').value=c.vit??'';q('eqgCfgMnd').value=c.mnd??'';q('eqgCfgAgi').value=c.agi??'';}
  function syncSlotCfg(){q('eqgCfgSlotValue').value=config.armor.slot_coefficients[q('eqgCfgSlot').value]??'';}
  q('eqgCfgWeaponType').addEventListener('change',syncWeaponCfg);q('eqgCfgArmorType').addEventListener('change',syncArmorCfg);q('eqgCfgSlot').addEventListener('change',syncSlotCfg);fillConfig();
  q('eqgSaveConfig').addEventListener('click',()=>{try{const next=clone(config),wt=q('eqgCfgWeaponType').value,at=q('eqgCfgArmorType').value,sl=q('eqgCfgSlot').value;next.config_version=q('eqgConfigVersion').value.trim()||next.config_version;next.weapon.performance.attack_multiplier=Number(q('eqgAttackMul').value);next.weapon.performance.accuracy_multiplier=Number(q('eqgAccuracyMul').value);next.weapon.performance.base_critical_rate=Number(q('eqgCrit').value);next.weapon.requirement_coefficients[wt]={str:Number(q('eqgCfgStr').value),dex:Number(q('eqgCfgDex').value),int:Number(q('eqgCfgInt').value)};next.armor.requirement_coefficients[at]={vit:Number(q('eqgCfgVit').value),mnd:Number(q('eqgCfgMnd').value),agi:Number(q('eqgCfgAgi').value)};next.armor.slot_coefficients[sl]=Number(q('eqgCfgSlotValue').value);saveActiveConfig(next);fillConfig();q('eqgConfigStatus').innerHTML='<b>生成基準を保存しました。</b><br>'+q('eqgConfigStatus').innerHTML;}catch(e){alert('生成設定を保存できません: '+e.message);}});
  q('eqgExportConfig').addEventListener('click',()=>downloadJson(`Equipment_Generation_Config_${config.config_version}.json`,config));
  q('eqgConfigFile').addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;saveActiveConfig(JSON.parse(await f.text()));fillConfig();}catch(err){alert('設定JSONを読み込めません: '+err.message);}finally{e.target.value='';}});
  const syncTypes=()=>{const armor=kind.value==='armor',vals=armor?Object.keys(config.armor.requirement_coefficients):Object.keys(config.weapon.requirement_coefficients);type.innerHTML=optionHtml(vals);slotField.style.display=armor?'':'none';};kind.addEventListener('change',syncTypes);syncTypes();
  q('eqgGenerate').addEventListener('click',()=>{try{const input={kind:kind.value,base_item_type:type.value,armor_slot:kind.value==='armor'?slot.value:'',item_level:Number(ilv.value),seed:'manual',id:q('eqgId').value.trim()||(typeof global.nextMasterId==='function'?global.nextMasterId('equipment'):'EQP-MANUAL'),name:q('eqgName').value.trim(),tags:[]};const p=generate(input);batchPreview={request:clone(input),entries:[{input:p.input,record:p.record,validation:p.validation}],summary:summarize([{input:p.input,record:p.record,validation:p.validation}]),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};lastRequestPayload={schema:'GKS_EQUIPMENT_GENERATION_REQUEST',version:'1.0.0',requests:[input]};renderResult(section,batchPreview);q('eqgStatus').textContent=p.validation.ok?'生成・検証完了':'エラー: '+p.validation.errors.join(' / ');q('eqgWorkExport').disabled=false;q('eqgFinalExport').disabled=!p.validation.ok;}catch(e){q('eqgStatus').textContent='生成エラー: '+e.message;}});
  q('eqgTemplate').addEventListener('click',()=>downloadJson('Equipment_AI_Generation_Request_Template.json',requestTemplate()));
  q('eqgJsonFile').addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;loadedPayload=JSON.parse(await f.text());q('eqgJsonText').value=JSON.stringify(loadedPayload,null,2);q('eqgJsonFileName').innerHTML=`<b>${f.name}</b> を読み込みました。`;q('eqgJsonStatus').textContent='読込完了。試算してください。';}catch(err){loadedPayload=null;q('eqgJsonStatus').textContent='JSON読込エラー: '+err.message;}});
  function payload(){const t=q('eqgJsonText').value.trim();return t?JSON.parse(t):loadedPayload||requestTemplate();}
  q('eqgJsonSimulate').addEventListener('click',()=>{try{const p=generateRequestPayload(payload());const sim={...p,mode:'simulation',commit_allowed:false};renderResult(section,sim);q('eqgJsonStatus').textContent=`試算完了: ${p.summary.count}件 / 正常 ${p.summary.valid} / エラー ${p.summary.invalid} / 保存なし`;q('eqgWorkExport').disabled=false;q('eqgFinalExport').disabled=true;}catch(e){q('eqgJsonStatus').textContent='試算エラー: '+e.message;}});
  q('eqgJsonGenerate').addEventListener('click',()=>{try{const p=generateRequestPayload(payload());renderResult(section,p);q('eqgJsonStatus').textContent=`生成確認完了: ${p.summary.count}件 / 正常 ${p.summary.valid} / エラー ${p.summary.invalid}`;q('eqgWorkExport').disabled=false;q('eqgFinalExport').disabled=p.summary.invalid>0;}catch(e){q('eqgJsonStatus').textContent='生成エラー: '+e.message;}});
  q('eqgWorkExport').addEventListener('click',()=>{try{downloadJson(`Equipment_Generation_Work_${Date.now()}.json`,workingPackage());q('eqgExportStatus').textContent='生成作業JSONを出力しました。バランステストとの往復・AI再編集に使用できます。';}catch(e){q('eqgExportStatus').textContent='出力エラー: '+e.message;}});
  q('eqgFinalExport').addEventListener('click',async()=>{try{const env=await managementEnvelope();downloadJson(`Equipment_Final_For_Management_${Date.now()}.json`,env);q('eqgExportStatus').innerHTML='<b>完成JSONを出力しました。</b><br>登録は「管理 → 読込」から行ってください。';}catch(e){q('eqgExportStatus').textContent='完成JSON出力エラー: '+e.message;}});
}
const api={GENERATOR_VERSION,initialize,generate,validate,getPreview,commit,expandBatchInputs,generateBatch,simulateBatch,getBatchPreview,commitBatch,prepareAiRequest,setConfigForTest,getConfig,saveActiveConfig,resetActiveConfig,normalizeRequestPayload,generateRequestPayload,requestTemplate,workingPackage,managementEnvelope};global.GKSEquipmentGenerator=api;
function boot(){initialize().then(()=>renderPanel()).catch(e=>{console.error('[EquipmentGenerator]',e);renderPanel();const s=document.getElementById('eqgStatus');if(s)s.textContent='初期化失敗: '+e.message;});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
