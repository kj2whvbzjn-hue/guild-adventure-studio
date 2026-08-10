(function(global){
'use strict';
const GENERATOR_VERSION='1.1.0';
const ILV_NAMES=['','木の','鉄の','鋼鉄の','銀の','ダイヤの','ミスリルの','アダマンタイトの','オリハルコンの','巨人の','竜の','星鋼の'];
let rules=null,config=null,preview=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=v=>Number.isFinite(Number(v));
const stamp=()=>new Date().toISOString();
async function loadJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' の読込に失敗しました: '+r.status);return r.json();}
async function initialize(){
  if(!rules)rules=await loadJson('./equipment/equipment-generation-rules.json');
  if(!config)config=await loadJson('./equipment/equipment-balance-config.json');
  validateConfig();return {rules:clone(rules),config:clone(config)};
}
function validateConfig(){
  if(!rules||!config)throw new Error('Generation Rules / Balance Config が未読込です。');
  if(config.status!=='active')throw new Error('Active Balance Configではありません。');
  if(!config.config_id||!config.config_version)throw new Error('Balance Config metadataが不足しています。');
}
function generationMeta(input,trace){return {
  generator_version:GENERATOR_VERSION,generation_rules_version:rules.generation_rules_version,
  config_id:config.config_id,config_version:config.config_version,source_spec_version:rules.source_spec_version,
  seed:String(input.seed??'0'),base_item_type:String(input.base_item_type||''),item_level:Number(input.item_level),
  generated_at:stamp(),generation_input:clone(input),calculation_trace:trace
};}
function levelRange(){
  const r=config?.item_level||{};return {min:Number(r.min),max:Number(r.max)};
}
function normalizeArmorCategory(type){
  const raw=String(type||'');return String(config?.armor?.category_aliases?.[raw]||raw);
}
function generateWeapon(input){
  const i=Number(input.item_level),type=String(input.base_item_type||''),c=config.weapon.requirement_coefficients[type];
  if(!c)throw new Error('未定義の武器種です: '+type);
  const required_str=i*Number(c.str),required_dex=i*Number(c.dex),required_int=i*Number(c.int);
  const perf=config.weapon.performance||{};
  const attack=required_str*Number(perf.attack_multiplier);
  const accuracy=required_dex*Number(perf.accuracy_multiplier);
  const magicMultiplier=perf.magic_int_multiplier_source==='weapon_str_requirement_coefficient'?Number(c.str):NaN;
  const magic_weapon_bonus=required_int*magicMultiplier;
  const base_critical_rate=Number(perf.base_critical_rate);
  const trace=[
    `required_str=${i}*${c.str}=${required_str}`,`required_dex=${i}*${c.dex}=${required_dex}`,`required_int=${i}*${c.int}=${required_int}`,
    `attack=${required_str}*${perf.attack_multiplier}=${attack}`,
    `accuracy=${required_dex}*${perf.accuracy_multiplier}=${accuracy}`,
    `magic_weapon_bonus=${required_int}*weapon_str_coefficient(${c.str})=${magic_weapon_bonus}`,
    `base_critical_rate=${base_critical_rate}`
  ];
  const out={id:String(input.id||''),name:String(input.name||`${ILV_NAMES[i]||''}${type}`),status:'draft',tags:Array.isArray(input.tags)?clone(input.tags):[],params:{},description:String(input.description||''),mod_ids:[],item_level:i,required_str,required_dex,required_int,attack,accuracy,magic_weapon_bonus,base_critical_rate};
  out.generation=generationMeta(input,trace);return out;
}
function generateArmor(input){
  const i=Number(input.item_level),rawType=String(input.base_item_type||''),type=normalizeArmorCategory(rawType),slot=String(input.armor_slot||'');
  const c=config.armor.requirement_coefficients[type];
  if(!c)throw new Error('未定義の防具カテゴリです: '+rawType);
  const slotCoefficient=Number(config.armor.slot_coefficients?.[slot]);
  if(!finite(slotCoefficient))throw new Error('未定義の防具部位です: '+slot);
  const required_vit=i*Number(c.vit),required_mnd=i*Number(c.mnd),required_agi=i*Number(c.agi);
  const hp_bonus=required_vit*slotCoefficient,mp_bonus=required_mnd*slotCoefficient,evasion=required_agi*slotCoefficient;
  const trace=[`armor_category=${type}`,`armor_slot=${slot}`,`required_vit=${i}*${c.vit}=${required_vit}`,`required_mnd=${i}*${c.mnd}=${required_mnd}`,`required_agi=${i}*${c.agi}=${required_agi}`,`slot_coefficient=${slotCoefficient}`,`hp_bonus=${required_vit}*${slotCoefficient}=${hp_bonus}`,`mp_bonus=${required_mnd}*${slotCoefficient}=${mp_bonus}`,`evasion=${required_agi}*${slotCoefficient}=${evasion}`];
  const out={id:String(input.id||''),name:String(input.name||`${ILV_NAMES[i]||''}${type}${slot}`),status:'draft',tags:Array.isArray(input.tags)?clone(input.tags):[],params:{},description:String(input.description||''),mod_ids:[],item_level:i,armor_category:type,armor_slot:slot,required_vit,required_mnd,required_agi,hp_bonus,mp_bonus,evasion};
  out.generation=generationMeta({...input,base_item_type:type},trace);return out;
}
function validate(record,input={}){
  const errors=[],warnings=[];if(!record||typeof record!=='object')return {ok:false,errors:['生成結果がありません。'],warnings};
  if(!record.id)errors.push('Equipment IDがありません。');if(!record.name)errors.push('名称がありません。');
  const i=Number(record.item_level),range=levelRange();if(!Number.isInteger(i)||!finite(range.min)||!finite(range.max)||i<range.min||i>range.max)errors.push(`iLvは${range.min}〜${range.max}です。`);
  if(config.status!=='active')errors.push('Balance Configがactiveではありません。');
  for(const f of rules.forbidden_fields||[])if(Object.prototype.hasOwnProperty.call(record,f))errors.push('禁止fieldを検出: '+f);
  const kind=String(input.kind||record.generation?.generation_input?.kind||'');
  const required=kind==='armor'?rules.armor.required_fields:rules.weapon.required_fields;
  const performance=kind==='armor'?rules.armor.performance_fields:rules.weapon.performance_fields;
  for(const f of required){if(!finite(record[f])||Number(record[f])<0)errors.push('要求値が不正: '+f);}
  for(const f of performance){if(!finite(record[f]))errors.push('正式性能が未確定: '+f);}
  if(kind==='weapon'&&String(input.base_item_type)==='杖'){
    const exists=Array.isArray(global.data?.tags)&&global.data.tags.some(t=>String(t.id)==='WEAPON_STAFF');
    if(!exists)errors.push('必須Tag WEAPON_STAFF がTag Masterに存在しません。Tag工程で正式IDを登録してから生成してください。');
    if(exists&&!record.tags.includes('WEAPON_STAFF'))errors.push('杖にはWEAPON_STAFF Tagが必要です。');
  }
  if(!record.generation?.generator_version||!record.generation?.generation_rules_version||!record.generation?.config_id||!record.generation?.config_version||!record.generation?.source_spec_version||!record.generation?.generated_at)errors.push('generation metadataが不足しています。');
  Object.entries(record).forEach(([k,v])=>{if(typeof v==='number'&&!Number.isFinite(v))errors.push('非有限値: '+k)});
  return {ok:errors.length===0,errors,warnings};
}
function generate(input){validateConfig();const i=Number(input.item_level),range=levelRange();if(!Number.isInteger(i)||!finite(range.min)||!finite(range.max)||i<range.min||i>range.max)throw new Error(`iLvは${range.min}〜${range.max}で指定してください。`);const record=input.kind==='armor'?generateArmor(input):generateWeapon(input);const validation=validate(record,input);preview={record,validation,input:clone(input)};return clone(preview);}
function getPreview(){return clone(preview);}
function commit(){
  if(!preview)throw new Error('Previewがありません。');if(!preview.validation.ok)throw new Error('Validator ErrorがあるためCommitできません。');
  if(!global.data?.masters?.equipment)throw new Error('Equipment Masterが利用できません。');
  const row=clone(preview.record);row.updated_at=stamp();if(!row.created_at)row.created_at=row.updated_at;
  const idx=global.data.masters.equipment.findIndex(x=>String(x.id)===String(row.id));if(idx>=0)global.data.masters.equipment[idx]=row;else global.data.masters.equipment.push(row);
  if(typeof global.persist==='function')global.persist('equipment generator commit');
  preview=null;return clone(row);
}
function setConfigForTest(next){config=clone(next);}
const api={GENERATOR_VERSION,initialize,generate,validate,getPreview,commit,setConfigForTest};global.GKSEquipmentGenerator=api;

