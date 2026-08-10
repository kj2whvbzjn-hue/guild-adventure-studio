(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSDataExchange=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const FORMAT='GKS_DATA_EXCHANGE';
  const VERSION='1.0.0-draft';
  const VOLATILE_DEFAULT=['updated_at','created_at','generated_at'];
  const REGISTRY={
    monsters:{path:['masters','monsters'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags','params.skill_ids','params.candidate_skill_ids','params.equipment_ids','params.mod_ids'],dependencies:[
      {dataset:'tags',paths:['tags']},
      {dataset:'skills',paths:['params.skill_ids','params.candidate_skill_ids']},
      {dataset:'jobs',paths:['params.job_id']},
      {dataset:'equipment',paths:['params.equipment_ids']},
      {dataset:'mods',paths:['params.mod_ids']},
      {dataset:'ai_conditions',paths:['params.ai.condition_id']},
      {dataset:'ai_targets',paths:['params.ai.target_id']},
      {dataset:'ai_actions',paths:['params.ai.action_id']}
    ]},
    tags:{path:['tags'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['aliases'],dependencies:[]},
    skills:{path:['masters','skills'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags','params.required_tags'],dependencies:[{dataset:'tags',paths:['tags','params.required_tags']}]},
    stats:{path:['masters','stats'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    status_effects:{path:['masters','status_effects'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    tablets:{path:['masters','tablets'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    jobs:{path:['masters','jobs'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    equipment:{path:['masters','equipment'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags','mod_ids','params.mod_ids'],dependencies:[{dataset:'tags',paths:['tags']},{dataset:'mods',paths:['mod_ids','params.mod_ids']}]},
    mods:{path:['masters','mods'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    ai_conditions:{path:['masters','ai_conditions'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    ai_targets:{path:['masters','ai_targets'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    ai_actions:{path:['masters','ai_actions'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    chapters:{path:['chapters'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:[],dependencies:[]},
    story_sections:{virtual:'story_sections',idField:'id',volatile:VOLATILE_DEFAULT,unordered:[],dependencies:[],contextFields:['chapter_id']},
    story_scenes:{virtual:'story_scenes',idField:'id',volatile:VOLATILE_DEFAULT,unordered:[],dependencies:[],contextFields:['chapter_id','section_id']},
    story_dialogues:{virtual:'story_dialogues',idField:'id',volatile:VOLATILE_DEFAULT,unordered:[],dependencies:[],contextFields:['chapter_id','section_id','scene_id']}
  };

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function getAt(obj,path){return String(path||'').split('.').filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],obj);}
  function storyVirtualRecords(rootData,dataset){
    const out=[];
    for(const chapter of Array.isArray(rootData?.chapters)?rootData.chapters:[]){
      const chapterId=String(chapter?.id||'');
      for(const section of Array.isArray(chapter?.sections)?chapter.sections:[]){
        const sectionId=String(section?.id||'');
        if(dataset==='story_sections'){const row=clone(section);delete row.scenes;row.chapter_id=chapterId;out.push(row);continue;}
        for(const scene of Array.isArray(section?.scenes)?section.scenes:[]){
          const sceneId=String(scene?.id||'');
          if(dataset==='story_scenes'){const row=clone(scene);delete row.dialogues;row.chapter_id=chapterId;row.section_id=sectionId;out.push(row);continue;}
          if(dataset==='story_dialogues'){
            for(const dialogue of Array.isArray(scene?.dialogues)?scene.dialogues:[]){const row=clone(dialogue);row.chapter_id=chapterId;row.section_id=sectionId;row.scene_id=sceneId;out.push(row);}
          }
        }
      }
    }
    return out;
  }
  function records(rootData,dataset){
    const def=REGISTRY[dataset]; if(!def)throw new Error('未対応Dataset: '+dataset);
    if(def.virtual)return storyVirtualRecords(rootData,dataset);
    const value=def.path.reduce((v,k)=>v&&v[k],rootData);
    return Array.isArray(value)?value:[];
  }
  function uniqueStrings(value){
    const arr=Array.isArray(value)?value:[value];
    return [...new Set(arr.map(x=>String(x??'').trim()).filter(Boolean))];
  }
  function sortJsonValues(values){return values.slice().sort((a,b)=>stableStringify(a).localeCompare(stableStringify(b),'en'));}
  function canonicalizeValue(value,path,def){
    if(Array.isArray(value)){
      const out=value.map(v=>canonicalizeValue(v,path+'[]',def));
      return (def.unordered||[]).includes(path)?sortJsonValues(out):out;
    }
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(key=>{
        if((def.volatile||[]).includes(key))return;
        const next=path?path+'.'+key:key;
        out[key]=canonicalizeValue(value[key],next,def);
      });
      return out;
    }
    return value;
  }
  function canonicalizeRecord(dataset,record){
    const def=REGISTRY[dataset]; if(!def)throw new Error('未対応Dataset: '+dataset);
    return canonicalizeValue(clone(record),'',def);
  }
  function stableStringify(value){
    if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
    return JSON.stringify(value);
  }
  async function sha256Hex(text){
    const input=String(text??'');
    if(typeof crypto!=='undefined'&&crypto.subtle&&typeof TextEncoder!=='undefined'){
      const bytes=new TextEncoder().encode(input); const digest=await crypto.subtle.digest('SHA-256',bytes);
      return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    if(typeof require==='function')return require('crypto').createHash('sha256').update(input,'utf8').digest('hex');
    throw new Error('SHA-256を利用できません。');
  }
  function canonicalRecords(dataset,rows){
    return rows.map(r=>canonicalizeRecord(dataset,r)).sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''),'en'));
  }
  async function recordHash(dataset,row){
    return sha256Hex(stableStringify(canonicalizeRecord(dataset,row)));
  }
  function collectIds(record,paths){return uniqueStrings(paths.flatMap(path=>{const v=getAt(record,path);return Array.isArray(v)?v:[v];}));}
  function resolveDependencies(rootData,primaryDataset,primaryRows,mode='none'){
    if(mode==='none')return {};
    const result={}; const queue=[]; const visited=new Set();
    const add=(dataset,id)=>{if(!id)return;const key=dataset+'::'+id;if(visited.has(key))return;visited.add(key);const row=records(rootData,dataset).find(x=>String(x?.id||'')===String(id));if(!row)return;(result[dataset]||(result[dataset]=[])).push(clone(row));if(mode==='recursive')queue.push({dataset,row});};
    const scan=(dataset,row)=>{const def=REGISTRY[dataset];(def?.dependencies||[]).forEach(dep=>collectIds(row,dep.paths).forEach(id=>add(dep.dataset,id)));};
    primaryRows.forEach(row=>scan(primaryDataset,row));
    while(queue.length){const item=queue.shift();scan(item.dataset,item.row);}
    Object.keys(result).forEach(dataset=>result[dataset]=result[dataset].sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''),'en')));
    return result;
  }
  async function buildEnvelope(options){
    const rootData=options.rootData||{}; const dataset=options.dataset; const ids=uniqueStrings(options.ids||[]); const mode=options.dependencyMode||'none';
    if(!REGISTRY[dataset])throw new Error('未対応Dataset: '+dataset);
    if(!ids.length)throw new Error('出力対象を1件以上選択してください。');
    const idSet=new Set(ids); const primary=records(rootData,dataset).filter(row=>idSet.has(String(row?.id||'')));
    if(primary.length!==idSet.size){const found=new Set(primary.map(x=>String(x.id)));const missing=ids.filter(id=>!found.has(id));throw new Error('対象IDが見つかりません: '+missing.join(', '));}
    const dependencies=resolveDependencies(rootData,dataset,primary,mode);
    const datasets={[dataset]:primary.map(clone)};
    Object.entries(dependencies).forEach(([key,value])=>{if(key!==dataset)datasets[key]=value;});
    const canonicalForBase={dataset,records:canonicalRecords(dataset,primary)};
    const baseHash=await sha256Hex(stableStringify(canonicalForBase));
    const recordHashes={};
    for(const row of primary)recordHashes[String(row.id)]=await recordHash(dataset,row);
    const envelope={
      format:FORMAT,version:VERSION,project_id:String(rootData.project?.id||''),mode:'partial',
      permissions:{writable:[dataset],read_only:Object.keys(datasets).filter(k=>k!==dataset).sort()},
      metadata:{
        generated_at:new Date().toISOString(),source:'studio-data-exchange',studio_version:String(options.studioVersion||''),schema_version:String(rootData.schema_version||''),
        dependency_mode:mode,record_count:Object.fromEntries(Object.entries(datasets).map(([k,v])=>[k,v.length])),base_project_revision:String(rootData.project?.updated_at||''),base_hash:baseHash,
        record_hashes:{[dataset]:recordHashes},package_hash:'',hash_algorithm:'SHA-256'
      },datasets
    };
    const hashable=clone(envelope);hashable.metadata.generated_at='';hashable.metadata.package_hash='';
    envelope.metadata.package_hash=await sha256Hex(stableStringify(hashable));
    return envelope;
  }
  function idsFor(dataset,rows){
    const def=REGISTRY[dataset]; const out=[]; const seen=new Set(); const errors=[];
    (Array.isArray(rows)?rows:[]).forEach((row,index)=>{
      if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(`${dataset}[${index}]がオブジェクトではありません。`);return;}
      const id=String(row[def.idField]??'').trim();
      if(!id){errors.push(`${dataset}[${index}]に${def.idField}がありません。`);return;}
      if(seen.has(id))errors.push(`${dataset}に重複IDがあります: ${id}`);
      seen.add(id);out.push(id);
    });
    return {ids:out,errors};
  }
  function referencedIds(dataset,row){
    const refs=[];
    (REGISTRY[dataset]?.dependencies||[]).forEach(dep=>collectIds(row,dep.paths).forEach(id=>refs.push({dataset:dep.dataset,id})));
    return refs;
  }
  async function verifyPackageHash(envelope){
    const expected=String(envelope?.metadata?.package_hash||'').trim();
    if(!expected)return {checked:false,ok:true,expected:'',actual:''};
    const hashable=clone(envelope);hashable.metadata=hashable.metadata||{};hashable.metadata.generated_at='';hashable.metadata.package_hash='';
    const actual=await sha256Hex(stableStringify(hashable));
    return {checked:true,ok:actual===expected,expected,actual};
  }
  function getIntegrityValidator(){
    if(typeof globalThis!=='undefined'&&globalThis.GKSDataExchangeIntegrityValidator)return globalThis.GKSDataExchangeIntegrityValidator;
    if(typeof require==='function'){try{return require('./data-exchange-integrity-validator.js');}catch(e){return null;}}
    return null;
  }
  function fieldDiffValues(beforeValue,afterValue,path='',out=[]){
    const beforeObj=beforeValue&&typeof beforeValue==='object',afterObj=afterValue&&typeof afterValue==='object';
    if(Array.isArray(beforeValue)||Array.isArray(afterValue)){
      if(stableStringify(beforeValue)!==stableStringify(afterValue))out.push({path:path||'(record)',before:clone(beforeValue),after:clone(afterValue)});
      return out;
    }
    if(beforeObj&&afterObj){
      const keys=[...new Set([...Object.keys(beforeValue),...Object.keys(afterValue)])].sort();
      for(const key of keys)fieldDiffValues(beforeValue[key],afterValue[key],path?path+'.'+key:key,out);
      return out;
    }
    if(stableStringify(beforeValue)!==stableStringify(afterValue))out.push({path:path||'(record)',before:clone(beforeValue),after:clone(afterValue)});
    return out;
  }
  function recordFieldDiff(dataset,beforeRow,afterRow){
    if(!beforeRow||!afterRow)return [];
    return fieldDiffValues(canonicalizeRecord(dataset,beforeRow),canonicalizeRecord(dataset,afterRow));
  }
  function buildImpactPreview(rootData,envelope,result){
    const writable=new Set(uniqueStrings(envelope?.permissions?.writable||[]));
    const readOnly=new Set(uniqueStrings(envelope?.permissions?.read_only||[]));
    const direct=[],reference_additions=[],existing_references=[],reference_differences=[];
    const impactedDatasets=new Set();
    const statusByKey=new Map((result?.items||[]).map(x=>[`${x.dataset}::${x.id}`,x.status]));
    for(const [dataset,rows] of Object.entries(envelope?.datasets||{})){
      if(!REGISTRY[dataset])continue;
      const localMap=new Map(records(rootData,dataset).map(row=>[String(row?.[REGISTRY[dataset].idField]??''),row]));
      for(const row of rows||[]){
        const id=String(row?.[REGISTRY[dataset].idField]??''),local=localMap.get(id);
        const same=!!local&&stableStringify(canonicalizeRecord(dataset,local))===stableStringify(canonicalizeRecord(dataset,row));
        if(writable.has(dataset)){
          const status=statusByKey.get(`${dataset}::${id}`)||(local?(same?'unchanged':'conflict'):'add');
          if(status!=='unchanged'){
            impactedDatasets.add(dataset);
            direct.push({dataset,id,status,diffs:local?recordFieldDiff(dataset,local,row):[]});
          }
        }else if(readOnly.has(dataset)){
          if(!local){
            impactedDatasets.add(dataset);
            reference_additions.push({dataset,id});
          }else if(same){
            existing_references.push({dataset,id});
          }else{
            impactedDatasets.add(dataset);
            reference_differences.push({dataset,id,diffs:recordFieldDiff(dataset,local,row)});
          }
        }
      }
    }
    const unaffected=Object.keys(REGISTRY).filter(dataset=>!impactedDatasets.has(dataset)&&!writable.has(dataset)&&!readOnly.has(dataset)).sort();
    return {
      direct,
      reference_additions,
      existing_references,
      reference_differences,
      unaffected,
      summary:{
        direct:direct.length,
        reference_additions:reference_additions.length,
        existing_references:existing_references.length,
        reference_differences:reference_differences.length,
        unaffected:unaffected.length
      }
    };
  }
  function buildImpactExportPayload(envelope,result){
    const impact=result?.impact_preview||{summary:{},direct:[],reference_additions:[],existing_references:[],reference_differences:[],unaffected:[]};
    return {
      format:'GKS_DATA_EXCHANGE_IMPACT',
      version:'1.0.0',
      generated_at:new Date().toISOString(),
      project_id:String(envelope?.project_id||''),
      source:{
        data_exchange_format:String(envelope?.format||''),
        data_exchange_version:String(envelope?.version||''),
        source_generated_at:String(envelope?.metadata?.generated_at||''),
        source_package_hash:String(envelope?.metadata?.package_hash||''),
        source_project_revision:String(envelope?.metadata?.base_project_revision||'')
      },
      summary:clone(impact.summary||{}),
      direct_changes:clone(impact.direct||[]),
      references:{
        additions:clone(impact.reference_additions||[]),
        existing:clone(impact.existing_references||[]),
        differences:clone(impact.reference_differences||[])
      },
      unaffected_datasets:clone(impact.unaffected||[])
    };
  }
  async function dryRunImport(options){
    const rootData=options?.rootData||{}; const envelope=options?.envelope;
    const result={ok:false,can_apply:false,summary:{add:0,unchanged:0,conflict:0,invalid:0,incompatible:0,stale_source:0,broken_reference:0,readonly_modified:0},items:[],errors:[],warnings:[],package_hash:{checked:false,ok:true,expected:'',actual:''}};
    const shape=validateEnvelopeShape(envelope);
    if(!shape.ok){result.errors.push(...shape.errors);result.summary.invalid+=shape.errors.length;return result;}
    const validator=getIntegrityValidator();
    if(validator){
      const integrity=validator.validate({rootData,envelope,registry:REGISTRY,records,canonicalizeRecord,stableStringify,referencedIds,format:FORMAT,version:VERSION});
      result.integrity=integrity;
      for(const issue of integrity.issues||[]){
        if(issue.code==='incompatible'||issue.code==='unknown_dataset'){result.summary.incompatible++;}
        else if(issue.code==='readonly_modified'){result.summary.readonly_modified++;result.items.push({dataset:issue.dataset,id:issue.id,status:'readonly_modified',detail:issue.detail});}
        else if(issue.code==='broken_reference'){result.summary.broken_reference++;result.items.push({dataset:issue.dataset,id:issue.id,status:'broken_reference',detail:issue.detail});}
        else if(issue.code==='invalid'||issue.code==='unsupported_delete'){result.summary.invalid++;}
      }
      if(integrity.blocking){result.errors.push(...integrity.errors);return result;}
    }else{
      if(envelope.version!==VERSION){result.errors.push(`version非互換: ${envelope.version} / 対応: ${VERSION}`);result.summary.incompatible++;return result;}
      if(String(envelope.project_id)!==String(rootData.project?.id||'')){result.errors.push(`project_id不一致: ${envelope.project_id}`);result.summary.incompatible++;return result;}
    }
    const writable=new Set(uniqueStrings(envelope.permissions?.writable||[]));
    const readOnly=new Set(uniqueStrings(envelope.permissions?.read_only||[]));
    const datasetNames=Object.keys(envelope.datasets||{});
    const unknown=datasetNames.filter(ds=>!REGISTRY[ds]);
    if(unknown.length){unknown.forEach(ds=>result.items.push({dataset:ds,id:'',status:'incompatible',detail:'未対応Dataset'}));result.summary.incompatible+=unknown.length;result.errors.push('未対応Dataset: '+unknown.join(', '));return result;}
    const overlap=[...writable].filter(ds=>readOnly.has(ds));
    if(overlap.length){result.summary.invalid+=overlap.length;result.errors.push('writable/read_only重複: '+overlap.join(', '));return result;}
    const undeclared=datasetNames.filter(ds=>!writable.has(ds)&&!readOnly.has(ds));
    if(undeclared.length){result.summary.invalid+=undeclared.length;result.errors.push('permissions未宣言Dataset: '+undeclared.join(', '));return result;}
    const writeDatasets=datasetNames.filter(ds=>writable.has(ds));
    if(writeDatasets.length!==1){result.summary.invalid++;result.errors.push('Dry Runではwritable Datasetは1分類である必要があります。');return result;}
    for(const ds of datasetNames){
      const checked=idsFor(ds,envelope.datasets[ds]);
      if(checked.errors.length){result.errors.push(...checked.errors);result.summary.invalid+=checked.errors.length;}
    }
    if(result.summary.invalid)return result;
    result.package_hash=await verifyPackageHash(envelope);
    if(result.package_hash.checked&&!result.package_hash.ok){result.summary.invalid++;result.errors.push('package_hashが一致しません。ファイル内容がExport後に変更されています。');return result;}
    const incomingIndex={};datasetNames.forEach(ds=>{incomingIndex[ds]=new Map((envelope.datasets[ds]||[]).map(row=>[String(row.id),row]));});
    const localIndex={};Object.keys(REGISTRY).forEach(ds=>{localIndex[ds]=new Map(records(rootData,ds).map(row=>[String(row.id),row]));});
    const primary=writeDatasets[0],baseHash=String(envelope.metadata?.base_hash||'').trim();
    const exportedRevision=String(envelope.metadata?.base_project_revision||'').trim();
    const currentRevision=String(rootData.project?.updated_at||'').trim();
    result.source_revision={exported:exportedRevision,current:currentRevision,changed:!!exportedRevision&&!!currentRevision&&exportedRevision!==currentRevision};
    const sourceHashes=envelope.metadata?.record_hashes?.[primary];
    const staleIds=new Set();
    let usedRecordHashes=false;
    if(sourceHashes&&typeof sourceHashes==='object'&&!Array.isArray(sourceHashes)){
      for(const row of envelope.datasets[primary]||[]){
        const id=String(row.id),expected=String(sourceHashes[id]||'').trim(),local=localIndex[primary].get(id);
        if(!expected||!local)continue;
        usedRecordHashes=true;
        const actual=await recordHash(primary,local);
        if(actual!==expected)staleIds.add(id);
      }
    }
    for(const ds of datasetNames){
      for(const row of envelope.datasets[ds]){
        const id=String(row.id),local=localIndex[ds].get(id);
        const same=!!local&&stableStringify(canonicalizeRecord(ds,local))===stableStringify(canonicalizeRecord(ds,row));
        if(readOnly.has(ds)){
          if(!result.integrity&&!local||(!result.integrity&&local&&!same)){result.items.push({dataset:ds,id,status:'readonly_modified',detail:!local?'read_only参照が現在のProjectに存在しません。':'read_only参照が現在値と異なります。'});result.summary.readonly_modified++;}
          continue;
        }
        if(ds===primary&&local&&staleIds.has(id)){
          result.items.push({dataset:ds,id,status:'stale_source',detail:'Export後にこのレコードが正本側で変更されています。'});
          result.summary.stale_source++;
          continue;
        }
        const broken=referencedIds(ds,row).filter(ref=>!(incomingIndex[ref.dataset]?.has(ref.id))&&!(localIndex[ref.dataset]?.has(ref.id)));
        if(broken.length){if(!result.integrity){result.items.push({dataset:ds,id,status:'broken_reference',detail:broken.map(x=>`${x.dataset}:${x.id}`).join(', ')});result.summary.broken_reference++;}continue;}
        if(!local){result.items.push({dataset:ds,id,status:'add',detail:'新規追加候補'});result.summary.add++;}
        else if(same){result.items.push({dataset:ds,id,status:'unchanged',detail:'現在値と同一'});result.summary.unchanged++;}
        else{result.items.push({dataset:ds,id,status:'conflict',detail:'同一IDの現在値と内容が異なります。'});result.summary.conflict++;}
      }
    }
    if(result.summary.stale_source){
      result.warnings.push(`対象レコード ${result.summary.stale_source}件がExport後に変更されています。古いImportとしてApplyを禁止します。`);
    }else if(usedRecordHashes&&result.source_revision.changed){
      result.warnings.push('Project revisionはExport後に更新されていますが、選択対象レコードのhashは一致しています。');
    }
    if(!usedRecordHashes&&baseHash){
      const incomingIds=(envelope.datasets[primary]||[]).map(r=>String(r.id));
      const localRows=incomingIds.map(id=>localIndex[primary].get(id)).filter(Boolean);
      if(localRows.length===incomingIds.length){
        const actual=await sha256Hex(stableStringify({dataset:primary,records:canonicalRecords(primary,localRows)}));
        if(actual!==baseHash){
          result.summary.stale_source++;
          result.items.push({dataset:primary,id:'',status:'stale_source',detail:'旧形式base_hashが現在の対象データと一致しません。'});
          result.warnings.push('base_hashが現在のProjectと一致しません。Export後に対象データが変更された可能性があります。');
        }
      }
    }
    result.ok=result.errors.length===0;
    result.impact_preview=buildImpactPreview(rootData,envelope,result);
    const blockers=applyBlockReasons(result);
    result.can_apply=result.ok&&blockers.length===0&&(result.summary.add||0)>0;
    return result;
  }
  function stripStoryContext(row,fields){const out=clone(row||{});for(const key of fields||[])delete out[key];return out;}
  function setStoryVirtualRecords(rootData,dataset,newRows){
    const rows=(Array.isArray(newRows)?newRows:[]).map(clone);
    const chapters=Array.isArray(rootData?.chapters)?rootData.chapters:[];
    const chapterById=new Map(chapters.map(ch=>[String(ch?.id||''),ch]));
    if(dataset==='story_sections'){
      const grouped=new Map();for(const row of rows){const cid=String(row?.chapter_id||'');if(!chapterById.has(cid))throw new Error('親Chapterが見つかりません: '+cid);if(!grouped.has(cid))grouped.set(cid,[]);grouped.get(cid).push(row);}
      for(const chapter of chapters){const cid=String(chapter?.id||''),existing=new Map((chapter.sections||[]).map(x=>[String(x?.id||''),x]));chapter.sections=(grouped.get(cid)||[]).map(row=>{const clean=stripStoryContext(row,['chapter_id']);const old=existing.get(String(row.id));clean.scenes=clone(old?.scenes||[]);return clean;});}
      return;
    }
    if(dataset==='story_scenes'){
      const sections=new Map();for(const chapter of chapters)for(const section of chapter.sections||[])sections.set(String(chapter.id)+'::'+String(section.id),section);
      const grouped=new Map();for(const row of rows){const key=String(row?.chapter_id||'')+'::'+String(row?.section_id||'');if(!sections.has(key))throw new Error('親Sectionが見つかりません: '+key);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row);}
      for(const [key,section] of sections){const existing=new Map((section.scenes||[]).map(x=>[String(x?.id||''),x]));section.scenes=(grouped.get(key)||[]).map(row=>{const clean=stripStoryContext(row,['chapter_id','section_id']);const old=existing.get(String(row.id));clean.dialogues=clone(old?.dialogues||[]);return clean;});}
      return;
    }
    if(dataset==='story_dialogues'){
      const scenes=new Map();for(const chapter of chapters)for(const section of chapter.sections||[])for(const scene of section.scenes||[])scenes.set(String(chapter.id)+'::'+String(section.id)+'::'+String(scene.id),scene);
      const grouped=new Map();for(const row of rows){const key=String(row?.chapter_id||'')+'::'+String(row?.section_id||'')+'::'+String(row?.scene_id||'');if(!scenes.has(key))throw new Error('親Sceneが見つかりません: '+key);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row);}
      for(const [key,scene] of scenes)scene.dialogues=(grouped.get(key)||[]).map(row=>stripStoryContext(row,['chapter_id','section_id','scene_id']));
      return;
    }
    throw new Error('未対応Story Dataset: '+dataset);
  }
  function setDatasetRecords(rootData,dataset,newRows){
    const def=REGISTRY[dataset];if(!def)throw new Error('未対応Dataset: '+dataset);
    if(def.virtual){setStoryVirtualRecords(rootData,dataset,newRows);return;}
    let target=rootData;
    for(let i=0;i<def.path.length-1;i++){
      const key=def.path[i];
      if(!target[key]||typeof target[key]!=='object')target[key]={};
      target=target[key];
    }
    target[def.path[def.path.length-1]]=newRows;
  }
  function applyBlockReasons(result,options={}){
    const reasons=[];
    if(!result?.ok)reasons.push('Dry Runが正常完了していません。');
    const s=result?.summary||{};
    if((s.invalid||0)>0)reasons.push(`不正 ${s.invalid}件`);
    if((s.incompatible||0)>0)reasons.push(`非互換 ${s.incompatible}件`);
    if(!options.allowConflict&&(s.conflict||0)>0)reasons.push(`競合 ${s.conflict}件`);
    if((s.stale_source||0)>0)reasons.push(`元データ更新済み ${s.stale_source}件`);
    if((s.broken_reference||0)>0)reasons.push(`参照切れ ${s.broken_reference}件`);
    if((s.readonly_modified||0)>0)reasons.push(`参照データ差異 ${s.readonly_modified}件`);
    if(result?.integrity?.apply_blocking&&!reasons.length)reasons.push('Integrity ValidatorがApplyを禁止しています。');
    return reasons;
  }
  const SAFE_TOP_LEVEL_FIELDS={
    monsters:new Set(['id','name','status','tags','params','description','created_at','updated_at']),
    tags:new Set(['id','name','status','category_id','parent_id','description','enabled','aliases','deprecated','replacement_tag_id','recommended_replacement_tag_id','order','created_at','updated_at']),
    skills:new Set(['id','name','status','tags','params','description','created_at','updated_at','version','kind','environment','mpCost','cooldown','multiplier','target','statusId','buff','operation','tag','tagId','stack','amount','stackId','execution']),
    jobs:new Set(['id','name','status','tags','params','description','created_at','updated_at','str','vit','agi','dex','int','mnd','luk']),
    equipment:new Set(['id','name','status','tags','params','description','created_at','updated_at','mod_ids','item_level','mod_budget','mod_count','required_str','required_dex','required_int','required_vit','required_mnd','required_agi','attack','accuracy','magic_weapon_bonus','base_critical_rate','hp_bonus','mp_bonus','evasion','armor_category','armor_slot','generation']),
    mods:new Set(['id','name','status','tags','params','description','created_at','updated_at']),
    ai_conditions:new Set(['id','name','status','tags','params','description','created_at','updated_at']),
    ai_targets:new Set(['id','name','status','tags','params','description','created_at','updated_at']),
    ai_actions:new Set(['id','name','status','tags','params','description','created_at','updated_at']),
    chapters:new Set(['id','no','title','theme','summary','purpose','status','design','sections','candidate_revisions','export_control','created_at','updated_at']),
    story_sections:new Set(['id','chapter_id','no','title','summary','purpose','start_state','end_state','key_points','status','design','candidate_revisions','export_control','created_at','updated_at']),
    story_scenes:new Set(['id','chapter_id','section_id','no','title','summary','purpose','status','design','candidate_revisions','export_control','created_at','updated_at']),
    story_dialogues:new Set(['id','chapter_id','section_id','scene_id','no','status','speaker','text','stage_direction','description','created_at','updated_at'])
  };
  function unknownIncomingFields(dataset,localRow,incomingRow){
    const allowed=SAFE_TOP_LEVEL_FIELDS[dataset];
    if(!allowed||!incomingRow||typeof incomingRow!=='object')return [];
    const localKeys=new Set(Object.keys(localRow||{}));
    return Object.keys(incomingRow).filter(key=>!allowed.has(key)&&!localKeys.has(key));
  }
  function mergeRecordPreservingCurrent(dataset,localRow,incomingRow){
    const unknown=unknownIncomingFields(dataset,localRow,incomingRow);
    if(unknown.length)throw new Error(`未知フィールドを検出しました: ${dataset} / ${incomingRow?.id||'-'} / ${unknown.join(', ')}`);
    const merged=clone(localRow||{});
    for(const [key,value] of Object.entries(incomingRow||{}))merged[key]=clone(value);
    return merged;
  }
  async function createApplyPlan(options){
    const rootData=options?.rootData||{},envelope=options?.envelope;
    const dryRun=options?.dryRun||await dryRunImport({rootData,envelope});
    const writable=uniqueStrings(envelope?.permissions?.writable||[]);
    const reasons=applyBlockReasons(dryRun,{allowConflict:true});
    if(writable.length!==1)reasons.push('writable Datasetは1分類である必要があります。');
    const dataset=writable[0]||'',def=REGISTRY[dataset];
    const incoming=Array.isArray(envelope?.datasets?.[dataset])?envelope.datasets[dataset]:[];
    const sourceById=new Map(incoming.map(row=>[String(row?.[def?.idField||'id']??''),row]));
    const localById=new Map(records(rootData,dataset).map(row=>[String(row?.[def?.idField||'id']??''),row]));
    const addItems=(dryRun.items||[]).filter(x=>x.status==='add'&&x.dataset===dataset);
    const conflictItems=(dryRun.items||[]).filter(x=>x.status==='conflict'&&x.dataset===dataset);
    const addIds=addItems.map(x=>String(x.id)).filter(Boolean);
    const choices={...(options?.conflictChoices||{})};
    const keepIds=[],importIds=[],unresolvedIds=[];
    for(const item of conflictItems){
      const id=String(item.id),choice=String(choices[id]||'');
      if(choice==='keep')keepIds.push(id);
      else if(choice==='import')importIds.push(id);
      else unresolvedIds.push(id);
      const unknown=unknownIncomingFields(dataset,localById.get(id),sourceById.get(id));
      if(unknown.length)reasons.push(`未知フィールド ${id}: ${unknown.join(', ')}`);
    }
    for(const id of addIds){
      const unknown=unknownIncomingFields(dataset,null,sourceById.get(id));
      if(unknown.length)reasons.push(`未知フィールド ${id}: ${unknown.join(', ')}`);
    }
    if(unresolvedIds.length)reasons.push(`競合未解決 ${unresolvedIds.length}件`);
    if(!addIds.length&&!conflictItems.length&&!reasons.length)reasons.push('追加・競合対象がありません。');
    const plan={
      ok:reasons.length===0,can_apply:reasons.length===0,dataset,
      add_count:addIds.length,add_ids:addIds,
      conflict_count:conflictItems.length,
      conflict_choices:choices,
      keep_ids:keepIds,import_ids:importIds,unresolved_ids:unresolvedIds,
      ids:[...addIds,...importIds],reasons,dryRun
    };
    dryRun.can_apply=plan.can_apply;
    dryRun.apply_plan={
      dataset,add_count:addIds.length,conflict_count:conflictItems.length,
      add_ids:addIds.slice(),keep_ids:keepIds.slice(),import_ids:importIds.slice(),
      unresolved_ids:unresolvedIds.slice(),reasons:reasons.slice()
    };
    return plan;
  }
  async function applySafeMerge(options){
    const rootData=options?.rootData||{},envelope=options?.envelope;
    const plan=options?.plan||await createApplyPlan({
      rootData,envelope,dryRun:options?.dryRun,conflictChoices:options?.conflictChoices
    });
    if(!plan.can_apply)throw new Error('Safe Apply不可: '+(plan.reasons||[]).join(' / '));
    const dataset=plan.dataset,def=REGISTRY[dataset];
    const incoming=Array.isArray(envelope?.datasets?.[dataset])?envelope.datasets[dataset]:[];
    const sourceById=new Map(incoming.map(row=>[String(row?.[def.idField]??''),row]));
    const current=records(rootData,dataset).map(clone);
    const index=new Map(current.map((row,i)=>[String(row?.[def.idField]??''),i]));
    const appliedIds=[];
    for(const id of plan.add_ids||[]){
      if(index.has(id))throw new Error('Apply直前に既存IDを検出しました: '+id);
      const row=sourceById.get(id);
      if(!row)throw new Error('Apply対象データが見つかりません: '+id);
      const unknown=unknownIncomingFields(dataset,null,row);
      if(unknown.length)throw new Error(`未知フィールドを検出しました: ${id} / ${unknown.join(', ')}`);
      current.push(clone(row));index.set(id,current.length-1);appliedIds.push(id);
    }
    for(const id of plan.import_ids||[]){
      if(!index.has(id))throw new Error('Conflict対象の現在レコードが見つかりません: '+id);
      const row=sourceById.get(id);
      if(!row)throw new Error('Import採用データが見つかりません: '+id);
      const pos=index.get(id);
      current[pos]=mergeRecordPreservingCurrent(dataset,current[pos],row);
      appliedIds.push(id);
    }
    const nextRootData=clone(rootData);
    setDatasetRecords(nextRootData,dataset,current);

    // Post-Apply verification compares against the committed candidate, not the pre-Import source hash.
    // Otherwise an intentional conflict adoption would be misclassified as stale_source.
    const verifyEnvelope=clone(envelope);
    if(verifyEnvelope?.metadata){
      verifyEnvelope.metadata.base_hash='';
      if(!verifyEnvelope.metadata.record_hashes||typeof verifyEnvelope.metadata.record_hashes!=='object')verifyEnvelope.metadata.record_hashes={};
      if(!verifyEnvelope.metadata.record_hashes[dataset]||typeof verifyEnvelope.metadata.record_hashes[dataset]!=='object')verifyEnvelope.metadata.record_hashes[dataset]={};
      for(const id of plan.import_ids||[]){
        const pos=index.get(id);
        const candidateRow=clone(current[pos]);
        verifyEnvelope.metadata.record_hashes[dataset][id]=await recordHash(dataset,candidateRow);
        const rows=verifyEnvelope.datasets?.[dataset]||[];
        const rowPos=rows.findIndex(row=>String(row?.[def.idField]??'')===id);
        if(rowPos>=0)rows[rowPos]=candidateRow;
      }
      verifyEnvelope.metadata.package_hash='';
    }
    const verify=await dryRunImport({rootData:nextRootData,envelope:verifyEnvelope});
    const verifyConflicts=(verify.items||[]).filter(x=>x.status==='conflict'&&x.dataset===dataset).map(x=>String(x.id)).sort();
    const expectedKeep=(plan.keep_ids||[]).slice().sort();
    const conflictOk=stableStringify(verifyConflicts)===stableStringify(expectedKeep);
    if(!verify.ok||
       verify.summary.add!==0||
       !conflictOk||
       verify.summary.broken_reference!==0||
       verify.summary.readonly_modified!==0||
       verify.summary.stale_source!==0||
       verify.summary.invalid!==0||
       verify.summary.incompatible!==0){
      throw new Error('Apply後の再検証に失敗しました。書き込み候補は破棄されました。');
    }
    return {
      nextRootData,
      applied:{
        dataset,count:appliedIds.length,
        add_count:(plan.add_ids||[]).length,
        changed_count:(plan.import_ids||[]).length,
        kept_count:(plan.keep_ids||[]).length,
        ids:appliedIds
      },
      verify
    };
  }
  function validateEnvelopeShape(value){
    const errors=[];
    if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,errors:['Envelopeがオブジェクトではありません。']};
    if(value.format!==FORMAT)errors.push('formatがGKS_DATA_EXCHANGEではありません。');
    if(typeof value.version!=='string'||!value.version)errors.push('versionがありません。');
    if(typeof value.project_id!=='string'||!value.project_id)errors.push('project_idがありません。');
    if(value.mode!=='partial')errors.push('modeはpartialである必要があります。');
    if(!value.datasets||typeof value.datasets!=='object'||Array.isArray(value.datasets))errors.push('datasetsがありません。');
    if(!value.permissions||!Array.isArray(value.permissions.writable)||!Array.isArray(value.permissions.read_only))errors.push('permissionsが不正です。');
    return {ok:errors.length===0,errors};
  }
  return {FORMAT,VERSION,REGISTRY,records,setDatasetRecords,canonicalizeRecord,stableStringify,sha256Hex,recordHash,recordFieldDiff,buildImpactPreview,buildImpactExportPayload,unknownIncomingFields,mergeRecordPreservingCurrent,resolveDependencies,buildEnvelope,validateEnvelopeShape,verifyPackageHash,dryRunImport,createApplyPlan,applySafeMerge};
});
