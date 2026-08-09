(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSDataExchangeIntegrityValidator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function strings(value){
    const arr=Array.isArray(value)?value:[value];
    return [...new Set(arr.map(x=>String(x??'').trim()).filter(Boolean))];
  }
  function rowId(row,def){return String(row?.[def?.idField||'id']??'').trim();}
  function addIssue(out,code,dataset,id,detail,severity='error'){
    out.issues.push({code,dataset:dataset||'',id:id||'',detail:String(detail||''),severity});
    out.summary[code]=(out.summary[code]||0)+1;
    if(severity==='error')out.errors.push(String(detail||code));
    else if(severity==='warning')out.warnings.push(String(detail||code));
  }
  function validate(options){
    const rootData=options?.rootData||{};
    const envelope=options?.envelope||{};
    const registry=options?.registry||{};
    const records=options?.records;
    const canonicalizeRecord=options?.canonicalizeRecord;
    const stableStringify=options?.stableStringify;
    const referencedIds=options?.referencedIds;
    const expectedFormat=String(options?.format||'GKS_DATA_EXCHANGE');
    const expectedVersion=String(options?.version||'');
    const out={ok:true,blocking:false,apply_blocking:false,summary:{},issues:[],errors:[],warnings:[]};

    if(envelope.format!==expectedFormat)addIssue(out,'incompatible','','',`format非互換: ${envelope.format||'(なし)'}`);
    if(expectedVersion&&envelope.version!==expectedVersion)addIssue(out,'incompatible','','',`version非互換: ${envelope.version||'(なし)'} / 対応: ${expectedVersion}`);
    if(String(envelope.project_id||'')!==String(rootData.project?.id||''))addIssue(out,'incompatible','','',`project_id不一致: ${envelope.project_id||'(なし)'}`);
    const expectedSchema=String(rootData.schema_version||'').trim();
    const incomingSchema=String(envelope.metadata?.schema_version||'').trim();
    if(expectedSchema&&incomingSchema!==expectedSchema)addIssue(out,'incompatible','','',`schema_version不一致: ${incomingSchema||'(なし)'} / 現在: ${expectedSchema}`);
    if(envelope.mode!=='partial')addIssue(out,'invalid','','','modeはpartialである必要があります。');

    if(envelope.operations?.delete || envelope.delete || envelope.deleted_ids){
      addIssue(out,'unsupported_delete','','','DELETEはData Exchange v1では未対応です。');
    }

    const datasets=(envelope.datasets&&typeof envelope.datasets==='object'&&!Array.isArray(envelope.datasets))?envelope.datasets:{};
    const names=Object.keys(datasets);
    if(!names.length)addIssue(out,'invalid','','','datasetsが空です。');
    for(const ds of names){
      const def=registry[ds];
      if(!def){addIssue(out,'unknown_dataset',ds,'',`未対応Dataset: ${ds}`);continue;}
      const rows=datasets[ds];
      if(!Array.isArray(rows)){addIssue(out,'invalid',ds,'',`${ds}は配列ではありません。`);continue;}
      const seen=new Set();
      rows.forEach((row,index)=>{
        if(!row||typeof row!=='object'||Array.isArray(row)){addIssue(out,'invalid',ds,'',`${ds}[${index}]がオブジェクトではありません。`);return;}
        const id=rowId(row,def);
        if(!id){addIssue(out,'invalid',ds,'',`${ds}[${index}]に${def.idField||'id'}がありません。`);return;}
        if(seen.has(id))addIssue(out,'invalid',ds,id,`${ds}に重複IDがあります: ${id}`);
        seen.add(id);
      });
      const declared=envelope.metadata?.record_count?.[ds];
      if(declared!==undefined && Number(declared)!==rows.length){
        addIssue(out,'invalid',ds,'',`record_count不一致: ${ds} metadata=${declared} actual=${rows.length}`);
      }
    }

    const writable=new Set(strings(envelope.permissions?.writable||[]));
    const readOnly=new Set(strings(envelope.permissions?.read_only||[]));
    const overlap=[...writable].filter(x=>readOnly.has(x));
    if(overlap.length)addIssue(out,'invalid','','',`writable/read_only重複: ${overlap.join(', ')}`);
    const undeclared=names.filter(ds=>!writable.has(ds)&&!readOnly.has(ds));
    if(undeclared.length)addIssue(out,'invalid','','',`permissions未宣言Dataset: ${undeclared.join(', ')}`);

    if(typeof records==='function'&&typeof canonicalizeRecord==='function'&&typeof stableStringify==='function'){
      const localIndex={};
      Object.keys(registry).forEach(ds=>{localIndex[ds]=new Map(records(rootData,ds).map(row=>[String(row?.[registry[ds].idField||'id']||''),row]));});
      const incomingIndex={};
      names.filter(ds=>registry[ds]&&Array.isArray(datasets[ds])).forEach(ds=>{incomingIndex[ds]=new Map(datasets[ds].map(row=>[rowId(row,registry[ds]),row]).filter(x=>x[0]));});
      const tagCategoryIds=new Set((Array.isArray(rootData.tag_categories)?rootData.tag_categories:[]).map(row=>String(row?.id||'').trim()).filter(Boolean));
      for(const ds of names){
        if(!registry[ds]||!Array.isArray(datasets[ds]))continue;
        for(const row of datasets[ds]){
          const id=rowId(row,registry[ds]); if(!id)continue;
          if(readOnly.has(ds)){
            const local=localIndex[ds].get(id);
            const same=!!local&&stableStringify(canonicalizeRecord(ds,local))===stableStringify(canonicalizeRecord(ds,row));
            if(!same)addIssue(out,'readonly_modified',ds,id,!local?'read_only参照が現在のProjectに存在しません。':'read_only参照が現在値と異なります。','issue');
          }
          if(typeof referencedIds==='function'){
            const broken=referencedIds(ds,row).filter(ref=>!(incomingIndex[ref.dataset]?.has(ref.id))&&!(localIndex[ref.dataset]?.has(ref.id)));
            if(broken.length)addIssue(out,'broken_reference',ds,id,broken.map(x=>`${x.dataset}:${x.id}`).join(', '),'issue');
          }
          if(ds==='tags'){
            const parentId=String(row?.parent_id||'').trim();
            const replacementId=String(row?.replacement_tag_id||row?.recommended_replacement_tag_id||'').trim();
            const categoryId=String(row?.category_id||'').trim();
            const tagExists=refId=>!!refId&&((incomingIndex.tags?.has(refId))||(localIndex.tags?.has(refId)));
            if(parentId&&!tagExists(parentId))addIssue(out,'broken_reference',ds,id,`tags:${parentId} (parent_id)`,'issue');
            if(replacementId&&!tagExists(replacementId))addIssue(out,'broken_reference',ds,id,`tags:${replacementId} (replacement_tag_id)`,'issue');
            if(categoryId&&!tagCategoryIds.has(categoryId))addIssue(out,'broken_reference',ds,id,`tag_categories:${categoryId} (category_id)`,'issue');
          }
        }
      }
    }

    out.blocking=out.errors.length>0;
    out.apply_blocking=out.blocking||out.issues.some(x=>x.severity==='issue');
    out.ok=!out.blocking;
    return out;
  }
  return {validate};
});
