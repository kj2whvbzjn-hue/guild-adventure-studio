const fs=require('fs'),vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const exportData=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const skills=exportData.data.map(x=>({...x,source:'studio_export'}));
const errors=[];
if(build.game_build!=='GA-B486.28')errors.push(`build=${build.game_build}`);
for(const id of ['SKL-AURA-ALLY-ATK-10','SKL-AURA-ALLY-ATK-30','SKL-AURA-ALLY-DEF-15-EX','SKL-AURA-ENEMY-ATK-DOWN-20'])if(!skills.some(x=>x.id===id&&x.environment==='production'))errors.push(`${id} missing`);
const ctx={console,Math,Date,JSON,TAG_SKILLS:skills,battle:{tick:0,units:[],log:[],validationMode:true,validationEvents:[]},recordValidationEvent:()=>{},queueSceneEvent:()=>{},finishIfNeeded:()=>{},renderBattle:()=>{}};
vm.createContext(ctx);
let src=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
src += `\n(function(){
 function u(id,side){return {id,name:id,side,alive:true,hp:100,maxHp:100,attack:100,modifierStacks:[],dotStacks:[],shieldEffects:[],statusEffects:[],auraSkillIds:[]}}
 const a=u('A','味方'),b=u('B','味方'),c=u('C','味方'),e=u('E','敵'); battle.units=[a,b,c,e];
 a.auraSkillIds=['SKL-AURA-ALLY-ATK-10']; b.auraSkillIds=['SKL-AURA-ALLY-ATK-30'];
 if(effectiveModifierPower(c,'BUFF','ATK')!==30) throw new Error('highest');
 resetCombatantOnDeath(b,{reason:'test'}); if(effectiveModifierPower(c,'BUFF','ATK')!==10) throw new Error('source death');
 b.alive=true;b.hp=100; if(effectiveModifierPower(c,'BUFF','ATK')!==30) throw new Error('source revive');
 a.auraSkillIds=['SKL-AURA-ENEMY-ATK-DOWN-20']; b.auraSkillIds=[]; if(effectiveModifierPower(e,'DEBUFF','ATK')!==20||effectiveModifierPower(c,'DEBUFF','ATK')!==0) throw new Error('enemy target');
 a.auraSkillIds=['SKL-AURA-ALLY-DEF-15-EX']; if(effectiveModifierPower(a,'BUFF','DEF')!==0||effectiveModifierPower(c,'BUFF','DEF')!==15) throw new Error('exclude self');
 resetCombatantOnDeath(c,{reason:'target'}); if(effectiveModifierPower(c,'BUFF','DEF')!==0) throw new Error('dead target active');
})();`;
try{vm.runInContext(src,ctx)}catch(e){errors.push(String(e.message||e))}
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8'),html=fs.readFileSync('game/index.html','utf8');
if(!app.includes('function tagTestRunAuraRuntimeJson()')||!app.includes('TAG-AURA-RUNTIME-DEVICE-001'))errors.push('device runtime json missing');
if(!html.includes('id="tagTestRunAuraRuntimeJson"'))errors.push('device runtime button missing');
if(errors.length){errors.forEach(e=>console.error('FAIL',e));process.exit(1)}
console.log('AURA_SOURCE_DEPENDENT_RUNTIME_GA_B486_28_OK');
