(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIMasterAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = '2.0.0';
  const CATEGORY_TYPE = Object.freeze({ai_searches: 'search', ai_conditions: 'condition', ai_actions: 'action'});
  const TYPE_PREFIX = Object.freeze({search: 'AIS-', condition: 'AIC-', action: 'AIA-'});
  const TARGET_SELECTOR_CATEGORY = 'ai_target_selectors';
  const ACTIVE_STATUS = new Set(['active', 'approved']);
  const SUBJECT_KINDS = new Set(['UNIT', 'SELF', 'BATTLE']);
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function isAICategory(category) { return Object.prototype.hasOwnProperty.call(CATEGORY_TYPE, category); }
  function isTargetSelectorCategory(category) { return category === TARGET_SELECTOR_CATEGORY; }
  function defaultPorts(type) {
    const input = [{id: 'in', kind: 'flow', data_type: 'flow'}];
    if (type === 'search') return {inputs: input, outputs: [{id: 'found', kind: 'flow', data_type: 'flow'}, {id: 'not_found', kind: 'flow', data_type: 'flow'}]};
    if (type === 'condition') return {inputs: input, outputs: [{id: 'true', kind: 'flow', data_type: 'flow'}, {id: 'false', kind: 'flow', data_type: 'flow'}]};
    if (type === 'action') return {inputs: input, outputs: []};
    return {inputs: input, outputs: []};
  }
  function formalStatus(status) {
    if (status === 'approved') return 'active';
    if (status === 'archived') return 'deprecated';
    return ['draft', 'active', 'deprecated', 'disabled'].includes(status) ? status : 'draft';
  }
  function normalizeSubjectKinds(value) {
    return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter((item) => SUBJECT_KINDS.has(item)))];
  }
  function toNode(master, category) {
    const source = master && typeof master === 'object' ? master : {};
    const type = CATEGORY_TYPE[category] || source.node_type || '';
    const node = {
      schema_version: SCHEMA_VERSION,
      id: String(source.id || ''), name: String(source.name || ''), node_type: type,
      status: formalStatus(source.status), data_version: String(source.data_version || ''),
      description: String(source.description || ''), tags: Array.isArray(source.tags) ? clone(source.tags) : [],
      evaluator: String(source.evaluator || `${type}.unconfigured`),
      ports: clone(source.ports || defaultPorts(type)),
      parameter_schema: clone(source.parameter_schema || {type: 'object', properties: {}, required: [], additionalProperties: false}),
      unlock: clone(source.unlock || {})
    };
    if (type === 'condition') node.supported_subject_kind = normalizeSubjectKinds(source.supported_subject_kind);
    return node;
  }
  function toTargetSelector(master) {
    const source = master && typeof master === 'object' ? master : {};
    return {
      schema_version: SCHEMA_VERSION,
      id: String(source.id || ''),
      name: String(source.name || ''),
      evaluator: String(source.evaluator || 'selector.unconfigured'),
      parameter_schema: clone(source.parameter_schema || {type: 'object', properties: {}, required: [], additionalProperties: false}),
      tags: Array.isArray(source.tags) ? clone(source.tags) : [],
      enabled: source.enabled === true
    };
  }
  function definitionErrors(node) {
    const errors = [];
    if (node.schema_version !== SCHEMA_VERSION) errors.push(`schema_versionは${SCHEMA_VERSION}固定です。`);
    if (!TYPE_PREFIX[node.node_type] || !node.id.startsWith(TYPE_PREFIX[node.node_type])) errors.push('IDとAI部品種別が一致しません。');
    if (!node.name) errors.push('名称が必要です。');
    if (!node.data_version) errors.push('data_versionが必要です。');
    if (!node.evaluator || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(node.evaluator)) errors.push('評価器IDが不正です。');
    if (!node.parameter_schema || node.parameter_schema.type !== 'object' || typeof node.parameter_schema.properties !== 'object') errors.push('パラメータSchemaはobjectである必要があります。');
    const inputs = Array.isArray(node.ports?.inputs) ? node.ports.inputs : [];
    const outputs = Array.isArray(node.ports?.outputs) ? node.ports.outputs : [];
    if (inputs.length !== 1 || inputs[0]?.id !== 'in') errors.push('入力ポートはinを1件だけ定義してください。');
    if (node.node_type === 'search') {
      if (outputs.length !== 2 || outputs[0]?.id !== 'found' || outputs[1]?.id !== 'not_found') errors.push('探索部品の出力はfound / not_foundの2件固定です。');
    } else if (node.node_type === 'condition') {
      if (outputs.length !== 2 || outputs[0]?.id !== 'true' || outputs[1]?.id !== 'false') errors.push('状態確認部品の出力はtrue / falseの2件固定です。');
      const kinds = normalizeSubjectKinds(node.supported_subject_kind);
      if (!kinds.length || kinds.length !== (Array.isArray(node.supported_subject_kind) ? node.supported_subject_kind.length : 0)) errors.push('AIC Predicateはsupported_subject_kindをUNIT / SELF / BATTLEから1件以上宣言してください。');
    } else if (node.node_type === 'action') {
      if (outputs.length !== 0) errors.push('行動部品は終端のため出力ポートを定義できません。');
    }
    return errors;
  }
  function targetSelectorDefinitionErrors(selector) {
    const errors = [];
    if (selector.schema_version !== SCHEMA_VERSION) errors.push(`schema_versionは${SCHEMA_VERSION}固定です。`);
    if (!/^ATS-[A-Za-z0-9_.-]+$/.test(selector.id)) errors.push('Target Selector IDはATS-*である必要があります。');
    if (!selector.name) errors.push('名称が必要です。');
    if (!/^selector\.[A-Za-z0-9_.-]+$/.test(selector.evaluator)) errors.push('Target Selector evaluatorはselector.*である必要があります。');
    if (!selector.parameter_schema || typeof selector.parameter_schema !== 'object' || Array.isArray(selector.parameter_schema)) errors.push('parameter_schemaはobjectである必要があります。');
    if (!Array.isArray(selector.tags)) errors.push('tagsは配列である必要があります。');
    if (typeof selector.enabled !== 'boolean') errors.push('enabledはbooleanである必要があります。');
    return errors;
  }
  function isAvailable(node, context) {
    const ctx = context || {};
    if (!ACTIVE_STATUS.has(node.status)) return false;
    if (ctx.data_version && node.data_version !== ctx.data_version) return false;
    const required = Array.isArray(node.unlock?.required_ids) ? node.unlock.required_ids : [];
    const unlocked = new Set(Array.isArray(ctx.unlocked_ids) ? ctx.unlocked_ids : []);
    return required.every((id) => unlocked.has(id));
  }
  function palette(masters, query, context) {
    const q = String(query || '').trim().toLowerCase(), rows = [];
    for (const category of Object.keys(CATEGORY_TYPE)) {
      for (const master of Array.isArray(masters?.[category]) ? masters[category] : []) {
        const node = toNode(master, category);
        const text = [node.id, node.name, node.description, ...(node.tags || [])].join(' ').toLowerCase();
        if (!q || text.includes(q)) rows.push({...node, category, available: isAvailable(node, context), errors: definitionErrors(node)});
      }
    }
    return rows;
  }
  function targetSelectorPalette(masters, query) {
    const q = String(query || '').trim().toLowerCase();
    return (Array.isArray(masters?.ai_target_selectors) ? masters.ai_target_selectors : []).map(toTargetSelector).filter((selector) => {
      const text = [selector.id, selector.name, selector.evaluator, ...(selector.tags || [])].join(' ').toLowerCase();
      return !q || text.includes(q);
    }).map((selector) => ({...selector, category: TARGET_SELECTOR_CATEGORY, available: selector.enabled, errors: targetSelectorDefinitionErrors(selector)}));
  }
  function inputDescriptors(node, refs) {
    const required = new Set(node.parameter_schema?.required || []), properties = node.parameter_schema?.properties || {};
    return Object.entries(properties).map(([name, schema]) => {
      const refKind = schema.ref_kind || schema['x-ref-kind'] || '';
      const options = refKind === 'tag' ? (refs?.tags || []) : refKind === 'skill' ? (refs?.skills || []) : refKind === 'ai_target_selector' ? (refs?.ai_target_selectors || []) : (schema.enum || []);
      return {name, label: schema.title || name, type: schema.type || 'string', required: required.has(name), minimum: schema.minimum, maximum: schema.maximum, ref_kind: refKind, options: options.map((item) => typeof item === 'string' ? {id: item, name: item} : {id: item.id, name: item.name || item.id})};
    });
  }
  function validateParameters(node, values, refs) {
    const errors = [], descriptors = inputDescriptors(node, refs), input = values || {};
    for (const field of descriptors) {
      const value = input[field.name];
      if (field.required && (value === '' || value == null)) { errors.push(`${field.name}: 必須です。`); continue; }
      if (value === '' || value == null) continue;
      if (field.type === 'number' || field.type === 'integer') {
        const number = Number(value);
        if (!Number.isFinite(number) || (field.type === 'integer' && !Number.isInteger(number))) errors.push(`${field.name}: 数値型が不正です。`);
        else if (field.minimum != null && number < field.minimum) errors.push(`${field.name}: 最小値未満です。`);
        else if (field.maximum != null && number > field.maximum) errors.push(`${field.name}: 最大値超過です。`);
      }
      if (field.options.length && !field.options.some((option) => option.id === String(value))) errors.push(`${field.name}: 参照または列挙値が存在しません。`);
    }
    return errors;
  }
  return Object.freeze({SCHEMA_VERSION,CATEGORY_TYPE,TARGET_SELECTOR_CATEGORY,isAICategory,isTargetSelectorCategory,toNode,toTargetSelector,definitionErrors,targetSelectorDefinitionErrors,isAvailable,palette,targetSelectorPalette,inputDescriptors,validateParameters});
});
