/* GKS Formal Skill Compile Service. */
(function(root){'use strict';
const VERSION='FORMAL-SKILL-1';let registryPromise=null;
function baseUrl(){
 const scripts=[...(root.document?.scripts||[])];
 const me=scripts.find(s=>String(s.src||'').includes('/assets/shared/js/skill-compile-service.js'));
 if(me?.src)return new URL('../config/skill-registry.json',me.src).toString();
 return '../assets/shared/config/skill-registry.json';
}
async function loadRegistry({force=false}={}){
 if(force||!registryPromise)registryPromise=fetch(baseUrl(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Skill Registry load failed: ${r.status}`);return r.json()});
 return registryPromise;
}
async function compileSkill(skill,{registry=null}={}){
 const compiler=root.GKSSkillCompiler;
 if(!compiler?.compileSkill)throw new Error('GKSSkillCompiler is not loaded');
 return compiler.compileSkill(skill,registry||await loadRegistry());
}
const api=Object.freeze({VERSION,loadRegistry,compileSkill});
root.GKSSkillCompileService=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
