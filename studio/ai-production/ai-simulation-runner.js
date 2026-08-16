(function(root,factory){
  const adapter=typeof module==='object'&&module.exports?require('./ai-battle-adapter.js'):root&&root.GKSAIBattleAdapter;
  const api=factory(adapter);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSAISimulationRunner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Adapter){
  'use strict';
  if(!Adapter)throw new Error('GKSAIBattleAdapter is required');
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  const key=(value)=>value==null?'none':String(value);
  function normalizeOptions(options){
    const trials=Math.min(1000,Math.max(1,Math.trunc(Number(options?.trials)||1)));
    return {trials,seed_start:Math.trunc(Number(options?.seed_start)||0),seed_step:Math.max(1,Math.trunc(Number(options?.seed_step)||1)),phase:['reservation','execution','rethink'].includes(options?.phase)?options.phase:'reservation'};
  }
  function pathOf(trace){return (trace?.events||[]).map((row)=>`${row.source_node_id}:${row.result}`).join('>');}
  function increment(target,name){target[name]=(target[name]||0)+1;}
  function run(runtime,battleInput,options,handlers){
    const config=normalizeOptions(options),traces=[],outcomes={},actions={},targets={},paths={};
    for(let index=0;index<config.trials;index++){
      const seed=config.seed_start+index*config.seed_step;
      const result=Adapter.decide(runtime,{...clone(battleInput),seed,phase:config.phase},handlers);
      traces.push(result.trace);increment(outcomes,key(result.proposal.status));increment(actions,key(result.proposal.action_id));increment(targets,key(result.proposal.target_id));increment(paths,pathOf(result.trace)||'empty');
    }
    return {schema_version:'1.0.0',program_id:String(runtime?.program_id||''),program_version:Number(runtime?.program_version)||1,actor_id:String(battleInput?.actor_id||''),config,summary:{trials:config.trials,outcomes,actions,targets,unique_paths:Object.keys(paths).length,paths},traces};
  }
  function compare(left,right){
    const a=left?.traces||[],b=right?.traces||[],length=Math.max(a.length,b.length),changes=[];
    for(let index=0;index<length;index++){
      const before=a[index]?.outcome||null,after=b[index]?.outcome||null;
      if(JSON.stringify(before)!==JSON.stringify(after)||pathOf(a[index])!==pathOf(b[index]))changes.push({trial:index+1,before:clone(before),after:clone(after),path_changed:pathOf(a[index])!==pathOf(b[index])});
    }
    return {left_trials:a.length,right_trials:b.length,changed_trials:changes.length,unchanged_trials:Math.max(0,Math.min(a.length,b.length)-changes.length),changes};
  }
  return Object.freeze({normalizeOptions,pathOf,run,compare});
});
