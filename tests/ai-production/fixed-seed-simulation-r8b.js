#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Runner=require('../../studio/ai-production/ai-simulation-runner.js');
const root=path.resolve(__dirname,'../..');
const runtime={schema_version:'2.0.0',data_version:'1.0.0',program_id:'AIP-R8B',program_version:1,compiler_version:'2.0.0',entry_instruction:'I-1',instructions:[{instruction_id:'I-1',op:'ACTION',origin_part_id:'AIN-ACTION',source_node_id:'AIN-ACTION',master_node_id:'AIA-ATTACK',evaluator:'action.attack',params:{},target_selector:{selector_id:'ATS-RANDOM',params:{}}}],source_map:{'I-1':{origin_part_id:'AIN-ACTION',source_node_id:'AIN-ACTION'}},limits:{max_steps:1,max_subroutine_depth:0},content_hash:'0'.repeat(64)};
const battle={battle_id:'BT-R8B',tick:0,actor_id:'ALLY-1',target_selectors:[{schema_version:'2.0.0',id:'ATS-RANDOM',evaluator:'selector.random',enabled:true}],units:[{id:'ALLY-1',name:'A',side:'味方',alive:true,formationPosition:'FRONTLINE',hp:100,maxHp:100},{id:'ENEMY-1',name:'E1',side:'敵',alive:true,formationPosition:'FRONTLINE',hp:100,maxHp:100},{id:'ENEMY-2',name:'E2',side:'敵',alive:true,formationPosition:'FRONTLINE',hp:100,maxHp:100}]};
const before=structuredClone(battle),first=Runner.run(runtime,battle,{trials:12,seed_start:100,seed_step:3}),second=Runner.run(runtime,battle,{trials:12,seed_start:100,seed_step:3});
assert.deepStrictEqual(first,second,'fixed seed batch must be reproducible');
assert.deepStrictEqual(battle,before,'simulation must not modify battle input');
assert.strictEqual(first.summary.trials,12);assert.strictEqual(first.traces[0].seed,100);assert.strictEqual(first.traces[11].seed,133);assert.strictEqual(first.summary.outcomes.selected,12);assert.strictEqual(first.summary.actions.attack,12);assert.strictEqual(first.summary.unique_paths,1);assert.strictEqual(Object.values(first.summary.targets).reduce((a,b)=>a+b,0),12);
assert(first.traces.every(trace=>trace.schema_version==='2.0.0'&&trace.events.filter(x=>x.event_type==='rng').every(x=>x.rng_stream==='AI_DECISION')),'fixed-seed Studio simulation must use V2 trace and AI_DECISION RNG');
assert.strictEqual(Runner.normalizeOptions({trials:100000}).trials,1000);assert.strictEqual(Runner.normalizeOptions({trials:-1,seed_step:0}).trials,1);assert.strictEqual(Runner.normalizeOptions({seed_step:0}).seed_step,1);
const changed=structuredClone(first);changed.traces[0].outcome={status:'wait',action_id:null,target_id:null,reason:null};const comparison=Runner.compare(first,changed);assert.strictEqual(comparison.changed_trials,1);assert.strictEqual(comparison.unchanged_trials,11);
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8'),ui=fs.readFileSync(path.join(root,'studio/ai-production/ai-production-ui.js'),'utf8'),css=fs.readFileSync(path.join(root,'studio/ai-production/ai-production.css'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'studio/ai-production/manifest.json'),'utf8'));
assert(html.includes('R10 P7 Developer Authoring'));assert(html.includes('./ai-production/ai-simulation-runner.js?v=1'));assert(html.includes('../shared/ai/ai-battle-runtime-context.js?v=1'));assert(html.includes('getBattleUnits:'));assert(ui.includes('固定Seed試行・Trace→Studio元箱'));assert(ui.includes('Runner.compare'));assert(css.includes('.ai-simulation-panel'));assert.strictEqual(manifest.entrypoints.simulation_runner,'ai-simulation-runner.js');assert.strictEqual(manifest.shared_canonical.battle_runtime_context,'shared/ai/ai-battle-runtime-context.js');
console.log('AI_FIXED_SEED_SIMULATION_R8B_OK v2=1 readonly=1 reproducible=1 multi_trial=1 aggregate=1 trace=1 rng=AI_DECISION compare=1 ui=1 shared_context=1');
