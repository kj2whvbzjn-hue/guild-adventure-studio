(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIMasterAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATEGORY_TYPE = Object.freeze({ai_conditions: 'condition', ai_targets: 'target', ai_actions: 'action'});
  const TYPE_PREFIX = Object.freeze({condition: 'AIC-', target: 'AIT-', action: 'AIA-'});
  const ACTIVE_STATUS = new Set(['active', 'approved']);
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function isAICategory(category) { return Object.prototype.hasOwnProperty.call(CATEGORY_TYPE, category); }
  function defaultPorts(type) {
    const input = [{id: 'in', kind: 'flow', data_type: 'flow'}];
    if (type === 'condition') return {inputs: input, outputs: [{id: 'true', kind: 'flow', data_type: 'flow'}, {id: 'false', kind: 'flow', data_type: 'flow'}]};
    if (type === 'target') return {inputs: input, outputs: [{id: 'next', kind: 'flow', data_type: 'flow'}]};
    if (type === 'action') return {inputs: input, outputs: []};
    return {inputs: input, outputs: []};
  }
  function formalStatus(status) {
    if (status === 'approved') return 'active';
    if (status === 'archived') return 'deprecated';
    return ['draft', 'active', 'deprecated', 'disabled'].includes(status) ? status : 'draft';
  }
  function toNode(master, category) {
    const source = master && typeof master === 'object' ? master : {};
    const type = CATEGORY_TYPE[category] || source.node_type || '';
    return {
      id: String(source.id || ''), name: String(source.name || ''), node_type: type,
      status: formalStatus(source.status), data_version: String(source.data_version || '1.0.0'),
      description: String(source.description || ''), tags: Array.isArray(source.tags) ? clone(source.tags) : [],
      evaluator: String(source.evaluator || `${type}.unconfigured`),
      ports: clone(source.ports || defaultPorts(type)),
      parameter_schema: clone(source.parameter_schema || {type: 'object', properties: {}, required: [], additionalProperties: false}),
      unlock: clone(source.unlock || {})
    };
  }
  function definitionErrors(node) {
    const errors = [];
    if (!TYPE_PREFIX[node.node_type] || !node.id.startsWith(TYPE_PREFIX[node.node_type])) errors.push('IDとAI部品種別が一致しません。');
    if (!node.name) errors.push('名称が必要です。');
    if (!node.evaluator || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(node.evaluator)) errors.push('評価器IDが不正です。');
    if (!node.parameter_schema || node.parameter_schema.type !== 'object' || typeof node.parameter_schema.properties !== 'object') errors.push('パラメータSchemaはobjectである必要があります。');
    const inputs = Array.isArray(node.ports?.inputs) ? node.ports.inputs : [];
    const outputs = Array.isArray(node.ports?.outputs) ? node.ports.outputs : [];
    if (inputs.length !== 1 || inputs[0]?.id !== 'in') errors.push('入力ポートはinを1件だけ定義してください。');
    if (node.node_type === 'condition') {
      if (outputs.length !== 2 || outputs[0]?.id !== 'true' || outputs[1]?.id !== 'false') errors.push('条件部品の出力はtrue / falseの2件固定です。');
    } else if (node.node_type === 'target') {
      if (outputs.length !== 1 || outputs[0]?.id !== 'next') errors.push('対象部品の出力はnextを1件だけ定義してください。');
    } else if (node.node_type === 'action') {
      if (outputs.length !== 0) errors.push('行動部品は終端のため出力ポートを定義できません。');
    }
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
  function inputDescriptors(node, refs) {
    const required = new Set(node.parameter_schema?.required || []), properties = node.parameter_schema?.properties || {};
    return Object.entries(properties).map(([name, schema]) => {
      const refKind = schema.ref_kind || schema['x-ref-kind'] || '';
      const options = refKind === 'tag' ? (refs?.tags || []) : refKind === 'skill' ? (refs?.skills || []) : (schema.enum || []);
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
  return Object.freeze({CATEGORY_TYPE, isAICategory, toNode, definitionErrors, isAvailable, palette, inputDescriptors, validateParameters});
});
