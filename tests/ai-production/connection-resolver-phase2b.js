#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Resolver = require('../../shared/ai/ai-connection-resolver.js');

const masters = {
  ai_conditions: [{
    id:'AIC-0001', name:'条件', node_type:'condition', status:'active', data_version:'1.0.0', evaluator:'condition.always',
    ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'true',kind:'flow',data_type:'flow'},{id:'false',kind:'flow',data_type:'flow'}]},
    parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}, unlock:{}
  }],
  ai_targets: [{
    id:'AIT-0001', name:'対象', node_type:'target', status:'active', data_version:'1.0.0', evaluator:'target.self',
    ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[{id:'next',kind:'flow',data_type:'flow'}]},
    parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}, unlock:{}
  }],
  ai_actions: [{
    id:'AIA-0001', name:'行動', node_type:'action', status:'active', data_version:'1.0.0', evaluator:'action.wait',
    ports:{inputs:[{id:'in',kind:'flow',data_type:'flow'}],outputs:[]},
    parameter_schema:{type:'object',properties:{},required:[],additionalProperties:false}, unlock:{}
  }]
};
const projectData = {masters, tags:[]};
const node = (id, master, type) => ({instance_id:id, master_node_id:master, master_data_version:'1.0.0', node_type:type, position:{x:0,y:0}, parameters:{}});
const layout = (programId, chips, extensions=[]) => ({layout_version:1,layout_id:'AIL-0001',program_id:programId,width:8,height:8,chips,extensions});
const program = (id, entry, nodes) => ({schema_version:'1.0.0',data_version:'1.0.0',id,name:'test',version:1,status:'draft',entry_node_id:entry,nodes,edges:[],subroutines:[],tags:[]});

// Canonical port directions and rotation.
assert.deepStrictEqual(Resolver.portSidesForNode(masters.ai_conditions[0], 0), [
  {port_id:'in',direction:'input',side:'west'},
  {port_id:'true',direction:'output',side:'east'},
  {port_id:'false',direction:'output',side:'south'}
]);
assert.strictEqual(Resolver.rotateSide('west', 90), 'north');
assert.deepStrictEqual(Resolver.extensionSides({shape:'straight',rotation:90}), ['north','south']);
assert.deepStrictEqual(Resolver.extensionSides({shape:'corner',rotation:180}), ['south','west']);

// CONDITION true/false auto-connect directly to ACTION inputs.
{
  const p = program('AIP-0001','AIN-0001',[
    node('AIN-0001','AIC-0001','condition'),
    node('AIN-0002','AIA-0001','action'),
    node('AIN-0003','AIA-0001','action')
  ]);
  const l = layout('AIP-0001',[
    {instance_id:'AIN-0001',x:1,y:1,rotation:0},
    {instance_id:'AIN-0002',x:2,y:1,rotation:0},
    {instance_id:'AIN-0003',x:1,y:2,rotation:90}
  ]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,true,JSON.stringify(r.diagnostics));
  assert.deepStrictEqual(r.edges,[
    {edge_id:'AIE-0001',from:{node_id:'AIN-0001',port_id:'false'},to:{node_id:'AIN-0003',port_id:'in'}},
    {edge_id:'AIE-0002',from:{node_id:'AIN-0001',port_id:'true'},to:{node_id:'AIN-0002',port_id:'in'}}
  ]);
}

// Straight extension collapses to a real node-to-node Formal edge.
{
  const p = program('AIP-0002','AIN-0001',[node('AIN-0001','AIT-0001','target'),node('AIN-0002','AIA-0001','action')]);
  const l = layout('AIP-0002',[
    {instance_id:'AIN-0001',x:1,y:1,rotation:0},
    {instance_id:'AIN-0002',x:3,y:1,rotation:0}
  ],[{id:'EXT-0001',x:2,y:1,shape:'straight',rotation:0}]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,true,JSON.stringify(r.diagnostics));
  assert.deepStrictEqual(r.edges,[{edge_id:'AIE-0001',from:{node_id:'AIN-0001',port_id:'next'},to:{node_id:'AIN-0002',port_id:'in'}}]);
  assert.deepStrictEqual(r.connections[0].extension_ids,['EXT-0001']);
  assert.strictEqual(JSON.stringify(r.edges).includes('EXT-0001'),false,'extension must not become a Formal runtime node/edge endpoint');
}

