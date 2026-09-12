(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKRuntimeBoundaryContracts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CONTRACTS=Object.freeze({
    C01:Object.freeze({id:'C01',name:'BattleSnapshot',schema_version:1}),
    C02:Object.freeze({id:'C02',name:'ActionReservation',schema_version:1}),
    C03:Object.freeze({id:'C03',name:'ResolvedHit',schema_version:1}),
    C04:Object.freeze({id:'C04',name:'QuestRunSnapshot',schema_version:1}),
    C05:Object.freeze({id:'C05',name:'SaveTransaction',schema_version:1}),
    C06:Object.freeze({id:'C06',name:'MasterValidation',schema_version:1})
  });
  const RNG_PURPOSES=Object.freeze({
    BATTLE_ORDER:'BATTLE_ORDER',
    HIT:'HIT',
    CRITICAL:'CRITICAL',
    BLOCK:'BLOCK',
    TARGET_SELECTION:'TARGET_SELECTION',
    AI_TIE_SELECTION:'AI_TIE_SELECTION',
    PASSIVE_TRIGGER:'PASSIVE_TRIGGER',
    GROWTH:'GROWTH',
    REWARD:'REWARD',
    QUEST_SELECTION:'QUEST_SELECTION',
    ENCOUNTER_SEED:'ENCOUNTER_SEED',
    BATTLE_SEED:'BATTLE_SEED',
    EXPLORATION_SEED:'EXPLORATION_SEED',
    BATTLE_MISC:'BATTLE_MISC'
  });
  const DOMAIN_OWNERS=Object.freeze({
    C01:Object.freeze(['game/assets/js/app-runtime.js','game/assets/js/battle-control.js']),
    C02:Object.freeze(['game/assets/js/battle-control.js']),
    C03:Object.freeze(['game/assets/js/tag-skill-runtime.js','game/assets/js/battle-control.js']),
    C04:Object.freeze(['assets/shared/js/adventure-story-system.js','game/assets/js/quest-run-save-bridge.js','game/assets/js/app-runtime.js']),
    C05:Object.freeze(['game/assets/js/app-runtime.js']),
    C06:Object.freeze(['studio/data-exchange/data-exchange-integrity-validator.js','game/assets/js/app-runtime.js'])
  });

  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}
    return value;
  }
  function stableEqual(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function nonEmpty(value,path){const text=String(value??'').trim();if(!text)throw new Error(`${path} is required.`);return text;}
  function requiredArray(value,path){if(!Array.isArray(value))throw new Error(`${path} array is required.`);return value;}
  function uniqueIds(value,path){const ids=requiredArray(value,path).map((row,index)=>nonEmpty(typeof row==='string'?row:row?.id,`${path}[${index}].id`));if(new Set(ids).size!==ids.length)throw new Error(`${path} contains duplicate ids.`);return ids;}
  function normalizePurpose(purpose){const value=String(purpose||'').trim().toUpperCase();if(!value)throw new Error('RNG purpose is required.');return value;}
  function normalizeRoll(value,purpose){const n=Number(value);if(!Number.isFinite(n)||n<0||n>=1)throw new Error(`RNG ${purpose} must resolve to a finite value in [0, 1).`);return n;}

  function createMetrics(){
    const state={rng_total:0,rng_by_purpose:{},rng_records:[],persistence_write_attempts:0,persistence_write_successes:0,persistence_by_phase:{},persistence_records:[]};
    return Object.freeze({
      recordRng(purpose,value,meta={},source='runtime'){
        const key=normalizePurpose(purpose);state.rng_total++;state.rng_by_purpose[key]=(state.rng_by_purpose[key]||0)+1;state.rng_records.push({index:state.rng_total,purpose:key,value:Number(value),source:String(source||'runtime'),meta:clone(meta||{})});
      },
      recordPersistenceAttempt(info={}){
        state.persistence_write_attempts++;const phase=String(info.phase||info.operation||'write');state.persistence_by_phase[phase]=(state.persistence_by_phase[phase]||0)+1;state.persistence_records.push({index:state.persistence_write_attempts,status:'attempt',...clone(info)});return state.persistence_write_attempts;
      },
      recordPersistenceSuccess(info={}){state.persistence_write_successes++;state.persistence_records.push({index:state.persistence_write_attempts,status:'success',...clone(info)});},
      snapshot(){return clone(state);}
    });
  }

  function createRngProbe({sequences={},metrics=null}={}){
    const queues={};
    for(const [purpose,values] of Object.entries(isObject(sequences)?sequences:{}))queues[normalizePurpose(purpose)]=Array.isArray(values)?values.map(Number):[];
    const offsets={};
    return Object.freeze({
      next(purpose,fallback,meta={}){
        const key=normalizePurpose(purpose),queue=queues[key]||[],offset=offsets[key]||0;
        let value,source='runtime';
        if(offset<queue.length){value=queue[offset];offsets[key]=offset+1;source='injected';}
        else{if(typeof fallback!=='function')throw new Error(`RNG fallback is required for ${key}.`);value=fallback();}
        const roll=normalizeRoll(value,key);if(metrics?.recordRng)metrics.recordRng(key,roll,{...clone(meta),purpose_draw_index:offsets[key]||offset},source);return roll;
      },
      consumed(){return clone(offsets);}
    });
  }

  function createPersistenceProbe({metrics=null,failOnWriteIndices=[]}={}){
    const failures=new Set((Array.isArray(failOnWriteIndices)?failOnWriteIndices:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0));let attempts=0;
    return Object.freeze({
      beforeWrite(info={}){
        attempts++;const writeIndex=metrics?.recordPersistenceAttempt?metrics.recordPersistenceAttempt({...clone(info),write_index:attempts}):attempts;
        if(failures.has(attempts)){const error=new Error(`Injected persistence write failure at write ${attempts}.`);error.code='TEST_PERSISTENCE_WRITE_FAILURE';error.write_index=attempts;error.write=clone(info);throw error;}
        return writeIndex;
      },
      afterWrite(info={}){if(metrics?.recordPersistenceSuccess)metrics.recordPersistenceSuccess({...clone(info),write_index:attempts});},
      attempts(){return attempts;}
    });
  }

  let instrumentation={rngProbe:null,persistenceProbe:null};
  function installInstrumentation({rngProbe=null,persistenceProbe=null}={}){
    const previous=instrumentation;instrumentation={rngProbe:rngProbe&&typeof rngProbe.next==='function'?rngProbe:null,persistenceProbe:persistenceProbe&&typeof persistenceProbe.beforeWrite==='function'?persistenceProbe:null};
    let restored=false;return()=>{if(!restored){instrumentation=previous;restored=true;}};
  }
  function draw(probe,purpose,fallback,meta={}){return probe&&typeof probe.next==='function'?probe.next(purpose,fallback,meta):normalizeRoll(fallback(),normalizePurpose(purpose));}
  function runtimeDraw(purpose,fallback,meta={}){return draw(instrumentation.rngProbe,purpose,fallback,meta);}
  function persistenceWrite(storage,{operation='set',key,value,boundary='C05',phase='write',owner=''}={}){
    if(!storage||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')throw new Error('Persistence storage adapter is required.');
    const op=String(operation||'set').toLowerCase(),info={boundary:String(boundary||'C05'),phase:String(phase||'write'),operation:op,key:String(key??''),owner:String(owner||'')};
    const probe=instrumentation.persistenceProbe;probe?.beforeWrite?.(info);
    if(op==='set')storage.setItem(info.key,String(value));else if(op==='remove')storage.removeItem(info.key);else throw new Error(`Unsupported persistence operation: ${op}`);
    probe?.afterWrite?.(info);return true;
  }

  function restoreStorageValue(read,write,key,previous,phase){
    const current=read(key);if(current===previous)return false;
    if(previous==null)write('remove',key,null,phase);else write('set',key,previous,phase);
    if(read(key)!==previous)throw new Error(`Save Transaction: rollback verification failed for ${key}.`);
    return true;
  }
  function commitTwoSlotSnapshot({payload,mainKey,backupKey,read,write,validatePayload}={}){
    if(typeof payload!=='string'||!payload.length)throw new Error('Save Transaction: payload is required.');
    const main=nonEmpty(mainKey,'Save Transaction mainKey'),backup=nonEmpty(backupKey,'Save Transaction backupKey');
    if(typeof read!=='function'||typeof write!=='function'||typeof validatePayload!=='function')throw new Error('Save Transaction: storage callbacks are required.');
    validatePayload(payload);
    const previousMain=read(main),previousBackup=read(backup),rollbackErrors=[];
    try{
      if(previousMain!==null){validatePayload(previousMain);write('set',backup,previousMain,'autosave_backup');if(read(backup)!==previousMain)throw new Error('Save Transaction: backup verification failed.');}
      write('set',main,payload,'autosave_main_commit');const committed=read(main);if(committed!==payload)throw new Error('Save Transaction: committed payload verification failed.');validatePayload(committed);
      return Object.freeze({committed:true,main_key:main,backup_key:backup,had_previous_main:previousMain!==null,previous_main:previousMain,previous_backup:previousBackup,committed_payload:payload});
    }catch(error){
      for(const [key,previous,phase] of [[main,previousMain,'autosave_main_rollback'],[backup,previousBackup,'autosave_backup_rollback']]){try{restoreStorageValue(read,write,key,previous,phase)}catch(rollbackError){rollbackErrors.push({key,error:String(rollbackError?.message||rollbackError)})}}
      if(rollbackErrors.length){const wrapped=new Error(`Save Transaction: commit failed and rollback was incomplete (${rollbackErrors.map(row=>`${row.key}: ${row.error}`).join(' / ')}).`);wrapped.code='SAVE_TRANSACTION_ROLLBACK_FAILED';wrapped.cause=error;wrapped.rollback_errors=clone(rollbackErrors);throw wrapped;}
      throw error;
    }
  }
  function inspectTwoSlotState({mainKey,backupKey,read,validatePayload}={}){
    const main=nonEmpty(mainKey,'Save Transaction mainKey'),backup=nonEmpty(backupKey,'Save Transaction backupKey');if(typeof read!=='function'||typeof validatePayload!=='function')throw new Error('Save Transaction: inspection callbacks are required.');
    const inspect=key=>{const raw=read(key);if(raw===null)return{key,present:false,valid:false,raw:null,error:''};try{validatePayload(raw);return{key,present:true,valid:true,raw,error:''}}catch(error){return{key,present:true,valid:false,raw,error:String(error?.message||error)}}};
    const mainState=inspect(main),backupState=inspect(backup);let status='EMPTY',normal_key='',recovery_key='';
    if(mainState.valid){status='MAIN_VALID';normal_key=main;}else if(backupState.valid){status='RECOVERY_REQUIRED';recovery_key=backup;}else if(mainState.present||backupState.present)status='INVALID';
    return Object.freeze({status,normal_key,recovery_key,main:Object.freeze({...mainState}),backup:Object.freeze({...backupState})});
  }
  function createSerialTransactionCoordinator({readState,cloneState=clone,prepareState=value=>value,validateState=()=>({ok:true}),commitState,publishState=()=>{},createTransactionRecord=null}={}){
    if(typeof readState!=='function'||typeof cloneState!=='function'||typeof prepareState!=='function'||typeof validateState!=='function'||typeof commitState!=='function'||typeof publishState!=='function')throw new Error('Save Transaction coordinator callbacks are required.');
    let tail=Promise.resolve(),sequence=0,pending=0,lastTransaction=null;
    const execute=async request=>{
      const operation=String(request?.operation||'mutation').trim()||'mutation',transactionId=String(request?.transactionId||`C05-TX-${++sequence}`),source=cloneState(readState()),proposed=cloneState(source);
      if(typeof request?.mutate!=='function')throw new Error('Save Transaction mutate callback is required.');
      const mutationResult=await request.mutate(proposed),prepared=await prepareState(proposed,{operation,transactionId,source:cloneState(source),mutationResult}),validationResult=await validateState(prepared,{operation,transactionId,source:cloneState(source),proposed:cloneState(proposed),mutationResult});
      if(validationResult===false||validationResult?.ok===false){const error=new Error(`Save Transaction validation failed: ${operation}`);error.code='SAVE_TRANSACTION_VALIDATION_FAILED';error.validation_result=clone(validationResult);throw error;}
      const committed=await commitState(prepared,{operation,transactionId,source:cloneState(source),mutationResult,validationResult:clone(validationResult)});await publishState(committed,{operation,transactionId,mutationResult});
      if(typeof createTransactionRecord==='function')lastTransaction=await createTransactionRecord({operation,transactionId,source:cloneState(source),proposed:cloneState(prepared),validationResult:clone(validationResult),committed:cloneState(committed),mutationResult});
      if(typeof request.afterCommit==='function'){try{await request.afterCommit({operation,transactionId,state:cloneState(committed),mutationResult,transaction:lastTransaction})}catch(error){const wrapped=new Error(`Save Transaction post-commit effect failed: ${operation} (${error?.message||error}).`);wrapped.code='SAVE_POST_COMMIT_EFFECT_FAILED';wrapped.committed=true;wrapped.cause=error;throw wrapped;}}
      return Object.freeze({ok:true,operation,transaction_id:transactionId,state:cloneState(committed),mutation_result:clone(mutationResult),transaction:lastTransaction});
    };
    const enqueue=request=>{pending++;const run=tail.then(()=>execute(request),()=>execute(request));tail=run.then(()=>undefined,()=>undefined);return run.finally(()=>{pending=Math.max(0,pending-1)})};
    return Object.freeze({enqueue,whenIdle:()=>tail,pendingCount:()=>pending,lastTransaction:()=>clone(lastTransaction)});
  }

  function assertDomainOwner(contractId,owner){const id=String(contractId||'').toUpperCase(),allowed=DOMAIN_OWNERS[id];if(!allowed)throw new Error(`Unknown contract id: ${id}`);const name=nonEmpty(owner,'owner');if(!allowed.includes(name))throw new Error(`${id} domain write owner is not allowed: ${name}`);return true;}
  function createBattleSnapshot(input={}){
    const actors=requiredArray(input.actors,'BattleSnapshot.actors').map((row,index)=>{if(!isObject(row))throw new Error(`BattleSnapshot.actors[${index}] object is required.`);return clone(row);});
    const actorIds=uniqueIds(actors,'BattleSnapshot.actors'),fixedOrder=requiredArray(input.fixedOrder,'BattleSnapshot.fixedOrder').map((id,index)=>nonEmpty(id,`BattleSnapshot.fixedOrder[${index}]`));
    if(fixedOrder.length!==actorIds.length||new Set(fixedOrder).size!==fixedOrder.length||fixedOrder.some(id=>!actorIds.includes(id)))throw new Error('BattleSnapshot.fixedOrder must contain every actor exactly once.');
    if(input.seed==null||String(input.seed)==='')throw new Error('BattleSnapshot.seed is required.');
    return Object.freeze({contract:'C01',schema_version:CONTRACTS.C01.schema_version,battle_id:nonEmpty(input.battleId,'BattleSnapshot.battleId'),settings_version:nonEmpty(input.settingsVersion,'BattleSnapshot.settingsVersion'),seed:clone(input.seed),actors:Object.freeze(actors.map(Object.freeze)),formation:Object.freeze(clone(Array.isArray(input.formation)?input.formation:[])),fixed_order:Object.freeze(fixedOrder.slice())});
  }
  function createActionReservation(input={}){
    const startTick=Number(input.startTick),completeTick=Number(input.completeTick);
    if(!Number.isInteger(startTick)||startTick<0)throw new Error('ActionReservation.startTick must be a non-negative integer.');
    if(!Number.isInteger(completeTick)||completeTick<startTick)throw new Error('ActionReservation.completeTick must be an integer >= startTick.');
    return Object.freeze({contract:'C02',schema_version:CONTRACTS.C02.schema_version,reservation_id:nonEmpty(input.reservationId,'ActionReservation.reservationId'),actor_id:nonEmpty(input.actorId,'ActionReservation.actorId'),skill_id:input.skillId==null?null:String(input.skillId),start_tick:startTick,complete_tick:completeTick,fixed_target_ids:Object.freeze((Array.isArray(input.fixedTargetIds)?input.fixedTargetIds:[]).map(String)),usage_conditions:Object.freeze(clone(input.usageConditions||{}))});
  }
  function createResolvedHit(input={}){
    const hitIndex=Number(input.hitIndex),committedHp=Number(input.committedHp),actualHpLoss=Number(input.actualHpLoss);
    if(!Number.isInteger(hitIndex)||hitIndex<0)throw new Error('ResolvedHit.hitIndex must be a non-negative integer.');
    if(!Number.isFinite(committedHp)||committedHp<0)throw new Error('ResolvedHit.committedHp must be >= 0.');
    if(!Number.isFinite(actualHpLoss)||actualHpLoss<0)throw new Error('ResolvedHit.actualHpLoss must be >= 0.');
    return Object.freeze({contract:'C03',schema_version:CONTRACTS.C03.schema_version,action_id:nonEmpty(input.actionId,'ResolvedHit.actionId'),hit_index:hitIndex,source_id:nonEmpty(input.sourceId,'ResolvedHit.sourceId'),target_id:nonEmpty(input.targetId,'ResolvedHit.targetId'),judgement:String(input.judgement||''),per_hit_damage:Number(input.perHitDamage)||0,block:Object.freeze(clone(input.block||{})),barrier:Object.freeze(clone(input.barrier||{})),committed_hp:committedHp,actual_hp_loss:actualHpLoss,trigger_context:Object.freeze(clone(input.triggerContext||{}))});
  }
  function createQuestRunSnapshot(run,{settingsVersion}={}){
    if(!isObject(run))throw new Error('QuestRunSnapshot run object is required.');
    const runId=nonEmpty(run.quest_run_id,'QuestRunSnapshot.quest_run_id');if(run.seed==null||String(run.seed)==='')throw new Error('QuestRunSnapshot.seed is required.');
    for(const key of ['party_snapshot','timeline_result','random_selections'])requiredArray(run[key],`QuestRunSnapshot.${key}`);
    return Object.freeze({contract:'C04',schema_version:CONTRACTS.C04.schema_version,run_id:runId,settings_version:nonEmpty(settingsVersion,'QuestRunSnapshot.settingsVersion'),snapshot:Object.freeze(clone(run))});
  }
  function createSaveDescriptor({saveId,saveVersion,schemaRevision,gameVersion}={}){
    const version=Number(saveVersion);if(!Number.isInteger(version)||version<1)throw new Error('SaveTransaction.saveVersion must be a positive integer.');
    return Object.freeze({contract:'C05',schema_version:CONTRACTS.C05.schema_version,save_id:nonEmpty(saveId,'SaveTransaction.saveId'),save_version:version,schema_revision:nonEmpty(schemaRevision,'SaveTransaction.schemaRevision'),game_version:nonEmpty(gameVersion,'SaveTransaction.gameVersion')});
  }
  function createSaveTransaction({transactionId,descriptor,sourceVersion,proposedState,validationResult,committedState,recoverablePreviousState}={}){
    if(!isObject(descriptor)||descriptor.contract!=='C05')throw new Error('SaveTransaction.descriptor must be a C05 descriptor.');
    return Object.freeze({contract:'C05',schema_version:CONTRACTS.C05.schema_version,transaction_id:nonEmpty(transactionId,'SaveTransaction.transactionId'),descriptor:Object.freeze(clone(descriptor)),source_version:String(sourceVersion??''),proposed_state:Object.freeze(clone(proposedState??null)),validation_result:Object.freeze(clone(validationResult??null)),committed_state:Object.freeze(clone(committedState??null)),recoverable_previous_state:Object.freeze(clone(recoverablePreviousState??null))});
  }
  function createMasterValidationResult({schemaVersion,masterId,ok,errors=[]}={}){return Object.freeze({contract:'C06',schema_version:CONTRACTS.C06.schema_version,master_schema_version:nonEmpty(schemaVersion,'MasterValidation.schemaVersion'),master_id:nonEmpty(masterId,'MasterValidation.masterId'),ok:ok===true,errors:Object.freeze(clone(Array.isArray(errors)?errors:[]))});}

  return Object.freeze({CONTRACTS,RNG_PURPOSES,DOMAIN_OWNERS,clone,stable,stableEqual,createMetrics,createRngProbe,createPersistenceProbe,installInstrumentation,draw,runtimeDraw,persistenceWrite,commitTwoSlotSnapshot,inspectTwoSlotState,createSerialTransactionCoordinator,assertDomainOwner,createBattleSnapshot,createActionReservation,createResolvedHit,createQuestRunSnapshot,createSaveDescriptor,createSaveTransaction,createMasterValidationResult});
});
