(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIExportAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='2.0.0';
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  function programRow(program){const row=clone(program)||{};delete row.compiled;return row;}
  function layoutRow(layout){return clone(layout);}
  function runtimeRow(runtime){return clone(runtime);}
  function build(data){
    const programs=Array.isArray(data?.ai_programs)?data.ai_programs:[];
    const layouts=Array.isArray(data?.ai_program_layouts)?data.ai_program_layouts:[];
    const runtimes=Array.isArray(data?.ai_program_runtime)?data.ai_program_runtime:[];
    return {programs:programs.map(programRow),layouts:layouts.map(layoutRow),runtimes:runtimes.map(runtimeRow)};
  }
  function collectIssues(data,rootDataVersion){
    const issues=[],sets=build(data),programIds=new Set(),layoutIds=new Set(),runtimeProgramIds=new Set();
    const programById=new Map();
    for(const program of sets.programs){
      const id=String(program?.id||'');
      if(!id){issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_ID_MISSING',message:'AIプログラムIDがありません。'});continue;}
      if(programIds.has(id))issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_ID_DUPLICATE',target:id,message:`AIプログラムIDが重複しています: ${id}`});
      const namespaceMatch=/^AIP-([0-9]+)$/.exec(id);if(!namespaceMatch||Number(namespaceMatch[1])%2!==1)issues.push({level:'ERROR',code:'AI_EXPORT_DEVELOPER_PROGRAM_ID_NAMESPACE',target:id,message:`開発者作成AIプログラムIDは奇数AIP numeric namespaceを使用する必要があります: ${id}`});
      programIds.add(id);programById.set(id,program);
      if(program.schema_version!==SCHEMA_VERSION)issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_SCHEMA_VERSION',target:id,message:`AIプログラムschema_versionは${SCHEMA_VERSION}である必要があります: ${id}`});
      if(typeof program.data_version!=='string'||!program.data_version)issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_DATA_VERSION',target:id,message:`AIプログラムdata_versionがありません: ${id}`});
      else if(rootDataVersion&&program.data_version!==rootDataVersion)issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_ROOT_DATA_VERSION_MISMATCH',target:id,message:`AIプログラムdata_versionがFormal Export rootと一致しません: ${id}`});
      if(program.status!=='valid')issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_NOT_VALID',target:id,message:`検証済みではないAIプログラムです: ${id}`});
      if(Object.prototype.hasOwnProperty.call(program,'compiled'))issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_COMPILED_EMBEDDED',target:id,message:`Formal Export ai_programsへcompiledを埋め込めません: ${id}`});
    }
    for(const layout of sets.layouts){
      const id=String(layout?.layout_id||''),programId=String(layout?.program_id||'');
      if(!id){issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_ID_MISSING',message:'AI Layout IDがありません。'});continue;}
      if(layoutIds.has(id))issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_ID_DUPLICATE',target:id,message:`AI Layout IDが重複しています: ${id}`});const namespaceMatch=/^AIL-([0-9]+)$/.exec(id);if(!namespaceMatch||Number(namespaceMatch[1])%2!==1)issues.push({level:'ERROR',code:'AI_EXPORT_DEVELOPER_LAYOUT_ID_NAMESPACE',target:id,message:`開発者作成AI Layout IDは奇数AIL numeric namespaceを使用する必要があります: ${id}`});layoutIds.add(id);
      if(layout.schema_version!==SCHEMA_VERSION)issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_SCHEMA_VERSION',target:id,message:`AI Layout schema_versionは${SCHEMA_VERSION}である必要があります: ${id}`});
      if(rootDataVersion&&layout.data_version!==rootDataVersion)issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_ROOT_DATA_VERSION_MISMATCH',target:id,message:`AI Layout data_versionがFormal Export rootと一致しません: ${id}`});
      const program=programById.get(programId);
      if(!program)issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_PROGRAM_MISSING',target:id,message:`AI LayoutのProgram参照がありません: ${id} -> ${programId||'-'}`});
      else if(layout.data_version!==program.data_version)issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_DATA_VERSION_MISMATCH',target:id,message:`AI LayoutとProgramのdata_versionが一致しません: ${id}`});
    }
    for(const runtime of sets.runtimes){
      const programId=String(runtime?.program_id||'');
      if(!programId){issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_PROGRAM_ID_MISSING',message:'AI Runtime program_idがありません。'});continue;}
      if(runtimeProgramIds.has(programId))issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_PROGRAM_DUPLICATE',target:programId,message:`AI RuntimeがProgram単位で重複しています: ${programId}`});runtimeProgramIds.add(programId);
      if(runtime.schema_version!==SCHEMA_VERSION)issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_SCHEMA_VERSION',target:programId,message:`AI Runtime schema_versionは${SCHEMA_VERSION}である必要があります: ${programId}`});
      if(rootDataVersion&&runtime.data_version!==rootDataVersion)issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_ROOT_DATA_VERSION_MISMATCH',target:programId,message:`AI Runtime data_versionがFormal Export rootと一致しません: ${programId}`});
      const program=programById.get(programId);
      if(!program)issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_PROGRAM_MISSING',target:programId,message:`AI RuntimeのProgram参照がありません: ${programId}`});
      else{
        if(runtime.data_version!==program.data_version)issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_DATA_VERSION_MISMATCH',target:programId,message:`AI RuntimeとProgramのdata_versionが一致しません: ${programId}`});
        if(Number(runtime.program_version)!==Number(program.version))issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_STALE',target:programId,message:`AIプログラムと実行形式の版が一致しません: ${programId}`});
      }
    }
    for(const id of programIds){
      if(!sets.layouts.some(row=>String(row?.program_id||'')===id))issues.push({level:'ERROR',code:'AI_EXPORT_LAYOUT_MISSING',target:id,message:`AIプログラムのLayoutがありません: ${id}`});
      if(!runtimeProgramIds.has(id))issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_MISSING',target:id,message:`AIプログラムのcompiled runtimeがありません: ${id}`});
    }
    return issues;
  }
  return Object.freeze({SCHEMA_VERSION,programRow,layoutRow,runtimeRow,build,collectIssues});
});
