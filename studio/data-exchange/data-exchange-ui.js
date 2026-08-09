(function(){
  'use strict';
  const selectedByDataset=new Map();
  let lastEnvelope=null,lastDryRun=null,lastApplyPlan=null,conflictChoices={},lastSourceFilename='';
  const DATASET_LABELS={tags:'タグ',stats:'能力値',jobs:'職業',skills:'スキル',equipment:'装備',mods:'MOD',monsters:'モンスター',status_effects:'状態異常',tablets:'石板',ai_conditions:'AI条件',ai_targets:'AI対象',ai_actions:'AI行動'};
  const ORDER=['monsters','tags','skills','jobs','equipment','mods','stats','status_effects','tablets','ai_conditions','ai_targets','ai_actions'];

  function supportedDatasets(){return ORDER.filter(k=>GKSDataExchange.REGISTRY[k]);}
  function currentDataset(){return document.getElementById('dxPickerDataset')?.value||supportedDatasets()[0]||'monsters';}
  function selectedSet(dataset=currentDataset()){if(!selectedByDataset.has(dataset))selectedByDataset.set(dataset,new Set());return selectedByDataset.get(dataset);}
  function rows(dataset=currentDataset()){try{return GKSDataExchange.records(data,dataset)||[];}catch(_){return [];}}
  function searchText(row){const tags=Array.isArray(row?.tags)?row.tags:[];return [row?.id,row?.name,row?.description,row?.category_id,row?.parent_id,...tags,...tags.map(id=>typeof tagLabel==='function'?tagLabel(id):id),JSON.stringify(row?.params||{})].filter(Boolean).join(' ').toLowerCase();}
  function visibleRecords(){const q=(document.getElementById('dxPickerSearch')?.value||'').trim().toLowerCase();return rows().filter(row=>!q||searchText(row).includes(q));}
  function escText(v){return typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function escA(v){return typeof escAttr==='function'?escAttr(String(v??'')):escText(v);}
  function auditLegacyStorageKey(){return `gks_data_exchange_audit_v1_${String(currentProjectId||data?.project?.id||'default')}`;}
  function auditStorageKey(){return 'project-audit-sessions';}
  function auditProjectStorage(){
    return {
      getItem(){
        const embedded=Array.isArray(data?.data_exchange_audit_sessions)?data.data_exchange_audit_sessions:null;
        if(embedded&&embedded.length)return JSON.stringify(embedded);
        // One-time migration from DE-16/16.1 standalone localStorage.
        try{
          const legacy=JSON.parse(localStorage.getItem(auditLegacyStorageKey())||'[]');
          if(Array.isArray(legacy)&&legacy.length){
            data.data_exchange_audit_sessions=legacy;
            if(typeof safeStorageSet==='function'){
              safeStorageSet(projectStorageKey(currentProjectId),JSON.stringify(data),'Data Exchange Audit migration');
            }
            return JSON.stringify(legacy);
          }
        }catch(_){}
        return JSON.stringify(Array.isArray(embedded)?embedded:[]);
      },
      setItem(_key,value){
        const parsed=JSON.parse(String(value||'[]'));
        data.data_exchange_audit_sessions=Array.isArray(parsed)?parsed:[];
        if(typeof safeStorageSet!=='function')throw new Error('Data Exchange Audit保存関数がありません。');
        if(!safeStorageSet(projectStorageKey(currentProjectId),JSON.stringify(data),'Data Exchange Audit')){
          throw new Error('Data Exchange Auditを正本へ保存できませんでした。');
        }
      },
      removeItem(){
        data.data_exchange_audit_sessions=[];
        if(typeof safeStorageSet==='function'){
          safeStorageSet(projectStorageKey(currentProjectId),JSON.stringify(data),'Data Exchange Audit');
        }
      }
    };
  }
  function normalizeCandidate(candidate){
    const original=data;
    try{
      data=structuredClone(candidate);
      if(typeof normalizeData==='function')normalizeData();
      return structuredClone(data);
    }finally{data=original;}
  }
  function validateAuditCandidate(candidate,session){
    const check=GKSDataExchangeAudit.validateSnapshot(candidate,session);
    return check?.ok!==false;
  }
  function latestUndoableSession(){
    return GKSDataExchangeAudit.load(auditProjectStorage(),auditStorageKey()).find(x=>!x.undone)||null;
  }
  function renderAuditPanel(){
    const panel=document.getElementById('dxAuditPanel');if(!panel||!globalThis.GKSDataExchangeAudit)return;
    const sessions=GKSDataExchangeAudit.load(auditProjectStorage(),auditStorageKey());
    const latest=sessions[0],undoable=latestUndoableSession();
    if(!sessions.length){
      panel.innerHTML='<span class="small">Data Exchange Apply履歴はありません。</span>';
      return;
    }
    const latestText=latest?`${escText(latest.dataset||'-')} / 追加${latest.added?.length||0} / 変更${latest.changed?.length||0} / 維持${latest.kept?.length||0}${latest.undone?' / Undo済み':''}`:'';
    panel.innerHTML=`<div><span class="badge">Audit ${sessions.length}件</span> <span class="small">${latestText}</span></div><div class="toolbar"><button type="button" onclick="GKSDataExchangeUI.exportAuditForGPT()">GPT用Audit JSONを出力</button><button type="button" ${undoable?'':'disabled'} onclick="GKSDataExchangeUI.undoLatestSession()">直前SessionをUndo</button></div><div class="small">Undoは現在状態が対象Session直後のhashと一致する場合だけ実行できます。</div>`;
  }
  function exportAuditForGPT(){
    const payload=GKSDataExchangeAudit.exportPayload(auditProjectStorage(),auditStorageKey());
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    downloadBlob(blob,`DX_AUDIT_${String(currentProjectId||'project')}_${stamp}.json`);
  }
  async function undoLatestSession(){
    const session=latestUndoableSession();
    if(!session)return alert('Undo可能なData Exchange Sessionはありません。');
    if(!confirm(`直前のData Exchange SessionをUndoします。\n${session.dataset} / 追加${session.added?.length||0} / 変更${session.changed?.length||0}\n続行しますか？`))return;
    const beforeUndo=structuredClone(data);
    let undoCompleted=false;
    try{
      const result=await GKSDataExchangeAudit.undo({
        session,
        currentData:data,
        normalize:normalizeCandidate,
        validate:(candidate)=>validateAuditCandidate(candidate,session),
        backup:()=>typeof createBackup==='function'&&createBackup('before-data-exchange-undo',{silent:true}),
        commit:(candidate)=>{data=candidate;return true;},
        persist:()=>typeof persist==='function'&&persist(`Data Exchange Undo: ${session.import_session_id}`)!==false,
        readCurrent:()=>structuredClone(data),
        rollback:(original)=>{data=original;return true;},
        rollbackPersist:()=>typeof persist==='function'&&persist(`Data Exchange Undo rollback: ${session.import_session_id}`)!==false
      });
      undoCompleted=true;
      if(!GKSDataExchangeAudit.markUndone(auditProjectStorage(),auditStorageKey(),session.import_session_id,result.undoAfterHash)){
        throw new Error('Undo後Audit更新に失敗しました。');
      }
      lastEnvelope=null;lastDryRun=null;lastApplyPlan=null;conflictChoices={};
      renderDryRun({ok:true,summary:{add:0,unchanged:0,conflict:0,invalid:0,incompatible:0,stale_source:0,broken_reference:0,readonly_modified:0},items:[],errors:[],warnings:[]},0);
      renderImpactPreview(null);renderApplyPanel();renderAuditPanel();
      alert('Data Exchange Undo完了: Backup・復元・persist・再検証まで完了しました。');
    }catch(e){
      data=beforeUndo;
      if(undoCompleted&&typeof persist==='function')persist(`Data Exchange Undo audit failure rollback: ${session.import_session_id}`);
      renderAuditPanel();
      alert('Data Exchange Undo失敗: '+e.message);
    }
  }
  function initDatasetOptions(){const select=document.getElementById('dxPickerDataset');if(!select)return;const old=select.value;select.innerHTML=supportedDatasets().map(k=>`<option value="${escA(k)}">${escText(DATASET_LABELS[k]||k)}</option>`).join('');if(old&&supportedDatasets().includes(old))select.value=old;else if(supportedDatasets().includes('monsters'))select.value='monsters';}
  function renderPicker(){const list=document.getElementById('dxPickerList');if(!list)return;const dataset=currentDataset(),set=selectedSet(dataset),visible=visibleRecords();list.innerHTML=visible.length?visible.map(row=>{const id=String(row?.id||''),sel=set.has(id),tags=Array.isArray(row?.tags)?row.tags.map(t=>typeof tagLabel==='function'?tagLabel(t):t).join(', '):'';return `<div class="dx-picker-row${sel?' selected':''}" role="button" tabindex="0" aria-pressed="${sel?'true':'false'}" onclick="GKSDataExchangeUI.toggleItem('${escA(id)}')" onkeydown="GKSDataExchangeUI.handleItemKey(event,'${escA(id)}')"><div class="dx-picker-row-name">${escText(row?.name||id)} <span class="badge">${escText(DATASET_LABELS[dataset]||dataset)}</span></div><div class="dx-picker-row-id">${escText(id)}</div><div class="dx-picker-row-meta">${escText(tags||row?.description||'')}</div></div>`}).join(''):'<div class="item">表示対象はありません。</div>';const count=document.getElementById('dxPickerCount');if(count)count.textContent=`選択 ${set.size}件 / 表示 ${visible.length}件 / 全 ${rows(dataset).length}件`;const btn=document.getElementById('dxPickerExport');if(btn){btn.disabled=set.size===0;btn.textContent=`選択した${set.size}件をJSON出力`;}}
  function openPicker(){initDatasetOptions();const p=document.getElementById('dataExchangePicker');if(!p)return;document.getElementById('dxPickerSearch').value='';p.classList.remove('hidden');p.setAttribute('aria-hidden','false');document.body.classList.add('dx-picker-open');renderPicker();}
  function closePicker(){const p=document.getElementById('dataExchangePicker');if(!p)return;p.classList.add('hidden');p.setAttribute('aria-hidden','true');document.body.classList.remove('dx-picker-open');}
  function changeDataset(){const search=document.getElementById('dxPickerSearch');if(search)search.value='';renderPicker();}
  function toggleItem(id){const set=selectedSet();id=String(id);if(set.has(id))set.delete(id);else set.add(id);renderPicker();}
  function handleItemKey(event,id){if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleItem(id);}}
  function selectVisible(){const set=selectedSet();visibleRecords().forEach(r=>set.add(String(r.id)));renderPicker();}
  function selectAllDataset(){const set=selectedSet();rows().forEach(r=>set.add(String(r.id)));renderPicker();}
  function clearSelection(){selectedSet().clear();renderPicker();}
  async function exportSelection(){try{const dataset=currentDataset(),ids=[...selectedSet(dataset)].filter(id=>rows(dataset).some(r=>String(r.id)===id)).sort();if(!ids.length)throw new Error('出力対象を1件以上選択してください。');const mode=document.getElementById('dxPickerDependencyMode')?.value||'none';const envelope=await GKSDataExchange.buildEnvelope({rootData:data,dataset,ids,dependencyMode:mode,studioVersion:(typeof DISTRIBUTION_BUILD!=='undefined'?DISTRIBUTION_BUILD:'')});const project=(data.project?.id||'project').replace(/[^A-Za-z0-9_.-]/g,'_'),suffix=mode==='recursive'?'GPT':mode==='direct'?'REFS':'DATA';downloadText(`${project}_${dataset.toUpperCase()}_${suffix}_${ids.length}.json`,JSON.stringify(envelope,null,2),'application/json;charset=utf-8');setStatus(`Data Exchange出力: ${DATASET_LABELS[dataset]||dataset} ${ids.length}件 / ${mode}`);}catch(e){alert('Data Exchange出力失敗: '+e.message);}}
  function setStatus(text){const el=document.getElementById('dxMasterExportStatus');if(el)el.textContent=text;}
  function shortJson(value){
    const s=typeof value==='string'?value:JSON.stringify(value);
    return s==null?'':(s.length>120?s.slice(0,117)+'…':s);
  }
  function renderImpactPreview(result){
    const panel=document.getElementById('dxImpactPreview');if(!panel)return;
    const impact=result?.impact_preview;
    if(!impact){
      panel.innerHTML='<span class="small">Dry Run後にGPT用影響範囲JSONを生成できます。</span>';
      return;
    }
    const s=impact.summary||{};
    panel.innerHTML=`<div class="dx-dryrun-summary"><span class="badge">直接 ${s.direct||0}</span><span class="badge">参照追加 ${s.reference_additions||0}</span><span class="badge">既存参照 ${s.existing_references||0}</span><span class="badge">参照差異 ${s.reference_differences||0}</span><span class="badge">影響なし ${s.unaffected||0}</span></div><div class="toolbar"><button type="button" class="primary" onclick="GKSDataExchangeUI.exportImpactForGPT()">GPT用影響範囲JSONを出力</button></div><div class="small">詳細は画面展開せず、AI解析用JSONへ全件出力します。</div>`;
  }
  function exportImpactForGPT(){
    if(!lastEnvelope||!lastDryRun?.impact_preview)return alert('先にDry Runを実行してください。');
    const payload=GKSDataExchange.buildImpactExportPayload(lastEnvelope,lastDryRun);
    const primary=String(lastEnvelope?.permissions?.writable?.[0]||'data');
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    downloadBlob(blob,`DX_IMPACT_${primary}_${stamp}.json`);
  }
  function renderApplyPanel(){
    const panel=document.getElementById('dxApplyPanel');if(!panel)return;
    if(!lastDryRun||!lastEnvelope){panel.innerHTML='<span class="small">Dry Run後にApply可否を表示します。</span>';return;}
    const plan=lastApplyPlan;
    if(!plan){panel.innerHTML='<span class="small">Apply可否を確認中…</span>';return;}
    const conflicts=(lastDryRun.items||[]).filter(x=>x.status==='conflict'&&x.dataset===plan.dataset);
    const conflictUi=conflicts.length?`<div class="item small"><b>競合 ${conflicts.length}件</b><div class="toolbar"><button type="button" onclick="GKSDataExchangeUI.setAllConflictChoices('keep')">全て既存維持</button><button type="button" onclick="GKSDataExchangeUI.setAllConflictChoices('import')">全てImport採用</button></div>${conflicts.map(x=>{const id=String(x.id),v=conflictChoices[id]||'';return `<div class="dx-dryrun-row"><b>${escText(id)}</b><select onchange="GKSDataExchangeUI.setConflictChoice('${escA(id)}',this.value)"><option value="" ${!v?'selected':''}>未選択</option><option value="keep" ${v==='keep'?'selected':''}>既存維持</option><option value="import" ${v==='import'?'selected':''}>Import採用</option></select></div>`;}).join('')}</div>`:'';
    if(!plan.can_apply){
      panel.innerHTML=`${conflictUi}<div><span class="badge error">Apply不可</span> <span class="small">正本データは変更されません。</span></div><div class="dx-dryrun-error">${escText((plan.reasons||[]).join(' / ')||'適用対象がありません。')}</div>`;
      return;
    }
    const label=DATASET_LABELS[plan.dataset]||plan.dataset;
    panel.innerHTML=`${conflictUi}<div><span class="badge ok">Apply可能</span> <b>${escText(label)} 追加${plan.add_count} / Import採用${plan.import_ids?.length||0} / 既存維持${plan.keep_ids?.length||0}</b></div><div class="small">競合は明示選択が必須です。Import採用時も現在側にしかないフィールドは保持します。</div><div class="toolbar"><button type="button" onclick="GKSDataExchangeUI.showApplyPlan()">変更内容を確認</button><button type="button" class="primary" onclick="GKSDataExchangeUI.applySafeMerge()">この内容で反映</button></div>`;
  }
  async function setConflictChoice(id,value){
    if(value)conflictChoices[id]=value;else delete conflictChoices[id];
    await updateApplyPlan();
  }
  async function setAllConflictChoices(value){
    const dataset=lastApplyPlan?.dataset||lastEnvelope?.permissions?.writable?.[0]||'';
    for(const item of lastDryRun?.items||[])if(item.status==='conflict'&&item.dataset===dataset)conflictChoices[String(item.id)]=value;
    await updateApplyPlan();
  }
  function renderDryRun(result,appliedCount=0){
    const status=document.getElementById('dxImportStatus');if(!status)return;
    const order=['add','unchanged','conflict','invalid','incompatible','stale_source','broken_reference','readonly_modified'];
    const labels={add:'追加',unchanged:'変更なし',conflict:'競合',invalid:'不正',incompatible:'非互換',stale_source:'元データ更新済み',broken_reference:'参照切れ',readonly_modified:'read_only差異'};
    const summary=order.map(k=>`<span class="badge">${labels[k]} ${result.summary?.[k]||0}</span>`).join(' ');
    const messages=[...(result.errors||[]).map(x=>`<div class="dx-dryrun-error">ERROR: ${escText(x)}</div>`),...(result.warnings||[]).map(x=>`<div class="dx-dryrun-warn">WARN: ${escText(x)}</div>`)].join('');
    const rows=(result.items||[]).map(item=>`<div class="dx-dryrun-row"><b>${escText(labels[item.status]||item.status)}</b> ${escText(item.dataset)} / ${escText(item.id||'-')}<div class="small">${escText(item.detail||'')}</div></div>`).join('');
    const changeText=appliedCount?`データ変更 ${appliedCount}件 / Apply後再検証`:'データ変更 0件';
    status.innerHTML=`<div><span class="badge ${result.ok?'ok':'error'}">${result.ok?'Dry Run完了':'Dry Run停止'}</span> <span class="small">${changeText}</span></div><div class="dx-dryrun-summary">${summary}</div>${messages}${rows||'<div class="small">差分項目はありません。</div>'}`;
  }
  async function updateApplyPlan(){
    lastApplyPlan=lastEnvelope&&lastDryRun?await GKSDataExchange.createApplyPlan({rootData:data,envelope:lastEnvelope,dryRun:lastDryRun,conflictChoices}):null;
    renderApplyPanel();
  }
  function showApplyPlan(){
    if(!lastApplyPlan?.can_apply)return alert('現在のデータはApplyできません。');
    const ids=(lastApplyPlan.ids||[]).join('\n');
    alert(`Safe Merge 反映予定\n分類: ${DATASET_LABELS[lastApplyPlan.dataset]||lastApplyPlan.dataset}\n追加: ${lastApplyPlan.add_count}件\nImport採用: ${lastApplyPlan.import_ids?.length||0}件\n既存維持: ${lastApplyPlan.keep_ids?.length||0}件\n\n${ids}`);
  }
  async function applySafeMerge(){
    if(!lastApplyPlan?.can_apply||!lastEnvelope)return alert('Apply可能なDry Run結果がありません。');
    const label=DATASET_LABELS[lastApplyPlan.dataset]||lastApplyPlan.dataset;
    if(!confirm(`${label} を反映します。\n追加 ${lastApplyPlan.add_count}件 / Import採用 ${lastApplyPlan.import_ids?.length||0}件 / 既存維持 ${lastApplyPlan.keep_ids?.length||0}件\n続行しますか？`))return;
    const before=structuredClone(data);
    const appliedPlan=structuredClone(lastApplyPlan);
    const appliedEnvelope=structuredClone(lastEnvelope);
    let txCompleted=false;
    try{
      if(!globalThis.GKSDataExchangeTransaction)throw new Error('DataExchangeTransactionが読み込まれていません。');
      if(!globalThis.GKSDataExchangeAudit)throw new Error('DataExchangeAuditが読み込まれていません。');
      const tx=await GKSDataExchangeTransaction.execute({
        rootData:data,
        envelope:lastEnvelope,
        plan:lastApplyPlan,
        dryRun:lastDryRun,
        backup:()=>typeof createBackup==='function'&&createBackup('before-data-exchange-safe-apply',{silent:true}),
        commit:(candidate)=>{data=candidate;return true;},
        persist:()=>typeof persist==='function'&&persist(`Data Exchange Transaction: ${lastApplyPlan.dataset} add=${lastApplyPlan.add_count} import=${lastApplyPlan.import_ids?.length||0} keep=${lastApplyPlan.keep_ids?.length||0}`)!==false,
        rollback:(original)=>{data=original;return true;}
      });
      txCompleted=true;
      const actualAfterHash=await GKSDataExchangeTransaction.projectHash(data);
      const session=GKSDataExchangeAudit.buildSession({
        transaction:tx,
        plan:appliedPlan,
        envelope:appliedEnvelope,
        beforeData:before,
        afterHash:actualAfterHash,
        sourceFilename:lastSourceFilename,
        projectId:String(currentProjectId||data?.project?.id||'')
      });
      if(!GKSDataExchangeAudit.append(auditProjectStorage(),auditStorageKey(),session)){
        throw new Error('Data Exchange Auditを保存できませんでした。');
      }
      lastDryRun=tx.validation;conflictChoices={};
      lastApplyPlan=await GKSDataExchange.createApplyPlan({rootData:data,envelope:lastEnvelope,dryRun:lastDryRun,conflictChoices});
      renderDryRun(lastDryRun,tx.applied.count);
      renderImpactPreview(lastDryRun);
      renderApplyPanel();renderAuditPanel();
      alert(`Safe Apply完了: ${label} ${tx.applied.count}件\nTransaction検証・Backup・commit・persist・再検証・Audit記録まで完了しました。`);
    }catch(e){
      data=before;
      if(txCompleted&&typeof persist==='function')persist('Data Exchange Audit failure rollback');
      renderApplyPanel();renderAuditPanel();
      alert('Safe Apply失敗: '+e.message);
    }
  }
  function inspectImportFile(){
    const input=document.getElementById('dxImportFile'),file=input?.files?.[0],status=document.getElementById('dxImportStatus');
    if(!file){if(status)status.textContent='JSONファイルを選択してください。';return;}
    lastSourceFilename=String(file.name||'');
    lastEnvelope=null;lastDryRun=null;lastApplyPlan=null;conflictChoices={};renderApplyPanel();renderImpactPreview(null);
    if(status)status.textContent='解析中…';
    const reader=new FileReader();
    reader.onload=async()=>{try{
      lastEnvelope=JSON.parse(reader.result);
      lastDryRun=await GKSDataExchange.dryRunImport({rootData:data,envelope:lastEnvelope});
      renderDryRun(lastDryRun);
      renderImpactPreview(lastDryRun);
      await updateApplyPlan();
    }catch(e){
      lastEnvelope=null;lastDryRun=null;lastApplyPlan=null;
      status.innerHTML=`<span class="badge error">解析エラー</span> ${escText(e.message)}<br><span class="small">データ変更 0件</span>`;
      renderApplyPanel();
    }};
    reader.onerror=()=>{if(status)status.innerHTML='<span class="badge error">読込エラー</span> ファイルを読み込めませんでした。<br><span class="small">データ変更 0件</span>';};
    reader.readAsText(file,'utf-8');
  }
  function onViewRefresh(){renderAuditPanel();}
  window.GKSDataExchangeUI={openPicker,closePicker,changeDataset,renderPicker,toggleItem,handleItemKey,selectVisible,selectAllDataset,clearSelection,exportSelection,inspectImportFile,renderImpactPreview,exportImpactForGPT,renderAuditPanel,exportAuditForGPT,undoLatestSession,setConflictChoice,setAllConflictChoices,showApplyPlan,applySafeMerge,onViewRefresh};
})( );
