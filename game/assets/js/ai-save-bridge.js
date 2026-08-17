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
  const LEGACY_CHARACTER_FIELDS=Object.freeze(['aiGraph','aiPolicy','defaultSkillId']);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);

  function normalizeBinding(value){
    if(value==null)return null;
    if(!isObject(value))return null;
    const keys=Object.keys(value).sort();
    if(keys.length!==2||keys[0]!=='layout_id'||keys[1]!=='program_id')return null;
    const programId=String(value.program_id||'').trim(),layoutId=String(value.layout_id||'').trim();
    return programId&&layoutId?{program_id:programId,layout_id:layoutId}:null;
  }
  function normalizePreset(value){
    if(!isObject(value))return null;
    const presetId=String(value.preset_id||'').trim(),name=String(value.name||'').trim();
    if(!presetId||!name||!isObject(value.program)||!isObject(value.layout))return null;
    const program=Program.normalizeProgram(value.program),layout=Layout.normalizeLayout(value.layout);
    if(!program.id||!layout.layout_id||layout.program_id!==program.id)return null;
    program.compiled=null;
    program.status='draft';
    return {
      preset_id:presetId,
      name,
      source:String(value.source||'user'),
      program,
      layout,
      created_at:String(value.created_at||''),
      updated_at:String(value.updated_at||'')
    };
  }
  function nextPresetId(rows){
    let max=0;
    for(const row of rows||[]){const match=PRESET_ID_PATTERN.exec(String(row?.preset_id||''));if(match)max=Math.max(max,Number(match[1]));}
    return `AIPR-${String(max+1).padStart(4,'0')}`;
  }
  function duplicateIds(rows,key){
    const seen=new Set(),duplicates=[];
    for(const row of rows||[]){const id=String(row?.[key]||'');if(!id)continue;if(seen.has(id)&&!duplicates.includes(id))duplicates.push(id);seen.add(id);}
    return duplicates;
  }
  function validatePreset(preset){
    const errors=[];
    if(!preset)errors.push('Presetが不正です。');
    if(!String(preset?.preset_id||''))errors.push('Preset IDがありません。');
    if(!String(preset?.name||'').trim())errors.push('Preset名がありません。');
    if(Object.prototype.hasOwnProperty.call(preset||{},'id'))errors.push('旧Preset idフィールドは使用できません。');
    if(Object.prototype.hasOwnProperty.call(preset||{},'ai_program'))errors.push('旧Preset ai_programフィールドは使用できません。');
    if(Object.prototype.hasOwnProperty.call(preset||{},'ai_layout'))errors.push('旧Preset ai_layoutフィールドは使用できません。');
    const program=Program.normalizeProgram(preset?.program),layout=Layout.normalizeLayout(preset?.layout);
    if(!program.id)errors.push('Preset Program IDがありません。');
    if(!layout.layout_id)errors.push('Preset Layout IDがありません。');
    if(program.id&&layout.program_id!==program.id)errors.push('Preset Program/Layout参照が一致しません。');
    Layout.validateLayout(layout).forEach(message=>errors.push(`Preset Layout: ${message}`));
    return errors;
  }
  function validateCurrent(save){
    const errors=[];
    if(!isObject(save))errors.push('save must be an object');
    if(Number(save?.saveVersion)!==SAVE_VERSION)errors.push(`saveVersion must be ${SAVE_VERSION}`);
    if(!Array.isArray(save?.characters))errors.push('characters must be an array');
    if(!Array.isArray(save?.aiPrograms))errors.push('aiPrograms must be an array');
    if(!Array.isArray(save?.aiLayouts))errors.push('aiLayouts must be an array');
    if(!Array.isArray(save?.aiPresets))errors.push('aiPresets must be an array');
    duplicateIds(save?.aiPrograms,'id').forEach(id=>errors.push(`AI Program ID is duplicated: ${id}`));
    duplicateIds(save?.aiLayouts,'layout_id').forEach(id=>errors.push(`AI Layout ID is duplicated: ${id}`));
    duplicateIds(save?.aiPresets,'preset_id').forEach(id=>errors.push(`AI Preset ID is duplicated: ${id}`));
    for(const character of save?.characters||[]){
      for(const key of LEGACY_CHARACTER_FIELDS)if(Object.prototype.hasOwnProperty.call(character||{},key))errors.push(`旧AIフィールドは使用できません: characters.${key}`);
      if(character?.formalAiBinding!=null&&!normalizeBinding(character.formalAiBinding))errors.push(`formalAiBindingが不正です: ${character?.id||'character'}`);
    }
    for(const layout of save?.aiLayouts||[])Layout.validateLayout(layout).forEach(message=>errors.push(`${layout?.layout_id||'layout'}: ${message}`));
    for(const preset of save?.aiPresets||[])validatePreset(preset).forEach(message=>errors.push(`${preset?.preset_id||'preset'}: ${message}`));
    return errors;
  }
  function assertCurrent(raw){
    if(!isObject(raw))throw new Error('Save Dataが不正です。');
    const source=clone(raw);
    const errors=validateCurrent(source);
    if(errors.length){const error=new Error(`Save Data Version ${SAVE_VERSION}が不正です。\n${errors.join('\n')}`);error.code='FORMAL_AI_SAVE_CURRENT_INVALID';error.errors=errors;throw error;}
    source.aiPrograms=source.aiPrograms.map(row=>Program.normalizeProgram(row));
    source.aiLayouts=source.aiLayouts.map(row=>Layout.normalizeLayout(row));
    source.aiPresets=source.aiPresets.map(normalizePreset);
    for(const character of source.characters)character.formalAiBinding=normalizeBinding(character.formalAiBinding);
    const normalizedErrors=validateCurrent(source);
    if(normalizedErrors.length){const error=new Error(`Save Data Version ${SAVE_VERSION}の正規化後検証に失敗しました。\n${normalizedErrors.join('\n')}`);error.code='FORMAL_AI_SAVE_CURRENT_INVALID';error.errors=normalizedErrors;throw error;}
    return source;
  }
  function loadForCharacter(saveValue,characterId){
    const save=isObject(saveValue)?saveValue:{};
    const character=(save.characters||[]).find(row=>String(row?.id||'')===String(characterId||''));
    const binding=normalizeBinding(character?.formalAiBinding);
    if(!binding)return null;
    const program=(save.aiPrograms||[]).find(row=>String(row?.id||'')===binding.program_id);
    const layout=(save.aiLayouts||[]).find(row=>String(row?.layout_id||'')===binding.layout_id);
    if(!program||!layout||String(layout.program_id||'')!==String(program.id||''))return null;
    return {binding:clone(binding),program:Program.normalizeProgram(program),layout:Layout.normalizeLayout(layout)};
  }
  function runtimeForCharacter(saveValue,characterId){
    const loaded=loadForCharacter(saveValue,characterId),runtime=loaded?.program?.compiled;
    if(!runtime||String(runtime.program_id||'')!==String(loaded.program.id||'')||Number(runtime.program_version)!==Number(loaded.program.version))return null;
    return clone(runtime);
  }
  function upsert(rows,key,value){
    const id=String(value?.[key]||''),index=rows.findIndex(row=>String(row?.[key]||'')===id);
    if(index>=0)rows[index]=clone(value);else rows.push(clone(value));
  }
  function saveForCharacter(saveValue,characterId,programValue,layoutValue,options){
    const next=assertCurrent(saveValue),character=next.characters.find(row=>String(row?.id||'')===String(characterId||''));
    if(!character)throw new Error('AI保存対象キャラクターが見つかりません。');
    const current=loadForCharacter(next,characterId),now=String(options?.now||new Date().toISOString());
    const program=Program.normalizeProgram(programValue),layout=Layout.normalizeLayout(layoutValue);
    program.compiled=null;
    const programId=current?.binding?.program_id||Program.nextProgramId(next.aiPrograms);
    const layoutId=current?.binding?.layout_id||Layout.nextLayoutId(next.aiLayouts);
    program.id=programId;program.name=String(program.name||`${character.name||'冒険者'} AI`);program.status='valid';program.updated_at=now;
    const previous=next.aiPrograms.find(row=>String(row?.id||'')===programId);
    program.version=previous?Math.max(1,Number(previous.version)||1)+1:Math.max(1,Number(program.version)||1);
    layout.layout_id=layoutId;layout.program_id=programId;
    const layoutErrors=Layout.validateLayout(layout);if(layoutErrors.length){const error=new Error(`AI Layoutを保存できません。\n${layoutErrors.join('\n')}`);error.code='FORMAL_AI_LAYOUT_INVALID';error.errors=layoutErrors;throw error;}
    upsert(next.aiPrograms,'id',program);upsert(next.aiLayouts,'layout_id',layout);
    character.formalAiBinding={program_id:programId,layout_id:layoutId};
    const errors=validateCurrent(next);if(errors.length){const error=new Error(`AI保存後のSave Dataが不正です。\n${errors.join('\n')}`);error.code='FORMAL_AI_SAVE_ATOMIC_VALIDATION_FAILED';error.errors=errors;throw error;}
    return {save:next,binding:clone(character.formalAiBinding),program:clone(program),layout:clone(layout)};
  }
  function userPresets(saveValue){
    const save=assertCurrent(saveValue);
    return clone(save.aiPresets);
  }
  function createUserPreset(saveValue,name,programValue,layoutValue,options){
    const next=assertCurrent(saveValue),now=String(options?.now||new Date().toISOString()),presetId=nextPresetId(next.aiPresets);
    const program=Program.normalizeProgram(programValue),layout=Layout.normalizeLayout(layoutValue);
    program.compiled=null;program.status='draft';
    if(layout.program_id!==program.id)layout.program_id=program.id;
    const preset=normalizePreset({preset_id:presetId,name:String(name||'').trim(),source:'user',program,layout,created_at:now,updated_at:now});
    const errors=validatePreset(preset);if(errors.length){const error=new Error(`Presetを保存できません。\n${errors.join('\n')}`);error.code='FORMAL_AI_PRESET_INVALID';error.errors=errors;throw error;}
    next.aiPresets.push(preset);
    return {save:next,preset:clone(preset)};
  }
  function renameUserPreset(saveValue,presetId,name,options){
    const next=assertCurrent(saveValue),preset=next.aiPresets.find(row=>row.preset_id===String(presetId||''));
    if(!preset)throw new Error('Presetが見つかりません。');
    const nextName=String(name||'').trim();if(!nextName)throw new Error('Preset名を入力してください。');
    preset.name=nextName;preset.updated_at=String(options?.now||new Date().toISOString());
    return {save:next,preset:clone(preset)};
  }
  function duplicateUserPreset(saveValue,presetId,name,options){
    const next=assertCurrent(saveValue),source=next.aiPresets.find(row=>row.preset_id===String(presetId||''));
    if(!source)throw new Error('Presetが見つかりません。');
    const now=String(options?.now||new Date().toISOString()),copy=clone(source);
    copy.preset_id=nextPresetId(next.aiPresets);copy.name=String(name||`${source.name} のコピー`).trim();copy.created_at=now;copy.updated_at=now;
    next.aiPresets.push(copy);
    return {save:next,preset:clone(copy)};
  }
  function deleteUserPreset(saveValue,presetId){
    const next=assertCurrent(saveValue),before=next.aiPresets.length;
    next.aiPresets=next.aiPresets.filter(row=>row.preset_id!==String(presetId||''));
    if(next.aiPresets.length===before)throw new Error('Presetが見つかりません。');
    return {save:next,deleted_preset_id:String(presetId||'')};
  }
  return Object.freeze({SAVE_VERSION,LEGACY_CHARACTER_FIELDS,normalizeBinding,normalizePreset,nextPresetId,validatePreset,validateCurrent,assertCurrent,loadForCharacter,runtimeForCharacter,saveForCharacter,userPresets,createUserPreset,renameUserPreset,duplicateUserPreset,deleteUserPreset});
});
