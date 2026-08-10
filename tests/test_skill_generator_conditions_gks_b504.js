const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
const index=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const config=fs.readFileSync(path.join(root,'assets/shared/config/runtime-config.js'),'utf8');
const build=JSON.parse(fs.readFileSync(path.join(root,'package-build.json'),'utf8'));
function need(v,m){if(!v)throw new Error(m)}
need(/const VERSION='1\.\d+\.0'/.test(js),'generator version');
need(js.includes('CONDITION_SELF_HP_RATE'),'hp rate condition missing');
need(js.includes("CONDITION_OPERATORS=new Set(['=','!=','>','>=','<','<='])"),'operators missing');
need(js.includes('発動条件（任意・すべてAND）'),'condition UI missing');
need(js.includes("className='skg-condition-row'"),'condition row missing');
need(js.includes('conditions:collectConditions()'),'condition collect missing');
need(js.includes('for(const c of normalizeConditions(d.conditions))'),'condition tags missing');
need(index.includes(build.studio_build),'studio build');
need(/\.\/skill\/skill-generator\.js\?v=\d+/.test(index),'cache key');
need(config.includes(`gameBuild: "${build.game_build}"`),'game build');
need(config.includes(`studioBuild: "${build.studio_build}"`),'studio build config');
console.log('SKILL_GENERATOR_CONDITIONS_REGRESSION_PASS');
