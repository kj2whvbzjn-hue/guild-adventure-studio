(function(root,factory){
  const Adapter=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-master-adapter.js'):root?.GKSAIMasterAdapter;
  const Layout=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-layout-model.js'):root?.GKSAILayoutModel;
  const Program=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-program-model.js'):root?.GKSAIProgramModel;
  const Resolver=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-connection-resolver.js'):root?.GKSAIConnectionResolver;
  const Validator=typeof module==='object'&&module.exports?require('../../../shared/ai/ai-program-validator.js'):root?.GKSAIProgramValidator;
  const Catalog=typeof module==='object'&&module.exports?require('./ai-catalog-loader.js'):root?.GKGameAICatalogLoader;
  const api=factory(Adapter,Layout,Program,Resolver,Validator,Catalog,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKGameAIEditorUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Adapter,Layout,Program,Resolver,Validator,Catalog,root){
  'use strict';
  if(!Adapter||!Layout||!Program||!Resolver||!Validator||!Catalog)throw new Error('Formal AI editor dependencies are required');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const CATEGORY_LABEL=Object.freeze({condition:'条件',target:'対象',action:'行動',extension:'延長'});
  const LONG_PRESS_MS=450,LONG_PRESS_DRIFT=12;
  const sessions=new Map();
  let ui=null,activeCharacter=null,activeSession=null,catalog=null,currentCategory='condition',candidateContext=null,configContext=null,moveContext=null,notify=()=>{},saveHandler=null,presetHandler=null,userPresets=[],issueCursor=0,lastEvaluation=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function projectData(c){
    const masters=clone(c?.masters||{});masters.skills=clone(c?.refs?.skills||[]);
    return {masters,tags:clone(c?.refs?.tags||[])};
  }
  function definitions(c){return Adapter.palette(c?.masters||{},'',{}).filter(row=>row.available&&row.errors.length===0);}
  function definitionById(c,id){return definitions(c).find(row=>row.id===String(id||''))||null;}
  function nextNodeId(nodes){let max=0;for(const row of nodes||[]){const m=/^AIN-([0-9]+)$/.exec(String(row?.instance_id||''));if(m)max=Math.max(max,Number(m[1]));}return `AIN-${String(max+1).padStart(4,'0')}`;}
  function nextExtensionId(rows){let max=0;for(const row of rows||[]){const m=/^EXT-([0-9]+)$/.exec(String(row?.id||''));if(m)max=Math.max(max,Number(m[1]));}return `EXT-${String(max+1).padStart(4,'0')}`;}
  function createSession(c,options){
    const opts=options||{};let sessionCatalog=c;
    let program=opts.program?Program.normalizeProgram(clone(opts.program)):Program.createProgram(opts.program_id||'AIP-DRAFT',opts.now||new Date().toISOString());
    if(!program.name)program.name=opts.name||'AI編集中';
    let layout=opts.layout?Layout.normalizeLayout(clone(opts.layout)):Layout.createLayout(opts.layout_id||'AIL-0001',program.id,opts.width||8,opts.height||8);
    if(layout.program_id!==program.id)layout={...layout,program_id:program.id};
    const undo=[],redo=[];
    const snapshot=()=>({program:clone(program),layout:clone(layout)});
    const restore=s=>{program=Program.normalizeProgram(clone(s.program));layout=Layout.normalizeLayout(clone(s.layout));};
    const commit=fn=>{undo.push(snapshot());if(undo.length>50)undo.shift();redo.length=0;fn();program.compiled=null;program.status='draft';};
    const chipAt=(x,y)=>layout.chips.find(row=>row.x===x&&row.y===y)||null;
    const extensionAt=(x,y)=>layout.extensions.find(row=>row.x===x&&row.y===y)||null;
    const nodeAt=(x,y)=>{const chip=chipAt(x,y);return chip?program.nodes.find(row=>row.instance_id===chip.instance_id)||null:null;};
    const definitionFor=node=>definitionById(sessionCatalog,node?.master_node_id);
    function assertFree(x,y,ignore){
      const chip=chipAt(x,y),extension=extensionAt(x,y);
      if(chip&&!(ignore?.kind==='node'&&chip.instance_id===ignore.id))throw new Error('配置先セルは使用済みです。');
      if(extension&&!(ignore?.kind==='extension'&&extension.id===ignore.id))throw new Error('配置先セルは使用済みです。');
    }
    function evaluateDocuments(programValue,layoutValue){
      const baseProgram=Program.normalizeProgram(programValue),baseLayout=Layout.normalizeLayout(layoutValue),data=projectData(sessionCatalog);let resolution,resolvedProgram,validation,generated=true,generationError='';
      try{resolution=Resolver.resolve(baseLayout,baseProgram,data);resolvedProgram=clone(baseProgram);resolvedProgram.edges=clone(resolution.edges||[]);validation=Validator.validate(resolvedProgram,data);}catch(error){generated=false;generationError=String(error?.message||error);resolution={valid:false,diagnostics:[{severity:'ERROR',code:'AI_PROGRAM_GENERATION_FAILED',message:generationError}],summary:{ERROR:1,WARNING:0,INFO:0},connections:[],edges:[]};resolvedProgram=clone(baseProgram);validation={valid:false,issues:[],summary:{ERROR:0,WARNING:0,INFO:0}};}
      const issues=[...(resolution.diagnostics||[]),...(validation.issues||[])],seen=new Set(),unique=[];
      for(const row of issues){const key=[row.severity,row.code,row.node_id||'',row.target_node_id||'',row.extension_id||'',row.message].join('|');if(!seen.has(key)){seen.add(key);unique.push(clone(row));}}
      const summary={ERROR:0,WARNING:0,INFO:0};unique.forEach(row=>{summary[row.severity]=(summary[row.severity]||0)+1;});
      return {valid:generated&&resolution.valid===true&&validation.valid===true,generated,generationError,resolution,validation,program:resolvedProgram,layout:baseLayout,issues:unique,summary};
    }
    function add(masterId,parameters,x,y){
      const def=definitionById(sessionCatalog,masterId);if(!def)throw new Error('AI部品Masterが見つかりません。');
      const paramErrors=Adapter.validateParameters(def,parameters,sessionCatalog?.refs||{});if(paramErrors.length)throw new Error(paramErrors.join('\n'));
      assertFree(x,y);
      let created;commit(()=>{created={instance_id:nextNodeId(program.nodes),master_node_id:def.id,master_data_version:def.data_version,node_type:def.node_type,position:{x,y},parameters:clone(parameters||{}),comment:''};program.nodes.push(created);if(!program.entry_node_id)program.entry_node_id=created.instance_id;layout=Layout.upsertChip(layout,{instance_id:created.instance_id,x,y,rotation:0});});return clone(created);
    }
    function addExtension(shape,x,y,rotation=0){
      if(!Layout.EXTENSION_SHAPES.includes(String(shape||'')))throw new Error('延長パネル形状が不正です。');
      if(!Layout.ROTATIONS.includes(Number(rotation)))throw new Error('延長パネル角度が不正です。');
      assertFree(x,y);let created;commit(()=>{created={id:nextExtensionId(layout.extensions),x,y,shape:String(shape),rotation:Number(rotation)};layout=Layout.upsertExtension(layout,created);});return clone(created);
    }
    function updateParameters(instanceId,parameters){const node=program.nodes.find(row=>row.instance_id===instanceId);if(!node)throw new Error('AI部品が見つかりません。');const def=definitionFor(node);if(!def)throw new Error('AI部品Masterが見つかりません。');const errors=Adapter.validateParameters(def,parameters,sessionCatalog?.refs||{});if(errors.length)throw new Error(errors.join('\n'));commit(()=>{node.parameters=clone(parameters||{});});}
    function replace(instanceId,masterId,parameters){const node=program.nodes.find(row=>row.instance_id===instanceId);if(!node)throw new Error('AI部品が見つかりません。');const def=definitionById(sessionCatalog,masterId);if(!def)throw new Error('AI部品Masterが見つかりません。');const errors=Adapter.validateParameters(def,parameters,sessionCatalog?.refs||{});if(errors.length)throw new Error(errors.join('\n'));commit(()=>{node.master_node_id=def.id;node.master_data_version=def.data_version;node.node_type=def.node_type;node.parameters=clone(parameters||{});});}
    function updateExtension(extensionId,shape,rotation){const extension=layout.extensions.find(row=>row.id===String(extensionId||''));if(!extension)throw new Error('延長パネルが見つかりません。');if(!Layout.EXTENSION_SHAPES.includes(String(shape||'')))throw new Error('延長パネル形状が不正です。');if(!Layout.ROTATIONS.includes(Number(rotation)))throw new Error('延長パネル角度が不正です。');commit(()=>{layout=Layout.upsertExtension(layout,{...extension,shape:String(shape),rotation:Number(rotation)});});}
    function rotate(instanceId,delta=90){const chip=layout.chips.find(row=>row.instance_id===instanceId);if(!chip)return false;commit(()=>{const next=((Number(chip.rotation)||0)+delta)%360;layout=Layout.upsertChip(layout,{...chip,rotation:(next+360)%360});});return true;}
    function rotateExtension(extensionId,delta=90){const extension=layout.extensions.find(row=>row.id===String(extensionId||''));if(!extension)return false;commit(()=>{const next=((Number(extension.rotation)||0)+delta)%360;layout=Layout.upsertExtension(layout,{...extension,rotation:(next+360)%360});});return true;}
    function moveNode(instanceId,x,y){const node=program.nodes.find(row=>row.instance_id===String(instanceId||'')),chip=layout.chips.find(row=>row.instance_id===String(instanceId||''));if(!node||!chip)throw new Error('移動するAI部品が見つかりません。');assertFree(x,y,{kind:'node',id:instanceId});commit(()=>{node.position={x,y};layout=Layout.upsertChip(layout,{...chip,x,y});});return true;}
    function moveExtension(extensionId,x,y){const extension=layout.extensions.find(row=>row.id===String(extensionId||''));if(!extension)throw new Error('移動する延長パネルが見つかりません。');assertFree(x,y,{kind:'extension',id:extensionId});commit(()=>{layout=Layout.upsertExtension(layout,{...extension,x,y});});return true;}
    function remove(instanceId){if(!program.nodes.some(row=>row.instance_id===instanceId))return false;commit(()=>{program.nodes=program.nodes.filter(row=>row.instance_id!==instanceId);program.edges=program.edges.filter(edge=>edge.from?.node_id!==instanceId&&edge.to?.node_id!==instanceId);layout=Layout.removeChip(layout,instanceId);if(program.entry_node_id===instanceId)program.entry_node_id=program.nodes[0]?.instance_id||'';});return true;}
    function removeExtension(extensionId){if(!layout.extensions.some(row=>row.id===String(extensionId||'')))return false;commit(()=>{layout=Layout.removeExtension(layout,extensionId);});return true;}
    function clear(){commit(()=>{program.nodes=[];program.edges=[];program.entry_node_id='';layout={...layout,chips:[],extensions:[]};});}
    function undoOnce(){if(!undo.length)return false;redo.push(snapshot());restore(undo.pop());return true;}
    function redoOnce(){if(!redo.length)return false;undo.push(snapshot());restore(redo.pop());return true;}
    function replaceDocuments(nextProgram,nextLayout){program=Program.normalizeProgram(clone(nextProgram));layout=Layout.normalizeLayout(clone(nextLayout));undo.length=0;redo.length=0;}
    function loadDocuments(nextProgram,nextLayout){commit(()=>{program=Program.normalizeProgram(clone(nextProgram));layout=Layout.normalizeLayout(clone(nextLayout));if(layout.program_id!==program.id)layout.program_id=program.id;});}
    function previewNode(masterId,parameters,x,y,rotation=0){
      const def=definitionById(sessionCatalog,masterId);if(!def)throw new Error('AI部品Masterが見つかりません。');const errors=Adapter.validateParameters(def,parameters,sessionCatalog?.refs||{});if(errors.length)throw new Error(errors.join('\n'));assertFree(x,y);
      const nextProgram=Program.normalizeProgram(program),nextLayout=Layout.normalizeLayout(layout),id=nextNodeId(nextProgram.nodes);nextProgram.nodes.push({instance_id:id,master_node_id:def.id,master_data_version:def.data_version,node_type:def.node_type,position:{x,y},parameters:clone(parameters||{}),comment:''});if(!nextProgram.entry_node_id)nextProgram.entry_node_id=id;const placed=Layout.upsertChip(nextLayout,{instance_id:id,x,y,rotation:Number(rotation)||0});return {...evaluateDocuments(nextProgram,placed),preview_id:id};
    }
    function previewExtension(shape,x,y,rotation=0){assertFree(x,y);const id=nextExtensionId(layout.extensions),placed=Layout.upsertExtension(layout,{id,x,y,shape:String(shape),rotation:Number(rotation)});return {...evaluateDocuments(program,placed),preview_id:id};}
    function previewMoveNode(instanceId,x,y){const chip=layout.chips.find(row=>row.instance_id===String(instanceId||''));if(!chip)throw new Error('移動するAI部品が見つかりません。');assertFree(x,y,{kind:'node',id:instanceId});const nextProgram=Program.normalizeProgram(program),node=nextProgram.nodes.find(row=>row.instance_id===String(instanceId||''));if(node)node.position={x,y};const placed=Layout.upsertChip(layout,{...chip,x,y});return {...evaluateDocuments(nextProgram,placed),preview_id:String(instanceId)};}
    function previewMoveExtension(extensionId,x,y){const extension=layout.extensions.find(row=>row.id===String(extensionId||''));if(!extension)throw new Error('移動する延長パネルが見つかりません。');assertFree(x,y,{kind:'extension',id:extensionId});const placed=Layout.upsertExtension(layout,{...extension,x,y});return {...evaluateDocuments(program,placed),preview_id:String(extensionId)};}
    function evaluate(){return evaluateDocuments(program,layout);}
    return Object.freeze({program:()=>clone(program),layout:()=>clone(layout),nodeAt,extensionAt,definitionFor,add,addExtension,updateParameters,replace,updateExtension,rotate,rotateExtension,moveNode,moveExtension,remove,removeExtension,clear,undo:undoOnce,redo:redoOnce,canUndo:()=>undo.length>0,canRedo:()=>redo.length>0,parameterErrors:(def,values)=>Adapter.validateParameters(def,values,sessionCatalog?.refs||{}),descriptors:def=>Adapter.inputDescriptors(def,sessionCatalog?.refs||{}),catalog:()=>sessionCatalog,setCatalog:next=>{sessionCatalog=next||sessionCatalog;return clone(sessionCatalog);},evaluate,previewNode,previewExtension,previewMoveNode,previewMoveExtension,replaceDocuments,loadDocuments});
  }

  function summaryFor(session,node){const def=session.definitionFor(node);if(!def)return '';const descriptors=session.descriptors(def),parts=[];for(const field of descriptors){const value=node.parameters?.[field.name];if(value==null||value==='')continue;const option=field.options.find(row=>String(row.id)===String(value));parts.push(`${field.label}: ${option?.name||value}`);}return parts.join(' / ');}
  function bindCellInteraction(cell,onTap,onHold){
    let timer=null,held=false,startX=0,startY=0;const clear=()=>{if(timer){clearTimeout(timer);timer=null;}};
    cell.onclick=event=>{if(held){held=false;event.preventDefault();event.stopPropagation();return;}if(typeof onTap==='function')onTap();};
    if(typeof onHold!=='function')return;
    cell.onpointerdown=event=>{if(moveContext||event.pointerType==='mouse'||event.button>0)return;held=false;startX=event.clientX;startY=event.clientY;clear();timer=setTimeout(()=>{timer=null;held=true;onHold();},LONG_PRESS_MS);};
    cell.onpointermove=event=>{if(timer&&Math.hypot(event.clientX-startX,event.clientY-startY)>LONG_PRESS_DRIFT)clear();};
    cell.onpointerup=clear;cell.onpointercancel=clear;cell.onpointerleave=clear;cell.oncontextmenu=event=>{if(held||event.pointerType!=='mouse')event.preventDefault();};
  }
  function sideClass(side){return `ai-port-${side||'west'}`;}
  function portHtml(def,rotation){if(!def)return '';return Resolver.portSidesForNode(def,rotation).map(port=>{const label=port.direction==='input'?'◀':port.port_id==='true'?'T▶':port.port_id==='false'?'F▶':'▶';return `<span class="ai-formal-port ${port.direction==='input'?'ai-formal-port-in':'ai-formal-port-out'} ${sideClass(port.side)}" title="${esc(port.direction==='input'?'入口':port.port_id.toUpperCase())}">${label}</span>`;}).join('');}
  function issueNodes(evaluation){const map=new Map();for(const row of evaluation?.issues||[]){for(const id of [row.node_id,row.target_node_id]){if(!id)continue;const severity=row.severity==='ERROR'?'ERROR':row.severity==='WARNING'?'WARNING':'INFO';if(!map.has(id)||map.get(id)==='INFO'||(map.get(id)==='WARNING'&&severity==='ERROR'))map.set(id,severity);}}return map;}
  function issueExtensions(evaluation){const map=new Map();for(const row of evaluation?.issues||[]){const id=String(row.extension_id||'');if(!id)continue;const severity=row.severity==='ERROR'?'ERROR':row.severity==='WARNING'?'WARNING':'INFO';if(!map.has(id)||map.get(id)==='INFO'||(map.get(id)==='WARNING'&&severity==='ERROR'))map.set(id,severity);}return map;}
  function renderValidationState(evaluation){
    lastEvaluation=evaluation;const errors=evaluation.summary.ERROR||0,warnings=evaluation.summary.WARNING||0;const state=errors?'error':warnings?'warning':'valid';
    ui.boardWrap.classList.remove('ai-state-error','ai-state-warning','ai-state-valid');ui.boardWrap.classList.add(`ai-state-${state}`);
    ui.save.disabled=!evaluation.valid;ui.save.title=evaluation.valid?'検証済みFormal AIを保存します。':'赤エラーを解消すると保存できます。';
    ui.issueJump.disabled=!(errors||warnings);ui.issueJump.textContent=errors?`エラー ${errors}件`:warnings?`警告 ${warnings}件`:'問題なし';
    const first=evaluation.issues[0]?.message||'';ui.state.textContent=evaluation.valid?(warnings?`保存可能 / 警告 ${warnings}件${first?` — ${first}`:''}`:'保存可能 / 接続・Program検証OK'):`保存不可 / エラー ${errors}件${first?` — ${first}`:''}`;
  }
  function extensionPortHtml(extension){return Resolver.extensionSides(extension).map(side=>`<span class="ai-formal-port ai-extension-port ${sideClass(side)}" title="延長経路">◆</span>`).join('');}
  function previewSummary(evaluation,focusId){
    const id=String(focusId||evaluation?.preview_id||''),connections=(evaluation?.resolution?.connections||[]).filter(row=>String(row?.from?.node_id||'')===id||String(row?.to?.node_id||'')===id||(row?.extension_ids||[]).map(String).includes(id));
    const errors=Number(evaluation?.summary?.ERROR)||0,warnings=Number(evaluation?.summary?.WARNING)||0;
    const detail=connections.slice(0,3).map(row=>`${row.from.node_id}.${row.from.port_id} → ${row.to.node_id}.${row.to.port_id}`).join(' / ');
    return `自動接続予定 ${connections.length}本 / エラー ${errors} / 警告 ${warnings}${detail?` — ${detail}`:''}`;
  }
  function renderMovePreview(){
    if(!ui?.movePreview)return;
    if(!moveContext){ui.movePreview.classList.add('hidden');return;}
    ui.movePreview.classList.remove('hidden');ui.moveCancel.disabled=false;
    if(!moveContext.destination){ui.movePreviewText.textContent='移動先の空きマスをタップしてください。接続予定を確認してから確定します。';ui.moveCommit.disabled=true;return;}
    ui.movePreviewText.textContent=`移動先 ${moveContext.destination.x+1},${moveContext.destination.y+1} / ${previewSummary(moveContext.evaluation,moveContext.id)}`;ui.moveCommit.disabled=false;
  }
  function renderBoard(){
    if(!ui||!activeSession)return;const layout=activeSession.layout(),program=activeSession.program(),evaluation=activeSession.evaluate(),nodeSeverity=issueNodes(evaluation),extensionSeverity=issueExtensions(evaluation);
    ui.board.style.gridTemplateColumns=`repeat(${layout.width},72px)`;ui.board.style.gridTemplateRows=`repeat(${layout.height},72px)`;ui.board.innerHTML='';const byId=new Map(program.nodes.map(n=>[n.instance_id,n]));
    for(let y=0;y<layout.height;y++)for(let x=0;x<layout.width;x++){
      const cell=document.createElement('button');cell.type='button';cell.className='ai-formal-cell';cell.dataset.x=x;cell.dataset.y=y;const chip=layout.chips.find(row=>row.x===x&&row.y===y),extension=layout.extensions.find(row=>row.x===x&&row.y===y),node=chip?byId.get(chip.instance_id):null;
      if(node){const def=activeSession.definitionFor(node),summary=summaryFor(activeSession,node),entry=program.entry_node_id===node.instance_id,severity=nodeSeverity.get(node.instance_id);cell.classList.add('occupied');if(severity==='ERROR')cell.classList.add('ai-node-error');else if(severity==='WARNING')cell.classList.add('ai-node-warning');if(moveContext?.kind==='node'&&moveContext.id===node.instance_id)cell.classList.add('ai-move-source');cell.dataset.nodeId=node.instance_id;cell.setAttribute('aria-label',`${def?.name||node.master_node_id}。タップで編集、長押しで移動`);cell.innerHTML=`<span class="ai-formal-chip ${esc(node.node_type)}">${portHtml(def,chip.rotation)}${entry?'<span class="ai-entry-badge">START</span>':''}<b>${esc(def?.name||node.master_node_id)}</b>${summary?`<small>${esc(summary)}</small>`:''}<small class="ai-rotation">${chip.rotation}°</small></span>`;bindCellInteraction(cell,()=>{if(!moveContext)openExistingConfig(node.instance_id);},()=>beginMove('node',node.instance_id));}
      else if(extension){const severity=extensionSeverity.get(extension.id);cell.classList.add('occupied','ai-extension-cell');if(severity==='ERROR')cell.classList.add('ai-node-error');else if(severity==='WARNING')cell.classList.add('ai-node-warning');if(moveContext?.kind==='extension'&&moveContext.id===extension.id)cell.classList.add('ai-move-source');cell.dataset.extensionId=extension.id;cell.setAttribute('aria-label',`${extension.shape==='straight'?'直線延長':'曲げ延長'}。タップで編集、長押しで移動`);cell.innerHTML=`<span class="ai-formal-chip extension">${extensionPortHtml(extension)}<b>${extension.shape==='straight'?'直線延長':'曲げ延長'}</b><small>${esc(extension.id)}</small><small class="ai-rotation">${extension.rotation}°</small></span>`;bindCellInteraction(cell,()=>{if(!moveContext)openExistingExtensionConfig(extension.id);},()=>beginMove('extension',extension.id));}
      else{cell.innerHTML='<span class="ai-formal-add">＋</span>';cell.setAttribute('aria-label',`空きセル ${x+1},${y+1}`);if(moveContext){cell.classList.add('ai-move-target');if(moveContext.destination?.x===x&&moveContext.destination?.y===y)cell.classList.add('ai-move-preview-target');cell.onclick=()=>previewMoveDestination(x,y);}else cell.onclick=()=>openCandidates({x,y});}
      ui.board.appendChild(cell);
    }
    ui.undo.disabled=!activeSession.canUndo();ui.redo.disabled=!activeSession.canRedo();renderValidationState(evaluation);renderMovePreview();if(moveContext)ui.state.textContent=moveContext.destination?'移動プレビューを確認して「この位置へ移動」を押してください。':'移動先の空きマスをタップしてください。';const catalogWarnings=Array.isArray(catalog?.warnings)?catalog.warnings:[],hasDefinitions=!!(catalog&&definitions(catalog).length);ui.catalogNotice.classList.toggle('hidden',hasDefinitions&&!catalogWarnings.length);ui.catalogNotice.textContent=!hasDefinitions?'正式AI MasterがGameデータに未配置です。Studioの「Gameデータ配置」後に候補が表示されます。':catalogWarnings.length?'AI Masterは読込済みですが、一部の参照カタログを取得できません。必須候補が空の場合は再読込してください。':'';
  }
  function renderCandidateTabs(){const entries=Object.entries(CATEGORY_LABEL).filter(([key])=>!(candidateContext?.replaceInstanceId&&key==='extension'));if(!entries.some(([key])=>key===currentCategory))currentCategory='condition';ui.candidateTabs.innerHTML=entries.map(([key,label])=>`<button type="button" data-ai-category="${key}" class="${currentCategory===key?'active':''}">${label}</button>`).join('');ui.candidateTabs.querySelectorAll('[data-ai-category]').forEach(btn=>btn.onclick=()=>{currentCategory=btn.dataset.aiCategory;renderCandidateTabs();renderCandidateList();});}
  function renderCandidateList(){
    const q=String(ui.candidateSearch.value||'').trim().toLowerCase();
    if(currentCategory==='extension'){
      const rows=[{shape:'straight',name:'直線延長',description:'向かい合う2方向をまっすぐ接続します。'},{shape:'corner',name:'曲げ延長',description:'90°曲げて経路を接続します。'}].filter(row=>!q||`${row.name} ${row.description}`.toLowerCase().includes(q));
      ui.candidateList.innerHTML=rows.map(row=>`<button type="button" class="ai-candidate-card extension" data-ai-extension-shape="${row.shape}"><span class="ai-candidate-name">${row.name}</span><span class="ai-candidate-desc">${row.description}</span><span class="ai-candidate-meta">Layout専用 / Runtime命令にはなりません</span></button>`).join('');ui.candidateEmpty.classList.toggle('hidden',rows.length>0);ui.candidateEmpty.textContent='条件に一致する延長パネルがありません。';ui.candidateList.querySelectorAll('[data-ai-extension-shape]').forEach(btn=>btn.onclick=()=>openExtensionConfig({mode:'new',x:candidateContext.x,y:candidateContext.y,shape:btn.dataset.aiExtensionShape,rotation:0}));return;
    }
    const rows=definitions(catalog).filter(row=>row.node_type===currentCategory&&(!q||[row.id,row.name,row.description,...(row.tags||[])].join(' ').toLowerCase().includes(q)));ui.candidateList.innerHTML=rows.map(row=>{const fields=Adapter.inputDescriptors(row,catalog?.refs||{}),req=fields.filter(f=>f.required).map(f=>f.label).join(' / ');return `<button type="button" class="ai-candidate-card ${esc(row.node_type)}" data-ai-master="${esc(row.id)}"><span class="ai-candidate-name">${esc(row.name)}</span><span class="ai-candidate-desc">${esc(row.description||'')}</span><span class="ai-candidate-meta">${req?`必須: ${esc(req)}`:'設定なし'} / ${row.node_type==='condition'?'TRUE・FALSE':row.node_type==='action'?'終端':'出口1'}</span></button>`;}).join('');ui.candidateEmpty.classList.toggle('hidden',rows.length>0);ui.candidateEmpty.textContent=definitions(catalog).length?'条件に一致するチップがありません。':'正式AI MasterがGameデータに配置されていません。';ui.candidateList.querySelectorAll('[data-ai-master]').forEach(btn=>btn.onclick=()=>{const def=definitionById(catalog,btn.dataset.aiMaster);if(!def)return;if(candidateContext?.replaceInstanceId)openConfig(def,{mode:'replace',instanceId:candidateContext.replaceInstanceId},{});else openNewConfig(btn.dataset.aiMaster);});
  }
  function showScreen(screen){ui.candidate.classList.toggle('open',screen==='candidate');ui.config.classList.toggle('open',screen==='config');ui.preset.classList.toggle('open',screen==='preset');}
  function openCandidates(context){candidateContext=context;currentCategory='condition';ui.candidateSearch.value='';renderCandidateTabs();renderCandidateList();showScreen('candidate');}
  function closeSubscreen(){showScreen('board');configContext=null;candidateContext=null;}
  function valuesFromForm(){const out={};ui.configBody.querySelectorAll('[data-ai-param]').forEach(el=>{if(el.type==='number')out[el.dataset.aiParam]=el.value===''?'':Number(el.value);else out[el.dataset.aiParam]=el.value;});return out;}
  function extensionValuesFromForm(){const shape=ui.configBody.querySelector('[data-ai-extension-field="shape"]')?.value||'',rotation=Number(ui.configBody.querySelector('[data-ai-extension-field="rotation"]')?.value||0);return{shape,rotation};}
  function renderConfigValidation(def){
    const values=valuesFromForm(),errors=activeSession.parameterErrors(def,values);ui.configErrors.innerHTML=errors.map(e=>`<div>${esc(e)}</div>`).join('');ui.configApply.disabled=errors.length>0;ui.configPreview.textContent='';
    if(!errors.length&&configContext?.mode==='new'){try{const preview=activeSession.previewNode(def.id,values,configContext.x,configContext.y,0);ui.configPreview.textContent=previewSummary(preview,preview.preview_id);}catch(error){ui.configPreview.textContent=String(error?.message||error);ui.configApply.disabled=true;}}
  }
  function renderExtensionConfigValidation(){const values=extensionValuesFromForm();ui.configErrors.textContent='';ui.configApply.disabled=false;ui.configPreview.textContent='';try{if(configContext?.mode==='new'){const preview=activeSession.previewExtension(values.shape,configContext.x,configContext.y,values.rotation);ui.configPreview.textContent=previewSummary(preview,preview.preview_id);}}catch(error){ui.configErrors.textContent=String(error?.message||error);ui.configApply.disabled=true;}}
  function fieldHtml(field,value){const required=field.required?' <span class="required">必須</span>':'';if(field.ref_kind||field.options.length){const options=['<option value="">選択してください</option>',...field.options.map(o=>`<option value="${esc(o.id)}" ${String(value??'')===String(o.id)?'selected':''}>${esc(o.name)}</option>`)].join(''),empty=field.options.length===0?'<small class="ai-ref-empty">正式データ未登録</small>':'';return `<label class="ai-param-field"><span>${esc(field.label)}${required}</span><select data-ai-param="${esc(field.name)}" ${field.required&&field.options.length===0?'disabled':''}>${options}</select>${empty}</label>`;}if(field.type==='number'||field.type==='integer')return `<label class="ai-param-field"><span>${esc(field.label)}${required}</span><input data-ai-param="${esc(field.name)}" type="number" ${field.minimum!=null?`min="${field.minimum}"`:''} ${field.maximum!=null?`max="${field.maximum}"`:''} ${field.type==='integer'?'step="1"':'step="any"'} value="${esc(value??'')}"></label>`;return `<label class="ai-param-field"><span>${esc(field.label)}${required}</span><input data-ai-param="${esc(field.name)}" value="${esc(value??'')}"></label>`;}
  function openConfig(def,context,values){configContext={kind:'node',...context,masterId:def.id};ui.configTitle.textContent=def.name;ui.configPort.textContent=def.node_type==='condition'?'入口1 / TRUE / FALSE':def.node_type==='action'?'入口1 / 終端':'入口1 / 出口1';ui.configBody.innerHTML=activeSession.descriptors(def).length?activeSession.descriptors(def).map(field=>fieldHtml(field,values?.[field.name])).join(''):'<div class="ai-no-params">このチップに設定項目はありません。</div>';ui.configDelete.classList.toggle('hidden',context.mode==='new');ui.configReplace.classList.toggle('hidden',context.mode==='new');ui.configRotate.classList.toggle('hidden',context.mode==='new');ui.configMove.classList.toggle('hidden',context.mode!=='existing');ui.configApply.textContent=context.mode==='new'?'配置する':'設定を反映';ui.configBody.querySelectorAll('[data-ai-param]').forEach(el=>{el.oninput=()=>renderConfigValidation(def);el.onchange=()=>renderConfigValidation(def);});renderConfigValidation(def);showScreen('config');}
  function openExtensionConfig(context,extension){configContext={kind:'extension',...context,extensionId:context.extensionId||extension?.id||''};const shape=context.shape||extension?.shape||'straight',rotation=Number(context.rotation??extension?.rotation??0);ui.configTitle.textContent=shape==='straight'?'直線延長':'曲げ延長';ui.configPort.textContent='入口1 / 出口1 / Layout専用';ui.configBody.innerHTML=`<label class="ai-param-field"><span>形状</span><select data-ai-extension-field="shape"><option value="straight" ${shape==='straight'?'selected':''}>直線</option><option value="corner" ${shape==='corner'?'selected':''}>曲げ</option></select></label><label class="ai-param-field"><span>向き</span><select data-ai-extension-field="rotation">${[0,90,180,270].map(v=>`<option value="${v}" ${v===rotation?'selected':''}>${v}°</option>`).join('')}</select></label>`;ui.configDelete.classList.toggle('hidden',context.mode==='new');ui.configReplace.classList.add('hidden');ui.configRotate.classList.toggle('hidden',context.mode==='new');ui.configMove.classList.toggle('hidden',context.mode!=='existing');ui.configApply.textContent=context.mode==='new'?'配置する':'設定を反映';ui.configBody.querySelectorAll('[data-ai-extension-field]').forEach(el=>{el.oninput=renderExtensionConfigValidation;el.onchange=renderExtensionConfigValidation;});renderExtensionConfigValidation();showScreen('config');}
  function openNewConfig(masterId){const def=definitionById(catalog,masterId);if(!def)return;openConfig(def,{mode:'new',x:candidateContext.x,y:candidateContext.y},{});}
  function openExistingConfig(instanceId){const node=activeSession.program().nodes.find(row=>row.instance_id===instanceId);if(!node)return;const def=activeSession.definitionFor(node);if(!def)return;openConfig(def,{mode:'existing',instanceId},node.parameters||{});}
  function openExistingExtensionConfig(extensionId){const extension=activeSession.layout().extensions.find(row=>row.id===String(extensionId||''));if(!extension)return;openExtensionConfig({mode:'existing',extensionId:extension.id},extension);}
  function applyConfig(){
    if(!configContext)return;
    try{
      if(configContext.kind==='extension'){const values=extensionValuesFromForm();if(configContext.mode==='new')activeSession.addExtension(values.shape,configContext.x,configContext.y,values.rotation);else activeSession.updateExtension(configContext.extensionId,values.shape,values.rotation);closeSubscreen();renderBoard();return;}
      const def=definitionById(catalog,configContext.masterId);if(!def)return;const values=valuesFromForm(),errors=activeSession.parameterErrors(def,values);if(errors.length)return;if(configContext.mode==='new')activeSession.add(def.id,values,configContext.x,configContext.y);else if(configContext.mode==='replace')activeSession.replace(configContext.instanceId,def.id,values);else activeSession.updateParameters(configContext.instanceId,values);closeSubscreen();renderBoard();
    }catch(error){notify(String(error?.message||error),'bad');}
  }
  function replaceExisting(){if(configContext?.kind!=='node'||!configContext?.instanceId)return;const node=activeSession.program().nodes.find(row=>row.instance_id===configContext.instanceId);if(!node)return;const chip=activeSession.layout().chips.find(row=>row.instance_id===node.instance_id);candidateContext={x:chip?.x||0,y:chip?.y||0,replaceInstanceId:node.instance_id};ui.candidateSearch.value='';currentCategory=node.node_type;renderCandidateTabs();renderCandidateList();showScreen('candidate');}
  function beginMove(kind,id){if(!activeSession||moveContext)return;moveContext={kind:kind==='extension'?'extension':'node',id:String(id||''),destination:null,evaluation:null};configContext=null;candidateContext=null;showScreen('board');renderBoard();}
  function startMoveFromConfig(){if(!configContext||configContext.mode!=='existing')return;beginMove(configContext.kind==='extension'?'extension':'node',configContext.kind==='extension'?configContext.extensionId:configContext.instanceId);}
  function previewMoveDestination(x,y){if(!moveContext)return;try{const evaluation=moveContext.kind==='extension'?activeSession.previewMoveExtension(moveContext.id,x,y):activeSession.previewMoveNode(moveContext.id,x,y);moveContext={...moveContext,destination:{x,y},evaluation};renderBoard();}catch(error){notify(String(error?.message||error),'bad');}}
  function commitMove(){if(!moveContext?.destination)return;try{const{x,y}=moveContext.destination;if(moveContext.kind==='extension')activeSession.moveExtension(moveContext.id,x,y);else activeSession.moveNode(moveContext.id,x,y);moveContext=null;renderBoard();}catch(error){notify(String(error?.message||error),'bad');}}
  function cancelMove(){moveContext=null;renderBoard();}

  function presetDocuments(preset){
    const currentProgram=activeSession.program(),currentLayout=activeSession.layout();
    const sourceProgram=Program.normalizeProgram(clone(preset?.program)),sourceLayout=Layout.normalizeLayout(clone(preset?.layout));
    if(!sourceProgram.id||!sourceLayout.layout_id)throw new Error('PresetのProgram/Layoutが不正です。');
    sourceProgram.id=currentProgram.id;sourceProgram.name=currentProgram.name;sourceProgram.version=currentProgram.version;sourceProgram.status='draft';sourceProgram.compiled=null;
    sourceLayout.layout_id=currentLayout.layout_id;sourceLayout.program_id=sourceProgram.id;
    return {program:sourceProgram,layout:sourceLayout};
  }
  function officialPresets(){return clone(catalog?.official_presets||[]);}
  function renderPresetScreen(){
    const official=officialPresets();
    ui.presetOfficial.innerHTML=official.length?official.map(row=>`<div class="ai-preset-card"><div><b>${esc(row.name)}</b>${row.description?`<small>${esc(row.description)}</small>`:''}</div><button type="button" data-ai-official-load="${esc(row.preset_id)}">読込</button></div>`).join(''):'<div class="ai-candidate-empty">公式プリセットは正式データ未登録です。</div>';
    ui.presetUser.innerHTML=userPresets.length?userPresets.map(row=>`<div class="ai-preset-card"><div><b>${esc(row.name)}</b><small>自作プリセット</small></div><div class="ai-preset-actions"><button type="button" data-ai-user-load="${esc(row.preset_id)}">読込</button><button type="button" data-ai-user-duplicate="${esc(row.preset_id)}">複製</button><button type="button" data-ai-user-rename="${esc(row.preset_id)}">名前変更</button><button type="button" class="danger" data-ai-user-delete="${esc(row.preset_id)}">削除</button></div></div>`).join(''):'<div class="ai-candidate-empty">自作プリセットはありません。</div>';
    ui.presetOfficial.querySelectorAll('[data-ai-official-load]').forEach(btn=>btn.onclick=()=>loadPreset(official.find(row=>row.preset_id===btn.dataset.aiOfficialLoad)));
    ui.presetUser.querySelectorAll('[data-ai-user-load]').forEach(btn=>btn.onclick=()=>loadPreset(userPresets.find(row=>row.preset_id===btn.dataset.aiUserLoad)));
    ui.presetUser.querySelectorAll('[data-ai-user-duplicate]').forEach(btn=>btn.onclick=()=>presetAction('duplicate',btn.dataset.aiUserDuplicate));
    ui.presetUser.querySelectorAll('[data-ai-user-rename]').forEach(btn=>btn.onclick=()=>presetAction('rename',btn.dataset.aiUserRename));
    ui.presetUser.querySelectorAll('[data-ai-user-delete]').forEach(btn=>btn.onclick=()=>presetAction('delete',btn.dataset.aiUserDelete));
  }
  function openPresets(){renderPresetScreen();showScreen('preset');}
  function loadPreset(preset){
    if(!preset)return;
    try{const docs=presetDocuments(preset);activeSession.loadDocuments(docs.program,docs.layout);showScreen('board');renderBoard();notify(`Preset「${preset.name}」を読み込みました。Undoで戻せます。`,'ok');}
    catch(error){notify(String(error?.message||error),'bad');}
  }
  async function presetAction(action,presetId){
    if(typeof presetHandler!=='function')return;
    try{
      let payload={action,preset_id:presetId};
      if(action==='create'){
        const evaluation=activeSession.evaluate();renderValidationState(evaluation);if(!evaluation.valid){notify('保存不可エラーがあるためPreset化できません。','bad');return;}
        const name=prompt('Preset名を入力してください。',`${activeCharacter?.name||'冒険者'} AI`);if(!name)return;
        payload={action,name,program:clone(evaluation.program),layout:clone(evaluation.layout)};
      }else if(action==='rename'){
        const current=userPresets.find(row=>row.preset_id===presetId),name=prompt('新しいPreset名を入力してください。',current?.name||'');if(!name)return;payload.name=name;
      }else if(action==='duplicate'){
        const current=userPresets.find(row=>row.preset_id===presetId),name=prompt('複製後のPreset名を入力してください。',`${current?.name||'Preset'} のコピー`);if(!name)return;payload.name=name;
      }else if(action==='delete'&&!confirm('この自作Presetを削除しますか？'))return;
      const result=await presetHandler(payload);userPresets=clone(result?.presets||userPresets);renderPresetScreen();notify(action==='delete'?'Presetを削除しました。':'Presetを保存しました。','ok');
    }catch(error){notify(String(error?.message||error),'bad');}
  }
  async function saveCurrent(){if(!activeSession||typeof saveHandler!=='function')return;const evaluation=activeSession.evaluate();renderValidationState(evaluation);if(!evaluation.valid){notify('AIに保存不可エラーがあります。','bad');return;}try{ui.save.disabled=true;const result=await saveHandler({character:clone(activeCharacter),program:clone(evaluation.program),layout:clone(evaluation.layout),validation:clone(evaluation),projectData:projectData(catalog)});if(result?.program&&result?.layout)activeSession.replaceDocuments(result.program,result.layout);renderBoard();notify('AIを保存しました。','ok');}catch(error){renderBoard();notify(String(error?.message||error),'bad');}}
  function jumpToIssue(){if(!lastEvaluation?.issues?.length)return;const rows=lastEvaluation.issues.filter(row=>row.node_id||row.target_node_id||row.extension_id);if(!rows.length)return;const row=rows[issueCursor%rows.length];issueCursor=(issueCursor+1)%rows.length;const id=String(row.node_id||row.target_node_id||row.extension_id),cell=[...ui.board.querySelectorAll('[data-node-id],[data-extension-id]')].find(el=>el.dataset.nodeId===id||el.dataset.extensionId===id);if(cell){cell.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});cell.focus();}}
  async function open(options){const opts=options||{};moveContext=null;activeCharacter=opts.character||null;notify=typeof opts.notify==='function'?opts.notify:()=>{};saveHandler=typeof opts.onSave==='function'?opts.onSave:null;presetHandler=typeof opts.onPresetAction==='function'?opts.onPresetAction:null;userPresets=clone(opts.userPresets||[]);if(!activeCharacter)return;if(!ui)bindDom();ui.title.textContent=`${activeCharacter.name||'冒険者'} — AIチップ編集`;ui.overlay.classList.add('open');ui.overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';ui.state.textContent='正式AI Masterを読込中…';try{catalog=await Catalog.load({aiUrl:opts.aiUrl,skillUrl:opts.skillUrl,templateUrl:opts.templateUrl,tags:opts.tags,tag_categories:opts.tag_categories});}catch(error){catalog=Catalog.normalize([],[],[],[]);notify(String(error?.message||error),'bad');}const key=String(activeCharacter.id||'default');if(!sessions.has(key))sessions.set(key,createSession(catalog,{program:opts.program,layout:opts.layout,program_id:`AIP-DRAFT-${key.replace(/[^A-Za-z0-9_.-]/g,'_')}`,layout_id:'AIL-0001',name:`${activeCharacter.name||''} AI`}));activeSession=sessions.get(key);activeSession.setCatalog?.(catalog);issueCursor=0;renderBoard();}
  function close(){if(!ui)return;moveContext=null;if(ui.movePreview)ui.movePreview.classList.add('hidden');showScreen('board');ui.overlay.classList.remove('open');ui.overlay.setAttribute('aria-hidden','true');document.body.style.overflow='';activeCharacter=null;activeSession=null;saveHandler=null;presetHandler=null;userPresets=[];}
  function resetSessions(characterId){if(characterId!=null)sessions.delete(String(characterId));else sessions.clear();}
  function bindDom(){
    const $=id=>document.getElementById(id);
    ui={
      overlay:$('aiEditor'),title:$('aiEditorTitle'),state:$('aiEditorState'),board:$('aiBoard'),boardWrap:$('aiBoard')?.parentElement,catalogNotice:$('aiCatalogNotice'),
      close:$('aiEditorClose'),save:$('aiEditorSave'),undo:$('aiUndo'),redo:$('aiRedo'),clear:$('aiClear'),issueJump:$('aiIssueJump'),
      presetOpen:$('aiPresetOpen'),preset:$('aiPresetScreen'),presetBack:$('aiPresetBack'),presetCreate:$('aiPresetCreate'),presetOfficial:$('aiPresetOfficial'),presetUser:$('aiPresetUser'),
      candidate:$('aiCandidateScreen'),candidateBack:$('aiCandidateBack'),candidateSearch:$('aiCandidateSearch'),candidateTabs:$('aiCandidateTabs'),candidateList:$('aiCandidateList'),candidateEmpty:$('aiCandidateEmpty'),
      config:$('aiConfigScreen'),configBack:$('aiConfigBack'),configTitle:$('aiConfigTitle'),configPort:$('aiConfigPort'),configBody:$('aiConfigBody'),configErrors:$('aiConfigErrors'),configPreview:$('aiConfigPreview'),
      configApply:$('aiConfigApply'),configDelete:$('aiConfigDelete'),configReplace:$('aiConfigReplace'),configRotate:$('aiConfigRotate'),configMove:$('aiConfigMove'),
      movePreview:$('aiMovePreview'),movePreviewText:$('aiMovePreviewText'),moveCommit:$('aiMoveCommit'),moveCancel:$('aiMoveCancel')
    };
    ui.close.onclick=close;
    ui.save.onclick=saveCurrent;
    ui.undo.onclick=()=>{moveContext=null;if(activeSession?.undo())renderBoard();};
    ui.redo.onclick=()=>{moveContext=null;if(activeSession?.redo())renderBoard();};
    ui.clear.onclick=()=>{if(activeSession&&confirm('編集中の盤面をすべて消去しますか？')){moveContext=null;activeSession.clear();renderBoard();}};
    ui.issueJump.onclick=jumpToIssue;
    ui.presetOpen.onclick=openPresets;
    ui.presetBack.onclick=closeSubscreen;
    ui.presetCreate.onclick=()=>presetAction('create');
    ui.candidateBack.onclick=closeSubscreen;
    ui.candidateSearch.oninput=renderCandidateList;
    ui.configBack.onclick=()=>{if(configContext?.mode==='new'||configContext?.mode==='replace')showScreen('candidate');else closeSubscreen();};
    ui.configApply.onclick=applyConfig;
    ui.configDelete.onclick=()=>{
      if(configContext?.kind==='extension'&&configContext.extensionId&&confirm('この延長パネルを削除しますか？')){activeSession.removeExtension(configContext.extensionId);closeSubscreen();renderBoard();return;}
      if(configContext?.instanceId&&confirm('このチップを削除しますか？')){activeSession.remove(configContext.instanceId);closeSubscreen();renderBoard();}
    };
    ui.configReplace.onclick=replaceExisting;
    ui.configRotate.onclick=()=>{
      if(configContext?.kind==='extension'&&configContext.extensionId&&activeSession.rotateExtension(configContext.extensionId,90)){closeSubscreen();renderBoard();return;}
      if(configContext?.instanceId&&activeSession.rotate(configContext.instanceId,90)){closeSubscreen();renderBoard();}
    };
    ui.configMove.onclick=startMoveFromConfig;
    ui.moveCommit.onclick=commitMove;
    ui.moveCancel.onclick=cancelMove;
  }
  return Object.freeze({CATEGORY_LABEL,createSession,definitions,definitionById,projectData,open,close,resetSessions});
});
