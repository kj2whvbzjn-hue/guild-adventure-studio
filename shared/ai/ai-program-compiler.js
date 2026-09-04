(function (root, factory) {
  const validator = typeof module === 'object' && module.exports ? require('./ai-program-validator.js') : root && root.GKSAIProgramValidator;
  const adapter = typeof module === 'object' && module.exports ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter;
  const api = factory(validator, adapter, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramCompiler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Validator, Adapter, root) {
  'use strict';
  if (!Validator || !Adapter) throw new Error('AI validator and master adapter are required');

  const COMPILER_VERSION = '2.0.0';
  class CompilerError extends Error {
    constructor(message, issues) { super(message); this.name = 'AIProgramCompilerError'; this.issues = issues || []; }
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const result = {};
      Object.keys(value).sort().forEach((key) => { result[key] = canonical(value[key]); });
      return result;
    }
    return value;
  }
  function stableStringify(value) { return JSON.stringify(canonical(value)); }
  async function sha256(text) {
    const cryptoApi = root?.crypto;
    if (!cryptoApi?.subtle) throw new CompilerError('SHA-256 runtime is unavailable', []);
    const bytes = new TextEncoder().encode(text), digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function compilePredicate(expression, predicateById) {
    return {
      logic: expression.logic,
      clauses: expression.clauses.map((clause) => {
        const definition = predicateById.get(clause.predicate_master_id);
        return {
          predicate_master_id: clause.predicate_master_id,
          evaluator: definition.evaluator,
          params: canonical(clause.params || {}),
          negate: clause.negate === true
        };
      })
    };
  }
  function instructionSuccessors(instruction, stack) {
    if (!instruction) return [];
    if (instruction.op === 'SEARCH') return [instruction.on_found, instruction.on_not_found].filter(Boolean).map((next) => ({next, stack}));
    if (instruction.op === 'CONDITION') return [instruction.on_true, instruction.on_false].filter(Boolean).map((next) => ({next, stack}));
    if (instruction.op === 'CALL') return instruction.entry_instruction ? [{next: instruction.entry_instruction, stack: [...stack, instruction.return_instruction_id]}] : [];
    if (instruction.op === 'RETURN') {
      if (!stack.length) return [];
      return [{next: stack[stack.length - 1], stack: stack.slice(0, -1)}];
    }
    if (instruction.op === 'ACTION' || instruction.op === 'WAIT' || instruction.op === 'END') return [];
    return instruction.next ? [{next: instruction.next, stack}] : [];
  }
  function deriveLimits(entryInstruction, instructions) {
    const byId = new Map(instructions.map((row) => [row.instruction_id, row]));
    const memo = new Map();
    const visiting = new Set();
    let maxDepth = 0;
    function walk(id, stack) {
      if (!id) return 0;
      maxDepth = Math.max(maxDepth, stack.length);
      const key = `${id}|${stack.join('>')}`;
      if (memo.has(key)) return memo.get(key);
      if (visiting.has(key)) throw new CompilerError('Combined runtime control flow must be acyclic', []);
      visiting.add(key);
      const instruction = byId.get(id);
      if (!instruction) throw new CompilerError(`Compiled instruction target not found: ${id}`, []);
      let tail = 0;
      for (const successor of instructionSuccessors(instruction, stack)) tail = Math.max(tail, walk(successor.next, successor.stack));
      visiting.delete(key);
      const value = 1 + tail;
      memo.set(key, value);
      return value;
    }
    const maxSteps = walk(entryInstruction, []);
    return {max_steps: Math.max(1, maxSteps), max_subroutine_depth: maxDepth};
  }
  async function compile(program, projectData, options) {
    if (options && (Object.prototype.hasOwnProperty.call(options, 'max_steps') || Object.prototype.hasOwnProperty.call(options, 'max_subroutine_depth'))) {
      throw new CompilerError('max_steps/max_subroutine_depth are compiler-derived and cannot be supplied', []);
    }
    const validation = Validator.validate(program, projectData);
    if (!validation.valid) throw new CompilerError('AI program validation failed', validation.issues);

    const data = projectData || {};
    const definitions = Adapter.palette(data.masters || {}, '', {});
    const byMaster = new Map(definitions.map((row) => [row.id, row]));
    const predicateById = new Map((Array.isArray(data.masters?.ai_conditions) ? data.masters.ai_conditions : []).map((row) => {
      const definition = Adapter.toNode(row, 'ai_conditions');
      return [definition.id, definition];
    }));
    const nodes = [...program.nodes].sort((a, b) => String(a.instance_id).localeCompare(String(b.instance_id)));
    const edges = [...program.edges].sort((a, b) => String(a.edge_id).localeCompare(String(b.edge_id)));
    const subById = new Map((program.subroutines || []).map((sub) => [String(sub.id), sub]));
    const nodeInstruction = new Map(nodes.map((node, index) => [String(node.instance_id), `I-${String(index + 1).padStart(4, '0')}`]));
    const syntheticEdges = edges.filter((edge) => edge.transition_kind === 'CALL' || edge.transition_kind === 'RETURN');
    const edgeInstruction = new Map(syntheticEdges.map((edge, index) => [String(edge.edge_id), `I-${String(nodes.length + index + 1).padStart(4, '0')}`]));
    const outgoing = new Map(nodes.map((node) => [String(node.instance_id), new Map()]));
    for (const edge of edges) {
      const from = String(edge?.from?.node_id || ''), port = String(edge?.from?.port_id || '');
      if (outgoing.has(from)) outgoing.get(from).set(port, edge);
    }
    function targetInstruction(edge) {
      if (!edge) return null;
      if (edge.transition_kind === 'NODE') return nodeInstruction.get(String(edge?.to?.node_id || '')) || null;
      if (edge.transition_kind === 'CALL' || edge.transition_kind === 'RETURN') return edgeInstruction.get(String(edge.edge_id || '')) || null;
      return null;
    }
    const instructions = [];
    const sourceMap = {};
    for (const node of nodes) {
      const definition = byMaster.get(String(node.master_node_id));
      const instructionId = nodeInstruction.get(String(node.instance_id));
      const base = {
        instruction_id: instructionId,
        op: node.node_type === 'search' ? 'SEARCH' : node.node_type === 'condition' ? 'CONDITION' : 'ACTION',
        origin_part_id: String(node.instance_id),
        source_node_id: String(node.instance_id),
        master_node_id: definition.id,
        evaluator: definition.evaluator,
        params: {}
      };
      if (node.node_type === 'search') {
        const target = Validator.resolveSearchTargetTag(node.parameters.target_tag_id, data);
        if (!target.ok) throw new CompilerError(`Search target tag cannot be resolved: ${String(node.parameters.target_tag_id || '')}`, []);
        base.params = canonical({scope: target.scope, predicate: compilePredicate(node.parameters.predicate, predicateById)});
        base.on_found = targetInstruction(outgoing.get(String(node.instance_id)).get('found'));
        base.on_not_found = targetInstruction(outgoing.get(String(node.instance_id)).get('not_found'));
      } else if (node.node_type === 'condition') {
        base.params = canonical({subject_scope: node.parameters.subject_scope, predicate: compilePredicate(node.parameters.predicate, predicateById)});
        base.on_true = targetInstruction(outgoing.get(String(node.instance_id)).get('true'));
        base.on_false = targetInstruction(outgoing.get(String(node.instance_id)).get('false'));
      } else {
        base.params = canonical(node.parameters || {});
        if (node.target_selector != null) base.target_selector = canonical(node.target_selector);
      }
      instructions.push(base);
      sourceMap[instructionId] = {origin_part_id: String(node.instance_id), source_node_id: String(node.instance_id)};
    }

    // Determine subroutine ownership using normal NODE reachability. Validation already
    // guarantees no overlapping Main/Subroutine region.
    const regionByNode = new Map();
    const normalAdj = new Map(nodes.map((node) => [String(node.instance_id), []]));
    for (const edge of edges) if (edge.transition_kind === 'NODE' && normalAdj.has(String(edge.from.node_id))) normalAdj.get(String(edge.from.node_id)).push(String(edge.to.node_id));
    const roots = [{id: 'MAIN', entry_node_id: program.entry_node_id}, ...(program.subroutines || [])];
    for (const rootDef of roots) {
      const regionId = String(rootDef.id || 'MAIN'), queue = [String(rootDef.entry_node_id || '')], seen = new Set();
      while (queue.length) {
        const id = queue.shift();
        if (!normalAdj.has(id) || seen.has(id)) continue;
        seen.add(id); if (!regionByNode.has(id)) regionByNode.set(id, regionId);
        queue.push(...normalAdj.get(id));
      }
    }

    for (const edge of syntheticEdges) {
      const instructionId = edgeInstruction.get(String(edge.edge_id));
      const sourceNodeId = String(edge?.from?.node_id || '');
      if (edge.transition_kind === 'CALL') {
        const sub = subById.get(String(edge.subroutine_id));
        instructions.push({
          instruction_id: instructionId,
          op: 'CALL',
          origin_part_id: String(edge.edge_id),
          source_node_id: sourceNodeId,
          params: {},
          subroutine_id: String(edge.subroutine_id),
          entry_instruction: nodeInstruction.get(String(sub.entry_node_id)),
          return_instruction_id: nodeInstruction.get(String(edge.return_to.node_id))
        });
      } else {
        instructions.push({
          instruction_id: instructionId,
          op: 'RETURN',
          origin_part_id: String(edge.edge_id),
          source_node_id: sourceNodeId,
          params: {},
          subroutine_id: String(regionByNode.get(sourceNodeId) || '')
        });
      }
      sourceMap[instructionId] = {origin_part_id: String(edge.edge_id), source_node_id: sourceNodeId};
    }
    instructions.sort((a, b) => a.instruction_id.localeCompare(b.instruction_id));
    const entryInstruction = nodeInstruction.get(String(program.entry_node_id));
    const limits = deriveLimits(entryInstruction, instructions);
    const runtime = {
      schema_version: '2.0.0',
      data_version: String(program.data_version),
      program_id: String(program.id),
      program_version: Number(program.version) || 1,
      compiler_version: COMPILER_VERSION,
      entry_instruction: entryInstruction,
      instructions,
      source_map: sourceMap,
      limits
    };
    runtime.content_hash = await sha256(stableStringify(runtime));
    return canonical(runtime);
  }
  return Object.freeze({COMPILER_VERSION, CompilerError, canonical, stableStringify, compilePredicate, deriveLimits, compile});
});
