const fs=require('fs'),vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const errors=[];
if(!/^GA-B\d+(?:\.\d+)+$/.test(build.game_build||''))errors.push(`build=${build.game_build}`);
function aura(id,power){return{schemaVersion:1,id,name:id,skillLevel:1,trigger:{type:'WHILE_SOURCE_ALIVE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'ALL'},effects:[{type:'APPLY',effectId:'ATK_UP',power}],resource:{mpCost:0,cooldown:0,activationPriority:0}}}
function revive(){return{schemaVersion:1,id:'AURA-REVIVE-FIXTURE',name:'Aura Revive Fixture',skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'REVIVE',hp:100}],resource:{mpCost:0,cooldown:0,activationPriority:0}}}
const skills=[aura('AURA-LOW-10',10),aura('AURA-HIGH-30',30),revive()].map(skill=>{const out=compiler.compileSkill(skill,registry);if(!out.ok){errors.push(`${skill.id} formal compile failed: ${JSON.stringify(out.errors)}`);return null}return{...out.compiledSkill,source:'formal_test_fixture'};}).filter(Boolean);
const reviveSkill=skills.find(x=>x.id==='AURA-REVIVE-FIXTURE');
if(!reviveSkill)errors.push('formal revive fixture missing');
const ctx={console,Math,Date,JSON,SKILLS:skills,GKSTriggerEngine:{dispatchCompiled(contract,event,payload,run){return{ok:true,result:run()}}},battle:{tick:0,units:[],log:[],validationMode:true,validationEvents:[]},recordValidationEvent:()=>{},queueSceneEvent:()=>{},finishIfNeeded:()=>{},renderBattle:()=>{}};
vm.createContext(ctx);
let src=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
src += `\n(function(){
 function u(id){return {id,name:id,side:'味方',alive:true,hp:500,maxHp:500,attack:100,gauge:0,modifierStacks:[],dotStacks:[],shieldEffects:[],statusEffects:[],coverEffects:[],cooldowns:{},auraSkillIds:[]}}
 const low=u('LOW'),high=u('HIGH'),target=u('TARGET'),reviver=u('REVIVER'); battle.units=[low,high,target,reviver];
 low.auraSkillIds=['AURA-LOW-10']; high.auraSkillIds=['AURA-HIGH-30'];
 if(effectiveModifierPower(target,'BUFF','ATK')!==30) throw new Error('pre highest');
 resetCombatantOnDeath(high,{reason:'test'});
 if(effectiveModifierPower(target,'BUFF','ATK')!==10) throw new Error('death disable');
 const rr=executeSkillRuntime(reviver,high,SKILLS.find(x=>x.id==='AURA-REVIVE-FIXTURE'));
 if(!rr.ok||!rr.reviveResult?.ok) throw new Error('fixed revive result');
 if(high.hp!==100||!high.alive) throw new Error('fixed revive state '+high.hp+'/'+high.alive);
 if(effectiveModifierPower(target,'BUFF','ATK')!==30) throw new Error('source aura restore');
 resetCombatantOnDeath(target,{reason:'target'});
 const tr=executeSkillRuntime(reviver,target,SKILLS.find(x=>x.id==='AURA-REVIVE-FIXTURE'));
 if(!tr.ok||!tr.reviveResult?.ok||target.hp!==100||!target.alive) throw new Error('target revive state');
 if(effectiveModifierPower(target,'BUFF','ATK')!==30) throw new Error('target aura re-evaluate');
})();`;
try{vm.runInContext(src,ctx)}catch(e){errors.push(String(e.message||e))}
const gameRuntime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
if(!gameRuntime.includes("rate!=null&&rate!==''?'rate':'fixed'"))errors.push('presence-based revive mode detection missing');
if(errors.length){errors.forEach(e=>console.error('FAIL',e));process.exit(1)}
console.log('AURA_REVIVE_CONNECTION_FORMAL_ONLY_OK');
