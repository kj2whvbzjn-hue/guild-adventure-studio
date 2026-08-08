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
    equipment:{path:['masters','equipment'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    mods:{path:['masters','mods'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    ai_conditions:{path:['masters','ai_conditions'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    ai_targets:{path:['masters','ai_targets'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]},
    ai_actions:{path:['masters','ai_actions'],idField:'id',volatile:VOLATILE_DEFAULT,unordered:['tags'],dependencies:[{dataset:'tags',paths:['tags']}]}
  };

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function getAt(obj,path){return String(path||'').split('.').filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],obj);}
  function records(rootData,dataset){
    const def=REGISTRY[dataset]; if(!def)throw new Error('未対応Dataset: '+dataset);
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
    const envelope={
      format:FORMAT,version:VERSION,project_id:String(rootData.project?.id||''),mode:'partial',
      permissions:{writable:[dataset],read_only:Object.keys(datasets).filter(k=>k!==dataset).sort()},
      metadata:{
        generated_at:new Date().toISOString(),source:'studio-data-exchange',studio_version:String(options.studioVersion||''),schema_version:String(rootData.schema_version||''),
        dependency_mode:mode,record_count:Object.fromEntries(Object.entries(datasets).map(([k,v])=>[k,v.length])),base_project_revision:String(rootData.project?.updated_at||''),base_hash:baseHash,
        package_hash:'',hash_algorithm:'SHA-256'
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
    for(const ds of datasetNames){
      for(const row of envelope.datasets[ds]){
        const id=String(row.id),local=localIndex[ds].get(id);
        const same=!!local&&stableStringify(canonicalizeRecord(ds,local))===stableStringify(canonicalizeRecord(ds,row));
        if(readOnly.has(ds)){
          if(!result.integrity&&!local||(!result.integrity&&local&&!same)){result.items.push({dataset:ds,id,status:'readonly_modified',detail:!local?'read_only参照が現在のProjectに存在しません。':'read_only参照が現在値と異なります。'});result.summary.readonly_modified++;}
          continue;
        }
        const broken=referencedIds(ds,row).filter(ref=>!(incomingIndex[ref.dataset]?.has(ref.id))&&!(localIndex[ref.dataset]?.has(ref.id)));
        if(broken.length){if(!result.integrity){result.items.push({dataset:ds,id,status:'broken_reference',detail:broken.map(x=>`${x.dataset}:${x.id}`).join(', ')});result.summary.broken_reference++;}continue;}
        if(!local){result.items.push({dataset:ds,id,status:'add',detail:'新規追加候補'});result.summary.add++;}
        else if(same){result.items.push({dataset:ds,id,status:'unchanged',detail:'現在値と同一'});result.summary.unchanged++;}
        else{result.items.push({dataset:ds,id,status:'conflict',detail:'同一IDの現在値と内容が異なります。'});result.summary.conflict++;}
      }
    }
    const primary=writeDatasets[0],baseHash=String(envelope.metadata?.base_hash||'').trim();
    if(baseHash){
      const incomingIds=(envelope.datasets[primary]||[]).map(r=>String(r.id));
      const localRows=incomingIds.map(id=>localIndex[primary].get(id)).filter(Boolean);
      if(localRows.length===incomingIds.length){
        const actual=await sha256Hex(stableStringify({dataset:primary,records:canonicalRecords(primary,localRows)}));
        if(actual!==baseHash){result.summary.stale_source++;result.warnings.push('base_hashが現在のProjectと一致しません。Export後に対象データが変更された可能性があります。');}
      }
    }
    result.ok=result.errors.length===0;result.can_apply=false;return result;
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
  return {FORMAT,VERSION,REGISTRY,records,canonicalizeRecord,stableStringify,sha256Hex,resolveDependencies,buildEnvelope,validateEnvelopeShape,verifyPackageHash,dryRunImport};
});
