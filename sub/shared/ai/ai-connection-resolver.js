(function (root, factory) {
  const Layout = typeof module === 'object' && module.exports ? require('./ai-layout-model.js') : root && root.GKSAILayoutModel;
  const Adapter = typeof module === 'object' && module.exports ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter;
  const api = factory(Layout, Adapter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIConnectionResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Layout, Adapter) {
  'use strict';

  if (!Layout) throw new Error('GKSAILayoutModel is required');
  if (!Adapter) throw new Error('GKSAIMasterAdapter is required');

  const DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);
  const VECTORS = Object.freeze({
    north: Object.freeze({x: 0, y: -1}),
    east: Object.freeze({x: 1, y: 0}),
    south: Object.freeze({x: 0, y: 1}),
    west: Object.freeze({x: -1, y: 0})
  });
  const OPPOSITE = Object.freeze({north: 'south', east: 'west', south: 'north', west: 'east'});
  const SEVERITY_RANK = Object.freeze({ERROR: 0, WARNING: 1, INFO: 2});
  const BASE_PORT_SIDES = Object.freeze({
    condition: Object.freeze({in: 'west', true: 'east', false: 'south'}),
    target: Object.freeze({in: 'west', next: 'east'}),
    action: Object.freeze({in: 'west'})
  });

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const cellKey = (x, y) => `${x},${y}`;
  const edgeKey = (edge) => `${edge.from.node_id}.${edge.from.port_id}>${edge.to.node_id}.${edge.to.port_id}`;

  function rotateSide(side, rotation) {
    const index = DIRECTIONS.indexOf(side);
    if (index < 0) throw new Error(`Unsupported side: ${side}`);
    const turns = ((Number(rotation) || 0) / 90) % 4;
    if (!Number.isInteger(turns)) throw new Error(`Unsupported rotation: ${rotation}`);
    return DIRECTIONS[(index + turns + 4) % 4];
  }

  function portSidesForNode(definition, rotation) {
    const type = String(definition?.node_type || '');
    const base = BASE_PORT_SIDES[type] || {};
    const ports = [];
    for (const port of Array.isArray(definition?.ports?.inputs) ? definition.ports.inputs : []) {
      if (base[port.id]) ports.push({port_id: String(port.id), direction: 'input', side: rotateSide(base[port.id], rotation)});
    }
    for (const port of Array.isArray(definition?.ports?.outputs) ? definition.ports.outputs : []) {
      if (base[port.id]) ports.push({port_id: String(port.id), direction: 'output', side: rotateSide(base[port.id], rotation)});
    }
    return ports;
  }

  function extensionSides(extension) {
    const shape = String(extension?.shape || '');
    const rotation = Number(extension?.rotation) || 0;
    const base = shape === 'straight' ? ['west', 'east'] : shape === 'corner' ? ['north', 'east'] : [];
    return base.map((side) => rotateSide(side, rotation));
  }

  function issue(severity, code, message, location) {
    return Object.freeze({severity, code, message, ...(location || {})});
  }

  function definitionFor(node, projectData) {
    if (!node) return null;
    const typeToCategory = {condition: 'ai_conditions', target: 'ai_targets', action: 'ai_actions'};
    const category = typeToCategory[node.node_type];
    if (!category) return null;
    const master = (projectData?.masters?.[category] || []).find((row) => String(row?.id || '') === String(node.master_node_id || ''));
    return master ? Adapter.toNode(master, category) : null;
  }

  function nextCell(x, y, side) {
    const vector = VECTORS[side];
    return {x: x + vector.x, y: y + vector.y};
  }

  function resolve(layoutValue, programValue, projectData) {
    const diagnostics = [];
    let layout;
    try {
      layout = Layout.normalizeLayout(layoutValue);
      Layout.assertValidLayout(layout);
    } catch (error) {
      const rows = Array.isArray(error?.errors) ? error.errors : [String(error?.message || error)];
      for (const message of rows) diagnostics.push(issue('ERROR', 'AI_LAYOUT_INVALID', message));
      return finalize([], [], diagnostics, {});
    }

    const program = programValue && typeof programValue === 'object' ? programValue : {};
    const nodes = Array.isArray(program.nodes) ? program.nodes : [];
    const nodeById = new Map(nodes.map((node) => [String(node?.instance_id || ''), node]).filter(([id]) => id));
    const chipById = new Map(layout.chips.map((chip) => [chip.instance_id, chip]));
    const itemByCell = new Map();
    for (const chip of layout.chips) itemByCell.set(cellKey(chip.x, chip.y), {kind: 'chip', value: chip});
    for (const extension of layout.extensions) itemByCell.set(cellKey(extension.x, extension.y), {kind: 'extension', value: extension});

    if (String(layout.program_id || '') !== String(program.id || '')) {
      diagnostics.push(issue('ERROR', 'AI_LAYOUT_PROGRAM_MISMATCH', `Layoutのprogram_idとFormal Program IDが一致しません: ${layout.program_id || '未設定'} / ${program.id || '未設定'}`));
    }

    for (const node of nodes) {
      const id = String(node?.instance_id || '');
      if (id && !chipById.has(id)) diagnostics.push(issue('ERROR', 'AI_LAYOUT_NODE_MISSING', `Formal Program部品が盤面にありません: ${id}`, {node_id: id}));
    }
    for (const chip of layout.chips) {
      if (!nodeById.has(chip.instance_id)) diagnostics.push(issue('ERROR', 'AI_LAYOUT_UNKNOWN_NODE', `盤面部品がFormal Programに存在しません: ${chip.instance_id}`, {node_id: chip.instance_id}));
    }

    const nodeInfo = new Map();
    for (const chip of layout.chips) {
      const node = nodeById.get(chip.instance_id);
      const definition = definitionFor(node, projectData || {});
      if (!node) continue;
      if (!definition) {
        diagnostics.push(issue('ERROR', 'AI_MASTER_NOT_FOUND', `接続判定に必要なAI部品マスターが存在しません: ${node.master_node_id || '未設定'}`, {node_id: chip.instance_id}));
        continue;
      }
      const ports = portSidesForNode(definition, chip.rotation);
      nodeInfo.set(chip.instance_id, {node, definition, chip, ports});
    }

    function portOnSide(nodeId, side, direction) {
      const info = nodeInfo.get(nodeId);
      if (!info) return null;
      return info.ports.find((port) => port.side === side && port.direction === direction) || null;
    }

    function insideBoard(x, y) {
      return x >= 0 && y >= 0 && x < layout.width && y < layout.height;
    }

    const usedExtensions = new Set();
    const resolved = [];
    const connectionDetails = [];

    function traceOutput(sourceInfo, sourcePort) {
      let x = sourceInfo.chip.x;
      let y = sourceInfo.chip.y;
      let exitSide = sourcePort.side;
      const visited = new Set();
      const path = [];

      while (true) {
        const next = nextCell(x, y, exitSide);
        if (!insideBoard(next.x, next.y)) {
          diagnostics.push(issue('ERROR', 'AI_OUTPUT_OPEN', `出力先が盤面外です: ${sourceInfo.node.instance_id}.${sourcePort.port_id}`, {node_id: sourceInfo.node.instance_id, port_id: sourcePort.port_id}));
          return;
        }
        const item = itemByCell.get(cellKey(next.x, next.y));
        if (!item) {
          diagnostics.push(issue('ERROR', 'AI_OUTPUT_OPEN', `出力ポートが未接続です: ${sourceInfo.node.instance_id}.${sourcePort.port_id}`, {node_id: sourceInfo.node.instance_id, port_id: sourcePort.port_id}));
          return;
        }

        const entrySide = OPPOSITE[exitSide];
        if (item.kind === 'chip') {
          const targetId = item.value.instance_id;
          const input = portOnSide(targetId, entrySide, 'input');
          if (!input) {
            const output = portOnSide(targetId, entrySide, 'output');
            const code = output ? 'AI_PORT_DIRECTION_INVALID' : 'AI_PORT_SIDE_MISMATCH';
            const message = output
              ? `出口同士は接続できません: ${sourceInfo.node.instance_id}.${sourcePort.port_id} → ${targetId}.${output.port_id}`
              : `向き合う入力ポートがありません: ${sourceInfo.node.instance_id}.${sourcePort.port_id} → ${targetId}`;
            diagnostics.push(issue('ERROR', code, message, {node_id: sourceInfo.node.instance_id, port_id: sourcePort.port_id, target_node_id: targetId}));
            return;
          }
          const edge = {
            edge_id: '',
            from: {node_id: sourceInfo.node.instance_id, port_id: sourcePort.port_id},
            to: {node_id: targetId, port_id: input.port_id}
          };
          resolved.push(edge);
          connectionDetails.push({from: clone(edge.from), to: clone(edge.to), extension_ids: path.slice()});
          path.forEach((id) => usedExtensions.add(id));
          return;
        }

        const extension = item.value;
        const extensionKey = extension.id || cellKey(extension.x, extension.y);
        if (visited.has(extensionKey)) {
          diagnostics.push(issue('ERROR', 'AI_EXTENSION_LOOP', `延長パネルが循環しています: ${extension.id}`, {extension_id: extension.id}));
          return;
        }
        visited.add(extensionKey);
        path.push(extension.id);
        const sides = extensionSides(extension);
        if (!sides.includes(entrySide)) {
          diagnostics.push(issue('ERROR', 'AI_EXTENSION_SIDE_MISMATCH', `延長パネルの向きが接続方向と一致しません: ${extension.id}`, {extension_id: extension.id}));
          return;
        }
        exitSide = sides.find((side) => side !== entrySide);
        if (!exitSide) {
          diagnostics.push(issue('ERROR', 'AI_EXTENSION_INVALID', `延長パネルの接続面が不正です: ${extension.id}`, {extension_id: extension.id}));
          return;
        }
        x = extension.x;
        y = extension.y;
      }
    }

    for (const info of [...nodeInfo.values()].sort((a, b) => a.node.instance_id.localeCompare(b.node.instance_id))) {
      const outputs = info.ports.filter((port) => port.direction === 'output').sort((a, b) => a.port_id.localeCompare(b.port_id));
      for (const output of outputs) traceOutput(info, output);
    }

    const signature = new Set();
    const outputUse = new Map();
    const inputUse = new Map();
    const uniqueEdges = [];
    for (const edge of resolved.sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)))) {
      const signatureKey = edgeKey(edge);
      if (signature.has(signatureKey)) continue;
      signature.add(signatureKey);
      uniqueEdges.push(edge);
      const outKey = `${edge.from.node_id}.${edge.from.port_id}`;
      const inKey = `${edge.to.node_id}.${edge.to.port_id}`;
      outputUse.set(outKey, (outputUse.get(outKey) || 0) + 1);
      inputUse.set(inKey, (inputUse.get(inKey) || 0) + 1);
    }

    for (const [key, count] of outputUse) {
      if (count > 1) diagnostics.push(issue('ERROR', 'AI_OUTPUT_AMBIGUOUS', `同じ出力ポートに複数の接続があります: ${key}`));
    }
    for (const [key, count] of inputUse) {
      if (count > 1) diagnostics.push(issue('ERROR', 'AI_INPUT_AMBIGUOUS', `同じ入力ポートに複数の接続があります: ${key}`));
    }

    for (const info of nodeInfo.values()) {
      const input = info.ports.find((port) => port.direction === 'input');
      if (!input) continue;
      const key = `${info.node.instance_id}.${input.port_id}`;
      if (info.node.instance_id !== String(program.entry_node_id || '') && !inputUse.get(key)) {
        diagnostics.push(issue('ERROR', 'AI_INPUT_REQUIRED', `入力ポートが未接続です: ${key}`, {node_id: info.node.instance_id, port_id: input.port_id}));
      }
    }

    function extensionNeighbors(extension) {
      const rows = [];
      for (const side of extensionSides(extension)) {
        const next = nextCell(extension.x, extension.y, side);
        if (!insideBoard(next.x, next.y)) continue;
        const item = itemByCell.get(cellKey(next.x, next.y));
        if (!item) continue;
        const entrySide = OPPOSITE[side];
        if (item.kind === 'extension') {
          if (extensionSides(item.value).includes(entrySide)) rows.push(item.value.id);
        }
      }
      return rows;
    }

    const extensionGraph = new Map(layout.extensions.map((extension) => [extension.id, extensionNeighbors(extension)]));
    const visiting = new Set();
    const done = new Set();
    const loopMembers = new Set();
    function walkExtension(id, parent, path) {
      if (visiting.has(id)) {
        const at = path.indexOf(id);
        for (const member of path.slice(at)) loopMembers.add(member);
        loopMembers.add(id);
        return;
      }
      if (done.has(id)) return;
      visiting.add(id);
      for (const next of extensionGraph.get(id) || []) {
        if (next === parent) continue;
        walkExtension(next, id, [...path, id]);
      }
      visiting.delete(id);
      done.add(id);
    }
    for (const id of [...extensionGraph.keys()].sort()) walkExtension(id, '', []);

    for (const extension of layout.extensions) {
      if (loopMembers.has(extension.id) && !diagnostics.some((row) => row.code === 'AI_EXTENSION_LOOP' && row.extension_id === extension.id)) {
        diagnostics.push(issue('ERROR', 'AI_EXTENSION_LOOP', `延長パネルが循環しています: ${extension.id}`, {extension_id: extension.id}));
      }
      if (!usedExtensions.has(extension.id) && !loopMembers.has(extension.id)) {
        diagnostics.push(issue('ERROR', 'AI_EXTENSION_ORPHAN', `延長パネルが有効な部品間接続に使われていません: ${extension.id}`, {extension_id: extension.id}));
      }
    }

    uniqueEdges.forEach((edge, index) => { edge.edge_id = `AIE-${String(index + 1).padStart(4, '0')}`; });

    const portMap = {};
    for (const [id, info] of nodeInfo) portMap[id] = clone(info.ports);
    return finalize(uniqueEdges, connectionDetails, diagnostics, portMap);
  }

  function finalize(edges, connections, diagnostics, portMap) {
    const rows = [...diagnostics].sort((a, b) =>
      (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) ||
      String(a.node_id || a.extension_id || '').localeCompare(String(b.node_id || b.extension_id || '')) ||
      a.code.localeCompare(b.code) || a.message.localeCompare(b.message)
    );
    const summary = {ERROR: 0, WARNING: 0, INFO: 0};
    rows.forEach((row) => { summary[row.severity] += 1; });
    return Object.freeze({
      valid: summary.ERROR === 0,
      edges: Object.freeze(clone(edges)),
      connections: Object.freeze(clone(connections)),
      diagnostics: Object.freeze(rows),
      summary: Object.freeze(summary),
      port_map: Object.freeze(clone(portMap))
    });
  }

  function applyToProgram(programValue, resolution) {
    if (!programValue || typeof programValue !== 'object') throw new Error('Formal Program is required');
    if (!resolution || resolution.valid !== true) {
      const error = new Error('Connection resolution must be valid before Program edges can be replaced');
      error.code = 'AI_CONNECTION_RESOLUTION_INVALID';
      throw error;
    }
    const next = clone(programValue);
    next.edges = clone(resolution.edges || []);
    return next;
  }

  return Object.freeze({
    DIRECTIONS,
    VECTORS,
    OPPOSITE,
    BASE_PORT_SIDES,
    rotateSide,
    portSidesForNode,
    extensionSides,
    resolve,
    applyToProgram
  });
});
