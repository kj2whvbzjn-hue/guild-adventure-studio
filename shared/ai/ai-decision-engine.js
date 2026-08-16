(function(root,factory){
  const trace=typeof module==='object'&&module.exports?require('./ai-program-trace.js'):root&&root.GKSAIProgramTrace;
  const api=factory(trace);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAIDecisionEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Trace){
  'use strict';
  if(!Trace)throw new Error('GKSAIProgramTrace is required');
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  function readonly(value){if(value&&typeof value==='object'){Object.values(value).forEach(readonly);Object.freeze(value);}return value;}
  function execute(runtime,context,handlers){
    const ctx=readonly(clone(context||{})),instructions=new Map((runtime?.instructions||[]).map((row)=>[row.instruction_id,row])),sourceMap=runtime?.source_map||{},phase=['reservation','execution','rethink'].includes(ctx.phase)?ctx.phase:'reservation',tick=Math.max(0,Number(ctx.tick)||0);
    const trace=Trace.create({data_version:runtime?.data_version,battle_id:ctx.battle_id,program_id:runtime?.program_id,program_version:runtime?.program_version,actor_id:ctx.actor_id,seed:ctx.seed});
    let current=runtime?.entry_instruction,step=0,targetId=null;
    const limit=Math.max(1,Number(runtime?.limits?.max_steps)||1);
    while(current&&step<limit){
      step++;const instruction=instructions.get(current),sourceNode=sourceMap[current]||current;
      if(!instruction){Trace.event(trace,{tick,phase,step,instruction_id:String(current),source_node_id:String(sourceNode),event_type:'error',result:'failed',details:{reason:'instruction_not_found'}});return Trace.finish(trace,{status:'failed',action_id:null,target_id:targetId,reason:'instruction_not_found'});}
      if(instruction.op==='CONDITION'){
        const passed=handlers?.condition?.(instruction.evaluator,clone(instruction.params),ctx)===true;
        Trace.event(trace,{tick,phase,step,instruction_id:current,source_node_id:sourceNode,event_type:'condition',result:passed?'true':'false',details:{evaluator:instruction.evaluator}});
        current=passed?instruction.on_true:instruction.on_false;continue;
      }
      if(instruction.op==='TARGET'){
        const selected=handlers?.target?.(instruction.evaluator,clone(instruction.params),ctx),value=typeof selected==='string'?selected:selected?.target_id;
        targetId=value==null?null:String(value);
        Trace.event(trace,{tick,phase,step,instruction_id:current,source_node_id:sourceNode,event_type:'target',result:targetId?'selected':'failed',details:{evaluator:instruction.evaluator,candidates:clone(selected?.candidates||[]),target_id:targetId}});
        if(!targetId)return Trace.finish(trace,{status:'failed',action_id:null,target_id:null,reason:'target_not_found'});
        current=instruction.next;continue;
      }
      if(instruction.op==='ACTION'){
        const selected=handlers?.action?.(instruction.evaluator,clone(instruction.params),ctx,{target_id:targetId}),actionId=typeof selected==='string'?selected:selected?.action_id;
        if(selected?.wait===true){Trace.event(trace,{tick,phase,step,instruction_id:current,source_node_id:sourceNode,event_type:'wait',result:'completed',details:{evaluator:instruction.evaluator}});return Trace.finish(trace,{status:'wait',action_id:null,target_id:targetId,reason:selected.reason||null});}
        Trace.event(trace,{tick,phase,step,instruction_id:current,source_node_id:sourceNode,event_type:'action',result:actionId?'selected':'failed',details:{evaluator:instruction.evaluator,action_id:actionId||null,target_id:targetId}});
        if(actionId)return Trace.finish(trace,{status:'selected',action_id:actionId,target_id:targetId,reason:null});
        return Trace.finish(trace,{status:'failed',action_id:null,target_id:targetId,reason:selected?.reason||'action_unavailable'});
      }
      if(instruction.op==='WAIT'||instruction.op==='END'){Trace.event(trace,{tick,phase,step,instruction_id:current,source_node_id:sourceNode,event_type:instruction.op==='WAIT'?'wait':'end',result:'completed',details:{}});return Trace.finish(trace,{status:'wait',action_id:null,target_id:targetId,reason:null});}
      Trace.event(trace,{tick,phase,step,instruction_id:current,source_node_id:sourceNode,event_type:'error',result:'failed',details:{reason:'unsupported_operation',op:instruction.op}});return Trace.finish(trace,{status:'failed',action_id:null,target_id:targetId,reason:'unsupported_operation'});
    }
    return Trace.finish(trace,{status:current?'step_limit':'wait',action_id:null,target_id:targetId,reason:current?'max_steps':'path_ended'});
  }
  return Object.freeze({execute});
});
