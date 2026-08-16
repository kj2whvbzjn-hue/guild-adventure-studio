(function(root,factory){
  const Program=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-program-model.js'):root?.GKSAIProgramModel;
  const Layout=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-layout-model.js'):root?.GKSAILayoutModel;
  const api=factory(Program,Layout);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAISaveBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Program,Layout){
  'use strict';
  if(!Program||!Layout)throw new Error('Formal AI save dependencies are required');
  const SAVE_VERSION=2;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);

  function normalizeBinding(value){
    if(!isObject(value))return null;
    const programId=String(value.program_id||'').trim(),layoutId=String(value.layout_id||'').trim();
    return programId&&layoutId?{program_id:programId,layout_id:layoutId}:null;
  }
  function ensureCollections(save){
    save.aiPrograms=Array.isArray(save.aiPrograms)?save.aiPrograms.map(row=>Program.normalizeProgram(row)):[];
    save.aiLayouts=Array.isArray(save.aiLayouts)?save.aiLayouts.map(row=>Layout.normalizeLayout(row)):[];
    save.aiPresets=Array.isArray(save.aiPresets)?clone(save.aiPresets):[];
    for(const character of save.characters||[])character.formalAiBinding=normalizeBinding(character.formalAiBinding);
    return save;
  }
  function duplicateIds(rows,key){
    const seen=new Set(),duplicates=[];
    for(const row of rows||[]){const id=String(row?.[key]||'');if(!id)continue;if(seen.has(id)&&!duplicates.includes(id))duplicates.push(id);seen.add(id);}
    return duplicates;
  }
  function validateV2(save){
    const errors=[];
    if(!isObject(save))errors.push('save must be an object');
    if(Number(save?.saveVersion)!==SAVE_VERSION)errors.push(`saveVersion must be ${SAVE_VERSION}`);
    if(!Array.isArray(save?.characters))errors.push('characters must be an array');
    if(!Array.isArray(save?.aiPrograms))errors.push('aiPrograms must be an array');
    if(!Array.isArray(save?.aiLayouts))errors.push('aiLayouts must be an array');
    if(!Array.isArray(save?.aiPresets))errors.push('aiPresets must be an array');
    duplicateIds(save?.aiPrograms,'id').forEach(id=>errors.push(`AI Program ID is duplicated: ${id}`));
    duplicateIds(save?.aiLayouts,'layout_id').forEach(id=>errors.push(`AI Layout ID is duplicated: ${id}`));
    for(const layout of save?.aiLayouts||[])Layout.validateLayout(layout).forEach(message=>errors.push(`${layout?.layout_id||'layout'}: ${message}`));
    return errors;
  }
  function migrate(raw){
    if(!isObject(raw))throw new Error('Save Dataが不正です。');
    const source=clone(raw);
    if(source.saveVersion===1){
      if(!Array.isArray(source.characters))throw new Error('Save Data Version 1のcharactersが不正です。');
      source.saveVersion=SAVE_VERSION;
      source.aiPrograms=[];source.aiLayouts=[];source.aiPresets=[];
      source.characters.forEach(character=>{character.formalAiBinding=null;});
    }else if(source.saveVersion!==SAVE_VERSION){
      throw new Error(`対応していないSave Data Versionです: ${source.saveVersion}`);
    }
    ensureCollections(source);
    const errors=validateV2(source);
    if(errors.length){const error=new Error(`Save Data Version 2が不正です。\n${errors.join('\n')}`);error.code='FORMAL_AI_SAVE_V2_INVALID';error.errors=errors;throw error;}
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
  function upsert(rows,key,value){
    const id=String(value?.[key]||''),index=rows.findIndex(row=>String(row?.[key]||'')===id);
    if(index>=0)rows[index]=clone(value);else rows.push(clone(value));
  }
  function saveForCharacter(saveValue,characterId,programValue,layoutValue,options){
    const next=migrate(saveValue),character=next.characters.find(row=>String(row?.id||'')===String(characterId||''));
    if(!character)throw new Error('AI保存対象キャラクターが見つかりません。');
    const current=loadForCharacter(next,characterId),now=String(options?.now||new Date().toISOString());
    const program=Program.normalizeProgram(programValue),layout=Layout.normalizeLayout(layoutValue);
    const programId=current?.binding?.program_id||Program.nextProgramId(next.aiPrograms);
    const layoutId=current?.binding?.layout_id||Layout.nextLayoutId(next.aiLayouts);
    program.id=programId;program.name=String(program.name||`${character.name||'冒険者'} AI`);program.status='valid';program.updated_at=now;
    const previous=next.aiPrograms.find(row=>String(row?.id||'')===programId);
    program.version=previous?Math.max(1,Number(previous.version)||1)+1:Math.max(1,Number(program.version)||1);
    layout.layout_id=layoutId;layout.program_id=programId;
    const layoutErrors=Layout.validateLayout(layout);if(layoutErrors.length){const error=new Error(`AI Layoutを保存できません。\n${layoutErrors.join('\n')}`);error.code='FORMAL_AI_LAYOUT_INVALID';error.errors=layoutErrors;throw error;}
    upsert(next.aiPrograms,'id',program);upsert(next.aiLayouts,'layout_id',layout);
    character.formalAiBinding={program_id:programId,layout_id:layoutId};
    const errors=validateV2(next);if(errors.length){const error=new Error(`AI保存後のSave Dataが不正です。\n${errors.join('\n')}`);error.code='FORMAL_AI_SAVE_ATOMIC_VALIDATION_FAILED';error.errors=errors;throw error;}
    return {save:next,binding:clone(character.formalAiBinding),program:clone(program),layout:clone(layout)};
  }
  return Object.freeze({SAVE_VERSION,normalizeBinding,ensureCollections,validateV2,migrate,loadForCharacter,saveForCharacter});
});
