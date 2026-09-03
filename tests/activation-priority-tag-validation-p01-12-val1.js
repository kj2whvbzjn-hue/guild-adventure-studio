'use strict';
const fs=require('fs'),assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
function skill(id,priority,omit=false){
 return{schemaVersion:1,id:`SKL-${id}`,name:id,skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:10,damageType:'PHYSICAL'}],resource:omit?{mpCost:0,cooldown:0}:{mpCost:0,cooldown:0,activationPriority:priority}};
}
for(const [id,v] of [['HIGH',100],['ZERO',0],['NEGATIVE',-100]]){
 const r=compiler.compileSkill(skill(id,v),registry);assert.strictEqual(r.ok,true,`${id} rejected ${JSON.stringify(r.errors)}`);assert.strictEqual(r.compiledSkill.runtimeContracts.resourceContract.activationPriority,v,`${id} priority mismatch`);
}
const omitted=compiler.compileSkill(skill('OMITTED',0,true),registry);assert.strictEqual(omitted.ok,true,JSON.stringify(omitted.errors));assert.strictEqual(omitted.compiledSkill.runtimeContracts.resourceContract.activationPriority,0,'omitted priority');
const decimal=compiler.compileSkill(skill('DECIMAL',1.5),registry);assert.strictEqual(decimal.ok,false,'decimal accepted');assert(decimal.errors.some(x=>x.code==='INVALID_ACTIVATION_PRIORITY'),'decimal must fail with INVALID_ACTIVATION_PRIORITY');
const data=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('Export/manifest.json','utf8'));
const project=JSON.parse(fs.readFileSync('project-data.json','utf8'));
assert.strictEqual(data.data_version,manifest.data_version,'Skill Export data_version must match Export manifest generation');
assert(Array.isArray(data.data),'Skill Export data must be an array');
assert.deepStrictEqual(data.data.map(x=>x.id).sort(),(project.masters?.skills||[]).map(x=>x.id).sort(),'Skill Export must mirror Current Product Skill Master, including valid zero-inventory');
assert(data.data.every(x=>x.runtimeContracts?.registryPhase===registry.phase),'Skill Export contains non-Formal runtimeContracts');
console.log('ACTIVATION_PRIORITY_FORMAL_COMPILER_GA_B486_PASS');
