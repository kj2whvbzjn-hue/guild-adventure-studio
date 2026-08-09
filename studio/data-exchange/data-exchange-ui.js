(function(){
  'use strict';
  const selectedByDataset=new Map();
  let lastEnvelope=null,lastDryRun=null,lastApplyPlan=null;
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
    downloadBlob(`DX_IMPACT_${primary}_${stamp}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
  }
  function renderApplyPanel(){
    const panel=document.getElementById('dxApplyPanel');if(!panel)return;
    if(!lastDryRun||!lastEnvelope){panel.innerHTML='<span class="small">Dry Run後にApply可否を表示します。</span>';return;}
    const plan=lastApplyPlan;
    if(!plan){panel.innerHTML='<span class="small">Apply可否を確認中…</span>';return;}
    if(!plan.can_apply){
      panel.innerHTML=`<div><span class="badge error">Apply不可</span> <span class="small">正本データは変更されません。</span></div><div class="dx-dryrun-error">${escText((plan.reasons||[]).join(' / ')||'追加対象がありません。')}</div>`;
      return;
    }
    panel.innerHTML=`<div><span class="badge ok">Apply可能</span> <b>${escText(DATASET_LABELS[plan.dataset]||plan.dataset)} ${plan.add_count}件を追加</b></div><div class="small">既存IDは上書きしません。Apply直前に自動バックアップを作成し、反映後に再検証します。</div><div class="toolbar"><button type="button" onclick="GKSDataExchangeUI.showApplyPlan()">変更内容を確認</button><button type="button" class="primary" onclick="GKSDataExchangeUI.applySafeMerge()">この内容で反映</button></div>`;
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
    lastApplyPlan=lastEnvelope&&lastDryRun?await GKSDataExchange.createApplyPlan({rootData:data,envelope:lastEnvelope,dryRun:lastDryRun}):null;
    renderApplyPanel();
  }
  function showApplyPlan(){
    if(!lastApplyPlan?.can_apply)return alert('現在のデータはApplyできません。');
    const ids=(lastApplyPlan.ids||[]).join('\n');
    alert(`Safe Merge 反映予定\n分類: ${DATASET_LABELS[lastApplyPlan.dataset]||lastApplyPlan.dataset}\n追加: ${lastApplyPlan.add_count}件\n\n${ids}`);
  }
  async function applySafeMerge(){
    if(!lastApplyPlan?.can_apply||!lastEnvelope)return alert('Apply可能なDry Run結果がありません。');
    const label=DATASET_LABELS[lastApplyPlan.dataset]||lastApplyPlan.dataset;
    if(!confirm(`${label} ${lastApplyPlan.add_count}件を正本データへ追加します。\n既存IDは上書きしません。\n続行しますか？`))return;
    if(typeof createBackup!=='function'||!createBackup('before-data-exchange-safe-apply',{silent:true})){
      return alert('バックアップを作成できないためApplyを中止しました。');
    }
    const before=structuredClone(data);
    try{
      const applied=await GKSDataExchange.applySafeMerge({rootData:data,envelope:lastEnvelope,plan:lastApplyPlan,dryRun:lastDryRun});
      data=applied.nextRootData;
      if(typeof persist!=='function'||persist(`Data Exchange Safe Apply: ${applied.applied.dataset} ${applied.applied.count}件`)===false){
        data=before;
        throw new Error('端末保存に失敗したためメモリ上の変更を戻しました。');
      }
      lastDryRun=applied.verify;
      lastApplyPlan=await GKSDataExchange.createApplyPlan({rootData:data,envelope:lastEnvelope,dryRun:lastDryRun});
      renderDryRun(lastDryRun,applied.applied.count);
      renderImpactPreview(lastDryRun);
      renderApplyPanel();
      alert(`Safe Apply完了: ${label} ${applied.applied.count}件\nバックアップ作成・反映後再検証まで完了しました。`);
    }catch(e){
      data=before;
      renderApplyPanel();
      alert('Safe Apply失敗: '+e.message);
    }
  }
  function inspectImportFile(){
    const input=document.getElementById('dxImportFile'),file=input?.files?.[0],status=document.getElementById('dxImportStatus');
    if(!file){if(status)status.textContent='JSONファイルを選択してください。';return;}
    lastEnvelope=null;lastDryRun=null;lastApplyPlan=null;renderApplyPanel();renderImpactPreview(null);
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
  function onViewRefresh(){}
  window.GKSDataExchangeUI={openPicker,closePicker,changeDataset,renderPicker,toggleItem,handleItemKey,selectVisible,selectAllDataset,clearSelection,exportSelection,inspectImportFile,renderImpactPreview,exportImpactForGPT,showApplyPlan,applySafeMerge,onViewRefresh};
})( );
