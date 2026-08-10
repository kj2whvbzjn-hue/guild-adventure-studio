const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
const index=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const config=fs.readFileSync(path.join(root,'assets/shared/config/runtime-config.js'),'utf8');
function need(v,m){if(!v)throw new Error(m)}
need(js.includes("const VERSION='1.2.0'"),'generator version');
need(js.includes('CONDITION_SELF_HP_RATE'),'hp rate condition missing');
need(js.includes("CONDITION_OPERATORS=new Set(['=','!=','>','>=','<','<='])"),'operators missing');
need(js.includes('発動条件（任意・すべてAND）'),'condition UI missing');
need(js.includes("className='skg-condition-row'"),'condition row missing');
need(js.includes('conditions:collectConditions()'),'condition collect missing');
need(js.includes('for(const c of normalizeConditions(d.conditions))'),'condition tags missing');
need(index.includes('GKS-B504'),'studio build');
need(index.includes('./skill/skill-generator.js?v=4'),'cache key');
need(config.includes('gameBuild: "GA-B486.59"'),'game build');
need(config.includes('studioBuild: "GKS-B504"'),'studio build config');
console.log('SKILL_GENERATOR_CONDITIONS_GKS_B504_PASS');
