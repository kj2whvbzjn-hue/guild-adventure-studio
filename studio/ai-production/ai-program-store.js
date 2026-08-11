(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('./ai-program-model.js') : root && root.GKSAIProgramModel;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  if (!Model) throw new Error('GKSAIProgramModel is required');
  function normalizeProject(projectData) {
    if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) throw new TypeError('Studio project data must be an object');
    const source = Array.isArray(projectData.ai_programs) ? projectData.ai_programs : [];
    projectData.ai_programs = source.map(Model.normalizeProgram);
    return projectData;
  }
  function inspect(projectData) {
    const programs = Array.isArray(projectData?.ai_programs) ? projectData.ai_programs : [];
    const duplicateIds = Model.duplicateIds(programs);
    const missingIds = programs.reduce((rows, program, index) => {
      if (!String(program?.id || '').trim()) rows.push(index);
      return rows;
    }, []);
    return Object.freeze({valid: duplicateIds.length === 0 && missingIds.length === 0, duplicate_ids: duplicateIds, missing_id_indexes: missingIds});
  }
  function nextProgramId(projectData) {
    return Model.nextProgramId(Array.isArray(projectData?.ai_programs) ? projectData.ai_programs : []);
  }
  function upsert(projectData, value) {
    normalizeProject(projectData);
    const program = Model.normalizeProgram(value);
    if (!program.id) throw new Error('AI program id is required');
    const matches = projectData.ai_programs.reduce((rows, item, index) => {
      if (item.id === program.id) rows.push(index);
      return rows;
    }, []);
    if (matches.length > 1) throw new Error(`Duplicate AI program id: ${program.id}`);
    if (matches.length === 1) projectData.ai_programs[matches[0]] = program;
    else projectData.ai_programs.push(program);
    return program;
  }
  return Object.freeze({normalizeProject, inspect, nextProgramId, upsert});
});
