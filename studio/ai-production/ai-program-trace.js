(function (root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIProgramTrace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  function create(meta){return {schema_version:'1.0.0',data_version:String(meta.data_version||'1.0.0'),battle_id:String(meta.battle_id||'battle'),program_id:String(meta.program_id||''),program_version:Number(meta.program_version)||1,actor_id:String(meta.actor_id||''),seed:typeof meta.seed==='string'?meta.seed:Number(meta.seed)||0,events:[],outcome:{status:'failed',action_id:null,target_id:null,reason:'not_completed'}};}
  function event(trace,row){trace.events.push({tick:Math.max(0,Number(row.tick)||0),phase:['reservation','execution','rethink'].includes(row.phase)?row.phase:'reservation',step:Math.max(1,Number(row.step)||1),instruction_id:String(row.instruction_id||''),source_node_id:String(row.source_node_id||''),event_type:row.event_type,result:row.result,details:clone(row.details||{})});return trace;}
  function finish(trace,outcome){trace.outcome={status:outcome.status,action_id:outcome.action_id==null?null:String(outcome.action_id),target_id:outcome.target_id==null?null:String(outcome.target_id),reason:outcome.reason==null?null:String(outcome.reason)};return clone(trace);}
  return Object.freeze({create,event,finish});
});
