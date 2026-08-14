(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GKExportCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='1.0.0';
  const EXPORT_PATHS=[
    'ai/ai_nodes.json','ai/ai_templates.json',
    'equipment/equipment.json','equipment/mods.json',
    'event/events.json','event/flags.json',
    'master/jobs.json','master/statuses.json',
    'monster/monster_mods.json','monster/monsters.json',
    'quest/event_quests.json','quest/main_quests.json','quest/sub_quests.json',
    'scenario/chapters.json','scenario/scenes.json','scenario/sections.json',
    'skill/skills.json','stone/stone_mods.json','stone/stones.json',
    'system/balance.json','system/drop_tables.json','system/game_settings.json'
  ];
  function clean(value){
    if(Array.isArray(value))return value.map(clean);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value)
      .filter(([k])=>!['ui_state','history','sync_meta','candidate_revisions','design','export_control'].includes(k))
      .map(([k,v])=>[k,clean(v)]));
    return value;
  }
  function recordsByTag(rows,tags){
    return (rows||[]).filter(row=>{
      const values=(row.tags||[]).map(x=>String(x).toLowerCase());
      return tags.some(tag=>values.includes(String(tag).toLowerCase()));
    });
  }
  function scenarioTextHash(text){
    const value=String(text||'');
    if(typeof require==='function'){return require('node:crypto').createHash('sha256').update(value,'utf8').digest('hex');}
    return null;
  }
  function collectScenarioExportIssues(data){
    const issues=[];
    function inspect(node,type,parentId){
      const revisions=Array.isArray(node.candidate_revisions)?node.candidate_revisions:[];
      const control=node.export_control||{};
      if(!revisions.length&&!control.approved_revision_id&&!control.ready)return;
      const target=`${type}:${node.id||'(missing-id)'}`;
      if(control.ready!==true){issues.push({level:'ERROR',code:'SCENARIO_NOT_EXPORT_READY',target,message:`${target} はExport準備済みではありません。`});return;}
      const approved=revisions.find(r=>r&&r.id===control.approved_revision_id&&r.status==='approved');
      if(!approved){issues.push({level:'ERROR',code:'APPROVED_REVISION_MISSING',target,message:`${target} の承認Revisionを確認できません。`});return;}
      if(String(node.summary||'')!==String(approved.text||'')){issues.push({level:'ERROR',code:'CANONICAL_TEXT_MISMATCH',target,message:`${target} の正本と承認Revision本文が一致しません。`});}
      const hash=scenarioTextHash(node.summary||'');
      if(hash&&control.canonical_hash!==hash){issues.push({level:'ERROR',code:'CANONICAL_HASH_MISMATCH',target,message:`${target} の承認ハッシュが一致しません。`});}
    }
    (data.chapters||[]).forEach(ch=>{inspect(ch,'chapter','');(ch.sections||[]).forEach(sec=>inspect(sec,'section',ch.id||''));});
    return issues;
  }
  function formalStoryQuestAssessment(data,quest){
    const links=quest&&quest.links&&typeof quest.links==='object'?quest.links:{};
    const chapterId=String(links.chapter_id||'').trim();
    const sectionId=String(links.section_id||'').trim();
    const candidate=Boolean(chapterId||sectionId);
    const issues=[];
    if(!candidate)return {is_formal:false,ready:false,chapter_id:'',section_id:'',issues,message:'Chapter / Section未接続のためGame遠征一覧には出ません。'};
    if(!chapterId||!sectionId){
      issues.push({level:'ERROR',code:'FORMAL_QUEST_LINK_INCOMPLETE',quest_id:String(quest?.id||''),message:`${quest?.id||'(ID未設定)'} は正式Story Quest候補ですが、ChapterとSectionの両方を設定してください。`});
      return {is_formal:true,ready:false,chapter_id:chapterId,section_id:sectionId,issues,message:'Chapter / Sectionの両方が必要です。'};
    }
    const chapter=(data?.chapters||[]).find(x=>String(x?.id||'')===chapterId);
    if(!chapter){issues.push({level:'ERROR',code:'FORMAL_QUEST_CHAPTER_MISSING',quest_id:String(quest?.id||''),message:`${quest?.id||'(ID未設定)'} の正式Story Quest参照Chapterが存在しません: ${chapterId}`});return {is_formal:true,ready:false,chapter_id:chapterId,section_id:sectionId,issues,message:'Chapter参照が切れています。'};}
    const section=(chapter.sections||[]).find(x=>String(x?.id||'')===sectionId);
    if(!section){issues.push({level:'ERROR',code:'FORMAL_QUEST_SECTION_MISSING',quest_id:String(quest?.id||''),message:`${quest?.id||'(ID未設定)'} の正式Story Quest参照Sectionが存在しません: ${sectionId}`});return {is_formal:true,ready:false,chapter_id:chapterId,section_id:sectionId,issues,message:'Section参照が切れています。'};}
    if(!Array.isArray(section.boxes)||section.boxes.length===0)issues.push({level:'ERROR',code:'FORMAL_QUEST_SECTION_BOXES_EMPTY',quest_id:String(quest?.id||''),message:`${quest?.id||'(ID未設定)'} の正式Story Quest参照Section ${sectionId} にBoxがありません。Game遠征開始前に1件以上設定してください。`});
    return {is_formal:true,ready:issues.length===0,chapter_id:chapterId,section_id:sectionId,issues,message:issues.length?'正式Story Quest要件を満たしていません。':'正式Story QuestとしてGame遠征一覧へExportできます。'};
  }
  function summarizeFormalStoryQuests(data){
    const rows=(data?.quests||[]).map(quest=>({quest,assessment:formalStoryQuestAssessment(data,quest)}));
    return {total_quests:rows.length,formal_candidates:rows.filter(x=>x.assessment.is_formal).length,ready_count:rows.filter(x=>x.assessment.ready).length,ready_ids:rows.filter(x=>x.assessment.ready).map(x=>String(x.quest?.id||'')),rows};
  }
  function collectFormalQuestExportIssues(data){
    const summary=summarizeFormalStoryQuests(data),issues=[];
    summary.rows.forEach(row=>row.assessment.issues.forEach(issue=>issues.push(issue)));
    if(summary.ready_count===0)issues.push({level:'WARNING',code:'FORMAL_QUEST_ZERO',message:'正式Story Questが0件です。Exportは可能ですが、Gameの遠征一覧にはStory Questが表示されません。'});
    return {summary,issues};
  }
  function buildData(data){
    const chapters=[],sections=[],scenes=[];
    (data.chapters||[]).forEach(chapter=>{
      const chapterRow=clean({...chapter}); delete chapterRow.sections; chapters.push(chapterRow);
      (chapter.sections||[]).forEach(section=>{
        const sectionRow=clean({...section,chapter_id:chapter.id}); delete sectionRow.scenes; sections.push(sectionRow);
        (section.scenes||[]).forEach(scene=>scenes.push(clean({...scene,chapter_id:chapter.id,section_id:section.id})));
      });
    });
    const masters=data.masters||{}, quests=data.quests||[], mods=masters.mods||[];
    return {
      'ai/ai_nodes.json':[...(masters.ai_conditions||[]).map(x=>({...clean(x),node_type:'condition'})),...(masters.ai_targets||[]).map(x=>({...clean(x),node_type:'target'})),...(masters.ai_actions||[]).map(x=>({...clean(x),node_type:'action'}))],
      'ai/ai_templates.json':clean(data.ai_templates||[]),
      'equipment/equipment.json':clean(masters.equipment||[]),
      'equipment/mods.json':clean(mods.filter(x=>!recordsByTag([x],['monster','stone','tablet','石板']).length)),
      'event/events.json':clean(data.events||[]),'event/flags.json':clean(data.flags||[]),
      'master/jobs.json':clean(masters.jobs||[]),'master/statuses.json':clean(masters.status_effects||[]),
      'monster/monster_mods.json':clean(recordsByTag(mods,['monster','モンスター'])),'monster/monsters.json':clean(masters.monsters||[]),
      'quest/event_quests.json':clean(quests.filter(x=>x.type==='event')),'quest/main_quests.json':clean(quests.filter(x=>x.type==='main')),'quest/sub_quests.json':clean(quests.filter(x=>!['main','event'].includes(x.type))),
      'scenario/chapters.json':chapters,'scenario/scenes.json':scenes,'scenario/sections.json':sections,
      'skill/skills.json':clean(masters.skills||[]),'stone/stone_mods.json':clean(recordsByTag(mods,['stone','tablet','石板'])),'stone/stones.json':clean(masters.tablets||[]),
      'system/balance.json':clean(data.balance||{}),'system/drop_tables.json':clean(data.drop_tables||[]),'system/game_settings.json':clean(data.game_settings||{})
    };
  }
  function envelope(payload,dataVersion,generatedAt,appVersion){return {schema_version:SCHEMA_VERSION,data_version:dataVersion,generated_at:generatedAt,generated_by:'GK Studio v'+appVersion,data:payload};}
  async function sha256Hex(text){
    if(globalThis.crypto&&globalThis.crypto.subtle){const bytes=new TextEncoder().encode(text);const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
    const crypto=require('node:crypto'); return crypto.createHash('sha256').update(text,'utf8').digest('hex');
  }
  async function buildPackage(data,{dataVersion,generatedAt,appVersion}){
    const payloads=buildData(data), files={}, manifestFiles=[];
    for(const path of EXPORT_PATHS){const text=JSON.stringify(envelope(payloads[path],dataVersion,generatedAt,appVersion),null,2)+'\n';files[path]=text;manifestFiles.push({path,sha256:await sha256Hex(text),required:true});}
    const manifest={schema_version:SCHEMA_VERSION,data_version:dataVersion,generated_at:generatedAt,generated_by:'GK Studio v'+appVersion,files:manifestFiles};
    files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';
    return {payloads,files,manifest};
  }
  return {SCHEMA_VERSION,EXPORT_PATHS,clean,scenarioTextHash,collectScenarioExportIssues,formalStoryQuestAssessment,summarizeFormalStoryQuests,collectFormalQuestExportIssues,buildData,envelope,sha256Hex,buildPackage};
});
