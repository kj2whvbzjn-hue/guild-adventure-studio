'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const core=require(path.join(ROOT,'assets/shared/js/adventure-battle-core.js'));
const encounter=require(path.join(ROOT,'assets/shared/js/adventure-encounter-resolver.js'));
const compiler=require(path.join(ROOT,'assets/shared/js/skill-compiler.js'));
const saveBridge=require(path.join(ROOT,'game/assets/js/save-domain-bridge.js'));
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/shared/config/skill-registry.json'),'utf8'));
const monstersPayload=JSON.parse(fs.readFileSync(path.join(ROOT,'Export/monster/monsters.json'),'utf8'));
const monsters=Array.isArray(monstersPayload)?monstersPayload:monstersPayload.data;

assert.deepStrictEqual(core.normalizeFormation([{monster_id:'M',count:2,formation_position:'BACKLINE'}]),[{monster_id:'M',count:2,formation_position:'BACKLINE'}]);
assert.strictEqual(core.monsterStats({id:'M',params:{job_code:'SWD',level:1,maxHp:1,maxMp:0,attack:0,agi:0}}).defaultFormationPosition,'FRONTLINE');
assert.strictEqual(core.monsterStats({id:'M',default_formation_position:'BACKLINE',params:{job_code:'SWD',level:1,maxHp:1,maxMp:0,attack:0,agi:0}}).defaultFormationPosition,'BACKLINE');
let expanded=core.expandFormation([{monster_id:'M',count:1}], [{id:'M',default_formation_position:'BACKLINE',params:{job_code:'SWD',level:1,maxHp:1,maxMp:0,attack:0,agi:0}}]);
assert.strictEqual(expanded[0].formationPosition,'BACKLINE');
expanded=core.expandFormation([{monster_id:'M',count:1,formation_position:'FRONTLINE'}], [{id:'M',default_formation_position:'BACKLINE',params:{job_code:'SWD',level:1,maxHp:1,maxMp:0,attack:0,agi:0}}]);
assert.strictEqual(expanded[0].formationPosition,'FRONTLINE');
const merged=encounter.mergeFormation([{monster_id:'M',count:1,formation_position:'BACKLINE'}],[{monster_id:'M',count:2}]);
assert.strictEqual(merged.length,2,'Encounter override row must not bleed into generated default-position rows');
assert.strictEqual(merged.find(x=>x.formation_position==='BACKLINE').count,1);
assert.strictEqual(merged.find(x=>!x.formation_position).count,2);

assert(saveBridge.CHARACTER_STATE_KEYS.includes('formation_position'));
assert(!Object.prototype.hasOwnProperty.call(registry.targets.ranges,'PIERCE'));
assert.strictEqual(registry.targets.ranges.BACK,'後衛選択可能単体');
const compileResult=compiler.compileSkill({schemaVersion:1,id:'T',name:'T',trigger:{type:'ACTIVE'},conditions:[],target:{side:'ENEMY',range:'PIERCE'},effects:[],resource:{mpCost:0,cooldown:0,castTime:0}},registry);
assert(compileResult.errors.some(x=>x.code==='PIERCE_RANGE_ABOLISHED'));

assert(Array.isArray(monsters)&&monsters.length>0);
for(const m of monsters)assert(['FRONTLINE','BACKLINE'].includes(m.default_formation_position),`monster ${m.id} missing valid default_formation_position`);

const runtime=fs.readFileSync(path.join(ROOT,'game/assets/js/tag-skill-runtime.js'),'utf8');
assert(runtime.includes("['single','back','random'].includes(incomingCompiled?.definition?.target?.range)"));
assert(runtime.includes("['back','all'].includes(normalized)"));
assert(runtime.includes("['single','front','random'].includes(normalized)"));
assert(runtime.includes("SINGLEは敵後衛を対象にできません"));
assert(runtime.includes("definition.target.randomCount"));
const battle=fs.readFileSync(path.join(ROOT,'game/assets/js/battle-control.js'),'utf8');
assert(battle.includes("ensureBattleFormationSafePoint('post_hp_alive_mutation')"));
assert(battle.includes("formationMultiplier=String(attacker?.formationPosition||'FRONTLINE')==='BACKLINE'?0.5:1"));

for(const rel of ['schemas/exports/monster-monsters.schema.json','studio/data-exchange/schemas/monster-dataset.schema.json']){
 const schema=JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
 assert.deepStrictEqual(schema.items.properties.default_formation_position.enum,['FRONTLINE','BACKLINE']);
}
console.log('TASK_FRM_004_FORMATION_RANGE_CONFORMANCE_PASS');
