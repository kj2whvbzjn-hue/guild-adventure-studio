(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = '2.0.0';
  const DATA_VERSION = '';
  const PROGRAM_ID_PATTERN = /^AIP-([0-9]+)$/;
  const STATUS = new Set(['draft', 'valid', 'invalid', 'archived']);
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeProgram(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? clone(value) : {};
    return Object.assign(source, {
      schema_version: typeof source.schema_version === 'string' ? source.schema_version : SCHEMA_VERSION,
      data_version: typeof source.data_version === 'string' ? source.data_version : DATA_VERSION,
      id: typeof source.id === 'string' ? source.id : '',
      name: typeof source.name === 'string' ? source.name : '',
      version: Number.isInteger(source.version) && source.version > 0 ? source.version : 1,
      status: STATUS.has(source.status) ? source.status : 'draft',
      entry_node_id: typeof source.entry_node_id === 'string' ? source.entry_node_id : '',
      nodes: Array.isArray(source.nodes) ? source.nodes : [],
      edges: Array.isArray(source.edges) ? source.edges : [],
      subroutines: Array.isArray(source.subroutines) ? source.subroutines : [],
      result_slots: Array.isArray(source.result_slots) ? source.result_slots : [],
      tags: Array.isArray(source.tags) ? source.tags : [],
      description: typeof source.description === 'string' ? source.description : ''
    });
  }
  function duplicateIds(programs) {
    const seen = new Set(), duplicates = new Set();
    for (const program of Array.isArray(programs) ? programs : []) {
      const id = typeof program?.id === 'string' ? program.id : '';
      if (!id) continue;
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    return Array.from(duplicates).sort();
  }
  function nextProgramId(programs) {
    const used = new Set((Array.isArray(programs) ? programs : []).map((program) => String(program?.id || '')));
    let max = 0;
    for (const id of used) {
      const match = PROGRAM_ID_PATTERN.exec(id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    let number = max + 1;
    let candidate = `AIP-${String(number).padStart(4, '0')}`;
    while (used.has(candidate)) {
      number += 1;
      candidate = `AIP-${String(number).padStart(4, '0')}`;
    }
    return candidate;
  }
  function createProgram(id, now, dataVersion) {
    return normalizeProgram({
      id: String(id || ''), data_version: String(dataVersion || DATA_VERSION), name: '新しいAIプログラム', updated_at: String(now || ''),
      status: 'draft', entry_node_id: '', nodes: [], edges: [], subroutines: [], result_slots: [], tags: [], description: ''
    });
  }
  function duplicateProgram(value, id, now) {
    const copy = normalizeProgram(value);
    copy.id = String(id || '');
    copy.name = `${copy.name || 'AIプログラム'} のコピー`;
    copy.version = 1;
    copy.status = 'draft';
    copy.updated_at = String(now || '');
    copy.compiled = null;
    return copy;
  }
  return Object.freeze({SCHEMA_VERSION,DATA_VERSION, normalizeProgram, duplicateIds, nextProgramId, createProgram, duplicateProgram});
});
