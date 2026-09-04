(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('../../shared/ai/ai-program-model.js') : root && root.GKSAIProgramModel;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  if (!Model) throw new Error('GKSAIProgramModel is required');
  const NODE_TYPES = new Set(['search', 'condition', 'action']);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  function nextId(rows, prefix, key) {
    let max = 0;
    for (const row of rows) {
      const match = new RegExp(`^${prefix}-([0-9]+)$`).exec(String(row?.[key] || ''));
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }
  function defaultParameters(nodeType) {
    if (nodeType === 'search') return {target_tag_id: '', predicate: {logic: 'ALL', clauses: []}};
    if (nodeType === 'condition') return {subject_scope: '', predicate: {logic: 'ALL', clauses: []}};
    return {};
  }
  function create(value) {
    let current = Model.normalizeProgram(value), undoStack = [], redoStack = [];
    function commit(change) {
      const before = clone(current), candidate = clone(current);
      const result = change(candidate);
      current = Model.normalizeProgram(candidate);
      undoStack.push(before); redoStack = [];
      return result;
    }
    function nodeById(program, id) { return program.nodes.find((item) => item.instance_id === String(id || '')); }
    function requireNode(program, id, label) {
      const node = nodeById(program, id);
      if (!node) throw new Error(`${label || 'AI node'} not found: ${id}`);
      return node;
    }
    function assertOutputFree(program, from, exceptEdgeId) {
      const existing = program.edges.find((edge) => edge.edge_id !== exceptEdgeId && edge.from?.node_id === from.node_id && edge.from?.port_id === from.port_id);
      if (existing) throw new Error(`Output already has a transition: ${from.node_id}.${from.port_id}`);
    }
    function normalizeEndpoint(value, label) {
      const nodeId = String(value?.node_id || ''), portId = String(value?.port_id || '');
      if (!nodeId || !portId) throw new Error(`${label} endpoint is incomplete`);
      return {node_id: nodeId, port_id: portId};
    }
    function addNode(definition, parameters, position) {
      if (!definition?.id || !NODE_TYPES.has(definition.node_type)) throw new Error('Valid AI V2 master definition is required');
      let created;
      commit((program) => {
        const params = parameters == null ? defaultParameters(definition.node_type) : clone(parameters);
        created = {
          instance_id: nextId(program.nodes, 'AIN', 'instance_id'), master_node_id: String(definition.id),
          master_data_version: String(definition.data_version || program.data_version || Model.DATA_VERSION), node_type: definition.node_type,
          position: {x:Number.isFinite(Number(position?.x))?Number(position.x):0, y:Number.isFinite(Number(position?.y))?Number(position.y):0}, parameters: params, comment: ''
        };
        if (definition.node_type !== 'action') created.target_selector = null;
        program.nodes.push(created);
        if (!program.entry_node_id) program.entry_node_id = created.instance_id;
      });
      return clone(created);
    }
    function duplicateNode(instanceId, position) {
      let created;
      commit((program) => {
        const source = requireNode(program, instanceId, 'AI node');
        created = clone(source);
        created.instance_id = nextId(program.nodes, 'AIN', 'instance_id');
        created.position = {
          x: Number.isFinite(Number(position?.x)) ? Number(position.x) : Number(source.position?.x || 0) + 1,
          y: Number.isFinite(Number(position?.y)) ? Number(position.y) : Number(source.position?.y || 0) + 1
        };
        program.nodes.push(created);
      });
      return clone(created);
    }
    function updateNode(instanceId, patch) {
      commit((program) => {
        const node = requireNode(program, instanceId, 'AI node');
        if (patch.position) node.position = {x:Number(patch.position.x),y:Number(patch.position.y)};
        if (patch.parameters) node.parameters = clone(patch.parameters);
        if (patch.comment !== undefined) node.comment = String(patch.comment || '');
        if (own(patch, 'target_selector')) node.target_selector = patch.target_selector == null ? null : clone(patch.target_selector);
      });
    }
    function removeNode(instanceId) {
      commit((program) => {
        requireNode(program, instanceId, 'AI node');
        program.nodes = program.nodes.filter((node) => node.instance_id !== instanceId);
        program.edges = program.edges.filter((edge) => edge.from?.node_id !== instanceId && edge.to?.node_id !== instanceId && edge.return_to?.node_id !== instanceId);
        program.subroutines = program.subroutines.filter((row) => row.entry_node_id !== instanceId);
        if (program.entry_node_id === instanceId) program.entry_node_id = '';
      });
    }
    function setEntryNode(instanceId) {
      commit((program) => { requireNode(program, instanceId, 'Entry node'); program.entry_node_id = String(instanceId); });
      return String(instanceId);
    }
    function edgeBase(program, from) {
      const endpoint = normalizeEndpoint(from, 'From');
      requireNode(program, endpoint.node_id, 'Connection source node');
      assertOutputFree(program, endpoint);
      return {edge_id: nextId(program.edges, 'AIE', 'edge_id'), from: endpoint};
    }
    function connect(from, to) {
      let edge;
      commit((program) => {
        const target = normalizeEndpoint(to, 'To'); requireNode(program, target.node_id, 'Connection target node');
        edge = {...edgeBase(program, from), transition_kind: 'NODE', to: target};
        program.edges.push(edge);
      });
      return clone(edge);
    }
    function connectCall(from, subroutineId, returnTo) {
      let edge;
      commit((program) => {
        const subId = String(subroutineId || '');
        if (!program.subroutines.some((row) => row.id === subId)) throw new Error(`Subroutine not found: ${subId}`);
        const target = normalizeEndpoint(returnTo, 'Return'); requireNode(program, target.node_id, 'CALL return node');
        edge = {...edgeBase(program, from), transition_kind: 'CALL', subroutine_id: subId, return_to: target};
        program.edges.push(edge);
      });
      return clone(edge);
    }
    function connectReturn(from) {
      let edge;
      commit((program) => { edge = {...edgeBase(program, from), transition_kind: 'RETURN'}; program.edges.push(edge); });
      return clone(edge);
    }
    function removeEdge(edgeId) {
      commit((program) => {
        const before = program.edges.length; program.edges = program.edges.filter((edge) => edge.edge_id !== edgeId);
        if (program.edges.length === before) throw new Error(`Connection not found: ${edgeId}`);
      });
    }
    function replaceEdge(edgeId, spec) {
      let replaced;
      commit((program) => {
        const index = program.edges.findIndex((edge) => edge.edge_id === edgeId);
        if (index < 0) throw new Error(`Connection not found: ${edgeId}`);
        const kind = String(spec?.transition_kind || 'NODE');
        const from = normalizeEndpoint(spec?.from || program.edges[index].from, 'From'); requireNode(program, from.node_id, 'Connection source node'); assertOutputFree(program, from, edgeId);
        if (kind === 'NODE') {
          const to = normalizeEndpoint(spec?.to, 'To'); requireNode(program, to.node_id, 'Connection target node');
          replaced = {edge_id: edgeId, from, transition_kind: 'NODE', to};
        } else if (kind === 'CALL') {
          const subId = String(spec?.subroutine_id || ''); if (!program.subroutines.some((row) => row.id === subId)) throw new Error(`Subroutine not found: ${subId}`);
          const ret = normalizeEndpoint(spec?.return_to, 'Return'); requireNode(program, ret.node_id, 'CALL return node');
          replaced = {edge_id: edgeId, from, transition_kind: 'CALL', subroutine_id: subId, return_to: ret};
        } else if (kind === 'RETURN') replaced = {edge_id: edgeId, from, transition_kind: 'RETURN'};
        else throw new Error(`Unsupported transition kind: ${kind}`);
        program.edges[index] = replaced;
      });
      return clone(replaced);
    }
    function addSubroutine(entryNodeId, requestedId) {
      let row;
      commit((program) => {
        requireNode(program, entryNodeId, 'Subroutine entry node');
        const id = String(requestedId || nextId(program.subroutines, 'SUB', 'id'));
        if (program.subroutines.some((item) => item.id === id)) throw new Error(`Subroutine already exists: ${id}`);
        row = {id, entry_node_id: String(entryNodeId)}; program.subroutines.push(row);
      });
      return clone(row);
    }
    function updateSubroutine(id, entryNodeId) {
      commit((program) => {
        requireNode(program, entryNodeId, 'Subroutine entry node');
        const row = program.subroutines.find((item) => item.id === id); if (!row) throw new Error(`Subroutine not found: ${id}`);
        row.entry_node_id = String(entryNodeId);
      });
    }
    function removeSubroutine(id) {
      commit((program) => {
        if (!program.subroutines.some((item) => item.id === id)) throw new Error(`Subroutine not found: ${id}`);
        program.subroutines = program.subroutines.filter((item) => item.id !== id);
        program.edges = program.edges.filter((edge) => !(edge.transition_kind === 'CALL' && edge.subroutine_id === id));
      });
    }
    function undo() { if (!undoStack.length) return false; redoStack.push(clone(current)); current = undoStack.pop(); return true; }
    function redo() { if (!redoStack.length) return false; undoStack.push(clone(current)); current = redoStack.pop(); return true; }
    function replace(value) { current = Model.normalizeProgram(value); undoStack = []; redoStack = []; }
    return Object.freeze({
      program:()=>clone(current), addNode, duplicateNode, updateNode, removeNode, setEntryNode,
      connect, connectCall, connectReturn, removeEdge, replaceEdge,
      addSubroutine, updateSubroutine, removeSubroutine,
      undo, redo, replace, canUndo:()=>undoStack.length>0, canRedo:()=>redoStack.length>0
    });
  }
  return Object.freeze({create, defaultParameters});
});
