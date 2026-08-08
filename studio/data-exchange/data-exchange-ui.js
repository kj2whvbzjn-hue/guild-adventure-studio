(function(){
  'use strict';
  const selectedMonsters=new Set();

  function currentMonsterRows(){return Array.isArray(data?.masters?.monsters)?data.masters.monsters:[];}
  function visibleMonsterCheckboxes(){return Array.from(document.querySelectorAll('input[data-dx-monster-id]'));}
  function selectedIds(){return [...selectedMonsters].filter(id=>currentMonsterRows().some(row=>String(row.id)===id)).sort();}
  function syncChecks(){visibleMonsterCheckboxes().forEach(cb=>{cb.checked=selectedMonsters.has(cb.dataset.dxMonsterId);});}
  function refreshMasterExportUi(){
    const box=document.getElementById('monsterExchangeToolbar');if(!box)return;
    const active=document.getElementById('masterCategory')?.value==='monsters';
    box.classList.toggle('hidden',!active);
    if(!active)return;
    syncChecks();
    const count=document.getElementById('dxMonsterSelectionCount');if(count)count.textContent=`選択 ${selectedIds().length}件 / 表示 ${visibleMonsterCheckboxes().length}件`;
    const exportButtons=box.querySelectorAll('[data-dx-export]');exportButtons.forEach(btn=>btn.disabled=selectedIds().length===0);
  }
  function toggleMonster(id,checked){if(checked)selectedMonsters.add(String(id));else selectedMonsters.delete(String(id));refreshMasterExportUi();}
  function selectVisibleMonsters(){visibleMonsterCheckboxes().forEach(cb=>selectedMonsters.add(cb.dataset.dxMonsterId));refreshMasterExportUi();}
  function clearMonsterSelection(){selectedMonsters.clear();refreshMasterExportUi();}
  async function exportMonsters(mode){
    try{
      const ids=selectedIds();if(!ids.length)throw new Error('モンスターを1件以上選択してください。');
      const envelope=await GKSDataExchange.buildEnvelope({rootData:data,dataset:'monsters',ids,dependencyMode:mode,studioVersion:(typeof DISTRIBUTION_BUILD!=='undefined'?DISTRIBUTION_BUILD:'')});
      const suffix=mode==='none'?'MONSTERS':mode==='direct'?'MONSTERS_REFS':'MONSTERS_GPT';
      const project=(data.project?.id||'project').replace(/[^A-Za-z0-9_.-]/g,'_');
      downloadText(`${project}_${suffix}_${ids.length}.json`,JSON.stringify(envelope,null,2),'application/json;charset=utf-8');
      setMasterStatus(`Data Exchange出力: Monster ${ids.length}件 / ${mode}`);
    }catch(e){alert('Data Exchange出力失敗: '+e.message);}
  }
  function setMasterStatus(text){const el=document.getElementById('dxMonsterExportStatus');if(el)el.textContent=text;}
  function selectedSummary(){return selectedIds().join(', ');}
  function centralRefresh(){
    const el=document.getElementById('dxCentralSelection');if(el)el.textContent=`Monster選択: ${selectedIds().length}件${selectedIds().length?' / '+selectedSummary():''}`;
  }
  async function centralExport(){
    const mode=document.getElementById('dxDependencyMode')?.value||'none';
    await exportMonsters(mode);centralRefresh();
  }
  function inspectImportFile(){
    const input=document.getElementById('dxImportFile'),file=input?.files?.[0],status=document.getElementById('dxImportStatus');
    if(!file){if(status)status.textContent='JSONファイルを選択してください。';return;}
    const reader=new FileReader();reader.onload=()=>{
      try{
        const obj=JSON.parse(reader.result);const shape=GKSDataExchange.validateEnvelopeShape(obj);if(!shape.ok)throw new Error(shape.errors.join(' / '));
        const projectOk=obj.project_id===String(data.project?.id||'');
        const counts=Object.entries(obj.datasets||{}).map(([k,v])=>`${k}:${Array.isArray(v)?v.length:'?'}`).join(' / ');
        status.innerHTML=`<span class="badge ${projectOk?'ok':'warn'}">${projectOk?'形式OK':'project_id不一致'}</span> ${esc(counts)}<br><span class="small">この段階ではDry Run/Import適用は行いません。データは変更されていません。</span>`;
      }catch(e){status.innerHTML=`<span class="badge error">形式エラー</span> ${esc(e.message)}`;}
    };reader.readAsText(file,'utf-8');
  }
  function onViewRefresh(){refreshMasterExportUi();centralRefresh();}
  window.GKSDataExchangeUI={refreshMasterExportUi,toggleMonster,selectVisibleMonsters,clearMonsterSelection,exportMonsters,centralExport,inspectImportFile,onViewRefresh,selectedIds};
  window.addEventListener('DOMContentLoaded',()=>setTimeout(onViewRefresh,0));
})();
