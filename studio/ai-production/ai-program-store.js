(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('../../shared/ai/ai-program-model.js') : root && root.GKSAIProgramModel;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  if (!Model) throw new Error('GKSAIProgramModel is required');

  const SCHEMA_VERSION = '2.0.0';
  const PROGRAM_KEYS = new Set(['schema_version','data_version','id','name','version','status','entry_node_id','nodes','edges','subroutines','tags','description','updated_at','compiled']);
  const NODE_KEYS = new Set(['instance_id','master_node_id','master_data_version','node_type','position','parameters','target_selector','comment']);
  const POSITION_KEYS = new Set(['x','y']);
  const EDGE_KEYS = new Set(['edge_id','from','transition_kind','to','subroutine_id','return_to']);
  const ENDPOINT_KEYS = new Set(['node_id','port_id']);
  const SUBROUTINE_KEYS = new Set(['id','entry_node_id']);
  const PREDICATE_KEYS = new Set(['logic','clauses']);
  const CLAUSE_KEYS = new Set(['predicate_master_id','params','negate']);
  const SELECTOR_KEYS = new Set(['selector_id','params']);
  const LAYOUT_KEYS = new Set(['schema_version','data_version','layout_id','program_id','width','height','chips','extensions']);
  const CHIP_KEYS = new Set(['instance_id','x','y','rotation']);
  const STATUS = new Set(['draft','valid','invalid','archived']);
  const NODE_TYPES = new Set(['search','condition','action']);
  const SEARCH_SCOPES = new Set(['SELF','ALLY','ENEMY','ANY']);
  const STATE_CHECK_SUBJECTS = new Set(['SELF','BATTLE']);
  const TRANSITIONS = new Set(['NODE','CALL','RETURN']);
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function own(value,key){return Object.prototype.hasOwnProperty.call(value,key);}
  function assertAllowedKeys(value, allowed, at) { for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${at}.${key} is not allowed`); }
  function assertString(value, at, allowEmpty=false) { if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error(`${at} must be a string${allowEmpty?'':' with content'}`); }
  function assertPattern(value, pattern, at) { assertString(value, at); if (!pattern.test(value)) throw new Error(`${at} has an invalid identifier`); }
  function assertEndpoint(value, at) {
    if (!isObject(value)) throw new Error(`${at} must be an object`); assertAllowedKeys(value, ENDPOINT_KEYS, at);
    if (!own(value,'node_id') || !own(value,'port_id')) throw new Error(`${at} is missing required fields`);
    assertString(value.node_id, `${at}.node_id`); assertString(value.port_id, `${at}.port_id`);
  }
  function assertPredicate(value, at) {
    if (!isObject(value)) throw new Error(`${at} must be an object`); assertAllowedKeys(value, PREDICATE_KEYS, at);
    if (!['ALL','ANY'].includes(value.logic)) throw new Error(`${at}.logic must be ALL or ANY`);
    if (!Array.isArray(value.clauses) || value.clauses.length < 1) throw new Error(`${at}.clauses must contain at least one predicate clause`);
    value.clauses.forEach((clause,index)=>{
      const cat=`${at}.clauses[${index}]`; if(!isObject(clause))throw new Error(`${cat} must be an object`); assertAllowedKeys(clause,CLAUSE_KEYS,cat);
      for(const key of ['predicate_master_id','params','negate'])if(!own(clause,key))throw new Error(`${cat}.${key} is required`);
      assertPattern(clause.predicate_master_id,/^AIC-[A-Za-z0-9_.-]+$/,`${cat}.predicate_master_id`);
      if(!isObject(clause.params))throw new Error(`${cat}.params must be an object`); if(typeof clause.negate!=='boolean')throw new Error(`${cat}.negate must be a boolean`);
    });
  }
  function assertTargetSelector(value, at) {
    if(value===null)return; if(!isObject(value))throw new Error(`${at} must be null or an object`); assertAllowedKeys(value,SELECTOR_KEYS,at);
    for(const key of ['selector_id','params'])if(!own(value,key))throw new Error(`${at}.${key} is required`);
    assertPattern(value.selector_id,/^ATS-[A-Za-z0-9_.-]+$/,`${at}.selector_id`); if(!isObject(value.params))throw new Error(`${at}.params must be an object`);
  }
  function assertNode(node, nat) {
    if(!isObject(node))throw new Error(`${nat} must be an object`); assertAllowedKeys(node,NODE_KEYS,nat);
    for(const key of ['instance_id','master_node_id','node_type','position','parameters'])if(!own(node,key))throw new Error(`${nat}.${key} is required`);
    assertString(node.instance_id,`${nat}.instance_id`); if(!NODE_TYPES.has(node.node_type))throw new Error(`${nat}.node_type is invalid`);
    const prefix=node.node_type==='search'?/^AIS-/:node.node_type==='condition'?/^AIC-/:/^AIA-/; assertString(node.master_node_id,`${nat}.master_node_id`); if(!prefix.test(node.master_node_id))throw new Error(`${nat}.master_node_id does not match ${node.node_type}`);
    if(own(node,'master_data_version'))assertString(node.master_data_version,`${nat}.master_data_version`);
    if(!isObject(node.position))throw new Error(`${nat}.position must be an object`); assertAllowedKeys(node.position,POSITION_KEYS,`${nat}.position`);
    if(!own(node.position,'x')||!own(node.position,'y')||typeof node.position.x!=='number'||typeof node.position.y!=='number'||!Number.isFinite(node.position.x)||!Number.isFinite(node.position.y))throw new Error(`${nat}.position is invalid`);
    if(!isObject(node.parameters))throw new Error(`${nat}.parameters must be an object`);
    if(node.node_type==='search'){
      assertAllowedKeys(node.parameters,new Set(['scope','predicate']),`${nat}.parameters`); if(!SEARCH_SCOPES.has(node.parameters.scope))throw new Error(`${nat}.parameters.scope is invalid`); assertPredicate(node.parameters.predicate,`${nat}.parameters.predicate`);
      if(own(node,'target_selector')&&node.target_selector!==null)throw new Error(`${nat}.target_selector is forbidden for search`);
    }else if(node.node_type==='condition'){
      assertAllowedKeys(node.parameters,new Set(['subject_scope','predicate']),`${nat}.parameters`); if(!STATE_CHECK_SUBJECTS.has(node.parameters.subject_scope))throw new Error(`${nat}.parameters.subject_scope is invalid`); assertPredicate(node.parameters.predicate,`${nat}.parameters.predicate`);
      if(own(node,'target_selector')&&node.target_selector!==null)throw new Error(`${nat}.target_selector is forbidden for condition`);
    }else if(own(node,'target_selector')) assertTargetSelector(node.target_selector,`${nat}.target_selector`);
    if(own(node,'comment')&&typeof node.comment!=='string')throw new Error(`${nat}.comment must be a string`);
  }
  function assertEdge(edge, eat) {
    if(!isObject(edge))throw new Error(`${eat} must be an object`); assertAllowedKeys(edge,EDGE_KEYS,eat);
    for(const key of ['edge_id','from','transition_kind'])if(!own(edge,key))throw new Error(`${eat}.${key} is required`);
    assertString(edge.edge_id,`${eat}.edge_id`); assertEndpoint(edge.from,`${eat}.from`); if(!TRANSITIONS.has(edge.transition_kind))throw new Error(`${eat}.transition_kind is invalid`);
    if(edge.transition_kind==='NODE'){
      if(!own(edge,'to'))throw new Error(`${eat}.to is required for NODE transition`); assertEndpoint(edge.to,`${eat}.to`); if(own(edge,'subroutine_id')||own(edge,'return_to'))throw new Error(`${eat} NODE transition cannot carry CALL fields`);
    }else if(edge.transition_kind==='CALL'){
      if(own(edge,'to'))throw new Error(`${eat}.to is forbidden for CALL transition`); if(!own(edge,'subroutine_id')||!own(edge,'return_to'))throw new Error(`${eat} CALL transition requires subroutine_id and return_to`);
      assertString(edge.subroutine_id,`${eat}.subroutine_id`); assertEndpoint(edge.return_to,`${eat}.return_to`);
    }else if(own(edge,'to')||own(edge,'subroutine_id')||own(edge,'return_to'))throw new Error(`${eat} RETURN transition cannot carry target fields`);
  }
  function assertProgramShape(program, index) {
    const at=typeof index==='number'?`ai_programs[${index}]`:`ai_programs[${index}]`; if (!isObject(program)) throw new Error(`${at} must be an object`); assertAllowedKeys(program, PROGRAM_KEYS, at);
    for (const key of ['schema_version','data_version','id','name','version','status','entry_node_id','nodes','edges','subroutines']) if (!own(program,key)) throw new Error(`${at}.${key} is required`);
    if (program.schema_version !== SCHEMA_VERSION) throw new Error(`${at}.schema_version must be ${SCHEMA_VERSION}`); assertString(program.data_version, `${at}.data_version`); assertPattern(program.id,/^AIP-[A-Za-z0-9_.-]+$/,`${at}.id`); assertString(program.name, `${at}.name`);
    if (!Number.isInteger(program.version) || program.version < 1) throw new Error(`${at}.version must be a positive integer`); if (!STATUS.has(program.status)) throw new Error(`${at}.status is invalid`);
    assertString(program.entry_node_id, `${at}.entry_node_id`, program.status === 'draft'); if (!Array.isArray(program.nodes) || !Array.isArray(program.edges) || !Array.isArray(program.subroutines)) throw new Error(`${at} graph collections must be arrays`);
    if(program.status!=='draft'&&program.nodes.length<1)throw new Error(`${at}.nodes must contain at least one node`); if (own(program,'tags') && (!Array.isArray(program.tags) || program.tags.some(x=>typeof x!=='string'||!x))) throw new Error(`${at}.tags must be an array of strings`);
    if (own(program,'description') && typeof program.description !== 'string') throw new Error(`${at}.description must be a string`); if (own(program,'updated_at') && typeof program.updated_at !== 'string') throw new Error(`${at}.updated_at must be a string`); if (own(program,'compiled') && program.compiled !== null && !isObject(program.compiled)) throw new Error(`${at}.compiled must be an object or null`);
    program.nodes.forEach((node,nodeIndex)=>assertNode(node,`${at}.nodes[${nodeIndex}]`)); program.edges.forEach((edge,edgeIndex)=>assertEdge(edge,`${at}.edges[${edgeIndex}]`));
    program.subroutines.forEach((row,rowIndex)=>{const sat=`${at}.subroutines[${rowIndex}]`;if(!isObject(row))throw new Error(`${sat} must be an object`);assertAllowedKeys(row,SUBROUTINE_KEYS,sat);if(!own(row,'id')||!own(row,'entry_node_id'))throw new Error(`${sat} is missing required fields`);assertString(row.id,`${sat}.id`);assertString(row.entry_node_id,`${sat}.entry_node_id`);});
  }
  function assertLayoutShape(layout, index) {
    const at=typeof index==='number'?`ai_program_layouts[${index}]`:`ai_program_layouts[${index}]`; if(!isObject(layout))throw new Error(`${at} must be an object`); assertAllowedKeys(layout,LAYOUT_KEYS,at);
    for(const key of ['schema_version','data_version','layout_id','program_id','width','height','chips','extensions'])if(!own(layout,key))throw new Error(`${at}.${key} is required`);
    if(layout.schema_version!==SCHEMA_VERSION)throw new Error(`${at}.schema_version must be ${SCHEMA_VERSION}`); assertString(layout.data_version,`${at}.data_version`); assertPattern(layout.layout_id,/^AIL-[0-9]+$/,`${at}.layout_id`); assertPattern(layout.program_id,/^AIP-[A-Za-z0-9_.-]+$/,`${at}.program_id`);
    if(!Number.isInteger(layout.width)||layout.width<1||!Number.isInteger(layout.height)||layout.height<1)throw new Error(`${at} board size is invalid`); if(!Array.isArray(layout.chips)||!Array.isArray(layout.extensions))throw new Error(`${at} layout collections must be arrays`);
    const occupied=new Set(); layout.chips.forEach((chip,i)=>{const cat=`${at}.chips[${i}]`;if(!isObject(chip))throw new Error(`${cat} must be an object`);assertAllowedKeys(chip,CHIP_KEYS,cat);for(const k of ['instance_id','x','y','rotation'])if(!own(chip,k))throw new Error(`${cat}.${k} is required`);assertString(chip.instance_id,`${cat}.instance_id`);if(!Number.isInteger(chip.x)||chip.x<0||!Number.isInteger(chip.y)||chip.y<0||chip.x>=layout.width||chip.y>=layout.height)throw new Error(`${cat} position is invalid`);if(![0,90,180,270].includes(chip.rotation))throw new Error(`${cat}.rotation is invalid`);const key=`${chip.x},${chip.y}`;if(occupied.has(key))throw new Error(`${cat} overlaps another chip`);occupied.add(key);});
    if(layout.extensions.length)throw new Error(`${at}.extensions are not authored by the P7 graph editor`);
  }
  function assertRuntimeShape(runtime, at='ai_program_runtime') {
    if(!isObject(runtime))throw new Error(`${at} must be an object`); if(runtime.schema_version!==SCHEMA_VERSION)throw new Error(`${at}.schema_version must be ${SCHEMA_VERSION}`);
    for(const key of ['data_version','program_id','program_version','compiler_version','entry_instruction','instructions','source_map','limits','content_hash'])if(!own(runtime,key))throw new Error(`${at}.${key} is required`);
    assertString(runtime.data_version,`${at}.data_version`); assertPattern(runtime.program_id,/^AIP-[A-Za-z0-9_.-]+$/,`${at}.program_id`); if(!Number.isInteger(runtime.program_version)||runtime.program_version<1)throw new Error(`${at}.program_version is invalid`); if(!Array.isArray(runtime.instructions)||!runtime.instructions.length)throw new Error(`${at}.instructions must not be empty`); if(!isObject(runtime.source_map)||!isObject(runtime.limits))throw new Error(`${at} source_map/limits must be objects`); assertPattern(runtime.content_hash,/^[a-f0-9]{64}$/,`${at}.content_hash`);
  }
  function normalizeProject(projectData) {
    if (!isObject(projectData)) throw new TypeError('Studio project data must be an object');
    if (!own(projectData,'ai_programs')) projectData.ai_programs=[]; if (!own(projectData,'ai_program_layouts')) projectData.ai_program_layouts=[]; if (!own(projectData,'ai_program_runtime')) projectData.ai_program_runtime=[];
    if(!Array.isArray(projectData.ai_programs)||!Array.isArray(projectData.ai_program_layouts)||!Array.isArray(projectData.ai_program_runtime))throw new TypeError('Studio AI project collections must be arrays');
    projectData.ai_programs.forEach(assertProgramShape); projectData.ai_program_layouts.forEach(assertLayoutShape); projectData.ai_program_runtime.forEach((row,index)=>assertRuntimeShape(row,`ai_program_runtime[${index}]`));
    projectData.ai_programs = projectData.ai_programs.map(Model.normalizeProgram); return projectData;
  }
  function inspect(projectData) {
    if (!isObject(projectData) || !Array.isArray(projectData.ai_programs)) return Object.freeze({valid:false, duplicate_ids:[], missing_id_indexes:[]});
    const duplicateIds = Model.duplicateIds(projectData.ai_programs); const missingIds = projectData.ai_programs.reduce((rows, program, index) => { if (!String(program?.id || '').trim()) rows.push(index); return rows; }, []);
    return Object.freeze({valid: duplicateIds.length === 0 && missingIds.length === 0, duplicate_ids: duplicateIds, missing_id_indexes: missingIds});
  }
  function nextOwnedNumericId(rows,key,pattern,prefix,parity) {
    let max=0; for(const row of Array.isArray(rows)?rows:[]){const m=pattern.exec(String(row?.[key]||''));if(m)max=Math.max(max,Number(m[1]));}
    let number=max+1; if(number%2!==parity)number+=1; return `${prefix}-${String(number).padStart(4,'0')}`;
  }
  function nextProgramId(projectData) { normalizeProject(projectData); return nextOwnedNumericId(projectData.ai_programs,'id',/^AIP-([0-9]+)$/,'AIP',1); }
  function nextLayoutId(projectData) { normalizeProject(projectData); return nextOwnedNumericId(projectData.ai_program_layouts,'layout_id',/^AIL-([0-9]+)$/,'AIL',1); }
  function upsert(projectData, value) {
    normalizeProject(projectData); assertProgramShape(value, 'input'); const program = Model.normalizeProgram(value); const matches = projectData.ai_programs.reduce((rows, item, index) => { if (item.id === program.id) rows.push(index); return rows; }, []);
    if (matches.length > 1) throw new Error(`Duplicate AI program id: ${program.id}`); if (matches.length === 1) projectData.ai_programs[matches[0]] = program; else projectData.ai_programs.push(program); return program;
  }
  function upsertLayout(projectData, value) {
    normalizeProject(projectData); assertLayoutShape(value,'input'); const row=clone(value); const index=projectData.ai_program_layouts.findIndex((item)=>item.layout_id===row.layout_id); if(index>=0)projectData.ai_program_layouts[index]=row;else projectData.ai_program_layouts.push(row); return row;
  }
  function upsertRuntime(projectData, value) {
    normalizeProject(projectData); assertRuntimeShape(value,'input'); const row=clone(value); const matches=projectData.ai_program_runtime.reduce((out,item,index)=>{if(item.program_id===row.program_id)out.push(index);return out;},[]); if(matches.length>1)throw new Error(`Duplicate AI runtime: ${row.program_id}`); if(matches.length)projectData.ai_program_runtime[matches[0]]=row;else projectData.ai_program_runtime.push(row); return row;
  }
  function removeRuntime(projectData, programId) { normalizeProject(projectData); projectData.ai_program_runtime=projectData.ai_program_runtime.filter((row)=>row.program_id!==programId); }
  function layoutForProgram(projectData, programId) { normalizeProject(projectData); const rows=projectData.ai_program_layouts.filter((row)=>row.program_id===programId); if(rows.length>1)throw new Error(`Multiple AI layouts reference ${programId}`); return rows.length?clone(rows[0]):null; }
  function runtimeForProgram(projectData, programId) { normalizeProject(projectData); const rows=projectData.ai_program_runtime.filter((row)=>row.program_id===programId); if(rows.length>1)throw new Error(`Multiple AI runtimes reference ${programId}`); return rows.length?clone(rows[0]):null; }
  function layoutFromProgram(programValue, existingLayout, layoutId) {
    const program=Model.normalizeProgram(programValue); assertString(program.data_version,'program.data_version');
    const chips=program.nodes.map((node)=>({instance_id:String(node.instance_id),x:Math.max(0,Math.round(Number(node.position?.x)||0)),y:Math.max(0,Math.round(Number(node.position?.y)||0)),rotation:0}));
    const width=Math.max(8,...chips.map((chip)=>chip.x+1)),height=Math.max(8,...chips.map((chip)=>chip.y+1));
    const layout={schema_version:SCHEMA_VERSION,data_version:program.data_version,layout_id:String(existingLayout?.layout_id||layoutId||''),program_id:program.id,width,height,chips,extensions:[]}; assertLayoutShape(layout,'generated'); return layout;
  }
  function bundle(projectData, programId) {
    normalizeProject(projectData); const program=projectData.ai_programs.find((row)=>row.id===programId); if(!program)return null; return {program:clone(program),layout:layoutForProgram(projectData,programId),runtime:runtimeForProgram(projectData,programId)};
  }
  function upsertBundle(projectData, value) {
    normalizeProject(projectData); const rawProgram=clone(value?.program); if(!rawProgram)throw new Error('AI program bundle requires program'); rawProgram.compiled=null; const program=upsert(projectData,rawProgram);
    if(!value?.layout)throw new Error('AI program bundle requires layout'); if(value.layout.program_id!==program.id||value.layout.data_version!==program.data_version)throw new Error('AI layout must match Program id/data_version'); const layout=upsertLayout(projectData,value.layout);
    if(value.runtime){if(value.runtime.program_id!==program.id||value.runtime.data_version!==program.data_version||Number(value.runtime.program_version)!==Number(program.version))throw new Error('AI runtime must match Program id/version/data_version');upsertRuntime(projectData,value.runtime);}else removeRuntime(projectData,program.id);
    return {program:clone(program),layout:clone(layout),runtime:runtimeForProgram(projectData,program.id)};
  }
  function duplicate(projectData, sourceId, now) {
    normalizeProject(projectData); const source = projectData.ai_programs.find((program) => program.id === sourceId); if (!source) throw new Error(`AI program not found: ${sourceId}`); const copy = Model.duplicateProgram(source, nextProgramId(projectData), now); copy.compiled=null; assertProgramShape(copy, 'duplicate'); projectData.ai_programs.push(copy); return copy;
  }
  function duplicateBundle(projectData, sourceId, now) {
    const source=bundle(projectData,sourceId); if(!source)throw new Error(`AI program not found: ${sourceId}`); const program=Model.duplicateProgram(source.program,nextProgramId(projectData),now); program.compiled=null; const layout=layoutFromProgram(program,null,nextLayoutId(projectData)); return {program,layout,runtime:null};
  }
  return Object.freeze({SCHEMA_VERSION,normalizeProject,inspect,nextProgramId,nextLayoutId,upsert,upsertLayout,upsertRuntime,removeRuntime,layoutForProgram,runtimeForProgram,layoutFromProgram,bundle,upsertBundle,duplicate,duplicateBundle,assertProgramShape,assertLayoutShape,assertRuntimeShape});
});
