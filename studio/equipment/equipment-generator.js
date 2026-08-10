(function(global){
'use strict';
const GENERATOR_VERSION='1.2.0';
const ILV_NAMES=['','木の','鉄の','鋼鉄の','銀の','ダイヤの','ミスリルの','アダマンタイトの','オリハルコンの','巨人の','竜の','星鋼の'];
const AI_FORBIDDEN_NUMERIC_FIELDS=['required_str','required_dex','required_int','required_vit','required_mnd','required_agi','attack','accuracy','magic_weapon_bonus','base_critical_rate','hp_bonus','mp_bonus','evasion'];
let rules=null,config=null,preview=null,batchPreview=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=v=>Number.isFinite(Number(v));
const stamp=()=>new Date().toISOString();
async function loadJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' の読込に失敗しました: '+r.status);return r.json();}
async function initialize(){if(!rules)rules=await loadJson('./equipment/equipment-generation-rules.json');if(!config)config=await loadJson('./equipment/equipment-balance-config.json');validateConfig();return {rules:clone(rules),config:clone(config)};}
function validateConfig(){
  if(!rules||!config)throw new Error('Generation Rules / Balance Config が未読込です。');
  if(config.status!=='active')throw new Error('Active Balance Configではありません。');
  if(!config.config_id||!config.config_version)throw new Error('Balance Config metadataが不足しています。');
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
  if(!record.id)errors.push('Equipment IDがありません。');if(!record.name)errors.push('名称がありません。');
  const i=Number(record.item_level),range=levelRange();if(!Number.isInteger(i)||!finite(range.min)||!finite(range.max)||i<range.min||i>range.max)errors.push(`iLvは${range.min}〜${range.max}です。`);
  if(config.status!=='active')errors.push('Balance Configがactiveではありません。');
  for(const f of rules.forbidden_fields||[])if(Object.prototype.hasOwnProperty.call(record,f))errors.push('禁止fieldを検出: '+f);
  const kind=String(input.kind||record.generation?.generation_input?.kind||'');if(kind!=='weapon'&&kind!=='armor')errors.push('装備区分が不正です。');
  const required=kind==='armor'?rules.armor.required_fields:rules.weapon.required_fields,performance=kind==='armor'?rules.armor.performance_fields:rules.weapon.performance_fields;
  for(const f of required){if(!finite(record[f])||Number(record[f])<0)errors.push('要求値が不正: '+f);}for(const f of performance){if(!finite(record[f]))errors.push('正式性能が未確定: '+f);}
  if(kind==='weapon'&&String(input.base_item_type)==='杖'){
    const exists=Array.isArray(global.data?.tags)&&global.data.tags.some(t=>String(t.id)==='WEAPON_STAFF');
    if(!exists)errors.push('必須Tag WEAPON_STAFF がTag Masterに存在しません。Tag工程で正式IDを登録してから生成してください。');
    if(exists&&!record.tags.includes('WEAPON_STAFF'))errors.push('杖にはWEAPON_STAFF Tagが必要です。');
  }
  if(!record.generation?.generator_version||!record.generation?.generation_rules_version||!record.generation?.config_id||!record.generation?.config_version||!record.generation?.source_spec_version||!record.generation?.generated_at)errors.push('generation metadataが不足しています。');
  Object.entries(record).forEach(([k,v])=>{if(typeof v==='number'&&!Number.isFinite(v))errors.push('非有限値: '+k)});return {ok:errors.length===0,errors,warnings};
}
function generateRecord(input){const i=Number(input.item_level),range=levelRange();if(!Number.isInteger(i)||!finite(range.min)||!finite(range.max)||i<range.min||i>range.max)throw new Error(`iLvは${range.min}〜${range.max}で指定してください。`);return input.kind==='armor'?generateArmor(input):generateWeapon(input);}
function generate(input){validateConfig();const record=generateRecord(input),validation=validate(record,input);preview={record,validation,input:clone(input)};return clone(preview);}
function getPreview(){return clone(preview);}function getBatchPreview(){return clone(batchPreview);}
function writeEquipment(row){const idx=global.data.masters.equipment.findIndex(x=>String(x.id)===String(row.id));if(idx>=0)global.data.masters.equipment[idx]=row;else global.data.masters.equipment.push(row);}
function commit(){if(!preview)throw new Error('Previewがありません。');if(!preview.validation.ok)throw new Error('Validator ErrorがあるためCommitできません。');if(!global.data?.masters?.equipment)throw new Error('Equipment Masterが利用できません。');const row=clone(preview.record);row.updated_at=stamp();if(!row.created_at)row.created_at=row.updated_at;writeEquipment(row);if(typeof global.persist==='function')global.persist('equipment generator commit');preview=null;return clone(row);}
function idsForBatch(request,count){const prefix=String(request.id_prefix||'EQP-GEN');const width=Math.max(3,String(count).length);return Array.from({length:count},(_,i)=>`${prefix}-${String(i+1).padStart(width,'0')}`);}
function normalizeList(v){if(Array.isArray(v))return v.map(String).map(x=>x.trim()).filter(Boolean);return String(v||'').split(',').map(x=>x.trim()).filter(Boolean);}
function expandBatchInputs(request={}){
  validateConfig();const kind=String(request.kind||'weapon');if(!['weapon','armor'].includes(kind))throw new Error('kindはweaponまたはarmorです。');
  const range=levelRange(),min=Number(request.item_level_min??request.item_level?.min??range.min),max=Number(request.item_level_max??request.item_level?.max??min);
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<range.min||max>range.max||min>max)throw new Error(`iLv帯は${range.min}〜${range.max}内で指定してください。`);
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
function generateBatch(request={}){const inputs=expandBatchInputs(request),entries=inputs.map(input=>{if(input.kind==='weapon'&&input.base_item_type==='杖'&&Array.isArray(global.data?.tags)&&global.data.tags.some(t=>String(t.id)==='WEAPON_STAFF'))input.tags.push('WEAPON_STAFF');const record=generateRecord(input);return {input:clone(input),record,validation:validate(record,input)};});batchPreview={request:clone(request),entries,summary:summarize(entries),generated_at:stamp(),config_id:config.config_id,config_version:config.config_version};return clone(batchPreview);}
function simulateBatch(request={}){const result=generateBatch(request);return clone({...result,mode:'simulation',commit_allowed:false});}
function commitBatch(){if(!batchPreview)throw new Error('一括Previewがありません。');if(batchPreview.entries.some(x=>!x.validation.ok))throw new Error('Validator Errorがあるため一括Commitできません。');if(!global.data?.masters?.equipment)throw new Error('Equipment Masterが利用できません。');const rows=batchPreview.entries.map(x=>{const row=clone(x.record);row.updated_at=stamp();if(!row.created_at)row.created_at=row.updated_at;writeEquipment(row);return row;});if(typeof global.persist==='function')global.persist('equipment generator batch commit');batchPreview=null;return clone(rows);}
function prepareAiRequest(request={}){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new Error('AI requestはobjectで指定してください。');
  const forbidden=AI_FORBIDDEN_NUMERIC_FIELDS.filter(k=>Object.prototype.hasOwnProperty.call(request,k));if(forbidden.length)throw new Error('AI requestに正式数値fieldを直接指定できません: '+forbidden.join(', '));
  const allowed=new Set(['kind','base_item_type','base_item_types','armor_slot','armor_slots','item_level','item_level_min','item_level_max','count','seed','seed_prefix','id_prefix']);
  const unknown=Object.keys(request).filter(k=>!allowed.has(k));if(unknown.length)throw new Error('AI requestの未許可field: '+unknown.join(', '));
  return generateBatch(request);
}
function setConfigForTest(next){config=clone(next);}
const api={GENERATOR_VERSION,initialize,generate,validate,getPreview,commit,expandBatchInputs,generateBatch,simulateBatch,getBatchPreview,commitBatch,prepareAiRequest,setConfigForTest};global.GKSEquipmentGenerator=api;
function optionHtml(values){return values.map(v=>`<option value="${v}">${v}</option>`).join('');}
function renderPanel(){
  const workspace=document.querySelector('main.workspace');if(!workspace||document.getElementById('view-equipment-generator'))return;
  const section=document.createElement('section');section.id='view-equipment-generator';section.className='view hidden';section.innerHTML=`
  <div class="view-heading"><div><h1>Equipment Generator</h1><p class="small">Equipment完全統合仕様 v1.1 / BaseItem Pipeline v1.2</p></div></div>
  <div class="card"><h2>単体生成</h2><div class="grid">
    <div class="field"><label>区分</label><select id="eqgKind"><option value="weapon">武器</option><option value="armor">防具</option></select></div>
    <div class="field"><label>BaseItem種別</label><select id="eqgType"></select></div><div class="field" id="eqgArmorSlotField"><label>防具部位</label><select id="eqgArmorSlot"></select></div>
    <div class="field"><label>iLv</label><input id="eqgIlv" type="number" value="1"></div><div class="field"><label>Seed（追跡用）</label><input id="eqgSeed" value="0"></div>
    <div class="field"><label>Equipment ID</label><input id="eqgId" placeholder="EQP-0001"></div><div class="field"><label>名称</label><input id="eqgName" placeholder="空欄ならiLv名称+種別"></div>
  </div><div class="toolbar"><button class="primary" id="eqgGenerate">生成してPreview</button><button id="eqgCommit" disabled>Commit</button></div><div id="eqgStatus" class="item">Generation Rules / Active Balance Configを読み込んでいます。</div></div>
  <div class="card"><h2>一括試算 / 一括生成</h2><p class="small">同じGeneratorを使い、試算は保存しません。一括CommitはPreview全件がValidator OKの場合だけ可能です。</p><div class="grid">
    <div class="field"><label>区分</label><select id="eqgBatchKind"><option value="weapon">武器</option><option value="armor">防具</option></select></div>
    <div class="field"><label>BaseItem種別（カンマ区切り／空欄=全種）</label><input id="eqgBatchTypes"></div><div class="field"><label>防具部位（カンマ区切り／空欄=全部位）</label><input id="eqgBatchSlots"></div>
    <div class="field"><label>iLv From</label><input id="eqgBatchMin" type="number" value="1"></div><div class="field"><label>iLv To</label><input id="eqgBatchMax" type="number" value="11"></div>
    <div class="field"><label>ID Prefix</label><input id="eqgBatchPrefix" value="EQP-GEN"></div><div class="field"><label>Seed Prefix</label><input id="eqgBatchSeed" value="0"></div>
  </div><div class="toolbar"><button id="eqgSimulate">一括試算</button><button class="primary" id="eqgBatchGenerate">一括Preview</button><button id="eqgBatchCommit" disabled>一括Commit</button></div><div id="eqgBatchStatus" class="item">未実行</div></div>
  <div class="card"><h2>AI request接続</h2><p class="small">AIは意図・候補のみ指定します。正式数値fieldは拒否し、Studio Generatorが計算します。</p><textarea id="eqgAiRequest" rows="8" style="width:100%">{"kind":"weapon","base_item_types":["片手剣"],"item_level":{"min":1,"max":3},"id_prefix":"EQP-AI","seed":"ai"}</textarea><div class="toolbar"><button id="eqgAiPreview">AI requestをPreview</button></div><div id="eqgAiStatus" class="item">未実行</div></div>
  <div class="card"><h2>Validator / Preview</h2><pre id="eqgPreview" style="white-space:pre-wrap;overflow:auto;max-height:620px">未生成</pre></div>`;
  workspace.appendChild(section);
  const kind=section.querySelector('#eqgKind'),type=section.querySelector('#eqgType'),slot=section.querySelector('#eqgArmorSlot'),slotField=section.querySelector('#eqgArmorSlotField'),ilv=section.querySelector('#eqgIlv'),status=section.querySelector('#eqgStatus'),pre=section.querySelector('#eqgPreview'),commitBtn=section.querySelector('#eqgCommit'),batchCommit=section.querySelector('#eqgBatchCommit');
  const range=levelRange();ilv.min=String(range.min);ilv.max=String(range.max);ilv.value=String(range.min);section.querySelector('#eqgBatchMin').value=String(range.min);section.querySelector('#eqgBatchMax').value=String(range.max);slot.innerHTML=optionHtml(Object.keys(config?.armor?.slot_coefficients||{}));
  const syncTypes=()=>{const armor=kind.value==='armor';const vals=armor?Object.keys(config?.armor?.requirement_coefficients||{}):Object.keys(config?.weapon?.requirement_coefficients||{});type.innerHTML=optionHtml(vals);slotField.style.display=armor?'':'none'};kind.addEventListener('change',syncTypes);syncTypes();
  section.querySelector('#eqgGenerate').addEventListener('click',()=>{try{const id=section.querySelector('#eqgId').value.trim()||(typeof global.nextMasterId==='function'?global.nextMasterId('equipment'):'');const input={kind:kind.value,base_item_type:type.value,armor_slot:kind.value==='armor'?slot.value:'',item_level:Number(ilv.value),seed:section.querySelector('#eqgSeed').value,id,name:section.querySelector('#eqgName').value.trim(),tags:[]};if(input.kind==='weapon'&&input.base_item_type==='杖'&&Array.isArray(global.data?.tags)&&global.data.tags.some(t=>String(t.id)==='WEAPON_STAFF'))input.tags.push('WEAPON_STAFF');const p=generate(input);pre.textContent=JSON.stringify(p,null,2);commitBtn.disabled=!p.validation.ok;batchCommit.disabled=true;status.innerHTML=p.validation.ok?'<b>Validator OK</b> — Preview確認後にCommitできます。':'<b>Commit停止</b><br>'+p.validation.errors.map(x=>'・'+x).join('<br>');}catch(e){commitBtn.disabled=true;status.textContent='生成エラー: '+e.message;}});
  commitBtn.addEventListener('click',()=>{try{const row=commit();commitBtn.disabled=true;status.textContent='Commit完了: '+row.id+' / Equipment Masterへ保存しました。';if(typeof global.render==='function')global.render();}catch(e){status.textContent='Commit失敗: '+e.message;}});
  const batchRequest=()=>({kind:section.querySelector('#eqgBatchKind').value,base_item_types:section.querySelector('#eqgBatchTypes').value,armor_slots:section.querySelector('#eqgBatchSlots').value,item_level_min:Number(section.querySelector('#eqgBatchMin').value),item_level_max:Number(section.querySelector('#eqgBatchMax').value),id_prefix:section.querySelector('#eqgBatchPrefix').value.trim()||'EQP-GEN',seed_prefix:section.querySelector('#eqgBatchSeed').value});
  section.querySelector('#eqgSimulate').addEventListener('click',()=>{try{const p=simulateBatch(batchRequest());pre.textContent=JSON.stringify(p,null,2);batchCommit.disabled=true;section.querySelector('#eqgBatchStatus').textContent=`試算完了: ${p.summary.count}件 / valid ${p.summary.valid} / 保存なし`;}catch(e){batchCommit.disabled=true;section.querySelector('#eqgBatchStatus').textContent='試算エラー: '+e.message;}});
  section.querySelector('#eqgBatchGenerate').addEventListener('click',()=>{try{const p=generateBatch(batchRequest());pre.textContent=JSON.stringify(p,null,2);batchCommit.disabled=p.summary.invalid>0;section.querySelector('#eqgBatchStatus').textContent=`Preview完了: ${p.summary.count}件 / valid ${p.summary.valid} / invalid ${p.summary.invalid}`;}catch(e){batchCommit.disabled=true;section.querySelector('#eqgBatchStatus').textContent='一括生成エラー: '+e.message;}});
  batchCommit.addEventListener('click',()=>{try{const rows=commitBatch();batchCommit.disabled=true;section.querySelector('#eqgBatchStatus').textContent=`一括Commit完了: ${rows.length}件`;if(typeof global.render==='function')global.render();}catch(e){section.querySelector('#eqgBatchStatus').textContent='一括Commit失敗: '+e.message;}});
  section.querySelector('#eqgAiPreview').addEventListener('click',()=>{try{const req=JSON.parse(section.querySelector('#eqgAiRequest').value);const p=prepareAiRequest(req);pre.textContent=JSON.stringify(p,null,2);batchCommit.disabled=p.summary.invalid>0;section.querySelector('#eqgAiStatus').textContent=`AI request Preview完了: ${p.summary.count}件 / valid ${p.summary.valid}`;}catch(e){batchCommit.disabled=true;section.querySelector('#eqgAiStatus').textContent='AI requestエラー: '+e.message;}});
}
function boot(){initialize().then(()=>renderPanel()).catch(e=>{console.error('[EquipmentGenerator]',e);renderPanel();const s=document.getElementById('eqgStatus');if(s)s.textContent='初期化失敗: '+e.message;});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
