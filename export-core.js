(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GKExportCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='1.0.0';
  const EXPORT_PATHS=[
    'ai/ai_nodes.json','ai/ai_templates.json','ai/ai_programs.json','ai/ai_runtimes.json',
    'equipment/equipment.json','equipment/mods.json',
    'event/events.json','event/flags.json',
    'master/jobs.json','master/statuses.json',
    'monster/monster_mods.json','monster/monsters.json',
    'quest/event_quests.json','quest/main_quests.json','quest/sub_quests.json',
    'scenario/chapters.json','scenario/scenes.json','scenario/sections.json',
    'skill/skills.json','stone/stone_mods.json','stone/stones.json',
    'system/balance.json','system/drop_tables.json','system/game_settings.json'
  ];
  function aiExportAdapter(){if(typeof require==='function'){const path=require('node:path'),base=__dirname.endsWith(path.sep+'studio')?'ai-production':path.join('studio','ai-production');return require(path.join(__dirname,base,'ai-export-adapter.js'));}return globalThis.GKSAIExportAdapter;}
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
  const QUEST_BOX_ZONE_KEYS=['event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post'];
  const QUEST_EVENT_USAGES=new Set(['story','random','common']);
  const QUEST_EVENT_TYPES=new Set(['battle','exploration','choice','special']);
  const QUEST_EVENT_INTENSITIES=new Set(['low','normal','high','extreme']);
  const QUEST_EVENT_FAILURE_POLICIES=new Set(['continue','quest_fail']);
  function stringValue(value){return String(value??'').trim();}
  function eventUsages(event){const raw=event?.usage;if(Array.isArray(raw))return raw.map(stringValue).filter(Boolean);const one=stringValue(raw);return one?[one]:[];}
  function allSceneIds(data){const ids=new Set();(data?.chapters||[]).forEach(ch=>(ch.sections||[]).forEach(sec=>(sec.scenes||[]).forEach(scene=>{const id=stringValue(scene?.id);if(id)ids.add(id);})));return ids;}
  function valuePresent(value){if(value==null)return false;if(Array.isArray(value))return value.length>0;if(typeof value==='object')return Object.keys(value).length>0;return stringValue(value)!=='';}
  function randomEventCandidates(data,placement){
    const filter=placement?.filter&&typeof placement.filter==='object'?placement.filter:{};
    const type=stringValue(filter.event_type),group=stringValue(filter.group),tags=Array.isArray(filter.tags)?filter.tags.map(stringValue).filter(Boolean):[];
    return (data?.events||[]).filter(event=>{
      if(event?.enabled===false||!eventUsages(event).includes('random'))return false;
      if(type&&stringValue(event?.type)!==type)return false;
      if(group&&stringValue(event?.group)!==group)return false;
      const eventTags=new Set((Array.isArray(event?.tags)?event.tags:[]).map(x=>stringValue(x).toLowerCase()).filter(Boolean));
      if(tags.some(tag=>!eventTags.has(tag.toLowerCase())))return false;
      return Number(event?.random_base_weight??1)>0;
    });
  }
  function collectQuestContractIssues(data,quest){
    const issues=[],qid=stringValue(quest?.id)||'(ID未設定)',boxes=Array.isArray(quest?.boxes)?quest.boxes:[],sceneIds=allSceneIds(data),eventIds=new Set((data?.events||[]).map(e=>stringValue(e?.id)).filter(Boolean));
    if(!stringValue(quest?.id))issues.push({level:'ERROR',code:'QUEST_ID_MISSING',quest_id:'',message:'Quest IDが未設定です。'});
    if(!stringValue(quest?.name))issues.push({level:'ERROR',code:'QUEST_NAME_MISSING',quest_id:qid,message:`${qid} のQuest名が未設定です。`});
    if(quest?.boxes!==undefined&&!Array.isArray(quest.boxes))issues.push({level:'ERROR',code:'QUEST_BOXES_INVALID',quest_id:qid,message:`${qid} のboxesが配列ではありません。`});
    if(!boxes.length)issues.push({level:'WARNING',code:'QUEST_BOXES_EMPTY',quest_id:qid,message:`${qid} はQuest.boxesが0件です。P4正式Quest契約の対象外です。`});
    const context=quest?.context;
    if(boxes.length&&(!context||typeof context!=='object'||Array.isArray(context)))issues.push({level:'WARNING',code:'QUEST_CONTEXT_MISSING',quest_id:qid,message:`${qid} はQuest Contextが未設定です。Contextは仮採用項目のため保存可能です。`});
    if(context&&typeof context==='object'&&!Array.isArray(context)){
      if(context.tags!==undefined&&!Array.isArray(context.tags))issues.push({level:'ERROR',code:'QUEST_CONTEXT_TAGS_INVALID',quest_id:qid,message:`${qid} のContext tagsが配列ではありません。`});
      if(context.difficulty!==undefined&&context.difficulty!==null&&!Number.isFinite(Number(context.difficulty)))issues.push({level:'ERROR',code:'QUEST_CONTEXT_DIFFICULTY_INVALID',quest_id:qid,message:`${qid} のContext difficultyが数値ではありません。`});
      if(context.budget!==undefined&&context.budget!==null&&(typeof context.budget!=='object'||Array.isArray(context.budget)))issues.push({level:'ERROR',code:'QUEST_CONTEXT_BUDGET_INVALID',quest_id:qid,message:`${qid} のContext budgetがオブジェクトではありません。`});
      if((valuePresent(context.map_id)||valuePresent(context.area_id)))issues.push({level:'INFO',code:'QUEST_CONTEXT_MAP_REFERENCE_UNVERIFIED',quest_id:qid,message:`${qid} のMap/Area参照は正本Dataset未確定のため、P4では存在確認を保留します。`});
    }
    const boxIds=new Set(),boxOrders=new Set();
    boxes.forEach((box,index)=>{
      const bid=stringValue(box?.box_id||box?.id),label=bid||`${qid} Box ${index+1}`,order=Number(box?.order);
      if(!bid)issues.push({level:'ERROR',code:'QUEST_BOX_ID_MISSING',quest_id:qid,box_index:index,message:`${qid} のBox ${index+1} にBox IDがありません。`});
      else if(boxIds.has(bid))issues.push({level:'ERROR',code:'QUEST_BOX_ID_DUPLICATE',quest_id:qid,box_id:bid,message:`${qid} のBox IDが重複しています: ${bid}`});
      else boxIds.add(bid);
      if(!Number.isInteger(order)||order<1)issues.push({level:'ERROR',code:'QUEST_BOX_ORDER_INVALID',quest_id:qid,box_id:bid,message:`${label} のorderが1以上の整数ではありません。`});
      else{
        if(boxOrders.has(order))issues.push({level:'ERROR',code:'QUEST_BOX_ORDER_DUPLICATE',quest_id:qid,box_id:bid,message:`${qid} のBox orderが重複しています: ${order}`});
        boxOrders.add(order);
        if(order!==index+1)issues.push({level:'ERROR',code:'QUEST_BOX_ORDER_SEQUENCE',quest_id:qid,box_id:bid,message:`${label} のorderは配列順 ${index+1} と一致しません。`});
      }
      const sceneKeys=['pre_scene_id','mid_scene_id','post_scene_id'];
      sceneKeys.forEach(key=>{const sid=stringValue(box?.[key]);if(sid&&!sceneIds.has(sid))issues.push({level:'ERROR',code:'QUEST_BOX_SCENE_REFERENCE_MISSING',quest_id:qid,box_id:bid,scene_id:sid,message:`${label} のScene参照が存在しません: ${sid}`});});
      let contentCount=sceneKeys.filter(key=>stringValue(box?.[key])).length;
      QUEST_BOX_ZONE_KEYS.forEach(zoneKey=>{
        const rows=box?.[zoneKey];
        if(rows!==undefined&&!Array.isArray(rows)){issues.push({level:'ERROR',code:'QUEST_BOX_EVENT_ZONE_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${label} の ${zoneKey} が配列ではありません。`});return;}
        const placements=Array.isArray(rows)?rows:[];contentCount+=placements.length;
        const placementOrders=new Set();
        placements.forEach((placement,pIndex)=>{
          const kind=stringValue(placement?.kind),pOrder=Number(placement?.order),prefix=`${label} / ${zoneKey} #${pIndex+1}`;
          if(!['fixed_event','random_event'].includes(kind))issues.push({level:'ERROR',code:'QUEST_EVENT_PLACEMENT_KIND_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のkindが不正です。`});
          if(!Number.isInteger(pOrder)||pOrder<1)issues.push({level:'ERROR',code:'QUEST_EVENT_PLACEMENT_ORDER_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のorderが不正です。`});
          else{
            if(placementOrders.has(pOrder))issues.push({level:'ERROR',code:'QUEST_EVENT_PLACEMENT_ORDER_DUPLICATE',quest_id:qid,box_id:bid,zone:zoneKey,message:`${label} の ${zoneKey} でEvent orderが重複しています: ${pOrder}`});
            placementOrders.add(pOrder);
            if(pOrder!==pIndex+1)issues.push({level:'ERROR',code:'QUEST_EVENT_PLACEMENT_ORDER_SEQUENCE',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のorderは配列順 ${pIndex+1} と一致しません。`});
          }
          if(!QUEST_EVENT_FAILURE_POLICIES.has(stringValue(placement?.failure_policy)))issues.push({level:'ERROR',code:'QUEST_EVENT_FAILURE_POLICY_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のfailure_policyが不正です。`});
          if(kind==='fixed_event'){
            const eventId=stringValue(placement?.event_id||placement?.ref_id);
            if(!eventId)issues.push({level:'ERROR',code:'QUEST_EVENT_REFERENCE_MISSING',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} にEvent IDがありません。`});
            else if(!eventIds.has(eventId))issues.push({level:'ERROR',code:'QUEST_EVENT_REFERENCE_BROKEN',quest_id:qid,box_id:bid,zone:zoneKey,event_id:eventId,message:`${prefix} のEvent参照が存在しません: ${eventId}`});
          }
          if(kind==='random_event'){
            const filter=placement?.filter;
            if(filter!==undefined&&(typeof filter!=='object'||Array.isArray(filter)))issues.push({level:'ERROR',code:'RANDOM_SLOT_FILTER_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のfilterがオブジェクトではありません。`});
            else if(filter){
              if(valuePresent(filter.event_type)&&!QUEST_EVENT_TYPES.has(stringValue(filter.event_type)))issues.push({level:'ERROR',code:'RANDOM_SLOT_EVENT_TYPE_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のEvent種別filterが不正です。`});
              if(filter.tags!==undefined&&!Array.isArray(filter.tags))issues.push({level:'ERROR',code:'RANDOM_SLOT_TAGS_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のタグfilterが配列ではありません。`});
            }
            if(placement?.allow_none!==undefined&&typeof placement.allow_none!=='boolean')issues.push({level:'ERROR',code:'RANDOM_SLOT_ALLOW_NONE_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のallow_noneがbooleanではありません。`});
            if(placement?.required!==undefined&&typeof placement.required!=='boolean')issues.push({level:'ERROR',code:'RANDOM_SLOT_REQUIRED_INVALID',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} のrequiredがbooleanではありません。`});
            if(placement?.box_side_individual_probability_override===true)issues.push({level:'ERROR',code:'RANDOM_SLOT_PROBABILITY_OVERRIDE_FORBIDDEN',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} は初期仕様で禁止されているBox側個別確率Overrideを使用しています。`});
            const candidates=randomEventCandidates(data,placement);
            if(!candidates.length){
              const level=placement?.required===true?'ERROR':'WARNING',code=placement?.required===true?'RANDOM_SLOT_REQUIRED_NO_CANDIDATES':'RANDOM_SLOT_OPTIONAL_NO_CANDIDATES';
              issues.push({level,code,quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} は現在のEvent Catalogで抽選可能な候補が0件です。`});
            }else{
              const conditional=candidates.filter(e=>valuePresent(e?.conditions)||Array.isArray(e?.required_flags)&&e.required_flags.length>0);
              if(conditional.length===candidates.length)issues.push({level:'WARNING',code:'RANDOM_SLOT_CONTEXT_DEPENDENT',quest_id:qid,box_id:bid,zone:zoneKey,message:`${prefix} の候補はすべて発生条件を持ちます。D-03未確定のためP4では実行時成立を断定しません。`});
            }
          }
        });
      });
      if(contentCount===0)issues.push({level:'WARNING',code:'QUEST_BOX_EMPTY',quest_id:qid,box_id:bid,message:`${label} はSceneもEventもありません。`});
    });
    return issues;
  }
  function collectEventContractIssues(data,event){
    const issues=[],eid=stringValue(event?.id)||'(ID未設定)',modern=event?.usage!==undefined;
    if(!stringValue(event?.id))issues.push({level:'ERROR',code:'EVENT_ID_MISSING',event_id:'',message:'Event IDが未設定です。'});
    if(!stringValue(event?.name))issues.push({level:'ERROR',code:'EVENT_NAME_MISSING',event_id:eid,message:`${eid} のEvent名が未設定です。`});
    if(!modern){issues.push({level:'WARNING',code:'EVENT_LEGACY_MODEL',event_id:eid,message:`${eid} は旧Eventモデルです。P3/P4の用途・種別契約へ未移行ですが、現時点では非破壊保持します。`});return issues;}
    const usages=eventUsages(event);
    if(!usages.length||usages.some(x=>!QUEST_EVENT_USAGES.has(x)))issues.push({level:'ERROR',code:'EVENT_USAGE_INVALID',event_id:eid,message:`${eid} のEvent用途が不正です。`});
    if(!QUEST_EVENT_TYPES.has(stringValue(event?.type)))issues.push({level:'ERROR',code:'EVENT_TYPE_INVALID',event_id:eid,message:`${eid} のEvent種別が不正です。`});
    if(event?.group!==undefined&&typeof event.group!=='string')issues.push({level:'ERROR',code:'EVENT_GROUP_INVALID',event_id:eid,message:`${eid} のEventグループが文字列ではありません。`});
    if(event?.tags!==undefined&&!Array.isArray(event.tags))issues.push({level:'ERROR',code:'EVENT_TAGS_INVALID',event_id:eid,message:`${eid} のEventタグが配列ではありません。`});
    if(event?.intensity!==undefined&&stringValue(event.intensity)&&!QUEST_EVENT_INTENSITIES.has(stringValue(event.intensity)))issues.push({level:'ERROR',code:'EVENT_INTENSITY_INVALID',event_id:eid,message:`${eid} のEvent強度が不正です。`});
    if(event?.random_base_weight!==undefined&&(!Number.isFinite(Number(event.random_base_weight))||Number(event.random_base_weight)<0))issues.push({level:'ERROR',code:'EVENT_RANDOM_WEIGHT_INVALID',event_id:eid,message:`${eid} の基礎抽選重みが不正です。`});
    if(usages.includes('random')&&event?.random_base_weight===undefined)issues.push({level:'WARNING',code:'EVENT_RANDOM_WEIGHT_DEFAULT',event_id:eid,message:`${eid} はRandom用途ですが基礎抽選重みが未設定です。P4 Exportでは既定値1相当として扱う互換状態です。`});
    if(event?.enabled!==undefined&&typeof event.enabled!=='boolean')issues.push({level:'ERROR',code:'EVENT_ENABLED_INVALID',event_id:eid,message:`${eid} の有効/無効がbooleanではありません。`});
    if(event?.generation_profile_ref!==undefined&&event.generation_profile_ref!==null&&typeof event.generation_profile_ref!=='string')issues.push({level:'ERROR',code:'EVENT_GENERATION_PROFILE_REF_INVALID',event_id:eid,message:`${eid} の生成方針参照が文字列ではありません。`});
    if(event?.conditions!==undefined&&!Array.isArray(event.conditions)&&typeof event.conditions!=='string')issues.push({level:'ERROR',code:'EVENT_CONDITIONS_INVALID',event_id:eid,message:`${eid} の発生条件は文字列または配列である必要があります。`});
    else if(typeof event?.conditions==='string'&&stringValue(event.conditions))issues.push({level:'WARNING',code:'EVENT_CONDITIONS_UNSTRUCTURED',event_id:eid,message:`${eid} の発生条件は自由記述です。D-03確定までRuntime条件として解釈しません。`});
    const forbidden=[
      ['map_id','Map ID'],['area_id','Area ID'],['battle_formation','通常敵固定編成'],['fixed_normal_enemy_roster','通常敵固定一覧'],['map_specific_exploration_result','Map固有探索結果'],['final_reward','確定報酬']
    ];
    forbidden.forEach(([key,label])=>{if(valuePresent(event?.[key]))issues.push({level:'ERROR',code:'EVENT_ENVIRONMENT_FIELD_FORBIDDEN',event_id:eid,field:key,message:`${eid} は新Eventに禁止されている環境依存項目「${label}」(${key})を保持しています。`});});
    return issues;
  }
  function collectQuestEventContractIssues(data){
    const issues=[];(data?.quests||[]).forEach(q=>issues.push(...collectQuestContractIssues(data,q)));(data?.events||[]).forEach(e=>issues.push(...collectEventContractIssues(data,e)));
    const boxes=(data?.quests||[]).flatMap(q=>Array.isArray(q?.boxes)?q.boxes:[]),randomSlots=boxes.flatMap(box=>QUEST_BOX_ZONE_KEYS.flatMap(key=>Array.isArray(box?.[key])?box[key]:[])).filter(p=>p?.kind==='random_event');
    const sceneUsage=new Set();boxes.forEach(box=>['pre_scene_id','mid_scene_id','post_scene_id'].forEach(key=>{const id=stringValue(box?.[key]);if(id)sceneUsage.add(id);}));
    issues.push({level:'INFO',code:'QUEST_BOX_COUNT',message:`P4情報: Quest Box ${boxes.length}件。`});
    issues.push({level:'INFO',code:'EVENT_COUNT',message:`P4情報: Event ${(data?.events||[]).length}件。`});
    issues.push({level:'INFO',code:'RANDOM_SLOT_COUNT',message:`P4情報: Random Event枠 ${randomSlots.length}件。`});
    issues.push({level:'INFO',code:'SCENE_USAGE_COUNT',message:`P4情報: Quest Boxから参照するScene ${sceneUsage.size}件。`});
    return issues;
  }
  function legacyStoryQuestRuntimeAssessment(data,quest){
    const links=quest&&quest.links&&typeof quest.links==='object'?quest.links:{};
    const chapterId=stringValue(links.chapter_id),sectionId=stringValue(links.section_id),issues=[];
    if(!chapterId||!sectionId){issues.push({level:'WARNING',code:'FORMAL_QUEST_LINK_INCOMPLETE',quest_id:stringValue(quest?.id),message:'現行Game互換にはChapter / Sectionの両方が必要です。'});return{ready:false,chapter_id:chapterId,section_id:sectionId,issues};}
    const chapter=(data?.chapters||[]).find(x=>stringValue(x?.id)===chapterId);
    if(!chapter){issues.push({level:'WARNING',code:'FORMAL_QUEST_CHAPTER_MISSING',quest_id:stringValue(quest?.id),message:`現行Game互換Chapterが存在しません: ${chapterId}`});return{ready:false,chapter_id:chapterId,section_id:sectionId,issues};}
    const section=(chapter.sections||[]).find(x=>stringValue(x?.id)===sectionId);
    if(!section){issues.push({level:'WARNING',code:'FORMAL_QUEST_SECTION_MISSING',quest_id:stringValue(quest?.id),message:`現行Game互換Sectionが存在しません: ${sectionId}`});return{ready:false,chapter_id:chapterId,section_id:sectionId,issues};}
    if(!Array.isArray(section.boxes)||section.boxes.length===0)issues.push({level:'WARNING',code:'FORMAL_QUEST_SECTION_BOXES_EMPTY',quest_id:stringValue(quest?.id),message:`現行Game Runtimeが参照するSection ${sectionId} の旧Boxが0件です。`});
    return{ready:issues.length===0,chapter_id:chapterId,section_id:sectionId,issues};
  }
  function formalStoryQuestAssessment(data,quest){
    const boxes=Array.isArray(quest?.boxes)?quest.boxes:[],legacy=legacyStoryQuestRuntimeAssessment(data,quest);
    if(!boxes.length)return{is_formal:false,ready:false,chapter_id:legacy.chapter_id,section_id:legacy.section_id,issues:[],legacy_runtime:legacy,legacy_runtime_ready:legacy.ready,message:legacy.ready?'旧Runtime互換Questですが、Quest.boxesがないためP4正式Quest契約の対象外です。':'Quest.boxesがないためP4正式Quest契約の対象外です。'};
    const issues=collectQuestContractIssues(data,quest).filter(issue=>issue.level==='ERROR');
    const ready=issues.length===0;
    return{is_formal:true,ready,chapter_id:legacy.chapter_id,section_id:legacy.section_id,issues,legacy_runtime:legacy,legacy_runtime_ready:legacy.ready,message:ready?(legacy.ready?'Quest.boxesを正とするP4正式Export契約に適合し、現行Game互換も満たします。':'Quest.boxesを正とするP4正式Export契約に適合します。P5前の現行Gameでは旧Chapter / Section Box互換が不足しています。'):'Quest.boxesを正とするP4正式Export契約の要件を満たしていません。'};
  }
  function summarizeFormalStoryQuests(data){
    const rows=(data?.quests||[]).map(quest=>({quest,assessment:formalStoryQuestAssessment(data,quest)}));
    return {total_quests:rows.length,formal_candidates:rows.filter(x=>x.assessment.is_formal).length,ready_count:rows.filter(x=>x.assessment.ready).length,legacy_runtime_ready_count:rows.filter(x=>x.assessment.ready&&x.assessment.legacy_runtime_ready).length,ready_ids:rows.filter(x=>x.assessment.ready).map(x=>stringValue(x.quest?.id)),rows};
  }
  function collectFormalQuestExportIssues(data){
    const summary=summarizeFormalStoryQuests(data),issues=[];
    summary.rows.forEach(row=>{
      row.assessment.issues.forEach(issue=>issues.push(issue));
      if(row.assessment.ready&&!row.assessment.legacy_runtime_ready)issues.push({level:'WARNING',code:'FORMAL_QUEST_LEGACY_RUNTIME_NOT_READY',quest_id:stringValue(row.quest?.id),message:`${stringValue(row.quest?.id)||'(ID未設定)'} はP4正式Export可能ですが、P5前の現行Game Runtimeでは除外されます。旧Chapter / Section Box互換を残すかP5切替まで待ってください。`});
    });
    if(summary.ready_count===0)issues.push({level:'WARNING',code:'FORMAL_QUEST_ZERO',message:'Quest.boxesを正とするP4正式Questが0件です。Exportは可能ですが、新Quest契約として実行対象はありません。'});
    return {summary,issues};
  }
  function collectAIExportIssues(data){const adapter=aiExportAdapter();return adapter?adapter.collectIssues(data):[{level:'ERROR',code:'AI_EXPORT_ADAPTER_MISSING',message:'AI Export Adapterを読み込めません。'}];}
  function buildData(data){
    const chapters=[],sections=[],scenes=[];
    (data.chapters||[]).forEach(chapter=>{
      const chapterRow=clean({...chapter}); delete chapterRow.sections; chapters.push(chapterRow);
      (chapter.sections||[]).forEach(section=>{
        const sectionRow=clean({...section,chapter_id:chapter.id}); delete sectionRow.scenes; sections.push(sectionRow);
        (section.scenes||[]).forEach(scene=>scenes.push(clean({...scene,chapter_id:chapter.id,section_id:section.id})));
      });
    });
    const masters=data.masters||{}, quests=data.quests||[], mods=masters.mods||[], ai=aiExportAdapter()?.build(data)||{programs:[],runtimes:[]};
    return {
      'ai/ai_nodes.json':[...(masters.ai_conditions||[]).map(x=>({...clean(x),node_type:'condition'})),...(masters.ai_targets||[]).map(x=>({...clean(x),node_type:'target'})),...(masters.ai_actions||[]).map(x=>({...clean(x),node_type:'action'}))],
      'ai/ai_templates.json':clean(data.ai_templates||[]),
      'ai/ai_programs.json':clean(ai.programs),'ai/ai_runtimes.json':clean(ai.runtimes),
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
    const aiIssues=collectAIExportIssues(data);if(aiIssues.some(row=>row.level==='ERROR')){const error=new Error('AI export validation failed');error.issues=aiIssues;throw error;}
    const contractIssues=[...collectQuestEventContractIssues(data),...collectFormalQuestExportIssues(data).issues];
    if(contractIssues.some(row=>row.level==='ERROR')){const error=new Error('Quest/Event export validation failed');error.issues=contractIssues;throw error;}
    const payloads=buildData(data), files={}, manifestFiles=[];
    for(const path of EXPORT_PATHS){const text=JSON.stringify(envelope(payloads[path],dataVersion,generatedAt,appVersion),null,2)+'\n';files[path]=text;manifestFiles.push({path,sha256:await sha256Hex(text),required:true});}
    const manifest={schema_version:SCHEMA_VERSION,data_version:dataVersion,generated_at:generatedAt,generated_by:'GK Studio v'+appVersion,files:manifestFiles};
    files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';
    return {payloads,files,manifest};
  }
  return {SCHEMA_VERSION,EXPORT_PATHS,QUEST_BOX_ZONE_KEYS,clean,scenarioTextHash,collectScenarioExportIssues,collectQuestContractIssues,collectEventContractIssues,collectQuestEventContractIssues,legacyStoryQuestRuntimeAssessment,formalStoryQuestAssessment,summarizeFormalStoryQuests,collectFormalQuestExportIssues,collectAIExportIssues,buildData,envelope,sha256Hex,buildPackage};
});
