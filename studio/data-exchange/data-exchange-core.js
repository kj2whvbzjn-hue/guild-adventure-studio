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
  return {FORMAT,VERSION,REGISTRY,records,canonicalizeRecord,stableStringify,sha256Hex,resolveDependencies,buildEnvelope,validateEnvelopeShape};
});
