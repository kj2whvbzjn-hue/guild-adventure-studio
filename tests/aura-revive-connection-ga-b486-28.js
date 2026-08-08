const fs=require('fs'),vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const exportData=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const skills=exportData.data.map(x=>({...x,source:'studio_export'}));
const errors=[];
if(build.game_build!=='GA-B486.52')errors.push(`build=${build.game_build}`);
const revive=skills.find(x=>x.id==='SKL-REVIVE-SINGLE-100');
if(!revive)errors.push('SKL-REVIVE-SINGLE-100 missing');
const ctx={console,Math,Date,JSON,TAG_SKILLS:skills,battle:{tick:0,units:[],log:[],validationMode:true,validationEvents:[]},recordValidationEvent:()=>{},queueSceneEvent:()=>{},finishIfNeeded:()=>{},renderBattle:()=>{}};
vm.createContext(ctx);
let src=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
src += `\n(function(){
 function u(id){return {id,name:id,side:'味方',alive:true,hp:500,maxHp:500,attack:100,gauge:0,modifierStacks:[],dotStacks:[],shieldEffects:[],statusEffects:[],auraSkillIds:[]}}
 const low=u('LOW'),high=u('HIGH'),target=u('TARGET'),reviver=u('REVIVER'); battle.units=[low,high,target,reviver];
 low.auraSkillIds=['SKL-AURA-ALLY-ATK-10']; high.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];
 if(effectiveModifierPower(target,'BUFF','ATK')!==30) throw new Error('pre highest');
 resetCombatantOnDeath(high,{reason:'test'});
 if(effectiveModifierPower(target,'BUFF','ATK')!==10) throw new Error('death disable');
 const rr=executeTaggedSkill(reviver,high,TAG_SKILLS.find(x=>x.id==='SKL-REVIVE-SINGLE-100'));
 if(!rr.ok||!rr.reviveResult?.ok) throw new Error('fixed revive result');
 if(high.hp!==100||!high.alive) throw new Error('fixed revive state '+high.hp+'/'+high.alive);
 if(effectiveModifierPower(target,'BUFF','ATK')!==30) throw new Error('source aura restore');
 resetCombatantOnDeath(target,{reason:'target'});
 const tr=executeTaggedSkill(reviver,target,TAG_SKILLS.find(x=>x.id==='SKL-REVIVE-SINGLE-100'));
 if(!tr.ok||!tr.reviveResult?.ok||target.hp!==100||!target.alive) throw new Error('target revive state');
 if(effectiveModifierPower(target,'BUFF','ATK')!==30) throw new Error('target aura re-evaluate');
})();`;
try{vm.runInContext(src,ctx)}catch(e){errors.push(String(e.message||e))}
const gameRuntime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
if(!gameRuntime.includes("rate!=null&&rate!==''?'rate':'fixed'"))errors.push('presence-based revive mode detection missing');
if(errors.length){errors.forEach(e=>console.error('FAIL',e));process.exit(1)}
console.log('AURA_REVIVE_CONNECTION_GA_B486_29_OK');
