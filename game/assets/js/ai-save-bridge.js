(function(root,factory){
  const Program=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-program-model.js'):root?.GKSAIProgramModel;
  const Layout=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-layout-model.js'):root?.GKSAILayoutModel;
  const api=factory(Program,Layout);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAISaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Program,Layout){
  'use strict';
  if(!Program||!Layout)throw new Error('Formal AI save dependencies are required');
  const SAVE_VERSION=3;
  const PRESET_ID_PATTERN=/^AIPR-([0-9]+)$/;
  const SAVE_KEYS=new Set(['saveVersion','schemaRevision','gameVersion','createdAt','updatedAt','characters','aiPrograms','aiLayouts','aiPresets','partyIds','selectedQuestId','inventory','guild','flags','quest_progress','quest_resources','adventure']);
  const SAVE_REQUIRED=Object.freeze([...SAVE_KEYS]);
  const CHARACTER_KEYS=new Set(['id','name','level','job','stats','skills','equippedSkillId','formalAiBinding','equipment','jobHistory','growthHistory','createdAt']);
  const CHARACTER_REQUIRED=Object.freeze([...CHARACTER_KEYS]);
  const PROGRAM_KEYS=new Set(['schema_version','data_version','id','name','version','status','entry_node_id','nodes','edges','subroutines','tags','description','updated_at','compiled']);
  const NODE_KEYS=new Set(['instance_id','master_node_id','master_data_version','node_type','position','parameters','comment']);
  const POSITION_KEYS=new Set(['x','y']);
  const EDGE_KEYS=new Set(['edge_id','from','to']);
  const ENDPOINT_KEYS=new Set(['node_id','port_id']);
  const SUBROUTINE_KEYS=new Set(['id','entry_node_id']);
  const LAYOUT_KEYS=new Set(['layout_version','layout_id','program_id','width','height','chips','extensions']);
  const CHIP_KEYS=new Set(['instance_id','x','y','rotation']);
  const EXTENSION_KEYS=new Set(['id','x','y','shape','rotation']);
  const PRESET_KEYS=new Set(['preset_id','name','source','program','layout','created_at','updated_at']);
  const PRESET_REQUIRED=Object.freeze([...PRESET_KEYS]);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function schemaError(errors,at,message){errors.push(`${at}: ${message}`);}
  function allowedKeys(errors,value,allowed,at){if(!isObject(value)){schemaError(errors,at,'object required');return false;}for(const key of Object.keys(value))if(!allowed.has(key))schemaError(errors,`${at}.${key}`,'field is not allowed');return true;}
  function requiredKeys(errors,value,required,at){for(const key of required)if(!own(value,key))schemaError(errors,`${at}.${key}`,'field is required');}
  function nonEmptyString(value){return typeof value==='string'&&value.trim().length>0;}
  function normalizeBinding(value){
    if(value==null)return null;if(!isObject(value))return null;const keys=Object.keys(value).sort();if(keys.length!==2||keys[0]!=='layout_id'||keys[1]!=='program_id')return null;
    const programId=String(value.program_id||'').trim(),layoutId=String(value.layout_id||'').trim();return programId&&layoutId?{program_id:programId,layout_id:layoutId}:null;
  }
  function validateProgramShape(program,at){
    const errors=[];if(!allowedKeys(errors,program,PROGRAM_KEYS,at))return errors;
    requiredKeys(errors,program,['schema_version','data_version','id','name','version','status','entry_node_id','nodes','edges','subroutines'],at);
    if(program.schema_version!==Program.DATA_VERSION)schemaError(errors,`${at}.schema_version`,`must be ${Program.DATA_VERSION}`);
    if(!nonEmptyString(program.data_version))schemaError(errors,`${at}.data_version`,'non-empty string required');if(!nonEmptyString(program.id))schemaError(errors,`${at}.id`,'non-empty string required');if(!nonEmptyString(program.name))schemaError(errors,`${at}.name`,'non-empty string required');
    if(!Number.isInteger(program.version)||program.version<1)schemaError(errors,`${at}.version`,'positive integer required');if(!['draft','valid','invalid','archived'].includes(program.status))schemaError(errors,`${at}.status`,'invalid value');if(typeof program.entry_node_id!=='string')schemaError(errors,`${at}.entry_node_id`,'string required');
    if(!Array.isArray(program.nodes))schemaError(errors,`${at}.nodes`,'array required');if(!Array.isArray(program.edges))schemaError(errors,`${at}.edges`,'array required');if(!Array.isArray(program.subroutines))schemaError(errors,`${at}.subroutines`,'array required');
    if(own(program,'tags')&&(!Array.isArray(program.tags)||program.tags.some(x=>!nonEmptyString(x))))schemaError(errors,`${at}.tags`,'array of non-empty strings required');if(own(program,'description')&&typeof program.description!=='string')schemaError(errors,`${at}.description`,'string required');if(own(program,'updated_at')&&typeof program.updated_at!=='string')schemaError(errors,`${at}.updated_at`,'string required');if(own(program,'compiled')&&program.compiled!==null&&!isObject(program.compiled))schemaError(errors,`${at}.compiled`,'object or null required');
    for(const [index,node] of (program.nodes||[]).entries()){
      const nat=`${at}.nodes[${index}]`;if(!allowedKeys(errors,node,NODE_KEYS,nat))continue;requiredKeys(errors,node,['instance_id','master_node_id','node_type','position','parameters'],nat);
      if(!nonEmptyString(node.instance_id))schemaError(errors,`${nat}.instance_id`,'non-empty string required');if(!nonEmptyString(node.master_node_id))schemaError(errors,`${nat}.master_node_id`,'non-empty string required');if(!['condition','target','action'].includes(node.node_type))schemaError(errors,`${nat}.node_type`,'invalid value');
      if(allowedKeys(errors,node.position,POSITION_KEYS,`${nat}.position`)){requiredKeys(errors,node.position,['x','y'],`${nat}.position`);if(typeof node.position.x!=='number'||typeof node.position.y!=='number')schemaError(errors,`${nat}.position`,'numeric x/y required');}
      if(!isObject(node.parameters))schemaError(errors,`${nat}.parameters`,'object required');
    }
    for(const [index,edge] of (program.edges||[]).entries()){
      const eat=`${at}.edges[${index}]`;if(!allowedKeys(errors,edge,EDGE_KEYS,eat))continue;requiredKeys(errors,edge,['edge_id','from','to'],eat);if(!nonEmptyString(edge.edge_id))schemaError(errors,`${eat}.edge_id`,'non-empty string required');
      for(const side of ['from','to'])if(allowedKeys(errors,edge[side],ENDPOINT_KEYS,`${eat}.${side}`)){requiredKeys(errors,edge[side],['node_id','port_id'],`${eat}.${side}`);if(!nonEmptyString(edge[side].node_id)||!nonEmptyString(edge[side].port_id))schemaError(errors,`${eat}.${side}`,'non-empty node_id/port_id required');}
    }
    for(const [index,row] of (program.subroutines||[]).entries()){
      const sat=`${at}.subroutines[${index}]`;if(!allowedKeys(errors,row,SUBROUTINE_KEYS,sat))continue;requiredKeys(errors,row,['id','entry_node_id'],sat);if(!nonEmptyString(row.id)||!nonEmptyString(row.entry_node_id))schemaError(errors,sat,'non-empty id/entry_node_id required');
    }
    return errors;
  }
  function validateLayoutShape(layout,at){
    const errors=[];if(!allowedKeys(errors,layout,LAYOUT_KEYS,at))return errors;requiredKeys(errors,layout,[...LAYOUT_KEYS],at);
    for(const [index,chip] of (Array.isArray(layout.chips)?layout.chips:[]).entries()){const cat=`${at}.chips[${index}]`;if(allowedKeys(errors,chip,CHIP_KEYS,cat))requiredKeys(errors,chip,[...CHIP_KEYS],cat);}
    for(const [index,extension] of (Array.isArray(layout.extensions)?layout.extensions:[]).entries()){const eat=`${at}.extensions[${index}]`;if(allowedKeys(errors,extension,EXTENSION_KEYS,eat))requiredKeys(errors,extension,[...EXTENSION_KEYS],eat);}
    Layout.validateLayout(layout).forEach(message=>schemaError(errors,at,message));return errors;
  }
  function normalizePreset(value){
    if(!isObject(value))return null;const presetId=String(value.preset_id||'').trim(),name=String(value.name||'').trim();if(!presetId||!name||!isObject(value.program)||!isObject(value.layout))return null;
    const program=Program.normalizeProgram(value.program),layout=Layout.normalizeLayout(value.layout);if(!program.id||!layout.layout_id||layout.program_id!==program.id)return null;program.compiled=null;program.status='draft';
    return{preset_id:presetId,name,source:String(value.source||'user'),program,layout,created_at:String(value.created_at||''),updated_at:String(value.updated_at||'')};
  }
  function nextPresetId(rows){let max=0;for(const row of rows||[]){const match=PRESET_ID_PATTERN.exec(String(row?.preset_id||''));if(match)max=Math.max(max,Number(match[1]));}return `AIPR-${String(max+1).padStart(4,'0')}`;}
  function duplicateIds(rows,key){const seen=new Set(),duplicates=[];for(const row of rows||[]){const id=String(row?.[key]||'');if(!id)continue;if(seen.has(id)&&!duplicates.includes(id))duplicates.push(id);seen.add(id);}return duplicates;}
  function validatePreset(preset){
    const errors=[];if(!allowedKeys(errors,preset,PRESET_KEYS,'preset'))return errors;requiredKeys(errors,preset,PRESET_REQUIRED,'preset');if(!nonEmptyString(preset.preset_id))schemaError(errors,'preset.preset_id','non-empty string required');if(!nonEmptyString(preset.name))schemaError(errors,'preset.name','non-empty string required');if(typeof preset.source!=='string')schemaError(errors,'preset.source','string required');if(typeof preset.created_at!=='string'||typeof preset.updated_at!=='string')schemaError(errors,'preset timestamps','strings required');
    errors.push(...validateProgramShape(preset.program,'preset.program'));errors.push(...validateLayoutShape(preset.layout,'preset.layout'));if(isObject(preset.program)&&isObject(preset.layout)&&preset.program.id&&preset.layout.program_id!==preset.program.id)schemaError(errors,'preset','Program/Layout reference mismatch');return errors;
  }
  function validateCurrent(save){
    const errors=[];if(!allowedKeys(errors,save,SAVE_KEYS,'save'))return errors;requiredKeys(errors,save,SAVE_REQUIRED,'save');if(Number(save.saveVersion)!==SAVE_VERSION)schemaError(errors,'save.saveVersion',`must be ${SAVE_VERSION}`);
    if(!Array.isArray(save.characters))schemaError(errors,'save.characters','array required');if(!Array.isArray(save.aiPrograms))schemaError(errors,'save.aiPrograms','array required');if(!Array.isArray(save.aiLayouts))schemaError(errors,'save.aiLayouts','array required');if(!Array.isArray(save.aiPresets))schemaError(errors,'save.aiPresets','array required');
    duplicateIds(save.aiPrograms,'id').forEach(id=>schemaError(errors,'save.aiPrograms',`duplicate id ${id}`));duplicateIds(save.aiLayouts,'layout_id').forEach(id=>schemaError(errors,'save.aiLayouts',`duplicate id ${id}`));duplicateIds(save.aiPresets,'preset_id').forEach(id=>schemaError(errors,'save.aiPresets',`duplicate id ${id}`));
    for(const [index,character] of (save.characters||[]).entries()){
      const at=`save.characters[${index}]`;if(!allowedKeys(errors,character,CHARACTER_KEYS,at))continue;requiredKeys(errors,character,CHARACTER_REQUIRED,at);if(!nonEmptyString(character.id))schemaError(errors,`${at}.id`,'non-empty string required');if(!nonEmptyString(character.name))schemaError(errors,`${at}.name`,'non-empty string required');if(character.formalAiBinding!=null&&!normalizeBinding(character.formalAiBinding))schemaError(errors,`${at}.formalAiBinding`,'invalid binding');
    }
    for(const [index,program] of (save.aiPrograms||[]).entries())errors.push(...validateProgramShape(program,`save.aiPrograms[${index}]`));
    for(const [index,layout] of (save.aiLayouts||[]).entries())errors.push(...validateLayoutShape(layout,`save.aiLayouts[${index}]`));
    for(const [index,preset] of (save.aiPresets||[]).entries())validatePreset(preset).forEach(message=>errors.push(`save.aiPresets[${index}]: ${message}`));
    return errors;
  }
  function assertCurrent(raw){
    if(!isObject(raw))throw new Error('Save Dataが不正です。');const source=clone(raw),errors=validateCurrent(source);if(errors.length){const error=new Error(`Save Data Version ${SAVE_VERSION}が不正です。\n${errors.join('\n')}`);error.code='FORMAL_AI_SAVE_CURRENT_INVALID';error.errors=errors;throw error;}
    source.aiPrograms=source.aiPrograms.map(row=>Program.normalizeProgram(row));source.aiLayouts=source.aiLayouts.map(row=>Layout.normalizeLayout(row));source.aiPresets=source.aiPresets.map(normalizePreset);for(const character of source.characters)character.formalAiBinding=normalizeBinding(character.formalAiBinding);return source;
  }
  function loadForCharacter(saveValue,characterId){const save=isObject(saveValue)?saveValue:{};const character=(save.characters||[]).find(row=>String(row?.id||'')===String(characterId||'')),binding=normalizeBinding(character?.formalAiBinding);if(!binding)return null;const program=(save.aiPrograms||[]).find(row=>String(row?.id||'')===binding.program_id),layout=(save.aiLayouts||[]).find(row=>String(row?.layout_id||'')===binding.layout_id);if(!program||!layout||String(layout.program_id||'')!==String(program.id||''))return null;return{binding:clone(binding),program:Program.normalizeProgram(program),layout:Layout.normalizeLayout(layout)};}
  function runtimeForCharacter(saveValue,characterId){const loaded=loadForCharacter(saveValue,characterId),runtime=loaded?.program?.compiled;if(!runtime||String(runtime.program_id||'')!==String(loaded.program.id||'')||Number(runtime.program_version)!==Number(loaded.program.version))return null;return clone(runtime);}
  function upsert(rows,key,value){const id=String(value?.[key]||''),index=rows.findIndex(row=>String(row?.[key]||'')===id);if(index>=0)rows[index]=clone(value);else rows.push(clone(value));}
  function saveForCharacter(saveValue,characterId,programValue,layoutValue,options){
    const next=assertCurrent(saveValue),character=next.characters.find(row=>String(row?.id||'')===String(characterId||''));if(!character)throw new Error('AI保存対象キャラクターが見つかりません。');const current=loadForCharacter(next,characterId),now=String(options?.now||new Date().toISOString()),program=Program.normalizeProgram(programValue),layout=Layout.normalizeLayout(layoutValue);program.compiled=null;
    const programId=current?.binding?.program_id||Program.nextProgramId(next.aiPrograms),layoutId=current?.binding?.layout_id||Layout.nextLayoutId(next.aiLayouts);program.id=programId;program.name=String(program.name||`${character.name||'冒険者'} AI`);program.status='valid';program.updated_at=now;const previous=next.aiPrograms.find(row=>String(row?.id||'')===programId);program.version=previous?Math.max(1,Number(previous.version)||1)+1:Math.max(1,Number(program.version)||1);layout.layout_id=layoutId;layout.program_id=programId;
    const layoutErrors=validateLayoutShape(layout,'layout');if(layoutErrors.length){const error=new Error(`AI Layoutを保存できません。\n${layoutErrors.join('\n')}`);error.code='FORMAL_AI_LAYOUT_INVALID';error.errors=layoutErrors;throw error;}upsert(next.aiPrograms,'id',program);upsert(next.aiLayouts,'layout_id',layout);character.formalAiBinding={program_id:programId,layout_id:layoutId};const errors=validateCurrent(next);if(errors.length){const error=new Error(`AI保存後のSave Dataが不正です。\n${errors.join('\n')}`);error.code='FORMAL_AI_SAVE_ATOMIC_VALIDATION_FAILED';error.errors=errors;throw error;}return{save:next,binding:clone(character.formalAiBinding),program:clone(program),layout:clone(layout)};
  }
  function userPresets(saveValue){const save=assertCurrent(saveValue);return clone(save.aiPresets);}
  function createUserPreset(saveValue,name,programValue,layoutValue,options){const next=assertCurrent(saveValue),now=String(options?.now||new Date().toISOString()),presetId=nextPresetId(next.aiPresets),program=Program.normalizeProgram(programValue),layout=Layout.normalizeLayout(layoutValue);program.compiled=null;program.status='draft';if(layout.program_id!==program.id)layout.program_id=program.id;const preset=normalizePreset({preset_id:presetId,name:String(name||'').trim(),source:'user',program,layout,created_at:now,updated_at:now}),errors=validatePreset(preset);if(errors.length){const error=new Error(`Presetを保存できません。\n${errors.join('\n')}`);error.code='FORMAL_AI_PRESET_INVALID';error.errors=errors;throw error;}next.aiPresets.push(preset);return{save:next,preset:clone(preset)};}
  function renameUserPreset(saveValue,presetId,name,options){const next=assertCurrent(saveValue),preset=next.aiPresets.find(row=>row.preset_id===String(presetId||''));if(!preset)throw new Error('Presetが見つかりません。');const nextName=String(name||'').trim();if(!nextName)throw new Error('Preset名を入力してください。');preset.name=nextName;preset.updated_at=String(options?.now||new Date().toISOString());return{save:next,preset:clone(preset)};}
  function duplicateUserPreset(saveValue,presetId,name,options){const next=assertCurrent(saveValue),source=next.aiPresets.find(row=>row.preset_id===String(presetId||''));if(!source)throw new Error('Presetが見つかりません。');const now=String(options?.now||new Date().toISOString()),copy=clone(source);copy.preset_id=nextPresetId(next.aiPresets);copy.name=String(name||`${source.name} のコピー`).trim();copy.created_at=now;copy.updated_at=now;next.aiPresets.push(copy);return{save:next,preset:clone(copy)};}
  function deleteUserPreset(saveValue,presetId){const next=assertCurrent(saveValue),before=next.aiPresets.length;next.aiPresets=next.aiPresets.filter(row=>row.preset_id!==String(presetId||''));if(next.aiPresets.length===before)throw new Error('Presetが見つかりません。');return{save:next,deleted_preset_id:String(presetId||'')};}
  return Object.freeze({SAVE_VERSION,normalizeBinding,normalizePreset,nextPresetId,validatePreset,validateCurrent,assertCurrent,loadForCharacter,runtimeForCharacter,saveForCharacter,userPresets,createUserPreset,renameUserPreset,duplicateUserPreset,deleteUserPreset});
});
