const assert=require('assert');
const B=require('../assets/shared/js/adventure-battle-core.js');
const HistoricalBattle=require('./helpers/historical-basic-battle.js');
const S=require('../assets/shared/js/adventure-story-system.js');

const fs=require('fs');
const battleControlSource=fs.readFileSync('game/assets/js/battle-control.js','utf8');
assert(battleControlSource.includes("skill_id:skill?.id||null,skill_name:skill?.name||null"),'Formal AI committed skill action must snapshot the formal skill name');
assert(battleControlSource.includes("skill_id:skill.id,skill_name:skill.name||null"),'regular committed skill action must snapshot the formal skill name');
const appRuntimeSource=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
assert(appRuntimeSource.includes("p.skill_name||p.skill||''"),'Playback UI must prefer the formal skill name over the skill ID');

assert.deepEqual(B.normalizeFormation([{monster_id:'M1',count:2.8},{monster_id:'',count:1}]),[{monster_id:'M1',count:2}]);
const expanded=B.expandFormation([{monster_id:'M1',count:2}],[{id:'M1',name:'Slime',params:{job_code:'SWD',level:1,maxHp:120,maxMp:0,attack:14,agi:7}}]);
assert.equal(expanded.length,2);
assert.deepEqual(expanded[0],{monster_id:'M1',instance_index:1,name:'Slime',defaultFormationPosition:'FRONTLINE',maxHp:120,maxMp:0,attack:14,agi:7,aiPolicy:'lowestHp',defaultSkillId:'SKL-TEST-ATTACK',formalGenerated:true,formationPosition:'FRONTLINE'});

const playback=B.validationEventsToPlaybackEvents([
 {tick:0,type:'battle_started',seed:123},
 {tick:10,type:'action_execution_committed',source_id:'A0',target_id:'E0',skill_id:'SK1',skill_name:'火炎斬り'},
 {tick:10,type:'attack',source_id:'A0',target_id:'E0',skill_id:'SK1',damage:25,hp_after:75},
 {tick:20,type:'status_applied',source_id:'A0',target_id:'E0',skill_id:'SK2',status_id:'poison'},
 {tick:30,type:'status_removed',target_id:'E0',status_id:'poison',reason:'expired'},
 {tick:40,type:'unit_death_reset',source_id:'A0',target_id:'E0'},
 {tick:41,type:'battle_finished',result:'味方勝利'}
]);
assert.equal(S.validatePlaybackEvents(playback),true);
assert.deepEqual(playback.map(x=>x.type),['battle_start','action_start','skill_cast','hit','damage','status_apply','status_remove','ko','battle_end']);
assert.equal(playback.find(x=>x.type==='skill_cast')?.skill_name,'火炎斬り','skill_cast must preserve the formal skill name snapshot');


const formalBasicPlayback=B.validationEventsToPlaybackEvents([
 {tick:11,type:'action_execution_committed',source_id:'A0',target_id:'E0',skill_id:null,formal_ai:true},
 {tick:11,type:'basic_attack',source_id:'A0',target_id:'E0',damage:80,hp_after:0}
]);
assert.deepEqual(formalBasicPlayback.map(x=>x.type),['action_start','hit','damage'],'Formal AI basic attack must not emit skill_cast or duplicate action_start');
assert.equal(formalBasicPlayback.filter(x=>x.type==='skill_cast').length,0,'basic attack must not be displayed as skill use');
assert.equal(formalBasicPlayback.filter(x=>x.type==='action_start').length,1,'basic attack action_start must be emitted exactly once');

const headlessBasicPlayback=B.validationEventsToPlaybackEvents([
 {tick:12,type:'basic_attack',source_id:'A0',target_id:'E0',damage:10,hp_after:70}
]);
assert.deepEqual(headlessBasicPlayback.map(x=>x.type),['action_start','hit','damage'],'basic_attack without committed event still needs one action_start');

const waitPlayback=B.validationEventsToPlaybackEvents([
 {tick:13,type:'action_execution_committed',source_id:'A0',target_id:null,skill_id:null,formal_ai:true,action_kind:'wait'}
]);
assert.deepEqual(waitPlayback.map(x=>x.type),['action_start'],'wait must never emit skill_cast');

const result=B.buildBattleResult({battle:{tick:41,actions:2,result:'味方勝利',p0113TieSeed:'seed-x',log:['debug'],validationEvents:[{tick:0,type:'battle_started',seed:'seed-x'},{tick:41,type:'battle_finished',result:'味方勝利'}],units:[{id:'A0',characterId:'C1',name:'Hero',side:'味方',hp:80,maxHp:100,mp:20,maxMp:30,alive:true,damageDealt:100,damageTaken:20},{id:'E0',monsterId:'M1',name:'Slime',side:'敵',hp:0,maxHp:100,mp:0,maxMp:0,alive:false,damageDealt:20,damageTaken:100}]},context:{formation:[{monster_id:'M1',count:1}],seed:'seed-x'}});
assert.equal(result.victory,true);
assert.equal(result.unit_final_state[1].monster_id,'M1');
assert.equal(result.statistics.ally_damage,100);
assert.equal(result.playback_events.at(-1).type,'battle_end');
console.log('adventure-battle-core PASS');

const simInput={party:[{id:'C1',name:'Hero',max_hp:180,attack:45,agi:12}],formation:[{monster_id:'M1',count:2}],monsters:[{id:'M1',name:'Slime',params:{hp:90,attack:12,agi:7}}],seed:98765};
const sim1=HistoricalBattle.simulateBasicBattle(simInput),sim2=HistoricalBattle.simulateBasicBattle(simInput);
assert.equal(sim1.victory,true);
assert.deepEqual(sim1,sim2,'same seed and snapshots must produce identical Battle Result');
assert.equal(S.validatePlaybackEvents(sim1.playback_events),true);
assert.equal(sim1.playback_events[0].type,'battle_start');
assert.equal(sim1.playback_events.at(-1).type,'battle_end');
assert(sim1.statistics.actions>0);
console.log('adventure-battle-core headless simulation PASS');
