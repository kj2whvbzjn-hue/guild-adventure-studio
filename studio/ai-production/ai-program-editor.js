(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('./ai-program-model.js') : root && root.GKSAIProgramModel;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  if (!Model) throw new Error('GKSAIProgramModel is required');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function nextId(rows, prefix, key) {
    let max = 0;
    for (const row of rows) {
      const match = new RegExp(`^${prefix}-([0-9]+)$`).exec(String(row?.[key] || ''));
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
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
    function addNode(definition, parameters, position) {
      if (!definition?.id || !['condition','target','action'].includes(definition.node_type)) throw new Error('Valid AI master definition is required');
      let created;
      commit((program) => {
        created = {
          instance_id: nextId(program.nodes, 'AIN', 'instance_id'), master_node_id: String(definition.id),
          master_data_version: String(definition.data_version || Model.DATA_VERSION), node_type: definition.node_type,
          position: {x:Number(position?.x)||0, y:Number(position?.y)||0}, parameters: clone(parameters || {}), comment: ''
        };
        program.nodes.push(created);
        if (!program.entry_node_id) program.entry_node_id = created.instance_id;
      });
      return clone(created);
    }
    function updateNode(instanceId, patch) {
      commit((program) => {
        const node = program.nodes.find((item) => item.instance_id === instanceId);
        if (!node) throw new Error(`AI node not found: ${instanceId}`);
        if (patch.position) node.position = {x:Number(patch.position.x)||0,y:Number(patch.position.y)||0};
        if (patch.parameters) node.parameters = clone(patch.parameters);
        if (patch.comment !== undefined) node.comment = String(patch.comment || '');
      });
    }
    function connect(from, to) {
      let edge;
      commit((program) => {
        const ids = new Set(program.nodes.map((node) => node.instance_id));
        if (!ids.has(from?.node_id) || !ids.has(to?.node_id)) throw new Error('Connection endpoint node does not exist');
        if (!from.port_id || !to.port_id) throw new Error('Connection port is required');
        const duplicate = program.edges.some((item) => item.from.node_id === from.node_id && item.from.port_id === from.port_id && item.to.node_id === to.node_id && item.to.port_id === to.port_id);
        if (duplicate) throw new Error('Connection already exists');
        edge = {edge_id:nextId(program.edges,'AIE','edge_id'),from:{node_id:String(from.node_id),port_id:String(from.port_id)},to:{node_id:String(to.node_id),port_id:String(to.port_id)}};
        program.edges.push(edge);
      });
      return clone(edge);
    }
    function undo() { if (!undoStack.length) return false; redoStack.push(clone(current)); current = undoStack.pop(); return true; }
    function redo() { if (!redoStack.length) return false; undoStack.push(clone(current)); current = redoStack.pop(); return true; }
    function replace(value) { current = Model.normalizeProgram(value); undoStack = []; redoStack = []; }
    return Object.freeze({program:()=>clone(current),addNode,updateNode,connect,undo,redo,replace,canUndo:()=>undoStack.length>0,canRedo:()=>redoStack.length>0});
  }
  return Object.freeze({create});
});
