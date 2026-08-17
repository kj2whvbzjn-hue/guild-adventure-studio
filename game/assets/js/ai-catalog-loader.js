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
  function refsFromEnvelope(value){
    const refs=value&&typeof value==='object'&&!Array.isArray(value)&&value.refs&&typeof value.refs==='object'?value.refs:{};
    return {tags:Array.isArray(refs.tags)?clone(refs.tags):[],tag_categories:Array.isArray(refs.tag_categories)?clone(refs.tag_categories):[]};
  }
  function dataVersionFromEnvelope(value){return value&&typeof value==='object'&&!Array.isArray(value)?String(value.data_version||''):'';}
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
  function filterSkills(catalog,allowedSkillIds){
    const source=catalog&&typeof catalog==='object'?catalog:normalize([],[],[],[],[]),allowed=new Set((Array.isArray(allowedSkillIds)?allowedSkillIds:[]).map(x=>String(x||'').trim()).filter(Boolean));
    const skills=(source.refs?.skills||[]).filter(row=>allowed.has(String(row?.id||'')));
    return Object.freeze({...source,refs:Object.freeze({...source.refs,skills:Object.freeze(clone(skills))}),counts:Object.freeze({...source.counts,skills:skills.length})});
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
    let ai=[],skills=[],templates=[],aiRefs={tags:[],tag_categories:[]},aiVersion='',skillVersion='',templateVersion='';
    try{const doc=await fetchJson(fetchImpl,aiUrl);ai=rowsFromEnvelope(doc);aiRefs=refsFromEnvelope(doc);aiVersion=dataVersionFromEnvelope(doc);}catch(error){warnings.push(String(error?.message||error));}
    try{const doc=await fetchJson(fetchImpl,skillUrl);skills=rowsFromEnvelope(doc);skillVersion=dataVersionFromEnvelope(doc);}catch(error){warnings.push(String(error?.message||error));}
    try{const doc=await fetchJson(fetchImpl,templateUrl);templates=rowsFromEnvelope(doc);templateVersion=dataVersionFromEnvelope(doc);}catch(error){templates=[];}
    const versions=[aiVersion,skillVersion,templateVersion].filter(Boolean);
    if(new Set(versions).size>1)warnings.push(`AI参照データのData Versionが一致しません: ${[aiVersion||'-',skillVersion||'-',templateVersion||'-'].join(' / ')}`);
    const tags=Array.isArray(opts.tags)?opts.tags:aiRefs.tags,tagCategories=Array.isArray(opts.tag_categories)?opts.tag_categories:aiRefs.tag_categories;
    const catalog=normalize(ai,skills,tags,tagCategories,templates);
    return Object.freeze({...catalog,data_version:aiVersion||skillVersion||templateVersion||'',warnings:Object.freeze(warnings)});
  }
  return Object.freeze({rowsFromEnvelope,refsFromEnvelope,dataVersionFromEnvelope,normalizeOfficialPreset,normalize,filterSkills,load});
});
