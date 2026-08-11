(function (root, factory) {
  const adapter = typeof module === 'object' && module.exports ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter;
  const api = factory(adapter, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProductionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Adapter, root) {
  'use strict';
  let selected = null, search = '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function hostData() { return root?.GKSAIProductionHost?.getData?.() || {masters: {}, tags: []}; }
  function references(data) { return {tags: data.tags || [], skills: data.masters?.skills || []}; }
  function fieldHtml(field) {
    const required = field.required ? ' required' : '';
    if (field.options.length) return `<label>${esc(field.label)}${field.required?' *':''}<select data-ai-param="${esc(field.name)}"${required}><option value="">選択してください</option>${field.options.map((option) => `<option value="${esc(option.id)}">${esc(option.name)} (${esc(option.id)})</option>`).join('')}</select>${field.ref_kind==='tag'?'<input class="ai-reference-search" type="search" placeholder="タグを検索" oninput="GKSAIProductionUI.filterReferenceOptions(this)">':''}</label>`;
    if (field.type === 'boolean') return `<label><input data-ai-param="${esc(field.name)}" type="checkbox"> ${esc(field.label)}</label>`;
    const type = field.type === 'number' || field.type === 'integer' ? 'number' : 'text';
    return `<label>${esc(field.label)}${field.required?' *':''}<input data-ai-param="${esc(field.name)}" type="${type}"${field.minimum!=null?` min="${field.minimum}"`:''}${field.maximum!=null?` max="${field.maximum}"`:''}${field.type==='integer'?' step="1"':''}${required}></label>`;
  }
  function render(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null), target = documentRef?.getElementById('aiProductionRoot');
    if (!target || !Adapter) return false;
    const data = hostData(), rows = Adapter.palette(data.masters, search, {data_version: '1.0.0', unlocked_ids: data.ai_unlocks || []});
    const chosen = selected ? rows.find((row) => row.id === selected.id && row.node_type === selected.node_type) : null;
    const fields = chosen ? Adapter.inputDescriptors(chosen, references(data)) : [];
    target.innerHTML = `<div class="ai-production-shell"><div class="ai-production-hero"><h2>AI部品パレット</h2><p>条件・対象・行動マスターを検索し、部品Schemaに従って設定します。</p><input id="aiPaletteSearch" type="search" value="${esc(search)}" placeholder="ID・名称・タグを検索" oninput="GKSAIProductionUI.setSearch(this.value)"></div><div class="ai-production-workspace"><div id="aiPaletteList" class="ai-palette-list">${rows.length?rows.map((row) => `<button type="button" class="ai-palette-item ${row.available?'':'disabled'}" ${row.available?'': 'disabled'} onclick="GKSAIProductionUI.select('${esc(row.id)}','${esc(row.node_type)}')"><b>${esc(row.name||row.id)}</b><span>${esc(row.id)} / ${esc(row.node_type)}</span><small>${esc((row.tags||[]).join(' / ')||row.status)}</small></button>`).join(''):'<div class="ai-production-boundary">一致するAI部品がありません。</div>'}</div><div id="aiParameterPanel" class="ai-parameter-panel">${chosen?`<h3>${esc(chosen.name)}</h3><p class="small">${esc(chosen.description)}</p>${fields.length?fields.map(fieldHtml).join(''):'<p>設定項目はありません。</p>'}<button type="button" onclick="GKSAIProductionUI.validateCurrent()">設定を検証</button><div id="aiParameterValidation" class="small"></div>`:'<p>有効な部品を選択してください。</p>'}</div></div></div>`;
    return true;
  }
  function setSearch(value) { search = String(value || ''); selected = null; render(); }
  function select(id, nodeType) { selected = {id, node_type: nodeType}; render(); }
  function filterReferenceOptions(input) {
    const select = input.previousElementSibling, q = String(input.value || '').toLowerCase();
    if (select) Array.from(select.options).forEach((option, index) => { if (index) option.hidden = !option.textContent.toLowerCase().includes(q); });
  }
  function validateCurrent(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null), data = hostData();
    const node = Adapter.palette(data.masters, '', {data_version:'1.0.0', unlocked_ids:data.ai_unlocks||[]}).find((row) => selected && row.id === selected.id && row.node_type === selected.node_type);
    if (!node) return ['AI部品が選択されていません。'];
    const values = {};
    documentRef?.querySelectorAll?.('[data-ai-param]').forEach((input) => { values[input.dataset.aiParam] = input.type === 'checkbox' ? input.checked : input.value; });
    const errors = Adapter.validateParameters(node, values, references(data)), output = documentRef?.getElementById('aiParameterValidation');
    if (output) output.textContent = errors.length ? errors.join(' / ') : '設定値は有効です。';
    return errors;
  }
  return Object.freeze({render, setSearch, select, filterReferenceOptions, validateCurrent});
});
