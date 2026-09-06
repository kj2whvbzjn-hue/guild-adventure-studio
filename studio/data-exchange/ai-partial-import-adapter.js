(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIPartialImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FORMAT='GKS_AI_PARTIAL_IMPORT',VERSION='1.0.0-draft';
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function requiredString(v){return typeof v==='string'&&v.trim().length>0;}
  async function parseAiPartialImport(input,{rootData,exchange}={}){
    const artifact=typeof input==='string'?JSON.parse(input):clone(input);
    const errors=[];
    if(!artifact||typeof artifact!=='object'||Array.isArray(artifact))errors.push('Artifactはobjectである必要があります。');
    if(artifact?.format!==FORMAT)errors.push('format不一致。');
    if(artifact?.version!==VERSION)errors.push('version不一致。');
    if(!requiredString(artifact?.project_id))errors.push('project_idがありません。');
    if(rootData&&String(artifact?.project_id||'')!==String(rootData?.project?.id||''))errors.push('project_id不一致。');
    if(!requiredString(artifact?.dataset)||!exchange?.REGISTRY?.[artifact.dataset])errors.push('未対応Datasetです。');
    if(!Array.isArray(artifact?.operations)||!artifact.operations.length)errors.push('operationsが空です。');
    if(!requiredString(artifact?.metadata?.package_hash)||artifact?.metadata?.hash_algorithm!=='SHA-256')errors.push('metadata.package_hash/hash_algorithmが不正です。');
    const seen=new Set();
    for(const [i,op] of (artifact?.operations||[]).entries()){
      if(!['CREATE','UPDATE'].includes(op?.op))errors.push(`operations[${i}].opはCREATE/UPDATEのみです。`);
      if(!requiredString(op?.id))errors.push(`operations[${i}].idがありません。`);
      if(op?.record==null||typeof op.record!=='object'||Array.isArray(op.record))errors.push(`operations[${i}].recordがobjectではありません。`);
      if(op?.op==='UPDATE'&&!requiredString(op?.expected_record_hash))errors.push(`operations[${i}] UPDATEにexpected_record_hashがありません。`);
      if(seen.has(String(op?.id||'')))errors.push(`同一Artifact内でIDが重複しています: ${op?.id||''}`);seen.add(String(op?.id||''));
      if(op?.record&&String(op.record.id??op.id)!==String(op.id))errors.push(`operations[${i}] idとrecord.idが一致しません。`);
    }
    if(errors.length)throw new Error(errors.join(' / '));
    const hashable=clone(artifact);hashable.metadata=hashable.metadata||{};hashable.metadata.package_hash='';if(Object.prototype.hasOwnProperty.call(hashable.metadata,'generated_at'))hashable.metadata.generated_at='';
    const actualHash=await exchange.sha256Hex(exchange.stableStringify(hashable));if(actualHash!==String(artifact.metadata.package_hash))throw new Error('AI_PARTIAL_IMPORT_PACKAGE_HASH_MISMATCH');
    return artifact;
  }
  async function validateAiPartialImportIntent({artifact,rootData,exchange}){
    const dataset=artifact.dataset,local=exchange.records(rootData,dataset),byId=new Map(local.map(r=>[exchange.rowId(dataset,r),r]));
    const conflictChoices={},recordHashes={},errors=[];
    for(const op of artifact.operations){
      const id=String(op.id),current=byId.get(id);
      if(op.op==='CREATE'){
        if(current)errors.push(`CREATE_ID_EXISTS: ${id}`);
      }else{
        if(!current){errors.push(`UPDATE_TARGET_MISSING: ${id}`);continue;}
        const actual=await exchange.recordHash(dataset,current);recordHashes[id]=String(op.expected_record_hash||'');
        if(actual!==String(op.expected_record_hash||''))errors.push(`STALE_SOURCE: ${id}`);
        conflictChoices[id]='import';
      }
    }
    if(errors.length)throw new Error(errors.join(' / '));
    return {conflictChoices,recordHashes};
  }
  async function buildDataExchangeEnvelopeFromAiImport({artifact,rootData,exchange,studioVersion=''}){
    const intent=await validateAiPartialImportIntent({artifact,rootData,exchange});
    const datasets={[artifact.dataset]:artifact.operations.map(op=>clone(op.record))};
    const envelope={format:exchange.FORMAT,version:exchange.VERSION,project_id:artifact.project_id,mode:'partial',permissions:{writable:[artifact.dataset],read_only:[]},metadata:{generated_at:new Date().toISOString(),source:'ai-partial-import',studio_version:String(studioVersion||''),schema_version:String(rootData.schema_version||''),dependency_mode:'none',record_count:{[artifact.dataset]:datasets[artifact.dataset].length},base_project_revision:String(rootData.project?.updated_at||''),base_hash:'',record_hashes:{[artifact.dataset]:intent.recordHashes},package_hash:'',hash_algorithm:'SHA-256'},datasets};
    const hashable=clone(envelope);hashable.metadata.generated_at='';hashable.metadata.package_hash='';envelope.metadata.package_hash=await exchange.sha256Hex(exchange.stableStringify(hashable));
    return {envelope,conflictChoices:intent.conflictChoices};
  }
  async function buildAiMergedCandidate({artifact,rootData,exchange,studioVersion=''}){
    const built=await buildDataExchangeEnvelopeFromAiImport({artifact,rootData,exchange,studioVersion});
    const dryRun=await exchange.dryRunImport({rootData,envelope:built.envelope});
    if(!dryRun.ok)throw new Error('AI Partial Import Dry Run ERROR: '+(dryRun.errors||[]).join(' / '));
    const plan=await exchange.createApplyPlan({rootData,envelope:built.envelope,dryRun,conflictChoices:built.conflictChoices});
    if(!plan.can_apply)throw new Error('AI Partial Import Apply Plan blocked: '+(plan.reasons||[]).join(' / '));
    const applied=await exchange.applySafeMerge({rootData,envelope:built.envelope,dryRun,conflictChoices:built.conflictChoices,plan});
    return {...built,dryRun,plan,candidate:applied.nextRootData,validation:applied.verify};
  }
  async function buildAiImportApprovalFingerprint({artifact,candidate,exchange}){
    return exchange.sha256Hex(exchange.stableStringify({project_id:artifact.project_id,dataset:artifact.dataset,operations:artifact.operations.map(x=>({op:x.op,id:x.id,expected_record_hash:x.expected_record_hash||''})),candidate}));
  }
  return {FORMAT,VERSION,parseAiPartialImport,validateAiPartialImportIntent,buildDataExchangeEnvelopeFromAiImport,buildAiMergedCandidate,buildAiImportApprovalFingerprint};
});
