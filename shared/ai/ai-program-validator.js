(function (root, factory) {
  const adapter = typeof module === 'object' && module.exports ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter;
  const api = factory(adapter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Adapter) {
  'use strict';
  if (!Adapter) throw new Error('GKSAIMasterAdapter is required');

  const SCHEMA_VERSION = '2.0.0';
  const rank = Object.freeze({ERROR: 0, WARNING: 1, INFO: 2});
  const SEARCH_SCOPES = new Set(['SELF', 'ALLY', 'OTHER_ALLY', 'ENEMY', 'ANY']);
  const AUTHORABLE_SEARCH_TARGET_SEMANTICS = new Set(['SELF', 'ALLY', 'OTHER_ALLY', 'ENEMY']);
  const STATE_SUBJECTS = new Set(['SELF', 'BATTLE']);
  const STATE_RUNTIME_SEMANTICS = new Set(['ALIVE', 'DEAD', 'HP', 'MP']);
  const STATE_NUMERIC_SEMANTICS = new Set(['HP', 'MP']);
  const STATE_VALUE_MODES = new Set(['CURRENT', 'RATIO']);
  const STATE_COMPARE_OPERATORS = new Set(['<', '<=', '>', '>=', '=']);
  const EDGE_KINDS = new Set(['NODE', 'CALL', 'RETURN']);
  const SELECTOR_REQUIRED_RANGES = new Set(['SINGLE', 'BACK']);
  const SELECTOR_FORBIDDEN_RANGES = new Set(['FRONT', 'ALL', 'RANDOM']);

  function issue(severity, code, message, location) { return {severity, code, message, ...(location || {})}; }
  function duplicates(rows, key) {
    const seen = new Set(), found = new Set();
    for (const row of rows) {
      const id = String(row?.[key] || '');
      if (id && seen.has(id)) found.add(id);
      seen.add(id);
    }
    return [...found].sort();
  }
  function normalizeRange(value) { return String(value || '').trim().toUpperCase(); }
  function normalizeSide(value) { return String(value || '').trim().toUpperCase(); }
  function selectorRequirement({actionEvaluator, targetContract, wait} = {}) {
    if (wait === true || actionEvaluator === 'action.wait') return 'FORBIDDEN';
    if (actionEvaluator === 'action.attack') return 'REQUIRED';
    const side = normalizeSide(targetContract?.side);
    const range = normalizeRange(targetContract?.range);
    if (side === 'SELF') return 'FORBIDDEN';
    if (SELECTOR_REQUIRED_RANGES.has(range)) return 'REQUIRED';
    if (SELECTOR_FORBIDDEN_RANGES.has(range)) return 'FORBIDDEN';
    return 'UNRESOLVED';
  }
  function skillTargetContract(skill) {
    const value = skill?.runtimeContracts?.targetContract;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }
  function resolveActionTargetContract(definition, node, data) {
    const evaluator = String(definition?.evaluator || '');
    if (evaluator === 'action.wait') return {resolved: true, wait: true, target_contract: null};
    if (evaluator === 'action.attack') return {resolved: true, wait: false, target_contract: {side: 'ENEMY', range: 'SINGLE'}, kind: 'BASIC_ATTACK'};
    if (evaluator === 'action.skill') {
      const skillId = String(node?.parameters?.skill_id || '');
      const skill = (Array.isArray(data?.masters?.skills) ? data.masters.skills : []).find((row) => String(row?.id || '') === skillId);
      if (!skill) return {resolved: false, reason: 'skill_not_found', skill_id: skillId};
      const targetContract = skillTargetContract(skill);
      if (!targetContract) return {resolved: false, reason: 'skill_target_contract_missing', skill_id: skillId};
      return {resolved: true, wait: false, target_contract: targetContract, skill_id: skillId};
    }
    return {resolved: false, reason: 'action_target_contract_unresolved', evaluator};
  }
  function resolveSearchTargetTag(targetTagId, data) {
    const id = String(targetTagId || '').trim();
    if (!id) return {ok: false, reason: 'target_tag_required', tag: null, category: null, scope: ''};
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const categories = Array.isArray(data?.tag_categories) ? data.tag_categories : [];
    const tag = tags.find((row) => String(row?.id || '') === id) || null;
    if (!tag) return {ok: false, reason: 'target_tag_not_found', tag: null, category: null, scope: ''};
    const categoryId = String(tag?.category_id || '').trim();
    const category = categories.find((row) => String(row?.id || '') === categoryId) || null;
    if (!categoryId || !category) return {ok: false, reason: 'target_tag_category_invalid', tag, category: null, scope: ''};
    const scope = String(tag?.runtime_semantic || '').trim().toUpperCase();
    if (!AUTHORABLE_SEARCH_TARGET_SEMANTICS.has(scope)) return {ok: false, reason: 'target_tag_semantic_invalid', tag, category, scope};
    return {ok: true, reason: '', tag, category, scope};
  }
  function searchTargetTags(data) {
    return (Array.isArray(data?.tags) ? data.tags : []).map((tag) => resolveSearchTargetTag(tag?.id, data)).filter((row) => row.ok).map((row) => ({
      id: String(row.tag.id || ''),
      name: String(row.tag.name || row.tag.id || ''),
      category_id: String(row.category.id || ''),
      category_name: String(row.category.name || row.category.id || ''),
      runtime_semantic: row.scope
    }));
  }
  function resolveStateTag(stateTagId, definition, data) {
    const id = String(stateTagId || '').trim();
    if (!id) return {ok: false, reason: 'state_tag_required', tag: null, category: null, semantic: ''};
    const schema = definition?.parameter_schema?.properties?.state_tag_id || {};
    const expectedCategoryId = String(schema.ref_category_id || schema['x-ref-category-id'] || '').trim();
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const categories = Array.isArray(data?.tag_categories) ? data.tag_categories : [];
    const tag = tags.find((row) => String(row?.id || '') === id) || null;
    if (!tag) return {ok: false, reason: 'state_tag_not_found', tag: null, category: null, semantic: ''};
    const categoryId = String(tag?.category_id || '').trim();
    const category = categories.find((row) => String(row?.id || '') === categoryId) || null;
    if (!categoryId || !category) return {ok: false, reason: 'state_tag_category_invalid', tag, category: null, semantic: ''};
    if (expectedCategoryId && categoryId !== expectedCategoryId) return {ok: false, reason: 'state_tag_category_mismatch', tag, category, semantic: ''};
    if (expectedCategoryId && !categories.some((row) => String(row?.id || '') === expectedCategoryId)) return {ok: false, reason: 'state_contract_category_missing', tag, category, semantic: ''};
    const semantic = String(tag?.runtime_semantic || '').trim().toUpperCase();
    if (!STATE_RUNTIME_SEMANTICS.has(semantic)) return {ok: false, reason: 'state_tag_semantic_invalid', tag, category, semantic};
    return {ok: true, reason: '', tag, category, semantic};
  }
  function stateSemanticNeedsComparison(semantic) { return STATE_NUMERIC_SEMANTICS.has(String(semantic || '').trim().toUpperCase()); }
  function statePredicateParameterIssues(definition, params, data) {
    const input = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
    const resolved = resolveStateTag(input.state_tag_id, definition, data), errors = [];
    if (!resolved.ok) {
      const messages = {
        state_tag_required: '状態Tagを指定してください。',
        state_tag_not_found: `状態Tagが存在しません: ${String(input.state_tag_id || '未設定')}`,
        state_tag_category_invalid: `状態Tagのカテゴリ参照が不正です: ${String(input.state_tag_id || '未設定')}`,
        state_tag_category_mismatch: `状態TagがCondition Master指定カテゴリに属していません: ${String(input.state_tag_id || '未設定')}`,
        state_contract_category_missing: '状態管理Condition MasterのTagカテゴリ参照が存在しません。',
        state_tag_semantic_invalid: `状態Tagのruntime_semanticが不正です: ${String(input.state_tag_id || '未設定')}`
      };
      errors.push(messages[resolved.reason] || '状態Tagが不正です。');
      return {resolved, errors};
    }
    if (!stateSemanticNeedsComparison(resolved.semantic)) {
      for (const key of ['value_mode', 'operator', 'value']) if (input[key] !== '' && input[key] != null) errors.push(`${resolved.semantic}では${key}を指定できません。`);
      return {resolved, errors};
    }
    const mode = String(input.value_mode || '').trim().toUpperCase();
    const operator = String(input.operator || '').trim();
    const value = Number(input.value);
    if (!STATE_VALUE_MODES.has(mode)) errors.push('value_modeはCURRENT / RATIOのいずれかが必要です。');
    if (!STATE_COMPARE_OPERATORS.has(operator)) errors.push('operatorは< / <= / > / >= / =のいずれかが必要です。');
    if (input.value === '' || input.value == null || !Number.isFinite(value) || value < 0) errors.push('valueは0以上の数値が必要です。');
    else if (mode === 'RATIO' && value > 1) errors.push('RATIOのvalueは0以上1以下で指定してください。');
    return {resolved, errors};
  }
  function nodeDefinitions(data) {
    const rows = Adapter.palette(data?.masters || {}, '', {});
    return new Map(rows.map((row) => [row.id, row]));
  }
  function predicateDefinitions(data) {
    const rows = (Array.isArray(data?.masters?.ai_conditions) ? data.masters.ai_conditions : []).map((row) => Adapter.toNode(row, 'ai_conditions'));
    return new Map(rows.map((row) => [row.id, row]));
  }
  function selectorDefinitions(data) {
    const rows = Adapter.targetSelectorPalette(data?.masters || {}, '');
    return new Map(rows.map((row) => [row.id, row]));
  }
  function validatePredicateExpression(expression, subjectKind, data, refs, nodeId, issues) {
    if (!expression || typeof expression !== 'object' || Array.isArray(expression)) {
      issues.push(issue('ERROR', 'AI_PREDICATE_REQUIRED', 'Predicate expressionが必要です。', {node_id: nodeId}));
      return;
    }
    if (!['ALL', 'ANY'].includes(expression.logic)) issues.push(issue('ERROR', 'AI_PREDICATE_LOGIC_INVALID', 'Predicate logicはALL/ANYのみです。', {node_id: nodeId}));
    const clauses = Array.isArray(expression.clauses) ? expression.clauses : [];
    if (!clauses.length) issues.push(issue('ERROR', 'AI_PREDICATE_CLAUSE_REQUIRED', 'Predicate clauseを1件以上指定してください。', {node_id: nodeId}));
    const byPredicate = predicateDefinitions(data);
    for (let index = 0; index < clauses.length; index += 1) {
      const clause = clauses[index] || {};
      const predicateId = String(clause.predicate_master_id || '');
      const definition = byPredicate.get(predicateId);
      const location = {node_id: nodeId, predicate_master_id: predicateId, clause_index: index};
      if (!definition) {
        issues.push(issue('ERROR', 'AI_PREDICATE_MASTER_NOT_FOUND', `Predicate Masterが存在しません: ${predicateId || '未設定'}`, location));
        continue;
      }
      Adapter.definitionErrors(definition).forEach((message) => issues.push(issue('ERROR', 'AI_PREDICATE_MASTER_INVALID', message, location)));
      const kinds = new Set(Array.isArray(definition.supported_subject_kind) ? definition.supported_subject_kind : []);
      if (!kinds.has(subjectKind)) issues.push(issue('ERROR', 'AI_PREDICATE_SUBJECT_UNSUPPORTED', `Predicate ${predicateId} は ${subjectKind} subjectをサポートしていません。`, location));
      Adapter.validateParameters(definition, clause.params || {}, refs).forEach((message) => issues.push(issue('ERROR', 'AI_PREDICATE_PARAMETER_INVALID', message, location)));
      if (!Adapter.isAvailable(definition, {unlocked_ids: Array.isArray(data?.ai_unlocks) ? data.ai_unlocks : []})) issues.push(issue('ERROR', 'AI_PREDICATE_MASTER_UNAVAILABLE', `Predicate ${predicateId} は利用可能状態ではありません。`, location));
      if (String(definition.evaluator || '') === 'condition.state_compare') {
        statePredicateParameterIssues(definition, clause.params || {}, data).errors.forEach((message) => issues.push(issue('ERROR', 'AI_STATE_COMPARE_PARAMETER_INVALID', message, location)));
      }
      if (typeof clause.negate !== 'boolean') issues.push(issue('ERROR', 'AI_PREDICATE_NEGATE_INVALID', 'Predicate negateはboolean必須です。', location));
    }
  }
  function normalNodeCycles(nodes, edges) {
    const graph = new Map(nodes.map((node) => [String(node.instance_id || ''), []]));
    for (const edge of edges) {
      if (edge?.transition_kind !== 'NODE') continue;
      const from = String(edge?.from?.node_id || ''), to = String(edge?.to?.node_id || '');
      if (graph.has(from) && graph.has(to)) graph.get(from).push(to);
    }
    graph.forEach((rows) => rows.sort());
    const visiting = new Set(), done = new Set(), cycles = new Set();
    function walk(id, path) {
      if (visiting.has(id)) {
        const at = path.indexOf(id), cycle = [...path.slice(at), id];
        cycles.add(cycle.join(' → '));
        return;
      }
      if (done.has(id)) return;
      visiting.add(id);
      for (const next of graph.get(id) || []) walk(next, [...path, id]);
      visiting.delete(id); done.add(id);
    }
    [...graph.keys()].sort().forEach((id) => walk(id, []));
    return [...cycles].sort();
  }
  function callGraphCycles(callGraph) {
    const visiting = new Set(), done = new Set(), cycles = new Set();
    function walk(id, path) {
      if (visiting.has(id)) {
        const at = path.indexOf(id), cycle = [...path.slice(at), id];
        cycles.add(cycle.join(' → '));
        return;
      }
      if (done.has(id)) return;
      visiting.add(id);
      for (const next of [...(callGraph.get(id) || [])].sort()) walk(next, [...path, id]);
      visiting.delete(id); done.add(id);
    }
    [...callGraph.keys()].sort().forEach((id) => walk(id, []));
    return [...cycles].sort();
  }
  function buildRegionMembership(source, nodes, edges) {
    const roots = [{id: 'MAIN', entry: String(source.entry_node_id || '')}, ...(Array.isArray(source.subroutines) ? source.subroutines : []).map((sub) => ({id: String(sub.id || ''), entry: String(sub.entry_node_id || '')}))];
    const adjacency = new Map(nodes.map((node) => [String(node.instance_id || ''), []]));
    for (const edge of edges) if (edge?.transition_kind === 'NODE' && adjacency.has(String(edge?.from?.node_id || ''))) adjacency.get(String(edge.from.node_id)).push(String(edge?.to?.node_id || ''));
    const membership = new Map(nodes.map((node) => [String(node.instance_id || ''), new Set()]));
    for (const root of roots) {
      if (!adjacency.has(root.entry)) continue;
      const queue = [root.entry], seen = new Set();
      while (queue.length) {
        const id = queue.shift();
        if (!adjacency.has(id) || seen.has(id)) continue;
        seen.add(id); membership.get(id)?.add(root.id);
        queue.push(...adjacency.get(id));
      }
    }
    return membership;
  }
  function validate(program, projectData) {
    const source = program && typeof program === 'object' ? program : {};
    const data = projectData || {};
    const nodes = Array.isArray(source.nodes) ? source.nodes : [];
    const edges = Array.isArray(source.edges) ? source.edges : [];
    const subroutines = Array.isArray(source.subroutines) ? source.subroutines : [];
    const issues = [];
    const refs = {tags: data.tags || [], skills: data.masters?.skills || [], ai_target_selectors: data.masters?.ai_target_selectors || []};

    if (source.schema_version !== SCHEMA_VERSION) issues.push(issue('ERROR', 'AI_PROGRAM_SCHEMA_VERSION', `schema_versionは${SCHEMA_VERSION}固定です。`));
    if (!String(source.data_version || '').trim()) issues.push(issue('ERROR', 'AI_PROGRAM_DATA_VERSION_REQUIRED', 'data_versionが必要です。'));
    if (!String(source.id || '').trim()) issues.push(issue('ERROR', 'AI_PROGRAM_ID_REQUIRED', 'AIプログラムIDが必要です。'));
    if (!String(source.name || '').trim()) issues.push(issue('ERROR', 'AI_PROGRAM_NAME_REQUIRED', 'AIプログラム名が必要です。'));
    if (!nodes.length) issues.push(issue('ERROR', 'AI_NODE_REQUIRED', 'AI部品を1件以上配置してください。'));

    const nodeIds = new Set(nodes.map((node) => String(node?.instance_id || '')).filter(Boolean));
    const nodeById = new Map(nodes.map((node) => [String(node?.instance_id || ''), node]));
    duplicates(nodes, 'instance_id').forEach((id) => issues.push(issue('ERROR', 'AI_NODE_ID_DUPLICATE', `部品IDが重複しています: ${id}`, {node_id: id})));
    duplicates(edges, 'edge_id').forEach((id) => issues.push(issue('ERROR', 'AI_EDGE_ID_DUPLICATE', `接続IDが重複しています: ${id}`, {edge_id: id})));
    duplicates(subroutines, 'id').forEach((id) => issues.push(issue('ERROR', 'AI_SUBROUTINE_DUPLICATE', `サブルーチンIDが重複しています: ${id}`, {subroutine_id: id})));
    if (nodes.length && !nodeIds.has(String(source.entry_node_id || ''))) issues.push(issue('ERROR', 'AI_ENTRY_NOT_FOUND', `開始部品が存在しません: ${source.entry_node_id || '未設定'}`, {node_id: String(source.entry_node_id || '')}));

    const byMaster = nodeDefinitions(data);
    const bySelector = selectorDefinitions(data);
    for (const node of [...nodes].sort((a, b) => String(a.instance_id).localeCompare(String(b.instance_id)))) {
      const id = String(node.instance_id || ''), definition = byMaster.get(String(node.master_node_id || ''));
      if (!id) issues.push(issue('ERROR', 'AI_NODE_ID_REQUIRED', '部品インスタンスIDが必要です。'));
      if (!['search', 'condition', 'action'].includes(node.node_type)) issues.push(issue('ERROR', 'AI_NODE_TYPE_INVALID', `V2 node_typeが不正です: ${node.node_type || '未設定'}`, {node_id: id}));
      if (!definition) { issues.push(issue('ERROR', 'AI_MASTER_NOT_FOUND', `参照AI部品が存在しません: ${node.master_node_id || '未設定'}`, {node_id: id})); continue; }
      if (definition.node_type !== node.node_type) issues.push(issue('ERROR', 'AI_NODE_TYPE_MISMATCH', `部品種別がマスターと一致しません: ${node.master_node_id}`, {node_id: id}));
      Adapter.definitionErrors(definition).forEach((message) => issues.push(issue('ERROR', 'AI_MASTER_DEFINITION_INVALID', message, {node_id: id})));
      if (node.master_data_version && node.master_data_version !== definition.data_version) issues.push(issue('WARNING', 'AI_MASTER_VERSION_STALE', `参照マスター版が更新されています: ${node.master_data_version} → ${definition.data_version}`, {node_id: id}));

      if (node.node_type === 'search') {
        const targetTagId = String(node.parameters?.target_tag_id || '');
        const target = resolveSearchTargetTag(targetTagId, data);
        if (!target.ok) {
          const messages = {
            target_tag_required: '探索対象Tagを指定してください。',
            target_tag_not_found: `探索対象Tagが存在しません: ${targetTagId || '未設定'}`,
            target_tag_category_invalid: `探索対象Tagのカテゴリ参照が不正です: ${targetTagId || '未設定'}`,
            target_tag_semantic_invalid: `探索対象Tagのruntime_semanticが不正です: ${targetTagId || '未設定'}`
          };
          issues.push(issue('ERROR', 'AI_SEARCH_TARGET_TAG_INVALID', messages[target.reason] || '探索対象Tagが不正です。', {node_id: id, target_tag_id: targetTagId}));
        }
        validatePredicateExpression(node.parameters?.predicate, 'UNIT', data, refs, id, issues);
        if (node.target_selector != null) issues.push(issue('ERROR', 'AI_SELECTOR_FORBIDDEN', 'Searchはtarget_selectorを持てません。', {node_id: id}));
      } else if (node.node_type === 'condition') {
        const subject = String(node.parameters?.subject_scope || '');
        if (!STATE_SUBJECTS.has(subject)) issues.push(issue('ERROR', 'AI_STATE_SUBJECT_INVALID', `StateCheck subject_scopeが不正です: ${subject || '未設定'}`, {node_id: id}));
        if (STATE_SUBJECTS.has(subject)) validatePredicateExpression(node.parameters?.predicate, subject, data, refs, id, issues);
        if (node.target_selector != null) issues.push(issue('ERROR', 'AI_SELECTOR_FORBIDDEN', 'StateCheckはtarget_selectorを持てません。', {node_id: id}));
      } else if (node.node_type === 'action') {
        Adapter.validateParameters(definition, node.parameters || {}, refs).forEach((message) => issues.push(issue('ERROR', 'AI_PARAMETER_INVALID', message, {node_id: id})));
        const resolved = resolveActionTargetContract(definition, node, data);
        if (!resolved.resolved) {
          issues.push(issue('ERROR', 'AI_ACTION_TARGET_CONTRACT_UNRESOLVED', `Action targetContractを解決できません: ${resolved.reason}`, {node_id: id}));
        } else {
          const requirement = selectorRequirement({actionEvaluator: definition.evaluator, targetContract: resolved.target_contract, wait: resolved.wait});
          const binding = node.target_selector;
          if (requirement === 'REQUIRED' && (!binding || typeof binding !== 'object')) issues.push(issue('ERROR', 'AI_SELECTOR_REQUIRED', 'このActionにはTarget Selectorが必要です。', {node_id: id}));
          if (requirement === 'FORBIDDEN' && binding != null) issues.push(issue('ERROR', 'AI_SELECTOR_FORBIDDEN', 'このActionではTarget Selectorは禁止です。', {node_id: id}));
          if (requirement === 'UNRESOLVED') issues.push(issue('ERROR', 'AI_SELECTOR_APPLICABILITY_UNRESOLVED', 'Range×Target Selector適用可否を解決できません。', {node_id: id}));
          if (binding && typeof binding === 'object') {
            const selectorId = String(binding.selector_id || ''), selector = bySelector.get(selectorId);
            if (!selector) issues.push(issue('ERROR', 'AI_SELECTOR_MASTER_NOT_FOUND', `Target Selectorが存在しません: ${selectorId || '未設定'}`, {node_id: id}));
            else {
              Adapter.targetSelectorDefinitionErrors(selector).forEach((message) => issues.push(issue('ERROR', 'AI_SELECTOR_MASTER_INVALID', message, {node_id: id})));
              if (selector.available !== true) issues.push(issue('ERROR', 'AI_SELECTOR_DISABLED', `Target Selectorが無効です: ${selectorId}`, {node_id: id}));
              Adapter.validateParameters(selector, binding.params || {}, refs).forEach((message) => issues.push(issue('ERROR', 'AI_SELECTOR_PARAMETER_INVALID', message, {node_id: id})));
            }
          }
        }
      }
    }

    const subById = new Map(subroutines.map((sub) => [String(sub?.id || ''), sub]));
    for (const subroutine of subroutines) if (!nodeIds.has(String(subroutine?.entry_node_id || ''))) issues.push(issue('ERROR', 'AI_SUBROUTINE_ENTRY_MISSING', `サブルーチン開始部品が存在しません: ${subroutine?.entry_node_id || '未設定'}`, {subroutine_id: String(subroutine?.id || '')}));

    const outputUse = new Map(), inputUse = new Map(), signatures = new Set();
    for (const edge of [...edges].sort((a, b) => String(a.edge_id).localeCompare(String(b.edge_id)))) {
      const edgeId = String(edge.edge_id || ''), kind = String(edge.transition_kind || ''), from = edge.from || {};
      const fromNode = nodeById.get(String(from.node_id || '')), fromDef = byMaster.get(String(fromNode?.master_node_id || ''));
      if (!EDGE_KINDS.has(kind)) issues.push(issue('ERROR', 'AI_TRANSITION_KIND_INVALID', `transition_kindが不正です: ${kind || '未設定'}`, {edge_id: edgeId}));
      if (!nodeIds.has(String(from.node_id || ''))) issues.push(issue('ERROR', 'AI_EDGE_FROM_MISSING', `接続元部品が存在しません: ${from.node_id || '未設定'}`, {edge_id: edgeId}));
      if (fromDef && fromDef.node_type === 'action') issues.push(issue('ERROR', 'AI_ACTION_OUTGOING_EDGE', 'ACTIONは終端のため後続接続を持てません。', {edge_id: edgeId, node_id: from.node_id}));
      if (fromDef && !(Array.isArray(fromDef.ports?.outputs) ? fromDef.ports.outputs : []).some((port) => port.id === from.port_id)) issues.push(issue('ERROR', 'AI_OUTPUT_PORT_INVALID', `出力ポートが存在しません: ${from.port_id || '未設定'}`, {edge_id: edgeId, node_id: from.node_id}));
      const outKey = `${from.node_id}.${from.port_id}`;
      const outRows = outputUse.get(outKey) || []; outRows.push(edgeId); outputUse.set(outKey, outRows);

      let signature = `${outKey}:${kind}`;
      if (kind === 'NODE') {
        const to = edge.to || {}, toNode = nodeById.get(String(to.node_id || '')), toDef = byMaster.get(String(toNode?.master_node_id || ''));
        if (!nodeIds.has(String(to.node_id || ''))) issues.push(issue('ERROR', 'AI_EDGE_TO_MISSING', `接続先部品が存在しません: ${to.node_id || '未設定'}`, {edge_id: edgeId}));
        if (toDef && !(Array.isArray(toDef.ports?.inputs) ? toDef.ports.inputs : []).some((port) => port.id === to.port_id)) issues.push(issue('ERROR', 'AI_INPUT_PORT_INVALID', `入力ポートが存在しません: ${to.port_id || '未設定'}`, {edge_id: edgeId, node_id: to.node_id}));
        const inKey = `${to.node_id}.${to.port_id}`; const inRows = inputUse.get(inKey) || []; inRows.push(edgeId); inputUse.set(inKey, inRows);
        signature += `>${inKey}`;
      } else if (kind === 'CALL') {
        const subId = String(edge.subroutine_id || ''), ret = edge.return_to || {};
        if (!subById.has(subId)) issues.push(issue('ERROR', 'AI_CALL_SUBROUTINE_MISSING', `CALL先Subroutineが存在しません: ${subId || '未設定'}`, {edge_id: edgeId, subroutine_id: subId}));
        const retNode = nodeById.get(String(ret.node_id || '')), retDef = byMaster.get(String(retNode?.master_node_id || ''));
        if (!nodeIds.has(String(ret.node_id || ''))) issues.push(issue('ERROR', 'AI_CALL_RETURN_TARGET_MISSING', `CALL return_to部品が存在しません: ${ret.node_id || '未設定'}`, {edge_id: edgeId}));
        if (retDef && !(Array.isArray(retDef.ports?.inputs) ? retDef.ports.inputs : []).some((port) => port.id === ret.port_id)) issues.push(issue('ERROR', 'AI_CALL_RETURN_PORT_INVALID', `CALL return_to入力ポートが不正です: ${ret.port_id || '未設定'}`, {edge_id: edgeId}));
        const inKey = `${ret.node_id}.${ret.port_id}`; const inRows = inputUse.get(inKey) || []; inRows.push(edgeId); inputUse.set(inKey, inRows);
        signature += `>${subId}>${inKey}`;
      } else if (kind === 'RETURN') {
        signature += '>RETURN';
      }
      if (signatures.has(signature)) issues.push(issue('ERROR', 'AI_EDGE_DUPLICATE', `同じ接続が重複しています: ${signature}`, {edge_id: edgeId}));
      signatures.add(signature);
    }

    for (const [key, ids] of outputUse) if (ids.length > 1) issues.push(issue('ERROR', 'AI_OUTPUT_AMBIGUOUS', `同じ出力ポートに複数の接続があります: ${key}`, {edge_id: ids.sort()[0]}));
    normalNodeCycles(nodes, edges).forEach((path) => issues.push(issue('ERROR', 'AI_CYCLE_UNBOUNDED', `通常NODE接続に循環があります: ${path}`)));

    const membership = buildRegionMembership(source, nodes, edges);
    for (const [nodeId, owners] of membership) if (owners.size > 1) issues.push(issue('ERROR', 'AI_SUBROUTINE_REGION_OVERLAP', `同一nodeがMain/Subroutine複数regionへ所属しています: ${nodeId}`, {node_id: nodeId}));
    const ownerOf = (nodeId) => {
      const owners = membership.get(String(nodeId || ''));
      return owners && owners.size === 1 ? [...owners][0] : null;
    };
    const callGraph = new Map(subroutines.map((sub) => [String(sub.id || ''), new Set()]));
    for (const edge of edges) {
      const kind = String(edge.transition_kind || ''), caller = ownerOf(edge?.from?.node_id);
      if (kind === 'RETURN' && (!caller || caller === 'MAIN')) issues.push(issue('ERROR', 'AI_RETURN_OUTSIDE_SUBROUTINE', 'RETURNはSubroutine body内だけで使用できます。', {edge_id: String(edge.edge_id || '')}));
      if (kind === 'CALL') {
        const callee = String(edge.subroutine_id || '');
        if (caller && caller !== 'MAIN' && callGraph.has(caller)) callGraph.get(caller).add(callee);
        const returnOwner = ownerOf(edge?.return_to?.node_id);
        if (caller && returnOwner && caller !== returnOwner) issues.push(issue('ERROR', 'AI_CALL_RETURN_REGION_MISMATCH', 'CALL return_toはcallerと同じregionへ戻る必要があります。', {edge_id: String(edge.edge_id || '')}));
      }
    }
    callGraphCycles(callGraph).forEach((path) => issues.push(issue('ERROR', 'AI_SUBROUTINE_CALL_CYCLE', `Subroutine call graphに循環があります: ${path}`)));

    const combinedReachable = new Set(), queue = nodeIds.has(String(source.entry_node_id || '')) ? [String(source.entry_node_id)] : [];
    while (queue.length) {
      const id = queue.shift(); if (combinedReachable.has(id)) continue; combinedReachable.add(id);
      for (const edge of edges.filter((row) => String(row?.from?.node_id || '') === id)) {
        if (edge.transition_kind === 'NODE' && nodeIds.has(String(edge?.to?.node_id || ''))) queue.push(String(edge.to.node_id));
        else if (edge.transition_kind === 'CALL') {
          const sub = subById.get(String(edge.subroutine_id || ''));
          if (sub && nodeIds.has(String(sub.entry_node_id || ''))) queue.push(String(sub.entry_node_id));
          if (nodeIds.has(String(edge?.return_to?.node_id || ''))) queue.push(String(edge.return_to.node_id));
        }
      }
    }
    [...nodeIds].filter((id) => !combinedReachable.has(id)).sort().forEach((id) => issues.push(issue('WARNING', 'AI_NODE_UNREACHABLE', `開始部品から到達できません: ${id}`, {node_id: id})));

    const subEntries = new Set(subroutines.map((sub) => String(sub.entry_node_id || '')));
    for (const node of nodes) {
      const id = String(node.instance_id || ''), definition = byMaster.get(String(node.master_node_id || ''));
      if (!definition || !combinedReachable.has(id)) continue;
      if (id !== String(source.entry_node_id || '') && !subEntries.has(id)) {
        const key = `${id}.in`, count = (inputUse.get(key) || []).length;
        if (count === 0) issues.push(issue('ERROR', 'AI_INPUT_REQUIRED', `入力ポートが未接続です: ${key}`, {node_id: id}));
      }
      for (const port of Array.isArray(definition.ports?.outputs) ? definition.ports.outputs : []) {
        const key = `${id}.${port.id}`, count = (outputUse.get(key) || []).length;
        if (count === 0) issues.push(issue('ERROR', 'AI_OUTPUT_REQUIRED', `出力ポートが未接続です: ${key}`, {node_id: id}));
      }
    }

    issues.sort((a, b) => (rank[a.severity] - rank[b.severity]) || String(a.node_id || a.edge_id || a.subroutine_id || '').localeCompare(String(b.node_id || b.edge_id || b.subroutine_id || '')) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
    const summary = {ERROR: 0, WARNING: 0, INFO: 0}; issues.forEach((row) => summary[row.severity]++);
    return Object.freeze({valid: summary.ERROR === 0, issues: Object.freeze(issues), summary: Object.freeze(summary)});
  }

  return Object.freeze({SCHEMA_VERSION, SEARCH_SCOPES, AUTHORABLE_SEARCH_TARGET_SEMANTICS, STATE_SUBJECTS, STATE_RUNTIME_SEMANTICS, STATE_NUMERIC_SEMANTICS, STATE_VALUE_MODES, STATE_COMPARE_OPERATORS, resolveSearchTargetTag, searchTargetTags, resolveStateTag, stateSemanticNeedsComparison, statePredicateParameterIssues, selectorRequirement, resolveActionTargetContract, validatePredicateExpression, validate});
});
