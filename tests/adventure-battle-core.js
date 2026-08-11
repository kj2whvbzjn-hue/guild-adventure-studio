const assert=require('assert');
const B=require('../assets/shared/js/adventure-battle-core.js');
const S=require('../assets/shared/js/adventure-story-system.js');

assert.deepEqual(B.normalizeFormation([{monster_id:'M1',count:2.8},{monster_id:'',count:1}]),[{monster_id:'M1',count:2}]);
const expanded=B.expandFormation([{monster_id:'M1',count:2}],[{id:'M1',name:'Slime',params:{hp:120,attack:14,agi:7}}]);
assert.equal(expanded.length,2);
assert.deepEqual(expanded[0],{monster_id:'M1',instance_index:1,name:'Slime',maxHp:120,attack:14,agi:7,aiPolicy:'lowestHp',defaultSkillId:'SKL-TEST-ATTACK'});

const playback=B.validationEventsToPlaybackEvents([
 {tick:0,type:'battle_started',seed:123},
 {tick:10,type:'action_execution_committed',source_id:'A0',target_id:'E0',skill_id:'SK1'},
 {tick:10,type:'attack',source_id:'A0',target_id:'E0',skill_id:'SK1',damage:25,hp_after:75},
 {tick:20,type:'status_applied',source_id:'A0',target_id:'E0',skill_id:'SK2',status_id:'poison'},
 {tick:30,type:'status_removed',target_id:'E0',status_id:'poison',reason:'expired'},
 {tick:40,type:'unit_death_reset',source_id:'A0',target_id:'E0'},
 {tick:41,type:'battle_finished',result:'味方勝利'}
]);
assert.equal(S.validatePlaybackEvents(playback),true);
assert.deepEqual(playback.map(x=>x.type),['battle_start','action_start','skill_cast','hit','damage','status_apply','status_remove','ko','battle_end']);

const result=B.buildBattleResult({battle:{tick:41,actions:2,result:'味方勝利',p0113TieSeed:'seed-x',log:['debug'],validationEvents:[{tick:0,type:'battle_started',seed:'seed-x'},{tick:41,type:'battle_finished',result:'味方勝利'}],units:[{id:'A0',characterId:'C1',name:'Hero',side:'味方',hp:80,maxHp:100,mp:20,maxMp:30,alive:true,damageDealt:100,damageTaken:20},{id:'E0',monsterId:'M1',name:'Slime',side:'敵',hp:0,maxHp:100,mp:0,maxMp:0,alive:false,damageDealt:20,damageTaken:100}]},context:{formation:[{monster_id:'M1',count:1}],seed:'seed-x'}});
assert.equal(result.victory,true);
assert.equal(result.unit_final_state[1].monster_id,'M1');
assert.equal(result.statistics.ally_damage,100);
assert.equal(result.playback_events.at(-1).type,'battle_end');
console.log('adventure-battle-core PASS');
