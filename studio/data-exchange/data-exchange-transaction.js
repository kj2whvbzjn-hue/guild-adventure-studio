(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports ? require('./data-exchange-core.js') : root.GKSDataExchange
  );
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSDataExchangeTransaction=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
  'use strict';

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function requireFunction(value,name){
    if(typeof value!=='function')throw new Error(`DataExchangeTransaction: ${name} hookがありません。`);
    return value;
  }
  function candidateIsValid(result,plan){
    const s=result?.summary||{};
    const items=result?.items||[];
    const conflicts=items.filter(x=>x.status==='conflict'&&x.dataset===plan?.dataset).map(x=>String(x.id)).sort();
    const expectedKeeps=(plan?.keep_ids||[]).map(String).sort();
    return !!result?.ok &&
      (s.add||0)===0 &&
      Core.stableStringify(conflicts)===Core.stableStringify(expectedKeeps) &&
      (s.stale_source||0)===0 &&
      (s.invalid||0)===0 &&
      (s.incompatible||0)===0 &&
      (s.broken_reference||0)===0 &&
      (s.readonly_modified||0)===0;
  }
  async function projectHash(data){
    const snapshot=clone(data||{});
    // Audit metadata is operational history, not game/master state.
    // Excluding it prevents Audit persistence itself from invalidating Undo hashes.
    delete snapshot.data_exchange_audit_sessions;
    return Core.sha256Hex(Core.stableStringify(snapshot));
  }
  async function execute(options){
    if(!Core)throw new Error('DataExchangeTransaction: Data Exchange Coreがありません。');
    const rootData=options?.rootData||{};
    const envelope=options?.envelope;
    const beforeData=clone(rootData);
    const beforeHash=await projectHash(beforeData);

    const built=await Core.applySafeMerge({
      rootData:beforeData,
      envelope,
      plan:options?.plan,
      dryRun:options?.dryRun
    });

    let candidateData=clone(built.nextRootData);
    let validation=built.verify;
    if(typeof options?.normalize==='function'){
      const normalized=await options.normalize(clone(candidateData));
      if(normalized!==undefined)candidateData=clone(normalized);
      validation=await Core.dryRunImport({rootData:candidateData,envelope});
    }

    if(!candidateIsValid(validation,options?.plan)){
      throw new Error('DataExchangeTransaction: candidate validationに失敗しました。commitしません。');
    }

    const candidateHash=await projectHash(candidateData);
    const backup=requireFunction(options?.backup,'backup');
    const commit=requireFunction(options?.commit,'commit');
    const persist=requireFunction(options?.persist,'persist');
    const rollback=requireFunction(options?.rollback,'rollback');

    const backupOk=await backup({
      beforeData:clone(beforeData),
      beforeHash,
      candidateHash,
      envelope,
      applied:clone(built.applied)
    });
    if(backupOk===false){
      throw new Error('DataExchangeTransaction: Backupに失敗したためcommitしません。');
    }

    let committed=false;
    try{
      const commitResult=await commit(clone(candidateData));
      if(commitResult===false)throw new Error('DataExchangeTransaction: commit hookが失敗しました。');
      committed=true;

      const persistResult=await persist({
        candidateData:clone(candidateData),
        beforeHash,
        candidateHash,
        applied:clone(built.applied)
      });
      if(persistResult===false)throw new Error('DataExchangeTransaction: persistに失敗しました。');

      return {
        ok:true,
        beforeHash,
        candidateHash,
        afterHash:candidateHash,
        applied:clone(built.applied),
        validation
      };
    }catch(error){
      if(committed){
        try{await rollback(clone(beforeData));}
        catch(rollbackError){
          const combined=new Error(`${error.message} / rollback失敗: ${rollbackError.message}`);
          combined.cause=error;
          throw combined;
        }
      }
      throw error;
    }
  }

  return {projectHash,candidateIsValid,execute};
});
