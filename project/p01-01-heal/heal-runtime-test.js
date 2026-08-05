const fs=require('fs'),vm=require('vm'),assert=require('assert');
const runtime=fs.readFileSync(process.argv[2],'utf8');
const events=[];
const context={
 console,
 TAG_SKILLS:[],
 battle:{tick:10,units:[],log:[],result:null,pendingResult:null},
 recordValidationEvent:(type,payload)=>events.push({type,payload}),
 renderBattle:()=>{},
 finishIfNeeded:()=>{},
 queueSceneEvent:()=>{},
};
vm.createContext(context);
vm.runInContext(runtime,context);
const actor={id:'A',name:'僧侶',side:'ally',alive:true,hp:500,maxHp:500,attack:10};
const ally={id:'B',name:'戦士',side:'ally',alive:true,hp:350,maxHp:400,attack:10};
const ally2={id:'C',name:'魔法使い',side:'ally',alive:true,hp:100,maxHp:300,attack:10};
const dead={id:'D',name:'戦闘不能',side:'ally',alive:false,hp:0,maxHp:300,attack:10};
const enemy={id:'E',name:'敵',side:'enemy',alive:true,hp:300,maxHp:300,attack:10};
context.battle.units=[actor,ally,ally2,dead,enemy];

const single={id:'H1',name:'単体回復',tags:['HEAL','味方','単体','HEAL=100']};
const all={id:'H2',name:'全体回復',tags:['HEAL','味方','全体','HEAL=60']};
const invalid={id:'HX',name:'不正',tags:['HEAL','味方','単体']};
assert.equal(context.compileTaggedSkill(single).ok,true);
assert.equal(context.compileTaggedSkill(all).ok,true);
assert.equal(context.compileTaggedSkill(invalid).ok,false);

let r=context.executeTaggedSkill(actor,ally,single);
assert.equal(r.ok,true);
assert.equal(ally.hp,400);
assert.equal(r.healResult.healed,50);
assert.equal(r.healResult.overheal,50);

r=context.executeTaggedSkill(actor,ally2,all);
assert.equal(r.ok,true);
assert.deepEqual(Array.from(r.targets),['A','B','C']);
assert.equal(actor.hp,500);
assert.equal(ally.hp,400);
assert.equal(ally2.hp,160);
assert.equal(dead.hp,0);
assert.equal(events.filter(x=>x.type==='heal').length,4);
console.log(JSON.stringify({passed:true,events:events.filter(x=>x.type==='heal').length,log_count:context.battle.log.length}));
