const fs=require('fs'),vm=require('vm');
const assert=(v,m)=>{if(!v)throw new Error(m)};
const context={console,Math,Number,String,Array,Object,Set,JSON,Date,Intl,
  TAG_SKILLS:[],battle:null,queueSceneEvent:()=>{},recordValidationEvent:()=>{},renderBattle:()=>{},finishIfNeeded:()=>false};
vm.createContext(context);
vm.runInContext(fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8'),context);
const unit=(id,side,hp=300)=>({id,name:id,side,hp,maxHp:hp,alive:true,attack:100,gauge:0,reservedAction:null,damageDealt:0,damageTaken:0,dotStacks:[],shieldEffects:[]});
const reset=()=>{const a=unit('A','味方'),t=unit('T','味方'),e=unit('E','敵');context.battle={tick:0,units:[a,t,e],log:[],validationEvents:[]};return{a,t,e}};
const shield=(value=100,duration=500,id='S')=>({id,name:id,tags:['SHIELD','味方','単体',`SHIELD=${value}`,`DURATION=${duration}`]});
{
 const {a,t,e}=reset();const r=context.executeTaggedSkill(a,t,shield());assert(r.ok&&r.shieldResult.ok,'shield grant failed');assert(context.shieldTotal(t)===100,'grant total');const d=context.applyTaggedDamage(e,t,60,{id:'D',name:'D',parameters:{damage:60}});assert(d.shieldAbsorbed===60&&d.damage===0,'partial absorb');assert(t.hp===300&&context.shieldTotal(t)===40,'partial state');
}
{
 const {a,t,e}=reset();context.executeTaggedSkill(a,t,shield());const d=context.applyTaggedDamage(e,t,150,{id:'D',name:'D',parameters:{damage:150}});assert(d.shieldAbsorbed===100&&d.damage===50,'overflow');assert(t.hp===250&&context.shieldTotal(t)===0,'overflow state');
}
{
 const {a,t,e}=reset();context.executeTaggedSkill(a,t,shield(100,500,'S100'));context.executeTaggedSkill(a,t,shield(40,700,'S40'));context.applyTaggedDamage(e,t,120,{id:'D',name:'D',parameters:{damage:120}});assert(context.shieldTotal(t)===20,'multiple remaining');assert(t.shieldEffects.length===1&&t.shieldEffects[0].skillId==='S40','FIFO');
}
{
 const {a,t}=reset();context.executeTaggedSkill(a,t,shield(25,5));context.battle.tick=5;context.processShieldEffects();assert(context.shieldTotal(t)===0,'expiry');
}
{
 const c=context.compileTaggedSkill(shield(0,100));assert(!c.ok&&c.errors.some(x=>x.includes('0より大きい')),'invalid zero');
}
console.log('SHIELD_RUNTIME_GA_B484_1_OK');
