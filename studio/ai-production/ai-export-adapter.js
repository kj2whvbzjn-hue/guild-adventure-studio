(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIExportAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  function programRow(program){const row=clone(program)||{};delete row.compiled;return row;}
  function runtimeRow(program){return program?.compiled?clone(program.compiled):null;}
  function build(data){const programs=Array.isArray(data?.ai_programs)?data.ai_programs:[];return {programs:programs.map(programRow),runtimes:programs.map(runtimeRow).filter(Boolean)};}
  function collectIssues(data){
    const issues=[],programs=Array.isArray(data?.ai_programs)?data.ai_programs:[],ids=new Set();
    for(const program of programs){
      const id=String(program?.id||'');
      if(!id){issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_ID_MISSING',message:'AIプログラムIDがありません。'});continue;}
      if(ids.has(id))issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_ID_DUPLICATE',target:id,message:`AIプログラムIDが重複しています: ${id}`});ids.add(id);
      if(program.status!=='valid')issues.push({level:'ERROR',code:'AI_EXPORT_PROGRAM_NOT_VALID',target:id,message:`検証済みではないAIプログラムです: ${id}`});
      if(!program.compiled)issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_MISSING',target:id,message:`実行形式がありません: ${id}`});
      else if(program.compiled.program_id!==id||Number(program.compiled.program_version)!==Number(program.version))issues.push({level:'ERROR',code:'AI_EXPORT_RUNTIME_STALE',target:id,message:`AIプログラムと実行形式の版が一致しません: ${id}`});
    }
    return issues;
  }
  return Object.freeze({programRow,runtimeRow,build,collectIssues});
});