function optionHtml(values){return values.map(v=>`<option value="${v}">${v}</option>`).join('');}
function renderPanel(){
  const workspace=document.querySelector('main.workspace');if(!workspace||document.getElementById('view-equipment-generator'))return;
  const section=document.createElement('section');section.id='view-equipment-generator';section.className='view hidden';section.innerHTML=`
  <div class="view-heading"><div><h1>Equipment Generator</h1><p class="small">Equipment完全統合仕様 v1.1 / Generator → Validator → Preview → Commit</p></div></div>
  <div class="card"><h2>BaseItem生成</h2><div class="grid">
    <div class="field"><label>区分</label><select id="eqgKind"><option value="weapon">武器</option><option value="armor">防具</option></select></div>
    <div class="field"><label>BaseItem種別</label><select id="eqgType"></select></div>
    <div class="field" id="eqgArmorSlotField"><label>防具部位</label><select id="eqgArmorSlot"></select></div>
    <div class="field"><label>iLv</label><input id="eqgIlv" type="number" value="1"></div>
    <div class="field"><label>Seed（追跡用）</label><input id="eqgSeed" value="0"></div>
    <div class="field"><label>Equipment ID</label><input id="eqgId" placeholder="EQP-0001"></div>
    <div class="field"><label>名称</label><input id="eqgName" placeholder="空欄ならiLv名称+種別"></div>
  </div><div class="toolbar"><button class="primary" id="eqgGenerate">生成してPreview</button><button id="eqgCommit" disabled>Commit</button></div>
  <div id="eqgStatus" class="item">Generation Rules / Active Balance Configを読み込んでいます。</div></div>
  <div class="card"><h2>Validator / Preview</h2><pre id="eqgPreview" style="white-space:pre-wrap;overflow:auto;max-height:520px">未生成</pre></div>`;
  workspace.appendChild(section);
  const kind=section.querySelector('#eqgKind'),type=section.querySelector('#eqgType'),slot=section.querySelector('#eqgArmorSlot'),slotField=section.querySelector('#eqgArmorSlotField'),ilv=section.querySelector('#eqgIlv'),status=section.querySelector('#eqgStatus'),pre=section.querySelector('#eqgPreview'),commitBtn=section.querySelector('#eqgCommit');
  const range=levelRange();ilv.min=String(range.min);ilv.max=String(range.max);ilv.value=String(range.min);slot.innerHTML=optionHtml(Object.keys(config?.armor?.slot_coefficients||{}));
  const syncTypes=()=>{const armor=kind.value==='armor';const vals=armor?Object.keys(config?.armor?.requirement_coefficients||{}):Object.keys(config?.weapon?.requirement_coefficients||{});type.innerHTML=optionHtml(vals);slotField.style.display=armor?'':'none'};
  kind.addEventListener('change',syncTypes);syncTypes();
  section.querySelector('#eqgGenerate').addEventListener('click',()=>{try{const id=section.querySelector('#eqgId').value.trim()||(typeof global.nextMasterId==='function'?global.nextMasterId('equipment'):'');const input={kind:kind.value,base_item_type:type.value,armor_slot:kind.value==='armor'?slot.value:'',item_level:Number(section.querySelector('#eqgIlv').value),seed:section.querySelector('#eqgSeed').value,id,name:section.querySelector('#eqgName').value.trim(),tags:[]};if(input.kind==='weapon'&&input.base_item_type==='杖'&&Array.isArray(global.data?.tags)&&global.data.tags.some(t=>String(t.id)==='WEAPON_STAFF'))input.tags.push('WEAPON_STAFF');const p=generate(input);pre.textContent=JSON.stringify(p,null,2);commitBtn.disabled=!p.validation.ok;status.innerHTML=p.validation.ok?'<b>Validator OK</b> — Preview確認後にCommitできます。':'<b>Commit停止</b><br>'+p.validation.errors.map(x=>'・'+x).join('<br>');}catch(e){commitBtn.disabled=true;status.textContent='生成エラー: '+e.message;}});
  commitBtn.addEventListener('click',()=>{try{const row=commit();commitBtn.disabled=true;status.textContent='Commit完了: '+row.id+' / Equipment Masterへ保存しました。';if(typeof global.render==='function')global.render();}catch(e){status.textContent='Commit失敗: '+e.message;}});
}
function boot(){initialize().then(()=>{renderPanel();}).catch(e=>{console.error('[EquipmentGenerator]',e);renderPanel();const s=document.getElementById('eqgStatus');if(s)s.textContent='初期化失敗: '+e.message;});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
