const fs=require('fs'),vm=require('vm');
const compiler=require('../assets/shared/js/skill-compiler.js');
const formation=require('../assets/shared/js/formation-target-resolver.js');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const context={console,Math,Number,String,Array,Object,Set,Map,JSON,Date,Intl,GKSFormationTargetResolver:formation,
  battle:null,queueSceneEvent:()=>{},recordValidationEvent:()=>{},renderBattle:()=>{},finishIfNeeded:()=>false};
vm.createContext(context);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),context);
const unit=(id,side,hp=100)=>({id,name:id,side,hp,maxHp:hp,alive:true,formationPosition:'FRONTLINE',attack:100,gauge:0,reservedAction:null,damageDealt:0,damageTaken:0,dotStacks:[],shieldEffects:[]});
const reset=()=>{const a=unit('A','味方'),t=unit('T','味方'),e=unit('E','敵');context.battle={tick:0,units:[a,t,e],log:[],validationEvents:[]};return{a,t,e}};
const shieldDraft=(value=100,duration=500,id='S')=>({schemaVersion:1,id,name:id,skillLevel:20,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power:value,duration}],resource:{mpCost:0,cooldown:0,activationPriority:0}});
const shield=(value=100,duration=500,id='S')=>{const out=compiler.compileSkill(shieldDraft(value,duration,id),registry);assert(out.ok,`Formal SHIELD compile failed: ${JSON.stringify(out.errors)}`);return out.compiledSkill};
{
 const {a,t,e}=reset();const r=context.executeSkillRuntime(a,t,shield());assert(r.ok&&r.shieldResult?.ok,'shield grant failed');assert(context.shieldTotal(t)===100,'grant total');const d=context.applyTaggedDamage(e,t,60,{id:'D',name:'D',parameters:{damage:60}});assert(d.shieldAbsorbed===60&&d.damage===0,'partial absorb');assert(t.hp===100&&context.shieldTotal(t)===40,'partial state');
}
{
 const {a,t,e}=reset();context.executeSkillRuntime(a,t,shield());const d=context.applyTaggedDamage(e,t,150,{id:'D',name:'D',parameters:{damage:150}});assert(d.shieldAbsorbed===100&&d.damage===50,'overflow');assert(t.hp===50&&context.shieldTotal(t)===0,'overflow state');
}
{
 const {a,t,e}=reset();context.executeSkillRuntime(a,t,shield(100,500,'S100'));context.executeSkillRuntime(a,t,shield(40,700,'S40'));context.applyTaggedDamage(e,t,120,{id:'D',name:'D',parameters:{damage:120}});assert(context.shieldTotal(t)===20,'multiple remaining');assert(t.shieldEffects.length===1&&t.shieldEffects[0].skillId==='S40','FIFO');
}
{
 const {a,t}=reset();context.executeSkillRuntime(a,t,shield(25,5));context.battle.tick=5;context.processShieldEffects();assert(context.shieldTotal(t)===0,'expiry');
}
{
 const {a,t}=reset(),out=compiler.compileSkill(shieldDraft(0,100,'S0'),registry);assert(out.ok,'Formal Draft shape should compile before runtime value guard');const r=context.executeSkillRuntime(a,t,out.compiledSkill);assert(r.ok&&r.shieldResult&&!r.shieldResult.ok,'invalid zero must be rejected by Formal runtime SHIELD guard');
}
console.log('SHIELD_RUNTIME_GA_B484_1_FORMAL_OK');
