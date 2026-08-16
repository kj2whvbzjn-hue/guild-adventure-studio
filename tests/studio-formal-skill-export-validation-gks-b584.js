const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');

assert.ok(html.includes('function masterRequiresParamsObjectValidation(category,m)'), 'B584 params validation helper missing');
assert.ok(html.includes("if(masterRequiresParamsObjectValidation(category,m)&&(typeof m.params!=='object'||Array.isArray(m.params)))"), 'runValidation must gate legacy params validation');

const formal={id:'SKL-0001',name:'Formal',schemaVersion:1,trigger:{type:'active'},effects:[],target:{type:'enemy'}};
const legacy={id:'SKL-9999',name:'Legacy'};
const normal={id:'MON-0001',name:'Monster'};
function isFormalSkillMasterRecord(category,m){return category==='skills'&&!!m&&typeof m==='object'&&(Number(m.schemaVersion)>=1||!!m.runtimeContracts||Array.isArray(m.effects)||!!m.trigger||!!m.target||!!m.resource)}
function masterRequiresParamsObjectValidation(category,m){return !isFormalSkillMasterRecord(category,m)}
assert.strictEqual(masterRequiresParamsObjectValidation('skills',formal),false,'formal skill must not require legacy params object');
assert.strictEqual(masterRequiresParamsObjectValidation('skills',legacy),true,'legacy skill still requires params object');
assert.strictEqual(masterRequiresParamsObjectValidation('monsters',normal),true,'normal masters still require params object');
console.log('PASS GKS-B584 formal Skill is exempt from legacy params-object validation only');
