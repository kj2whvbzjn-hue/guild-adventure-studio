(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAICatalogLoader=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='2.0.0';
  let installedCatalog=null,primePromise=null;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  function rowsFromEnvelope(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.data))throw new Error('AI Formal Export envelope is invalid');
    return clone(value.data);
  }
  function refsFromEnvelope(value){
    const refs=value&&typeof value==='object'&&!Array.isArray(value)&&value.refs&&typeof value.refs==='object'?value.refs:{};
    return {tags:Array.isArray(refs.tags)?clone(refs.tags):[],tag_categories:Array.isArray(refs.tag_categories)?clone(refs.tag_categories):[]};
  }
  function dataVersionFromEnvelope(value){return value&&typeof value==='object'&&!Array.isArray(value)?String(value.data_version||''):'';}
  function schemaVersionFromEnvelope(value){return value&&typeof value==='object'&&!Array.isArray(value)?String(value.schema_version||''):'';}
  function assertFormalEnvelope(value,label){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label}: envelope is required`);
    if(schemaVersionFromEnvelope(value)!==SCHEMA_VERSION)throw new Error(`${label}: schema_version must be ${SCHEMA_VERSION}`);
    const dataVersion=dataVersionFromEnvelope(value);if(!dataVersion)throw new Error(`${label}: data_version is required`);
    if(!Array.isArray(value.data))throw new Error(`${label}: data must be an array`);
    return dataVersion;
  }
  function assertRowDataVersion(rows,dataVersion,label){
    for(const row of rows){
      if(row&&typeof row==='object'&&!Array.isArray(row)&&Object.prototype.hasOwnProperty.call(row,'data_version')&&String(row.data_version)!==dataVersion){
        throw new Error(`${label}: row data_version mismatch (${String(row.id||row.layout_id||row.program_id||'-')})`);
      }
      if(row&&typeof row==='object'&&!Array.isArray(row)&&Object.prototype.hasOwnProperty.call(row,'schema_version')&&String(row.schema_version)!==SCHEMA_VERSION){
        throw new Error(`${label}: row schema_version mismatch (${String(row.id||row.layout_id||row.program_id||'-')})`);
      }
    }
  }
  function normalizeOfficialPreset(row){
    if(!row||typeof row!=='object'||Array.isArray(row))return null;
    const id=String(row.id||row.preset_id||'').trim(),name=String(row.name||'').trim();
    const program=row.program||row.ai_program,layout=row.layout||row.ai_layout;
    if(!id||!name||!program||!layout)return null;
    return {preset_id:id,name,source:'official',description:String(row.description||''),program:clone(program),layout:clone(layout)};
  }
  function normalize(nodeRows,selectorRows,skillRows,tags,tagCategories,programRows,layoutRows,runtimeRows,templateRows){
    const masters={ai_searches:[],ai_conditions:[],ai_actions:[],ai_target_selectors:[]};
    for(const row of Array.isArray(nodeRows)?nodeRows:[]){
      const type=String(row?.node_type||''),id=String(row?.id||'');
      if(type==='search'&&/^AIS-/.test(id))masters.ai_searches.push(clone(row));
      else if(type==='condition'&&/^AIC-/.test(id))masters.ai_conditions.push(clone(row));
      else if(type==='action'&&/^AIA-/.test(id))masters.ai_actions.push(clone(row));
      else throw new Error(`AI node dataset contains an invalid Current V2 node: ${id||'-'} / ${type||'-'}`);
    }
    for(const row of Array.isArray(selectorRows)?selectorRows:[]){
      if(!/^ATS-/.test(String(row?.id||'')))throw new Error(`AI target selector dataset contains an invalid ATS id: ${String(row?.id||'-')}`);
      if(String(row?.node_type||''))throw new Error(`ATS must not be represented as an AI node: ${String(row?.id||'-')}`);
      masters.ai_target_selectors.push(clone(row));
    }
    const officialPresets=(Array.isArray(templateRows)?templateRows:[]).map(normalizeOfficialPreset).filter(Boolean);
    const developerPrograms=clone(Array.isArray(programRows)?programRows:[]),developerLayouts=clone(Array.isArray(layoutRows)?layoutRows:[]),developerRuntimes=clone(Array.isArray(runtimeRows)?runtimeRows:[]);
    return Object.freeze({
      masters:Object.freeze(masters),
      refs:Object.freeze({skills:Object.freeze(clone(skillRows||[])),tags:Object.freeze(clone(tags||[]))}),
      tag_categories:Object.freeze(clone(tagCategories||[])),
      developer_programs:Object.freeze(developerPrograms),
      developer_program_layouts:Object.freeze(developerLayouts),
      developer_program_runtime:Object.freeze(developerRuntimes),
      official_presets:Object.freeze(officialPresets),
      counts:Object.freeze({
        searches:masters.ai_searches.length,
        conditions:masters.ai_conditions.length,
        actions:masters.ai_actions.length,
        target_selectors:masters.ai_target_selectors.length,
        developer_programs:developerPrograms.length,
        developer_program_layouts:developerLayouts.length,
        developer_program_runtime:developerRuntimes.length,
        skills:Array.isArray(skillRows)?skillRows.length:0,
        tags:Array.isArray(tags)?tags.length:0,
        official_presets:officialPresets.length
      })
    });
  }
  function filterSkills(catalog,allowedSkillIds){
    const source=catalog&&typeof catalog==='object'?catalog:normalize([],[],[],[],[],[],[],[],[]),allowed=new Set((Array.isArray(allowedSkillIds)?allowedSkillIds:[]).map(x=>String(x||'').trim()).filter(Boolean));
    const skills=(source.refs?.skills||[]).filter(row=>allowed.has(String(row?.id||'')));
    return Object.freeze({...source,refs:Object.freeze({...source.refs,skills:Object.freeze(clone(skills))}),counts:Object.freeze({...source.counts,skills:skills.length})});
  }
  async function fetchJson(fetchImpl,url){
    const response=await fetchImpl(url,{cache:'no-store'});
    if(!response||!response.ok)throw new Error(`AI catalog fetch failed: ${url} (${response?.status||'network'})`);
    return response.json();
  }
  async function load(options){
    const opts=options||{},fetchImpl=opts.fetch||globalThis.fetch;
    if(typeof fetchImpl!=='function')throw new Error('fetch is required');
    const config=globalThis.GA_PROJECT_CONFIG||{};
    const urls={
      nodes:opts.aiNodeUrl||config.aiNodeExportUrl||'../Export/ai/ai_nodes.json',
      selectors:opts.aiTargetSelectorUrl||config.aiTargetSelectorExportUrl||'../Export/ai/ai_target_selectors.json',
      programs:opts.aiProgramUrl||config.aiProgramExportUrl||'../Export/ai/ai_programs.json',
      layouts:opts.aiProgramLayoutUrl||config.aiProgramLayoutExportUrl||'../Export/ai/ai_program_layouts.json',
      runtime:opts.aiProgramRuntimeUrl||config.aiProgramRuntimeExportUrl||'../Export/ai/ai_program_runtime.json',
      skills:opts.skillUrl||config.skillExportUrl||'../Export/skill/skills.json'
    };
    const [nodeDoc,selectorDoc,programDoc,layoutDoc,runtimeDoc]=await Promise.all([
      fetchJson(fetchImpl,urls.nodes),fetchJson(fetchImpl,urls.selectors),fetchJson(fetchImpl,urls.programs),fetchJson(fetchImpl,urls.layouts),fetchJson(fetchImpl,urls.runtime)
    ]);
    const aiDocs=[['ai_nodes',nodeDoc],['ai_target_selectors',selectorDoc],['ai_programs',programDoc],['ai_program_layouts',layoutDoc],['ai_program_runtime',runtimeDoc]];
    const versions=aiDocs.map(([label,doc])=>assertFormalEnvelope(doc,label));
    if(new Set(versions).size!==1)throw new Error(`AI Formal Export data_version mismatch: ${versions.join(' / ')}`);
    const dataVersion=versions[0];
    const nodes=rowsFromEnvelope(nodeDoc),selectors=rowsFromEnvelope(selectorDoc),programs=rowsFromEnvelope(programDoc),layouts=rowsFromEnvelope(layoutDoc),runtimes=rowsFromEnvelope(runtimeDoc);
    assertRowDataVersion(nodes,dataVersion,'ai_nodes');assertRowDataVersion(selectors,dataVersion,'ai_target_selectors');assertRowDataVersion(programs,dataVersion,'ai_programs');assertRowDataVersion(layouts,dataVersion,'ai_program_layouts');assertRowDataVersion(runtimes,dataVersion,'ai_program_runtime');
    const warnings=[];let skills=[];const aiRefs=refsFromEnvelope(nodeDoc);
    try{const skillDoc=await fetchJson(fetchImpl,urls.skills);skills=rowsFromEnvelope(skillDoc);const skillVersion=dataVersionFromEnvelope(skillDoc);if(skillVersion&&skillVersion!==dataVersion)warnings.push(`Skill data_version differs from AI Formal Export: ${skillVersion} / ${dataVersion}`);}catch(error){warnings.push(String(error?.message||error));}
    const tags=Array.isArray(opts.tags)?opts.tags:aiRefs.tags,tagCategories=Array.isArray(opts.tag_categories)?opts.tag_categories:aiRefs.tag_categories;
    const catalog=normalize(nodes,selectors,skills,tags,tagCategories,programs,layouts,runtimes,[]);
    return Object.freeze({...catalog,schema_version:SCHEMA_VERSION,data_version:dataVersion,warnings:Object.freeze(warnings)});
  }
  function install(catalog){
    if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)||catalog.schema_version!==SCHEMA_VERSION||!String(catalog.data_version||''))throw new Error('AI V2 catalog install requires a validated Formal Export catalog');
    installedCatalog=catalog;return installedCatalog;
  }
  function current(){return installedCatalog;}
  async function prime(options){
    if(installedCatalog)return installedCatalog;
    if(!primePromise)primePromise=load(options).then(install).catch(error=>{primePromise=null;throw error;});
    return primePromise;
  }
  function clear(){installedCatalog=null;primePromise=null;}
  return Object.freeze({SCHEMA_VERSION,rowsFromEnvelope,refsFromEnvelope,dataVersionFromEnvelope,schemaVersionFromEnvelope,assertFormalEnvelope,normalizeOfficialPreset,normalize,filterSkills,load,install,current,prime,clear});
});
