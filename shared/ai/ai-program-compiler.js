(function (root, factory) {
  const validator = typeof module === 'object' && module.exports ? require('./ai-program-validator.js') : root && root.GKSAIProgramValidator;
  const adapter = typeof module === 'object' && module.exports ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter;
  const api = factory(validator, adapter, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramCompiler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Validator, Adapter, root) {
  'use strict';
  if (!Validator || !Adapter) throw new Error('AI validator and master adapter are required');
  const COMPILER_VERSION='1.1.0';
  class CompilerError extends Error { constructor(message,issues){super(message);this.name='AIProgramCompilerError';this.issues=issues||[];} }
  function canonical(value) {
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object'){const result={};Object.keys(value).sort().forEach((key)=>{result[key]=canonical(value[key]);});return result;}
    return value;
  }
  function stableStringify(value){return JSON.stringify(canonical(value));}
  async function sha256(text){
    const cryptoApi=root?.crypto;
    if(!cryptoApi?.subtle)throw new CompilerError('SHA-256 runtime is unavailable',[]);
    const bytes=new TextEncoder().encode(text),digest=await cryptoApi.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,'0')).join('');
  }
  function orderedNodes(program) {
    const nodes=new Map(program.nodes.map((node)=>[node.instance_id,node])), outgoing=new Map(program.nodes.map((node)=>[node.instance_id,[]]));
    for(const edge of program.edges)if(outgoing.has(edge.from.node_id))outgoing.get(edge.from.node_id).push(edge);
    outgoing.forEach((rows)=>rows.sort((a,b)=>String(a.from.port_id).localeCompare(String(b.from.port_id))||String(a.edge_id).localeCompare(String(b.edge_id))||String(a.to.node_id).localeCompare(String(b.to.node_id))));
    const order=[],seen=new Set(),queue=[program.entry_node_id];
    while(queue.length){const id=queue.shift();if(seen.has(id)||!nodes.has(id))continue;seen.add(id);order.push(nodes.get(id));for(const edge of outgoing.get(id)||[])queue.push(edge.to.node_id);}
    return {order,outgoing};
  }
  function opFor(node){return node.node_type==='condition'?'CONDITION':node.node_type==='target'?'TARGET':'ACTION';}
  async function compile(program,projectData,options) {
    const validation=Validator.validate(program,projectData);
    if(!validation.valid)throw new CompilerError('AI program validation failed',validation.issues);
    const limits={max_steps:Number.isInteger(options?.max_steps)&&options.max_steps>0?options.max_steps:128,max_subroutine_depth:Number.isInteger(options?.max_subroutine_depth)&&options.max_subroutine_depth>=0?options.max_subroutine_depth:8};
    const definitions=Adapter.palette(projectData?.masters||{},'',{}),byMaster=new Map(definitions.map((row)=>[row.id,row]));
    const {order,outgoing}=orderedNodes(program),instructionId=new Map(order.map((node,index)=>[node.instance_id,`I-${String(index+1).padStart(4,'0')}`]));
    const instructions=order.map((node)=>{
      const definition=byMaster.get(node.master_node_id),edges=outgoing.get(node.instance_id)||[],base={instruction_id:instructionId.get(node.instance_id),op:opFor(node),master_node_id:definition.id,evaluator:definition.evaluator,params:canonical(node.parameters||{})};
      if(node.node_type==='condition'){
        const yes=edges.find((edge)=>edge.from.port_id==='true'),no=edges.find((edge)=>edge.from.port_id==='false');
        base.on_true=yes?instructionId.get(yes.to.node_id)||null:null;base.on_false=no?instructionId.get(no.to.node_id)||null:null;
      }else if(node.node_type==='target'){
        const next=edges.find((edge)=>edge.from.port_id==='next');base.next=next?instructionId.get(next.to.node_id)||null:null;
      }
      return base;
    });
    const sourceMap={};order.forEach((node)=>{sourceMap[instructionId.get(node.instance_id)]=node.instance_id;});
    const runtime={schema_version:'1.0.0',data_version:String(program.data_version||'1.0.0'),program_id:String(program.id),program_version:Number(program.version)||1,compiler_version:COMPILER_VERSION,entry_instruction:instructionId.get(program.entry_node_id),instructions,source_map:sourceMap,limits};
    runtime.content_hash=await sha256(stableStringify(runtime));
    return canonical(runtime);
  }
  return Object.freeze({COMPILER_VERSION,CompilerError,canonical,stableStringify,compile});
});
