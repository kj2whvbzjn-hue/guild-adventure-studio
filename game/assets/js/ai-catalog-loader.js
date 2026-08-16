(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAICatalogLoader=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  function rowsFromEnvelope(value){
    if(Array.isArray(value))return clone(value);
    return Array.isArray(value?.data)?clone(value.data):[];
  }
  function normalizeOfficialPreset(row){
    if(!row||typeof row!=='object'||Array.isArray(row))return null;
    const id=String(row.id||row.preset_id||'').trim(),name=String(row.name||'').trim();
    const program=row.program||row.ai_program,layout=row.layout||row.ai_layout;
    if(!id||!name||!program||!layout)return null;
    return {preset_id:id,name,source:'official',description:String(row.description||''),program:clone(program),layout:clone(layout)};
  }
  function normalize(aiRows,skillRows,tags,tagCategories,templateRows){
    const masters={ai_conditions:[],ai_targets:[],ai_actions:[]};
    for(const row of Array.isArray(aiRows)?aiRows:[]){
      const type=String(row?.node_type||'');
      if(type==='condition')masters.ai_conditions.push(clone(row));
      else if(type==='target')masters.ai_targets.push(clone(row));
      else if(type==='action')masters.ai_actions.push(clone(row));
    }
    const officialPresets=(Array.isArray(templateRows)?templateRows:[]).map(normalizeOfficialPreset).filter(Boolean);
    return Object.freeze({
      masters:Object.freeze(masters),
      refs:Object.freeze({skills:Object.freeze(clone(skillRows||[])),tags:Object.freeze(clone(tags||[]))}),
      tag_categories:Object.freeze(clone(tagCategories||[])),
      official_presets:Object.freeze(officialPresets),
      counts:Object.freeze({
        conditions:masters.ai_conditions.length,
        targets:masters.ai_targets.length,
        actions:masters.ai_actions.length,
        skills:Array.isArray(skillRows)?skillRows.length:0,
        tags:Array.isArray(tags)?tags.length:0,
        official_presets:officialPresets.length
      })
    });
  }
  async function fetchJson(fetchImpl,url){
    const response=await fetchImpl(url,{cache:'no-store'});
    if(!response||!response.ok)throw new Error(`AI catalog fetch failed: ${url} (${response?.status||'network'})`);
    return response.json();
  }
  async function load(options){
    const opts=options||{};
    const fetchImpl=opts.fetch||globalThis.fetch;
    if(typeof fetchImpl!=='function')throw new Error('fetch is required');
    const config=globalThis.GA_PROJECT_CONFIG||{};
    const aiUrl=opts.aiUrl||config.aiNodeExportUrl||'../Export/ai/ai_nodes.json';
    const skillUrl=opts.skillUrl||config.skillExportUrl||'../Export/skill/skills.json';
    const templateUrl=opts.templateUrl||config.aiTemplateExportUrl||'../Export/ai/ai_templates.json';
    const warnings=[];
    let ai=[],skills=[],templates=[];
    try{ai=rowsFromEnvelope(await fetchJson(fetchImpl,aiUrl));}catch(error){warnings.push(String(error?.message||error));}
    try{skills=rowsFromEnvelope(await fetchJson(fetchImpl,skillUrl));}catch(error){warnings.push(String(error?.message||error));}
    try{templates=rowsFromEnvelope(await fetchJson(fetchImpl,templateUrl));}catch(error){templates=[];}
    const catalog=normalize(ai,skills,opts.tags||[],opts.tag_categories||[],templates);
    return Object.freeze({...catalog,warnings:Object.freeze(warnings)});
  }
  return Object.freeze({rowsFromEnvelope,normalizeOfficialPreset,normalize,load});
});