// Corner extension turns the route and is also collapsed.
{
  const p = program('AIP-0003','AIN-0001',[node('AIN-0001','AIT-0001','target'),node('AIN-0002','AIA-0001','action')]);
  const l = layout('AIP-0003',[
    {instance_id:'AIN-0001',x:1,y:1,rotation:0},
    {instance_id:'AIN-0002',x:2,y:2,rotation:90}
  ],[{id:'EXT-0001',x:2,y:1,shape:'corner',rotation:180}]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,true,JSON.stringify(r.diagnostics));
  assert.strictEqual(r.edges.length,1);
  assert.deepStrictEqual(r.connections[0].extension_ids,['EXT-0001']);
}

// Multiple extension cells form a valid non-looping route.
{
  const p = program('AIP-0008','AIN-0001',[node('AIN-0001','AIT-0001','target'),node('AIN-0002','AIA-0001','action')]);
  const l = layout('AIP-0008',[
    {instance_id:'AIN-0001',x:1,y:4,rotation:0},
    {instance_id:'AIN-0002',x:4,y:4,rotation:0}
  ],[
    {id:'EXT-0001',x:2,y:4,shape:'straight',rotation:0},
    {id:'EXT-0002',x:3,y:4,shape:'straight',rotation:0}
  ]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,true,JSON.stringify(r.diagnostics));
  assert.deepStrictEqual(r.connections[0].extension_ids,['EXT-0001','EXT-0002']);
}

// Output-output adjacency is invalid; reversed/like-direction connection is never generated.
{
  const p = program('AIP-0004','AIN-0001',[node('AIN-0001','AIT-0001','target'),node('AIN-0002','AIT-0001','target')]);
  const l = layout('AIP-0004',[
    {instance_id:'AIN-0001',x:1,y:1,rotation:0},
    {instance_id:'AIN-0002',x:2,y:1,rotation:180}
  ]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,false);
  assert(r.diagnostics.some(x=>x.code==='AI_PORT_DIRECTION_INVALID'));
  assert.strictEqual(r.edges.length,0);
}

// Open required output and orphan extension fail closed.
{
  const p = program('AIP-0005','AIN-0001',[node('AIN-0001','AIT-0001','target')]);
  const l = layout('AIP-0005',[{instance_id:'AIN-0001',x:1,y:1,rotation:0}], [{id:'EXT-0001',x:5,y:5,shape:'straight',rotation:0}]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,false);
  assert(r.diagnostics.some(x=>x.code==='AI_OUTPUT_OPEN'));
  assert(r.diagnostics.some(x=>x.code==='AI_EXTENSION_ORPHAN'));
}

// A closed extension loop is a hard error even when no output reaches it.
{
  const p = program('AIP-0006','AIN-0001',[node('AIN-0001','AIA-0001','action')]);
  const l = layout('AIP-0006',[{instance_id:'AIN-0001',x:0,y:0,rotation:0}], [
    {id:'EXT-0001',x:2,y:2,shape:'corner',rotation:90},
    {id:'EXT-0002',x:3,y:2,shape:'corner',rotation:180},
    {id:'EXT-0003',x:3,y:3,shape:'corner',rotation:270},
    {id:'EXT-0004',x:2,y:3,shape:'corner',rotation:0}
  ]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,false);
  assert(r.diagnostics.some(x=>x.code==='AI_EXTENSION_LOOP'));
}

// ACTION may be the entry and has no required outgoing connection.
{
  const p = program('AIP-0007','AIN-0001',[node('AIN-0001','AIA-0001','action')]);
  const l = layout('AIP-0007',[{instance_id:'AIN-0001',x:1,y:1,rotation:0}]);
  const r = Resolver.resolve(l,p,projectData);
  assert.strictEqual(r.valid,true,JSON.stringify(r.diagnostics));
  assert.strictEqual(r.edges.length,0);
  const applied = Resolver.applyToProgram({...p,edges:[{edge_id:'OLD'}]},r);
  assert.deepStrictEqual(applied.edges,[]);
}

console.log('AI_CONNECTION_RESOLVER_PHASE2B_OK direct=1 true_false=1 extension_collapse=1 direction_guard=1 loop_guard=1');
