(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSFullImportGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const MASTER_PREFIXES=Object.freeze({
    tags:'TAG',stats:'STA',jobs:'JOB',skills:'SKL',equipment:'EQP',mods:'MOD',monsters:'MON',status_effects:'STS',tablets:'TBL',
    ai_conditions:'AIC',ai_targets:'AIT',ai_actions:'AIA',maps:'MAP',exploration_outcomes:'EXP',reward_tables:'RWD',adventure_settings:'ADV'
  });
  const GAME_PREFIXES=Object.freeze({chapter:'CHP',section:'SEC',scene:'SCN',dialogue:'DLG',quest:'QST',event:'EVT',flag:'FLG'});
  const OPTIONAL_ARRAY_FIELDS=Object.freeze(['chapters','characters','organizations','terms','relationships','timeline','quests','events','flags','battle_tests','battle_snapshots','entities','decisions','tags','tag_categories','ai_programs','history']);
  const REQUIRED_ROOT_OBJECTS=Object.freeze(['project','masters']);

  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function issue(code,path,message,severity='error',extra={}){return {code,path,message,severity,...extra};}
  function idPattern(prefix){return new RegExp('^'+prefix+'-\\d{4}$');}
  function projectShapeIssues(rootData){
    const out=[];
    if(!isObject(rootData))return [issue('invalid_root','', 'Project JSONのルートはオブジェクトである必要があります。')];
    for(const key of REQUIRED_ROOT_OBJECTS){
      if(!isObject(rootData[key]))out.push(issue('invalid_type',key,`${key} はオブジェクトである必要があります。`));
    }
    if(isObject(rootData.project)){
      if(!String(rootData.project.id||'').trim())out.push(issue('required','project.id','Project IDがありません。'));
      if(!String(rootData.project.name||'').trim())out.push(issue('required','project.name','Project Nameがありません。'));
    }
    for(const key of OPTIONAL_ARRAY_FIELDS){
      if(rootData[key]!==undefined&&!Array.isArray(rootData[key]))out.push(issue('invalid_type',key,`${key} は配列である必要があります。`));
    }
    if(Array.isArray(rootData.chapters))rootData.chapters.forEach((chapter,ci)=>{
      if(!isObject(chapter)){out.push(issue('invalid_record',`chapters[${ci}]`,`chapters[${ci}] はオブジェクトである必要があります。`));return;}
      if(chapter.sections!==undefined&&!Array.isArray(chapter.sections))out.push(issue('invalid_type',`chapters[${ci}].sections`,`chapters[${ci}].sections は配列である必要があります。`));
      (Array.isArray(chapter.sections)?chapter.sections:[]).forEach((section,si)=>{
        if(!isObject(section)){out.push(issue('invalid_record',`chapters[${ci}].sections[${si}]`,`Sectionはオブジェクトである必要があります。`));return;}
        if(section.scenes!==undefined&&!Array.isArray(section.scenes))out.push(issue('invalid_type',`chapters[${ci}].sections[${si}].scenes`,`scenes は配列である必要があります。`));
        (Array.isArray(section.scenes)?section.scenes:[]).forEach((scene,sci)=>{
          if(!isObject(scene)){out.push(issue('invalid_record',`chapters[${ci}].sections[${si}].scenes[${sci}]`,`Sceneはオブジェクトである必要があります。`));return;}
          if(scene.dialogues!==undefined&&!Array.isArray(scene.dialogues))out.push(issue('invalid_type',`chapters[${ci}].sections[${si}].scenes[${sci}].dialogues`,`dialogues は配列である必要があります。`));
        });
      });
    });
    if(Array.isArray(rootData.quests))rootData.quests.forEach((quest,qi)=>{if(isObject(quest)&&quest.boxes!==undefined&&!Array.isArray(quest.boxes))out.push(issue('invalid_type',`quests[${qi}].boxes`,`quests[${qi}].boxes は配列である必要があります。`));});
    if(isObject(rootData.masters)){
      for(const [category,value] of Object.entries(rootData.masters)){
        if(!Array.isArray(value))out.push(issue('invalid_type',`masters.${category}`,`masters.${category} は配列である必要があります。`));
      }
    }
    return out;
  }
  function masterEntries(rootData){
    const out=[];
    (Array.isArray(rootData?.tags)?rootData.tags:[]).forEach((record,index)=>out.push({category:'tags',record,path:`tags[${index}]`}));
    for(const [category,prefix] of Object.entries(MASTER_PREFIXES)){
      if(category==='tags')continue;
      const rows=Array.isArray(rootData?.masters?.[category])?rootData.masters[category]:[];
      rows.forEach((record,index)=>out.push({category,prefix,record,path:`masters.${category}[${index}]`}));
    }
    return out;
  }
  function gameEntries(rootData){
    const out=[];
    (Array.isArray(rootData?.chapters)?rootData.chapters:[]).forEach((chapter,ci)=>{
      out.push({kind:'chapter',record:chapter,path:`chapters[${ci}]`});
      (Array.isArray(chapter?.sections)?chapter.sections:[]).forEach((section,si)=>{
        out.push({kind:'section',record:section,path:`chapters[${ci}].sections[${si}]`});
        (Array.isArray(section?.scenes)?section.scenes:[]).forEach((scene,sci)=>{
          out.push({kind:'scene',record:scene,path:`chapters[${ci}].sections[${si}].scenes[${sci}]`});
          (Array.isArray(scene?.dialogues)?scene.dialogues:[]).forEach((dialogue,di)=>out.push({kind:'dialogue',record:dialogue,path:`chapters[${ci}].sections[${si}].scenes[${sci}].dialogues[${di}]`}));
        });
      });
    });
    (Array.isArray(rootData?.quests)?rootData.quests:[]).forEach((record,index)=>out.push({kind:'quest',record,path:`quests[${index}]`}));
    (Array.isArray(rootData?.events)?rootData.events:[]).forEach((record,index)=>out.push({kind:'event',record,path:`events[${index}]`}));
    (Array.isArray(rootData?.flags)?rootData.flags:[]).forEach((record,index)=>out.push({kind:'flag',record,path:`flags[${index}]`}));
    return out;
  }
  function recordTypeIssues(entries,label){
    const out=[];
    entries.forEach(entry=>{
      if(!isObject(entry.record))out.push(issue('invalid_record',entry.path,`${entry.path} はオブジェクトである必要があります。`, 'error',{group:label}));
    });
    return out;
  }
  function idIssues(rootData){
    const out=[];
    const entries=[];
    for(const entry of masterEntries(rootData)){
      if(!isObject(entry.record))continue;
      const prefix=MASTER_PREFIXES[entry.category]||entry.prefix||'MST',id=String(entry.record.id||'').trim();
      entries.push({id,path:entry.path,type:entry.category,prefix});
      if(!idPattern(prefix).test(id))out.push(issue('invalid_id',`${entry.path}.id`,`${entry.path}: ${id||'(ID未設定)'} は規約外です。期待形式 ${prefix}-0001。`,'error',{id,expected_prefix:prefix,record_type:entry.category}));
    }
    for(const entry of gameEntries(rootData)){
      if(!isObject(entry.record))continue;
      const prefix=GAME_PREFIXES[entry.kind],id=String(entry.record.id||'').trim();
      entries.push({id,path:entry.path,type:entry.kind,prefix});
      if(!idPattern(prefix).test(id))out.push(issue('invalid_id',`${entry.path}.id`,`${entry.path}: ${id||'(ID未設定)'} は規約外です。期待形式 ${prefix}-0001。`,'error',{id,expected_prefix:prefix,record_type:entry.kind}));
    }
    const byId=new Map();
    for(const entry of entries){
      if(!entry.id)continue;
      if(!byId.has(entry.id))byId.set(entry.id,[]);
      byId.get(entry.id).push(entry);
    }
    for(const [id,hits] of byId){
      if(hits.length>1)out.push(issue('duplicate_id',hits[0].path,`${id} が ${hits.length}件重複しています: ${hits.map(x=>x.path).join(', ')}`,'error',{id,paths:hits.map(x=>x.path)}));
    }
    return out;
  }
  function requiredFieldIssues(rootData){
    const out=[];
    for(const entry of masterEntries(rootData)){
      if(!isObject(entry.record))continue;
      if(!String(entry.record.name||'').trim())out.push(issue('required',`${entry.path}.name`,`${entry.path} の名称が未設定です。`));
    }
    for(const entry of gameEntries(rootData)){
      if(!isObject(entry.record))continue;
      const r=entry.record;
      if(entry.kind==='chapter'&&!String(r.title||'').trim())out.push(issue('required',`${entry.path}.title`,`${entry.path} の章タイトルが未設定です。`));
      if(entry.kind==='section'&&!String(r.title||'').trim())out.push(issue('required',`${entry.path}.title`,`${entry.path} の節タイトルが未設定です。`));
      if(entry.kind==='scene'&&!String(r.title||'').trim())out.push(issue('required',`${entry.path}.title`,`${entry.path} のシーンタイトルが未設定です。`));
      if(entry.kind==='quest'&&!String(r.name||'').trim())out.push(issue('required',`${entry.path}.name`,`${entry.path} のQuest名が未設定です。`));
      if(entry.kind==='event'&&!String(r.name||'').trim())out.push(issue('required',`${entry.path}.name`,`${entry.path} のEvent名が未設定です。`));
      if(entry.kind==='flag'&&!String(r.name||'').trim())out.push(issue('required',`${entry.path}.name`,`${entry.path} のFlag名が未設定です。`));
    }
    return out;
  }
  function validateBase(rootData){
    const shape=projectShapeIssues(rootData);
    if(shape.length)return {ok:false,version:VERSION,issues:shape,summary:summarize(shape)};
    const issues=[...recordTypeIssues(masterEntries(rootData),'master'),...recordTypeIssues(gameEntries(rootData),'game'),...idIssues(rootData),...requiredFieldIssues(rootData)];
    return {ok:!issues.some(x=>x.severity==='error'),version:VERSION,issues,summary:summarize(issues)};
  }
  function summarize(issues){
    const summary={errors:0,warnings:0,invalid_id:0,duplicate_id:0,invalid_type:0,required:0,invalid_record:0};
    for(const row of issues||[]){
      if(row.severity==='warning')summary.warnings++;else summary.errors++;
      if(Object.prototype.hasOwnProperty.call(summary,row.code))summary[row.code]++;
    }
    summary.total=(issues||[]).length;
    return summary;
  }
  function aiFixPackage({input,report,sourceFilename='',inputType='project'}){
    return {
      schema:'gk.ai-fix-full-import.v1',version:'1.0.0',generated_at:new Date().toISOString(),source_filename:String(sourceFilename||''),input_type:inputType,
      instruction:'validation_report の ERROR をすべて修正し、ID変更時は references / audit issues を参照して参照元も同時に修正してください。元の意味・数値・文章は必要なく変更しないでください。',
      id_contract:{format:'AAA-0001',masters:MASTER_PREFIXES,game_data:GAME_PREFIXES,quest_box_id:'監査対象外（Quest内部安定識別子）'},
      validation_report:clone(report),input_data:clone(input)
    };
  }
  return {VERSION,MASTER_PREFIXES,GAME_PREFIXES,projectShapeIssues,masterEntries,gameEntries,idIssues,requiredFieldIssues,validateBase,summarize,aiFixPackage};
});
