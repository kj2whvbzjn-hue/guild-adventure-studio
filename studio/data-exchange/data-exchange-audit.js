(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports ? require('./data-exchange-core.js') : root.GKSDataExchange,
    typeof module==='object'&&module.exports ? require('./data-exchange-transaction.js') : root.GKSDataExchangeTransaction
  );
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSDataExchangeAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core,Transaction){
  'use strict';

  const FORMAT='GKS_DATA_EXCHANGE_AUDIT';
  const VERSION='1.0.0';
  const DEFAULT_MAX_SESSIONS=10;
  const DEFAULT_MAX_BYTES=3*1024*1024;

  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function byteLength(text){
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(String(text)).length;
    if(typeof Buffer!=='undefined')return Buffer.byteLength(String(text),'utf8');
    return unescape(encodeURIComponent(String(text))).length;
  }
  function load(storage,key){
    try{
      const value=JSON.parse(storage.getItem(key)||'[]');
      return Array.isArray(value)?value:[];
    }catch(_){return [];}
  }
  function save(storage,key,sessions,options={}){
    const maxSessions=Math.max(1,Number(options.maxSessions)||DEFAULT_MAX_SESSIONS);
    const maxBytes=Math.max(1024,Number(options.maxBytes)||DEFAULT_MAX_BYTES);
    const list=sessions.slice(0,maxSessions);
    while(list.length&&byteLength(JSON.stringify(list))>maxBytes)list.pop();
    const encoded=JSON.stringify(list);
    if(byteLength(encoded)>maxBytes)return false;
    try{storage.setItem(key,encoded);return true;}catch(_){return false;}
  }
  function datasetRows(rootData,dataset){
    return Core.records(rootData,dataset).map(clone);
  }
  function setDatasetRows(rootData,dataset,rows){
    if(typeof Core.setDatasetRecords!=='function')throw new Error('DataExchangeAudit: Dataset setterがありません。');
    Core.setDatasetRecords(rootData,dataset,rows.map(clone));
  }
  async function datasetHash(rootData,dataset){
    return Core.sha256Hex(Core.stableStringify(datasetRows(rootData,dataset)));
  }
  function normalizedPlanIds(plan,tx){
    const all=(tx?.applied?.ids||plan?.ids||[]).map(String);
    const addIds=Array.isArray(plan?.add_ids)?plan.add_ids.map(String):
      all.slice(0,Math.max(0,Number(tx?.applied?.add_count??plan?.add_count)||0));
    const importIds=Array.isArray(plan?.import_ids)?plan.import_ids.map(String):
      all.slice(addIds.length,addIds.length+Math.max(0,Number(tx?.applied?.changed_count)||0));
    const keepIds=Array.isArray(plan?.keep_ids)?plan.keep_ids.map(String):[];
    return {addIds,importIds,keepIds};
  }
  function buildUndoSnapshot(beforeData,plan,tx){
    const dataset=String(plan?.dataset||tx?.applied?.dataset||'');
    const ids=normalizedPlanIds(plan,tx);
    const restoreIds=new Set(ids.importIds);
    const restoreRecords=datasetRows(beforeData,dataset).filter(row=>restoreIds.has(String(row?.id||'')));
    return {
      dataset,
      remove_ids:clone(ids.addIds),
      restore_records:restoreRecords
    };
  }
  function applyUndoSnapshot(currentData,snapshot){
    const candidate=clone(currentData),dataset=String(snapshot?.dataset||'');
    const remove=new Set((snapshot?.remove_ids||[]).map(String));
    const restore=new Map((snapshot?.restore_records||[]).map(row=>[String(row?.id||''),clone(row)]));
    const rows=datasetRows(candidate,dataset);
    const out=[];
    const seen=new Set();
    for(const row of rows){
      const id=String(row?.id||'');
      if(remove.has(id))continue;
      if(restore.has(id)){out.push(clone(restore.get(id)));seen.add(id);}
      else out.push(clone(row));
    }
    for(const [id,row] of restore.entries())if(!seen.has(id))out.push(clone(row));
    setDatasetRows(candidate,dataset,out);
    return candidate;
  }
  function validateSnapshot(rootData,session){
    if(!rootData||typeof rootData!=='object')return {ok:false,reason:'Project snapshotが不正です。'};
    if(String(rootData.project?.id||'')!==String(session?.project_id||''))return {ok:false,reason:'project_idが一致しません。'};
    const dataset=String(session?.dataset||'');
    if(!Core.REGISTRY[dataset])return {ok:false,reason:'Audit対象Datasetが未対応です。'};
    const ids=new Set();
    for(const row of datasetRows(rootData,dataset)){
      const id=String(row?.id||'');
      if(!id)return {ok:false,reason:'ID欠落レコードがあります。'};
      if(ids.has(id))return {ok:false,reason:'重複IDがあります: '+id};
      ids.add(id);
    }
    return {ok:true};
  }
  function buildSession(options){
    const tx=options?.transaction||{},plan=options?.plan||{},envelope=options?.envelope||{};
    const ids=normalizedPlanIds(plan,tx);
    return {
      format:FORMAT,
      version:VERSION,
      import_session_id:String(options?.sessionId||`DXS-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
      timestamp:String(options?.timestamp||new Date().toISOString()),
      project_id:String(envelope.project_id||options?.projectId||''),
      source_filename:String(options?.sourceFilename||''),
      package_hash:String(envelope.metadata?.package_hash||''),
      source_generated_at:String(envelope.metadata?.generated_at||''),
      before_hash:String(tx.beforeHash||options?.beforeHash||''),
      candidate_hash:String(tx.candidateHash||options?.candidateHash||''),
      after_hash:String(options?.afterHash||tx.afterHash||''),
      dataset:String(plan.dataset||tx.applied?.dataset||''),
      before_dataset_hash:String(options?.beforeDatasetHash||''),
      after_dataset_hash:String(options?.afterDatasetHash||''),
      added:clone(ids.addIds),
      changed:clone(ids.importIds),
      kept:clone(ids.keepIds),
      conflict_choices:clone(plan.conflict_choices||{}),
      applied_ids:clone(tx.applied?.ids||[]),
      undo_snapshot:buildUndoSnapshot(options?.beforeData||{},plan,tx),
      undone:false,
      undone_at:'',
      undo_after_hash:''
    };
  }
  function append(storage,key,session,options={}){
    const sessions=load(storage,key);
    sessions.unshift(clone(session));
    return save(storage,key,sessions,options);
  }
  function exportPayload(storage,key){
    return {format:FORMAT,version:VERSION,generated_at:new Date().toISOString(),sessions:load(storage,key).map(clone)};
  }
  async function canUndo(session,currentData){
    if(!session||session.undone)return {ok:false,reason:'このSessionはUndoできません。'};
    if(!Transaction)throw new Error('DataExchangeAudit: Transactionがありません。');
    const currentHash=await Transaction.projectHash(currentData);
    if(currentHash!==String(session.after_hash||'')){
      return {ok:false,reason:'現在データがSession適用直後の状態と一致しません。安全のためUndoを拒否します。',currentHash,expectedHash:String(session.after_hash||'')};
    }
    const structural=validateSnapshot(currentData,session);
    if(!structural.ok)return structural;
    if(session.after_dataset_hash){
      const currentDatasetHash=await datasetHash(currentData,session.dataset);
      if(currentDatasetHash!==String(session.after_dataset_hash)){
        return {ok:false,reason:'対象DatasetがSession適用直後の状態と一致しません。',currentDatasetHash,expectedAfterDatasetHash:String(session.after_dataset_hash)};
      }
    }
    const candidate=applyUndoSnapshot(currentData,session.undo_snapshot);
    if(session.before_dataset_hash){
      const beforeDatasetHash=await datasetHash(candidate,session.dataset);
      if(beforeDatasetHash!==String(session.before_dataset_hash)){
        return {ok:false,reason:'Undo候補Datasetが元状態と一致しません。',beforeDatasetHash,expectedBeforeDatasetHash:String(session.before_dataset_hash)};
      }
      return {ok:true,currentHash,beforeDatasetHash,candidate};
    }
    const beforeHash=await Transaction.projectHash(candidate);
    if(beforeHash!==String(session.before_hash||'')){
      return {ok:false,reason:'Undo候補hashが元状態と一致しません。',beforeHash,expectedBeforeHash:String(session.before_hash||'')};
    }
    return {ok:true,currentHash,beforeHash,candidate};
  }
  async function undo(options){
    const session=options?.session,currentData=options?.currentData||{};
    const check=await canUndo(session,currentData);
    if(!check.ok)throw new Error(check.reason);
    let candidate=clone(check.candidate);
    if(typeof options?.normalize==='function'){
      const normalized=await options.normalize(clone(candidate));
      if(normalized!==undefined)candidate=clone(normalized);
    }
    const structural=validateSnapshot(candidate,session);
    if(!structural.ok)throw new Error('Undo candidate validation: '+structural.reason);
    if(typeof options?.validate==='function'){
      const valid=await options.validate(clone(candidate));
      if(valid===false||valid?.ok===false)throw new Error('Undo candidate validationに失敗しました。');
    }
    const candidateHash=await Transaction.projectHash(candidate);
    if(session.before_dataset_hash){
      const candidateDatasetHash=await datasetHash(candidate,session.dataset);
      if(candidateDatasetHash!==String(session.before_dataset_hash))throw new Error('Undo candidate Dataset hashが元状態と一致しません。');
    }else if(candidateHash!==String(session.before_hash||'')){
      throw new Error('Undo candidate hashが元状態と一致しません。');
    }
    if(typeof options?.backup!=='function'||await options.backup({currentData:clone(currentData),session})===false)throw new Error('Undo前Backupに失敗しました。');

    const original=clone(currentData);
    let committed=false,persisted=false;
    try{
      if(typeof options?.commit!=='function'||await options.commit(clone(candidate))===false)throw new Error('Undo commitに失敗しました。');
      committed=true;
      if(typeof options?.persist!=='function'||await options.persist({session})===false)throw new Error('Undo persistに失敗しました。');
      persisted=true;
      const afterData=typeof options?.readCurrent==='function'?await options.readCurrent():candidate;
      const afterValidation=validateSnapshot(afterData,session);
      if(!afterValidation.ok)throw new Error('Undo後再検証に失敗しました: '+afterValidation.reason);
      if(typeof options?.validate==='function'){
        const validAfter=await options.validate(clone(afterData));
        if(validAfter===false||validAfter?.ok===false)throw new Error('Undo後再検証に失敗しました。');
      }
      if(session.before_dataset_hash){
        const restoredDatasetHash=await datasetHash(afterData,session.dataset);
        if(restoredDatasetHash!==String(session.before_dataset_hash))throw new Error('Undo後Dataset再検証に失敗しました。');
      }
      const undoAfterHash=await Transaction.projectHash(afterData);
      return {ok:true,candidateHash,undoAfterHash};
    }catch(error){
      if(committed&&typeof options?.rollback==='function')await options.rollback(clone(original));
      if(persisted&&typeof options?.rollbackPersist==='function')await options.rollbackPersist({session});
      throw error;
    }
  }
  function markUndone(storage,key,sessionId,undoAfterHash,options={}){
    const sessions=load(storage,key);
    const target=sessions.find(x=>x.import_session_id===sessionId);
    if(!target)return false;
    target.undone=true;target.undone_at=new Date().toISOString();target.undo_after_hash=String(undoAfterHash||'');
    return save(storage,key,sessions,options);
  }

  return {FORMAT,VERSION,DEFAULT_MAX_SESSIONS,DEFAULT_MAX_BYTES,load,save,datasetHash,normalizedPlanIds,buildSession,append,exportPayload,validateSnapshot,buildUndoSnapshot,applyUndoSnapshot,canUndo,undo,markUndone};
});
