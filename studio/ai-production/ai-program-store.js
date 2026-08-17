(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('../../shared/ai/ai-program-model.js') : root && root.GKSAIProgramModel;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  if (!Model) throw new Error('GKSAIProgramModel is required');
  const PROGRAM_KEYS = new Set(['schema_version','data_version','id','name','version','status','entry_node_id','nodes','edges','subroutines','tags','description','updated_at','compiled']);
  const NODE_KEYS = new Set(['instance_id','master_node_id','master_data_version','node_type','position','parameters','comment']);
  const POSITION_KEYS = new Set(['x','y']);
  const EDGE_KEYS = new Set(['edge_id','from','to']);
  const ENDPOINT_KEYS = new Set(['node_id','port_id']);
  const SUBROUTINE_KEYS = new Set(['id','entry_node_id']);
  const STATUS = new Set(['draft','valid','invalid','archived']);
  const NODE_TYPES = new Set(['condition','target','action']);
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  function own(value,key){return Object.prototype.hasOwnProperty.call(value,key);}
  function assertAllowedKeys(value, allowed, at) {
    for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${at}.${key} is not allowed`);
  }
  function assertString(value, at, allowEmpty=false) {
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error(`${at} must be a string${allowEmpty?'':' with content'}`);
  }
  function assertEndpoint(value, at) {
    if (!isObject(value)) throw new Error(`${at} must be an object`);
    assertAllowedKeys(value, ENDPOINT_KEYS, at);
    if (!own(value,'node_id') || !own(value,'port_id')) throw new Error(`${at} is missing required fields`);
    assertString(value.node_id, `${at}.node_id`); assertString(value.port_id, `${at}.port_id`);
  }
  function assertProgramShape(program, index) {
    const at=`ai_programs[${index}]`;
    if (!isObject(program)) throw new Error(`${at} must be an object`);
    assertAllowedKeys(program, PROGRAM_KEYS, at);
    for (const key of ['schema_version','data_version','id','name','version','status','entry_node_id','nodes','edges','subroutines']) if (!own(program,key)) throw new Error(`${at}.${key} is required`);
    if (program.schema_version !== Model.DATA_VERSION) throw new Error(`${at}.schema_version must be ${Model.DATA_VERSION}`);
    assertString(program.data_version, `${at}.data_version`); assertString(program.id, `${at}.id`); assertString(program.name, `${at}.name`);
    if (!Number.isInteger(program.version) || program.version < 1) throw new Error(`${at}.version must be a positive integer`);
    if (!STATUS.has(program.status)) throw new Error(`${at}.status is invalid`);
    assertString(program.entry_node_id, `${at}.entry_node_id`, program.status === 'draft');
    if (!Array.isArray(program.nodes) || !Array.isArray(program.edges) || !Array.isArray(program.subroutines)) throw new Error(`${at} graph collections must be arrays`);
    if (own(program,'tags') && (!Array.isArray(program.tags) || program.tags.some(x=>typeof x!=='string'||!x))) throw new Error(`${at}.tags must be an array of strings`);
    if (own(program,'description') && typeof program.description !== 'string') throw new Error(`${at}.description must be a string`);
    if (own(program,'updated_at') && typeof program.updated_at !== 'string') throw new Error(`${at}.updated_at must be a string`);
    if (own(program,'compiled') && program.compiled !== null && !isObject(program.compiled)) throw new Error(`${at}.compiled must be an object or null`);
    program.nodes.forEach((node,nodeIndex)=>{
      const nat=`${at}.nodes[${nodeIndex}]`; if(!isObject(node))throw new Error(`${nat} must be an object`); assertAllowedKeys(node,NODE_KEYS,nat);
      for(const key of ['instance_id','master_node_id','node_type','position','parameters'])if(!own(node,key))throw new Error(`${nat}.${key} is required`);
      assertString(node.instance_id,`${nat}.instance_id`);assertString(node.master_node_id,`${nat}.master_node_id`);
      if(own(node,'master_data_version'))assertString(node.master_data_version,`${nat}.master_data_version`);
      if(!NODE_TYPES.has(node.node_type))throw new Error(`${nat}.node_type is invalid`);
      if(!isObject(node.position))throw new Error(`${nat}.position must be an object`);assertAllowedKeys(node.position,POSITION_KEYS,`${nat}.position`);
      if(!own(node.position,'x')||!own(node.position,'y')||typeof node.position.x!=='number'||typeof node.position.y!=='number')throw new Error(`${nat}.position is invalid`);
      if(!isObject(node.parameters))throw new Error(`${nat}.parameters must be an object`);
      if(own(node,'comment')&&typeof node.comment!=='string')throw new Error(`${nat}.comment must be a string`);
    });
    program.edges.forEach((edge,edgeIndex)=>{
      const eat=`${at}.edges[${edgeIndex}]`;if(!isObject(edge))throw new Error(`${eat} must be an object`);assertAllowedKeys(edge,EDGE_KEYS,eat);
      for(const key of ['edge_id','from','to'])if(!own(edge,key))throw new Error(`${eat}.${key} is required`);assertString(edge.edge_id,`${eat}.edge_id`);assertEndpoint(edge.from,`${eat}.from`);assertEndpoint(edge.to,`${eat}.to`);
    });
    program.subroutines.forEach((row,rowIndex)=>{
      const sat=`${at}.subroutines[${rowIndex}]`;if(!isObject(row))throw new Error(`${sat} must be an object`);assertAllowedKeys(row,SUBROUTINE_KEYS,sat);
      if(!own(row,'id')||!own(row,'entry_node_id'))throw new Error(`${sat} is missing required fields`);assertString(row.id,`${sat}.id`);assertString(row.entry_node_id,`${sat}.entry_node_id`);
    });
  }
  function normalizeProject(projectData) {
    if (!isObject(projectData)) throw new TypeError('Studio project data must be an object');
    if (!own(projectData,'ai_programs') || !Array.isArray(projectData.ai_programs)) throw new TypeError('Studio project data.ai_programs must be an array');
    projectData.ai_programs.forEach(assertProgramShape);
    projectData.ai_programs = projectData.ai_programs.map(Model.normalizeProgram);
    return projectData;
  }
  function inspect(projectData) {
    if (!isObject(projectData) || !Array.isArray(projectData.ai_programs)) return Object.freeze({valid:false, duplicate_ids:[], missing_id_indexes:[]});
    const duplicateIds = Model.duplicateIds(projectData.ai_programs);
    const missingIds = projectData.ai_programs.reduce((rows, program, index) => { if (!String(program?.id || '').trim()) rows.push(index); return rows; }, []);
    return Object.freeze({valid: duplicateIds.length === 0 && missingIds.length === 0, duplicate_ids: duplicateIds, missing_id_indexes: missingIds});
  }
  function nextProgramId(projectData) {
    if (!isObject(projectData) || !Array.isArray(projectData.ai_programs)) throw new TypeError('Studio project data.ai_programs must be an array');
    return Model.nextProgramId(projectData.ai_programs);
  }
  function upsert(projectData, value) {
    normalizeProject(projectData);
    assertProgramShape(value, 'input');
    const program = Model.normalizeProgram(value);
    if (!program.id) throw new Error('AI program id is required');
    const matches = projectData.ai_programs.reduce((rows, item, index) => { if (item.id === program.id) rows.push(index); return rows; }, []);
    if (matches.length > 1) throw new Error(`Duplicate AI program id: ${program.id}`);
    if (matches.length === 1) projectData.ai_programs[matches[0]] = program; else projectData.ai_programs.push(program);
    return program;
  }
  function duplicate(projectData, sourceId, now) {
    normalizeProject(projectData);
    const source = projectData.ai_programs.find((program) => program.id === sourceId);
    if (!source) throw new Error(`AI program not found: ${sourceId}`);
    const copy = Model.duplicateProgram(source, nextProgramId(projectData), now);
    projectData.ai_programs.push(copy);
    return copy;
  }
  return Object.freeze({normalizeProject, inspect, nextProgramId, upsert, duplicate});
});
