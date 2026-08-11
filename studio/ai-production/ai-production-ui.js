(function (root, factory) {
  const commonjs = typeof module === 'object' && module.exports;
  const api = factory(
    commonjs ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter,
    commonjs ? require('./ai-program-model.js') : root && root.GKSAIProgramModel,
    commonjs ? require('./ai-program-store.js') : root && root.GKSAIProgramStore,
    commonjs ? require('./ai-program-editor.js') : root && root.GKSAIProgramEditor,
    commonjs ? require('./ai-program-validator.js') : root && root.GKSAIProgramValidator,
    commonjs ? require('./ai-program-compiler.js') : root && root.GKSAIProgramCompiler,
    commonjs ? require('./ai-simulation-runner.js') : root && root.GKSAISimulationRunner,
    root
  );
  if (commonjs) module.exports = api;
  if (root) root.GKSAIProductionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Adapter, Model, Store, Editor, Validator, Compiler, Runner, root) {
  'use strict';
  let selectedPart = null, selectedNodeId = '', paletteSearch = '', programSearch = '', draft = null, original = null, editor = null, validationResult = null, compileResult = null, dirty = false, simulationResult = null, comparisonBase = null, selectedTrace = 0;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function host() { return root?.GKSAIProductionHost || {}; }
  function hostData() { return host().getData?.() || {masters: {}, tags: [], ai_programs: []}; }
  function references(data) { return {tags: data.tags || [], skills: data.masters?.skills || []}; }
  function now() { return host().now?.() || new Date().toISOString(); }
  function isDirty() { return dirty; }
  function setDraft(value) { draft = Model.normalizeProgram(value); original = clone(draft); editor = Editor.create(draft); selectedNodeId = ''; validationResult = null; compileResult = draft.compiled||null; simulationResult = null; comparisonBase = null; selectedTrace = 0; dirty = false; }
  function syncGraph() {
    if (!editor || !draft) return;
    const graph = editor.program();
    draft = {...graph,name:draft.name,status:draft.status,tags:clone(draft.tags),description:draft.description,updated_at:draft.updated_at,compiled:draft.compiled||null};
  }
  function invalidateCompiled(){if(draft)draft.compiled=null;compileResult=null;}
  function markDirty() { dirty = true; render(); }
  function fieldHtml(field) {
    const required = field.required ? ' required' : '';
    if (field.options.length) return `<label>${esc(field.label)}${field.required?' *':''}<select data-ai-param="${esc(field.name)}"${required}><option value="">選択してください</option>${field.options.map((option) => `<option value="${esc(option.id)}">${esc(option.name)} (${esc(option.id)})</option>`).join('')}</select>${field.ref_kind==='tag'?'<input class="ai-reference-search" type="search" placeholder="タグを検索" oninput="GKSAIProductionUI.filterReferenceOptions(this)">':''}</label>`;
    if (field.type === 'boolean') return `<label><input data-ai-param="${esc(field.name)}" type="checkbox"> ${esc(field.label)}</label>`;
    const type = field.type === 'number' || field.type === 'integer' ? 'number' : 'text';
    return `<label>${esc(field.label)}${field.required?' *':''}<input data-ai-param="${esc(field.name)}" type="${type}"${field.minimum!=null?` min="${field.minimum}"`:''}${field.maximum!=null?` max="${field.maximum}"`:''}${field.type==='integer'?' step="1"':''}${required}></label>`;
  }
  function programRows(data) {
    const q = programSearch.trim().toLowerCase();
    return (Array.isArray(data.ai_programs) ? data.ai_programs : []).filter((program) => !q || [program.id, program.name, program.description, ...(program.tags || [])].join(' ').toLowerCase().includes(q));
  }
  function editorHtml() {
    if (!draft) return '<div class="ai-program-editor"><p>一覧からAIプログラムを選択するか、新規作成してください。</p></div>';
    const nodeOptions = draft.nodes.map((node)=>`<option value="${esc(node.instance_id)}">${esc(node.instance_id)} / ${esc(node.master_node_id)}</option>`).join('');
    const selectedNode = draft.nodes.find((node)=>node.instance_id===selectedNodeId);
    const nodePanel = selectedNode ? `<div class="ai-node-settings"><h4>${esc(selectedNode.instance_id)} 設定</h4><label>X<input id="aiNodeX" type="number" value="${esc(selectedNode.position.x)}"></label><label>Y<input id="aiNodeY" type="number" value="${esc(selectedNode.position.y)}"></label><label>コメント<input id="aiNodeComment" value="${esc(selectedNode.comment||'')}"></label><label>パラメータJSON<textarea id="aiNodeParameters" rows="4">${esc(JSON.stringify(selectedNode.parameters,null,2))}</textarea></label><button type="button" onclick="GKSAIProductionUI.updateSelectedNode()">部品設定を反映</button></div>` : '';
    return `<div class="ai-program-editor"><div class="ai-program-toolbar"><h3>${esc(draft.id)}</h3>${dirty?'<span class="ai-unsaved">未保存</span>':'<span class="small">保存済み</span>'}</div><label>名称 *<input id="aiProgramName" value="${esc(draft.name)}" oninput="GKSAIProductionUI.updateDraft('name',this.value)"></label><label>状態<select id="aiProgramStatus" onchange="GKSAIProductionUI.updateDraft('status',this.value)">${['draft','valid','invalid','archived'].map((status)=>`<option value="${status}"${draft.status===status?' selected':''}>${status}</option>`).join('')}</select></label><label>タグ（空白またはカンマ区切り）<input id="aiProgramTags" value="${esc((draft.tags||[]).join(' '))}" oninput="GKSAIProductionUI.updateDraft('tags',this.value)"></label><label>説明<textarea id="aiProgramDescription" rows="4" oninput="GKSAIProductionUI.updateDraft('description',this.value)">${esc(draft.description)}</textarea></label><div class="ai-graph-toolbar"><b>構築</b><button type="button" onclick="GKSAIProductionUI.undoGraph()"${editor?.canUndo()?'':' disabled'}>Undo</button><button type="button" onclick="GKSAIProductionUI.redoGraph()"${editor?.canRedo()?'':' disabled'}>Redo</button></div><div class="ai-node-list">${draft.nodes.length?draft.nodes.map((node)=>`<button type="button" class="ai-node-item ${selectedNodeId===node.instance_id?'active':''}" onclick="GKSAIProductionUI.selectNode('${esc(node.instance_id)}')"><b>${esc(node.instance_id)}</b><span>${esc(node.master_node_id)} / ${esc(node.node_type)}</span><small>x:${esc(node.position.x)} y:${esc(node.position.y)}</small></button>`).join(''):'<p>パレットから部品を追加してください。</p>'}</div>${nodePanel}<div class="ai-connection-panel"><h4>接続</h4><select id="aiEdgeFromNode"><option value="">接続元</option>${nodeOptions}</select><input id="aiEdgeFromPort" value="next" placeholder="出力ポート"><select id="aiEdgeToNode"><option value="">接続先</option>${nodeOptions}</select><input id="aiEdgeToPort" value="in" placeholder="入力ポート"><button type="button" onclick="GKSAIProductionUI.connectNodes()">接続を追加</button><div class="small">${draft.edges.map((edge)=>`${esc(edge.from.node_id)}.${esc(edge.from.port_id)} → ${esc(edge.to.node_id)}.${esc(edge.to.port_id)}`).join('<br>')||'接続なし'}</div></div><div class="small">部品 ${draft.nodes.length} / 接続 ${draft.edges.length} / サブルーチン ${draft.subroutines.length}${draft.updated_at?` / 更新 ${esc(draft.updated_at)}`:''}</div><div class="ai-editor-actions"><button type="button" class="primary" onclick="GKSAIProductionUI.saveDraft()">保存</button><button type="button" onclick="GKSAIProductionUI.revertDraft()"${dirty?'':' disabled'}>変更を戻す</button><button type="button" onclick="GKSAIProductionUI.duplicateDraft()">複製</button></div></div>`;
  }
  function validationPanelHtml() {
    if(!draft)return '';
    const issues=validationResult?.issues||[],summary=validationResult?.summary||{ERROR:0,WARNING:0,INFO:0};
    return `<div class="ai-validation-panel"><div class="ai-program-toolbar"><h3>AI構成検証・コンパイル</h3><button type="button" onclick="GKSAIProductionUI.validateDraft()">構成を検証</button><button type="button" class="primary" onclick="GKSAIProductionUI.compileDraft()">実行形式を生成</button></div>${compileResult?`<p class="small">生成済み: ${esc(compileResult.content_hash)} / 命令 ${compileResult.instructions.length}件</p>`:''}${validationResult?`<p class="${validationResult.valid?'':'ai-unsaved'}">エラー ${summary.ERROR} / 警告 ${summary.WARNING} / 情報 ${summary.INFO}</p><div class="ai-issue-list">${issues.length?issues.map((row,index)=>`<button type="button" class="ai-issue-item ${row.severity.toLowerCase()}" onclick="GKSAIProductionUI.selectIssue(${index})"><b>${esc(row.severity)} / ${esc(row.code)}</b><span>${esc(row.message)}</span><small>${esc(row.node_id||row.edge_id||row.subroutine_id||'プログラム全体')}</small></button>`).join(''):'<p>問題は見つかりませんでした。</p>'}</div>`:'<p class="small">保存前に構造・参照・到達性を検査できます。</p>'}</div>`;
  }
  function simulationPanelHtml() {
    if(!draft)return '';
    const units=host().getBattleUnits?.()||[],actorOptions=units.map((unit)=>`<option value="${esc(unit.id)}">${esc(unit.name||unit.id)} / ${esc(unit.side||'')}</option>`).join(''),summary=simulationResult?.summary;
    const trace=simulationResult?.traces?.[selectedTrace],events=trace?.events||[],comparison=comparisonBase&&simulationResult?Runner.compare(comparisonBase,simulationResult):null;
    return `<div class="ai-simulation-panel"><div class="ai-program-toolbar"><h3>固定Seed試行・Trace比較</h3><button type="button" onclick="GKSAIProductionUI.setComparisonBase()"${simulationResult?'':' disabled'}>比較基準にする</button></div><p class="small">戦闘テスト欄の現在の編成を読み取り専用で使用します。既存の戦闘結果とユニットは変更しません。</p><div class="ai-simulation-controls"><label>実行ユニット<select id="aiSimulationActor"><option value="">選択してください</option>${actorOptions}</select></label><label>開始Seed<input id="aiSimulationSeed" type="number" value="0"></label><label>試行数<input id="aiSimulationTrials" type="number" min="1" max="1000" value="10"></label><label>Seed増分<input id="aiSimulationStep" type="number" min="1" value="1"></label><button type="button" class="primary" onclick="GKSAIProductionUI.runSimulation()"${compileResult&&units.length?'':' disabled'}>試行を実行</button></div>${summary?`<div class="ai-simulation-summary"><b>${summary.trials}試行 / 経路 ${summary.unique_paths}種類</b><span>結果 ${esc(JSON.stringify(summary.outcomes))}</span><span>行動 ${esc(JSON.stringify(summary.actions))}</span><span>対象 ${esc(JSON.stringify(summary.targets))}</span></div><label>Trace<select onchange="GKSAIProductionUI.selectTrace(this.value)">${simulationResult.traces.map((row,index)=>`<option value="${index}"${index===selectedTrace?' selected':''}>#${index+1} Seed ${esc(row.seed)} / ${esc(row.outcome.status)}</option>`).join('')}</select></label><div class="ai-trace-list">${events.map((row)=>`<button type="button" class="ai-trace-item" onclick="GKSAIProductionUI.selectNode('${esc(row.source_node_id)}')"><b>${row.step}. ${esc(row.event_type)} / ${esc(row.result)}</b><span>${esc(row.source_node_id)} → ${esc(row.instruction_id)}</span><small>${esc(JSON.stringify(row.details))}</small></button>`).join('')||'<p>イベントなし</p>'}</div>${comparison?`<div class="small">比較: 変更 ${comparison.changed_trials}試行 / 同一 ${comparison.unchanged_trials}試行</div>`:''}`:'<p class="small">実行後に行動分布、対象分布、経路、各ノードのTraceを表示します。</p>'}</div>`;
  }
  function render(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null), target = documentRef?.getElementById('aiProductionRoot');
    if (!target || !Adapter || !Model || !Store || !Editor || !Validator || !Compiler) return false;
    const data = hostData(); Store.normalizeProject(data);
    const programs = programRows(data);
    const rows = Adapter.palette(data.masters, paletteSearch, {data_version: Model.DATA_VERSION, unlocked_ids: data.ai_unlocks || []});
    const chosen = selectedPart ? rows.find((row) => row.id === selectedPart.id && row.node_type === selectedPart.node_type) : null;
    const fields = chosen ? Adapter.inputDescriptors(chosen, references(data)) : [];
    target.innerHTML = `<div class="ai-production-shell"><div class="ai-production-hero"><h2>AIプログラム</h2><p>プロジェクト内へ保存する編集データを作成・再編集します。部品配置と接続は次工程です。</p><div class="ai-program-toolbar"><input type="search" value="${esc(programSearch)}" placeholder="プログラムを検索" oninput="GKSAIProductionUI.setProgramSearch(this.value)"><button type="button" class="primary" onclick="GKSAIProductionUI.newProgram()">新規作成</button></div></div><div class="ai-program-layout"><div class="ai-program-list">${programs.length?programs.map((program)=>`<button type="button" class="ai-program-item ${draft?.id===program.id?'active':''}" onclick="GKSAIProductionUI.openProgram('${esc(program.id)}')"><b>${esc(program.name||program.id)}</b><span>${esc(program.id)} / ${esc(program.status)}</span><small>${esc(program.updated_at||'未保存')}</small></button>`).join(''):'<p>AIプログラムはありません。</p>'}</div>${editorHtml()}</div><div class="ai-production-hero"><h2>AI部品パレット</h2><p>条件・対象・行動マスターを検索し、部品Schemaに従って設定します。</p><input id="aiPaletteSearch" type="search" value="${esc(paletteSearch)}" placeholder="ID・名称・タグを検索" oninput="GKSAIProductionUI.setSearch(this.value)"></div><div class="ai-production-workspace"><div id="aiPaletteList" class="ai-palette-list">${rows.length?rows.map((row) => `<button type="button" class="ai-palette-item ${row.available?'':'disabled'}" ${row.available?'': 'disabled'} onclick="GKSAIProductionUI.select('${esc(row.id)}','${esc(row.node_type)}')"><b>${esc(row.name||row.id)}</b><span>${esc(row.id)} / ${esc(row.node_type)}</span><small>${esc((row.tags||[]).join(' / ')||row.status)}</small></button>`).join(''):'<div class="ai-production-boundary">一致するAI部品がありません。</div>'}</div><div id="aiParameterPanel" class="ai-parameter-panel">${chosen?`<h3>${esc(chosen.name)}</h3><p class="small">${esc(chosen.description)}</p>${fields.length?fields.map(fieldHtml).join(''):'<p>設定項目はありません。</p>'}<button type="button" onclick="GKSAIProductionUI.validateCurrent()">設定を検証</button><div id="aiParameterValidation" class="small"></div>`:'<p>有効な部品を選択してください。</p>'}</div></div></div>`;
    target.innerHTML = target.innerHTML.replace('プロジェクト内へ保存する編集データを作成・再編集します。部品配置と接続は次工程です。','部品を配置・接続し、Undo/Redoで構築履歴を戻せます。').replace('<button type="button" onclick="GKSAIProductionUI.validateCurrent()">設定を検証</button>',`<button type="button" onclick="GKSAIProductionUI.validateCurrent()">設定を検証</button>${draft?'<button type="button" class="primary" onclick="GKSAIProductionUI.addSelectedPart()">プログラムへ追加</button>':''}`);
    target.innerHTML += validationPanelHtml()+simulationPanelHtml();
    return true;
  }
  function refresh() { if (typeof document !== 'undefined' && document.getElementById('view-ai-production')?.classList.contains('hidden') === false) render(); }
  function setSearch(value) { paletteSearch = String(value || ''); selectedPart = null; render(); }
  function setProgramSearch(value) { programSearch = String(value || ''); render(); }
  function select(id, nodeType) { selectedPart = {id, node_type: nodeType}; render(); }
  function newProgram() { if (dirty && root?.confirm && !root.confirm('未保存の変更を破棄して新規作成しますか？')) return false; const data = hostData(); setDraft(Model.createProgram(Store.nextProgramId(data), now())); dirty = true; render(); return clone(draft); }
  function openProgram(id) { if (dirty && root?.confirm && !root.confirm('未保存の変更を破棄して開きますか？')) return false; const found = hostData().ai_programs?.find((program)=>program.id===id); if (!found) return false; setDraft(found); render(); return true; }
  function updateDraft(field, value) { if (!draft) return false; draft[field] = field === 'tags' ? String(value||'').split(/[\s,]+/).filter(Boolean) : String(value ?? ''); validationResult=null; dirty = true; return true; }
  function saveDraft() { if (!draft) return false; syncGraph(); if (!draft.name.trim()) { root?.alert?.('名称を入力してください。'); return false; } draft.updated_at = now(); Store.upsert(hostData(), draft); setDraft(draft); host().persist?.(`AIプログラム保存: ${draft.id}`); render(); return true; }
  function revertDraft() { if (!original) return false; setDraft(original); render(); return true; }
  function duplicateDraft() { if (!draft) return false; const copy = Model.duplicateProgram(draft, Store.nextProgramId(hostData()), now()); setDraft(copy); dirty = true; render(); return clone(copy); }
  function filterReferenceOptions(input) { const selectElement = input.previousElementSibling, q = String(input.value || '').toLowerCase(); if (selectElement) Array.from(selectElement.options).forEach((option, index) => { if (index) option.hidden = !option.textContent.toLowerCase().includes(q); }); }
  function selectedDefinition() { const data=hostData(); return Adapter.palette(data.masters,'',{data_version:Model.DATA_VERSION,unlocked_ids:data.ai_unlocks||[]}).find((row)=>selectedPart&&row.id===selectedPart.id&&row.node_type===selectedPart.node_type); }
  function readParameters(doc, node) {
    const documentRef=doc||(typeof document!=='undefined'?document:null), values={}, descriptors=Adapter.inputDescriptors(node,references(hostData()));
    documentRef?.querySelectorAll?.('[data-ai-param]').forEach((input)=>{ const field=descriptors.find((item)=>item.name===input.dataset.aiParam); let value=input.type==='checkbox'?input.checked:input.value; if(value!==''&&(field?.type==='number'||field?.type==='integer'))value=Number(value); values[input.dataset.aiParam]=value; });
    return values;
  }
  function addSelectedPart(doc) { const node=selectedDefinition(); if(!draft||!editor||!node)return false; const values=readParameters(doc,node),errors=Adapter.validateParameters(node,values,references(hostData())); if(errors.length){root?.alert?.(errors.join('\n'));return false;} const placed=editor.addNode(node,values,{x:(draft.nodes.length%3)*240,y:Math.floor(draft.nodes.length/3)*140}); syncGraph(); invalidateCompiled(); selectedNodeId=placed.instance_id; validationResult=null; dirty=true; render(); return placed; }
  function selectNode(id) { selectedNodeId=String(id||''); render(); }
  function updateSelectedNode(doc) { const documentRef=doc||(typeof document!=='undefined'?document:null); if(!editor||!selectedNodeId)return false; let parameters; try{parameters=JSON.parse(documentRef?.getElementById('aiNodeParameters')?.value||'{}');}catch(e){root?.alert?.('パラメータJSONが不正です。');return false;} editor.updateNode(selectedNodeId,{position:{x:Number(documentRef?.getElementById('aiNodeX')?.value)||0,y:Number(documentRef?.getElementById('aiNodeY')?.value)||0},comment:documentRef?.getElementById('aiNodeComment')?.value||'',parameters}); syncGraph(); invalidateCompiled(); validationResult=null; dirty=true; render(); return true; }
  function connectNodes(doc) { const documentRef=doc||(typeof document!=='undefined'?document:null); if(!editor)return false; try{editor.connect({node_id:documentRef?.getElementById('aiEdgeFromNode')?.value,port_id:documentRef?.getElementById('aiEdgeFromPort')?.value},{node_id:documentRef?.getElementById('aiEdgeToNode')?.value,port_id:documentRef?.getElementById('aiEdgeToPort')?.value});syncGraph();invalidateCompiled();validationResult=null;dirty=true;render();return true;}catch(e){root?.alert?.(e.message);return false;} }
  function undoGraph() { if(!editor?.undo())return false;syncGraph();invalidateCompiled();validationResult=null;dirty=true;render();return true; }
  function redoGraph() { if(!editor?.redo())return false;syncGraph();invalidateCompiled();validationResult=null;dirty=true;render();return true; }
  function validateDraft() { if(!draft)return null;syncGraph();validationResult=Validator.validate(draft,hostData());render();return validationResult; }
  async function compileDraft() { if(!draft)return null;syncGraph();try{const runtime=await Compiler.compile(draft,hostData());draft.compiled=runtime;draft.status='valid';compileResult=runtime;validationResult=Validator.validate(draft,hostData());dirty=true;render();return runtime;}catch(error){compileResult=null;validationResult={valid:false,issues:error.issues||[{severity:'ERROR',code:'AI_COMPILE_FAILED',message:error.message}],summary:{ERROR:(error.issues||[]).filter((row)=>row.severity==='ERROR').length||1,WARNING:0,INFO:0}};render();return null;} }
  function runSimulation(doc){const documentRef=doc||(typeof document!=='undefined'?document:null),units=host().getBattleUnits?.()||[],actorId=documentRef?.getElementById('aiSimulationActor')?.value;if(!compileResult||!actorId)return null;simulationResult=Runner.run(compileResult,{battle_id:`ai-production-${draft.id}`,tick:0,actor_id:actorId,units,mp_cost_multiplier:Number(host().getMpCostMultiplier?.())||1},{seed_start:Number(documentRef.getElementById('aiSimulationSeed')?.value)||0,trials:Number(documentRef.getElementById('aiSimulationTrials')?.value)||1,seed_step:Number(documentRef.getElementById('aiSimulationStep')?.value)||1,phase:'reservation'});selectedTrace=0;render();return clone(simulationResult);}
  function selectTrace(index){selectedTrace=Math.max(0,Math.min(Number(index)||0,(simulationResult?.traces?.length||1)-1));render();return selectedTrace;}
  function setComparisonBase(){if(!simulationResult)return false;comparisonBase=clone(simulationResult);render();return true;}
  function selectIssue(index) { const row=validationResult?.issues?.[Number(index)];if(!row)return false;if(row.node_id){selectedNodeId=row.node_id;render();}return true; }
  function validateCurrent(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null), data = hostData();
    const node = Adapter.palette(data.masters, '', {data_version:Model.DATA_VERSION, unlocked_ids:data.ai_unlocks||[]}).find((row) => selectedPart && row.id === selectedPart.id && row.node_type === selectedPart.node_type);
    if (!node) return ['AI部品が選択されていません。'];
    const values = readParameters(documentRef,node);
    const errors = Adapter.validateParameters(node, values, references(data)), output = documentRef?.getElementById('aiParameterValidation');
    if (output) output.textContent = errors.length ? errors.join(' / ') : '設定値は有効です。';
    return errors;
  }
  return Object.freeze({render, refresh, setSearch, setProgramSearch, select, selectNode, selectIssue, newProgram, openProgram, updateDraft, saveDraft, revertDraft, duplicateDraft, addSelectedPart, updateSelectedNode, connectNodes, undoGraph, redoGraph, validateDraft, compileDraft, runSimulation, selectTrace, setComparisonBase, isDirty, filterReferenceOptions, validateCurrent});
});
