(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAdventureEntityJsonImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KINDS={
    quests:{label:'Quest',rootKey:'quests',wrapperKeys:['quests','quest']},
    events:{label:'Event',rootKey:'events',wrapperKeys:['events','event']},
    story:{label:'Story',rootKey:'chapters',wrapperKeys:['chapters','chapter','story']}
  };
  const VOLATILE=new Set(['created_at','updated_at','generated_at']);
  function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
  function deepMerge(current,incoming){
    if(Array.isArray(incoming))return clone(incoming);
    if(!isObject(incoming))return clone(incoming);
    const out=isObject(current)?clone(current):{};
    for(const [k,v] of Object.entries(incoming))out[k]=isObject(v)?deepMerge(out[k],v):clone(v);
    return out;
  }
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(isObject(value)){
      const out={};
      Object.keys(value).sort().forEach(k=>{if(!VOLATILE.has(k))out[k]=canonical(value[k]);});
      return out;
    }
    return value;
  }
  function sameMeaning(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b))}
  function extractStoryPayload(payload){
    if(Array.isArray(payload))return payload;
    if(!isObject(payload))throw new Error('Story JSONは章オブジェクト、章配列、または {"chapters": [...]} 形式で指定してください。');
    if(Array.isArray(payload.chapters))return payload.chapters;
    if(isObject(payload.story)&&Array.isArray(payload.story.chapters))return payload.story.chapters;
    if(isObject(payload.chapter))return [payload.chapter];
    if(payload.id)return [payload];
    throw new Error('Story JSONに chapters 配列または章オブジェクトがありません。');
  }
  function extractRecords(kind,payload){
    const info=KINDS[kind];if(!info)throw new Error(`未対応のImport種別です: ${kind}`);
    if(kind==='story')return extractStoryPayload(payload).map(clone);
    if(Array.isArray(payload))return payload.map(clone);
    if(!isObject(payload))throw new Error(`${info.label} JSONはオブジェクトまたは配列で指定してください。`);
    for(const key of info.wrapperKeys){
      if(Array.isArray(payload[key]))return payload[key].map(clone);
      if(isObject(payload[key]))return [clone(payload[key])];
    }
    if(payload.id)return [clone(payload)];
    throw new Error(`${info.label} JSONに ${info.rootKey} 配列または単体レコードがありません。`);
  }
  function storyNodes(chapter){
    const rows=[];
    if(!isObject(chapter))return rows;
    rows.push({id:String(chapter.id||''),type:'chapter',chapterId:String(chapter.id||'')});
    for(const section of Array.isArray(chapter.sections)?chapter.sections:[]){
      rows.push({id:String(section?.id||''),type:'section',chapterId:String(chapter.id||'')});
      for(const scene of Array.isArray(section?.scenes)?section.scenes:[]){
        rows.push({id:String(scene?.id||''),type:'scene',chapterId:String(chapter.id||'')});
        for(const dialogue of Array.isArray(scene?.dialogues)?scene.dialogues:[])rows.push({id:String(dialogue?.id||''),type:'dialogue',chapterId:String(chapter.id||'')});
      }
    }
    return rows;
  }
  function currentStoryOwners(rootData){
    const map=new Map();
    for(const chapter of Array.isArray(rootData?.chapters)?rootData.chapters:[])for(const row of storyNodes(chapter))if(row.id)map.set(row.id,row);
    return map;
  }
  function collectAllIds(rootData){
    const ids=new Set();
    function add(id){id=String(id||'').trim();if(id)ids.add(id)}
    add(rootData?.project?.id);
    for(const k of ['decisions','characters','organizations','terms','relationships','timeline','quests','events','flags','entities','ai_programs'])for(const row of Array.isArray(rootData?.[k])?rootData[k]:[])add(row?.id);
    for(const chapter of Array.isArray(rootData?.chapters)?rootData.chapters:[])for(const row of storyNodes(chapter))add(row.id);
    for(const rows of Object.values(rootData?.masters||{}))for(const row of Array.isArray(rows)?rows:[])add(row?.id);
    for(const row of Array.isArray(rootData?.tags)?rootData.tags:[])add(row?.id);
    for(const row of Array.isArray(rootData?.tag_categories)?rootData.tag_categories:[])add(row?.id);
    return ids;
  }
  function validateQuestRecord(q,index,errors,warnings){
    const where=`Quest[${index+1}]`,id=String(q?.id||'').trim();
    if(!isObject(q)){errors.push(`${where}: オブジェクトではありません。`);return;}
    if(!id)errors.push(`${where}: id は必須です。`);
    if(!String(q.name||'').trim())errors.push(`${where}${id?` ${id}`:''}: name は必須です。`);
    if(q.boxes!==undefined&&!Array.isArray(q.boxes))errors.push(`${where}${id?` ${id}`:''}: boxes は配列で指定してください。`);
    const seen=new Set();
    (Array.isArray(q.boxes)?q.boxes:[]).forEach((box,bi)=>{
      const boxId=String(box?.box_id||box?.id||`BOX-${String(bi+1).padStart(4,'0')}`).trim();
      if(seen.has(boxId))errors.push(`${id||where}: Box IDが重複しています: ${boxId}`);seen.add(boxId);
      if(!box?.box_id&&!box?.id)warnings.push(`${id||where}: Box ${bi+1} はbox_id未指定のため ${boxId} として正規化されます。`);
    });
  }
  function validateEventRecord(e,index,errors){
    const where=`Event[${index+1}]`,id=String(e?.id||'').trim();
    if(!isObject(e)){errors.push(`${where}: オブジェクトではありません。`);return;}
    if(!id)errors.push(`${where}: id は必須です。`);
    if(!String(e.name||'').trim())errors.push(`${where}${id?` ${id}`:''}: name は必須です。`);
  }
  function validateStoryRecord(c,index,errors,warnings){
    const where=`Chapter[${index+1}]`,chapterId=String(c?.id||'').trim();
    if(!isObject(c)){errors.push(`${where}: オブジェクトではありません。`);return;}
    if(!chapterId)errors.push(`${where}: id は必須です。`);
    if(!String(c.title||'').trim())errors.push(`${where}${chapterId?` ${chapterId}`:''}: title は必須です。`);
    const local=new Set();
    for(const row of storyNodes(c)){
      if(!row.id){errors.push(`${chapterId||where}: ${row.type} のidがありません。`);continue;}
      if(local.has(row.id))errors.push(`${chapterId||where}: Story内IDが重複しています: ${row.id}`);local.add(row.id);
    }
    if(c.sections!==undefined&&!Array.isArray(c.sections))errors.push(`${chapterId||where}: sections は配列で指定してください。`);
    if(!Array.isArray(c.sections)||!c.sections.length)warnings.push(`${chapterId||where}: sections が空です。章だけ先に登録できます。`);
  }
  function datasetIds(rootData,kind){return new Set((Array.isArray(rootData?.[KINDS[kind].rootKey])?rootData[KINDS[kind].rootKey]:[]).map(x=>String(x?.id||'')).filter(Boolean))}
  function validateGlobalCollisions(kind,records,rootData,errors){
    const all=collectAllIds(rootData),target=kind==='story'?null:datasetIds(rootData,kind),storyOwners=kind==='story'?currentStoryOwners(rootData):null;
    const incomingTop=new Set(),incomingStoryOwners=new Map();
    for(const record of records){
      const id=String(record?.id||'').trim();if(!id)continue;
      if(incomingTop.has(id))errors.push(`${KINDS[kind].label} Import内でIDが重複しています: ${id}`);incomingTop.add(id);
      if(kind!=='story'){
        if(all.has(id)&&!target.has(id))errors.push(`${id}: 別データ種別ですでに使用されているIDです。`);
        continue;
      }
      const chapterId=id;
      for(const node of storyNodes(record)){
        if(!node.id)continue;
        const incomingOwner=incomingStoryOwners.get(node.id);
        if(incomingOwner&&incomingOwner!==chapterId)errors.push(`${node.id}: Import内の別章 ${incomingOwner} と ${chapterId} で重複しています。`);
        else incomingStoryOwners.set(node.id,chapterId);
        const current=storyOwners.get(node.id);
        if(current&&current.chapterId!==chapterId)errors.push(`${node.id}: 既存Storyの別章 ${current.chapterId} で使用されています。`);
        if(all.has(node.id)&&!current)errors.push(`${node.id}: Story以外のデータで使用されているIDです。`);
      }
    }
  }
  function questReferenceWarnings(q,rootData,incomingQuestIds,warnings){
    const id=String(q.id||'Quest'),eventIds=new Set((rootData?.events||[]).map(x=>String(x.id||''))),sceneIds=new Set(),mapIds=new Set((rootData?.masters?.maps||[]).map(x=>String(x.id||''))),flagIds=new Set((rootData?.flags||[]).map(x=>String(x.id||''))),questIds=new Set([...(rootData?.quests||[]).map(x=>String(x.id||'')),...incomingQuestIds]);
    for(const chapter of rootData?.chapters||[])for(const section of chapter.sections||[])for(const scene of section.scenes||[])sceneIds.add(String(scene.id||''));
    const mapId=String(q.context?.map_id||'');if(mapId&&!mapIds.has(mapId))warnings.push(`${id}: Map参照は現在未登録です: ${mapId}`);
    for(const ref of [...(q.prerequisite_ids||[]),...(q.next_quest_ids||[])].map(String).filter(Boolean))if(!questIds.has(ref))warnings.push(`${id}: Quest参照は現在未登録です: ${ref}`);
    for(const ref of [...(q.required_flags||[]),...(q.set_flags||[])].map(String).filter(Boolean))if(!flagIds.has(ref))warnings.push(`${id}: Flag参照は現在未登録です: ${ref}`);
    for(const box of Array.isArray(q.boxes)?q.boxes:[]){
      for(const sceneKey of ['pre_scene_id','mid_scene_id','post_scene_id']){const ref=String(box?.[sceneKey]||box?.scenes?.[sceneKey]||'');if(ref&&!sceneIds.has(ref))warnings.push(`${id}/${String(box?.box_id||box?.id||'?')}: Scene参照は現在未登録です: ${ref}`);}
      for(const zoneKey of ['event_zone_before_pre','event_zone_pre_to_mid','event_zone_mid_to_post','event_zone_after_post','event_before_pre','event_pre_to_mid','event_mid_to_post','event_after_post'])for(const p of Array.isArray(box?.[zoneKey])?box[zoneKey]:[]){const ref=String(p?.event_id||p?.ref_id||'');if(ref&&!eventIds.has(ref))warnings.push(`${id}/${String(box?.box_id||box?.id||'?')}: Event参照は現在未登録です: ${ref}`);}
    }
  }
  function eventReferenceWarnings(e,rootData,warnings){
    const id=String(e.id||'Event'),flagIds=new Set((rootData?.flags||[]).map(x=>String(x.id||''))),rewardIds=new Set((rootData?.masters?.reward_tables||[]).map(x=>String(x.id||'')));
    for(const ref of [...(e.required_flags||[]),...(e.set_flags||[])].map(String).filter(Boolean))if(!flagIds.has(ref))warnings.push(`${id}: Flag参照は現在未登録です: ${ref}`);
    for(const ref of (e.reward_table_ids||[]).map(String).filter(Boolean))if(!rewardIds.has(ref))warnings.push(`${id}: Reward Table参照は現在未登録です: ${ref}`);
  }
  function storyReferenceWarnings(c,rootData,warnings){
    const id=String(c.id||'Chapter'),monsterIds=new Set((rootData?.masters?.monsters||[]).map(x=>String(x.id||''))),eventIds=new Set((rootData?.events||[]).map(x=>String(x.id||'')));
    for(const ref of (c.available_monster_ids||[]).map(String).filter(Boolean))if(!monsterIds.has(ref))warnings.push(`${id}: Monster参照は現在未登録です: ${ref}`);
    for(const row of c.random_event_candidates||[]){const ref=String(row?.event_id||row?.id||row||'');if(ref&&!eventIds.has(ref))warnings.push(`${id}: Random Event参照は現在未登録です: ${ref}`);}
  }
  function buildPlan(kind,payload,rootData){
    const records=extractRecords(kind,payload),errors=[],warnings=[];
    if(!records.length)errors.push(`${KINDS[kind].label} Import対象が0件です。`);
    records.forEach((r,i)=>kind==='quests'?validateQuestRecord(r,i,errors,warnings):kind==='events'?validateEventRecord(r,i,errors):validateStoryRecord(r,i,errors,warnings));
    validateGlobalCollisions(kind,records,rootData||{},errors);
    const incomingQuestIds=new Set(kind==='quests'?records.map(x=>String(x.id||'')):[]);
    if(kind==='quests')records.forEach(q=>questReferenceWarnings(q,rootData||{},incomingQuestIds,warnings));
    if(kind==='events')records.forEach(e=>eventReferenceWarnings(e,rootData||{},warnings));
    if(kind==='story')records.forEach(c=>storyReferenceWarnings(c,rootData||{},warnings));
    const target=Array.isArray(rootData?.[KINDS[kind].rootKey])?rootData[KINDS[kind].rootKey]:[],byId=new Map(target.map(x=>[String(x?.id||''),x])),adds=[],updates=[],unchanged=[];
    for(const incoming of records){const id=String(incoming?.id||'');if(!id)continue;const current=byId.get(id);if(!current){adds.push(id);continue;}const merged=deepMerge(current,incoming);if(sameMeaning(current,merged))unchanged.push(id);else updates.push(id);}
    return {kind,label:KINDS[kind].label,rootKey:KINDS[kind].rootKey,records,adds,updates,unchanged,errors:[...new Set(errors)],warnings:[...new Set(warnings)],canApply:errors.length===0&&(adds.length+updates.length)>0};
  }
  function applyPlan(rootData,plan,timestamp){
    if(!plan||plan.errors?.length)throw new Error('Import planにエラーがあります。');
    const candidate=clone(rootData||{}),key=plan.rootKey,rows=Array.isArray(candidate[key])?candidate[key]:[],byId=new Map(rows.map((x,i)=>[String(x?.id||''),i])),stamp=String(timestamp||new Date().toISOString());
    for(const incoming of plan.records){
      const id=String(incoming?.id||'');if(!id)continue;
      const idx=byId.get(id);
      if(idx===undefined){const next=clone(incoming);if(!next.created_at)next.created_at=stamp;next.updated_at=stamp;rows.push(next);byId.set(id,rows.length-1);}
      else{const current=rows[idx],next=deepMerge(current,incoming);next.created_at=current?.created_at||next.created_at||stamp;next.updated_at=stamp;rows[idx]=next;}
    }
    candidate[key]=rows;return candidate;
  }
  return {KINDS,extractRecords,buildPlan,applyPlan,deepMerge,sameMeaning,storyNodes};
});
