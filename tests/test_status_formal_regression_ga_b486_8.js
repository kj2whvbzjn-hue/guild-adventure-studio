const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'game/assets/js/studio-skill-bridge.js'),'utf8');
const skills=JSON.parse(fs.readFileSync(path.join(root,'Export/skill/skills.json'),'utf8'));
const rows=skills.data||[];
const requireId=id=>{if(!rows.some(x=>x.id===id))throw new Error(`missing ${id}`)};
requireId('SKL-TEST-STATUS-ACCURACY-DOWN');
requireId('SKL-TEST-ATTACK-STATUS-ACCURACY-DOWN');
requireId('SKL-TEST-STATUS-INVALID');
for(const needle of ['runFormalStatusRuntimeRegression','FORMAL-STATUS-APPLY','FORMAL-STATUS-RESIST-DURATION','FORMAL-STATUS-ATTACK-HIT','FORMAL-STATUS-REFRESH-EXPIRE','FORMAL-STATUS-BATTLE-END','status_runtime_case_count']){
 if(!bridge.includes(needle))throw new Error(`bridge missing ${needle}`);
}
if(!bridge.includes("build:'GA-B486.8'"))throw new Error('formal report build mismatch');
if(!bridge.includes('tag-formal-runtime-regression-GA-B486.8-'))throw new Error('download filename mismatch');
console.log('STATUS_FORMAL_REGRESSION_GA_B486_8_OK');
