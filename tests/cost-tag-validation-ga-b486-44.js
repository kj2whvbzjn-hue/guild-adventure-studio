'use strict';
const fs=require('fs'),assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
function skill(id,mpCost,omit=false,cooldown=0){const resource=omit?{cooldown,activationPriority:0}:{mpCost,cooldown,activationPriority:0};return{schemaVersion:1,id:`SKL-${id}`,name:id,skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],resource}}
for(const [id,value,omit,cooldown,expected] of [['FORMAL',20,false,0,20],['ZERO',0,false,0,0],['OMITTED',0,true,0,0],['WITH-CD',20,false,300,20]]){const r=compiler.compileSkill(skill(id,value,omit,cooldown),registry);assert.strictEqual(r.ok,true,`${id}: ${JSON.stringify(r.errors)}`);assert.strictEqual(r.compiledSkill.runtimeContracts.resourceContract.mpCost,expected,`${id} mpCost`);}
const negative=compiler.compileSkill(skill('NEGATIVE',-1),registry);assert.strictEqual(negative.ok,false,'negative mpCost accepted');assert(negative.errors.some(x=>x.code==='INVALID_MP_COST'),JSON.stringify(negative.errors));
const data=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('Export/manifest.json','utf8'));
const project=JSON.parse(fs.readFileSync('project-data.json','utf8'));
assert.strictEqual(data.data_version,manifest.data_version,'Skill Export data_version must match Export manifest generation');
assert(Array.isArray(data.data),'Skill Export data must be an array');
assert.deepStrictEqual(data.data.map(x=>x.id).sort(),(project.masters?.skills||[]).map(x=>x.id).sort(),'Skill Export must mirror Current Product Skill Master, including valid zero-inventory');
assert(data.data.every(x=>x.runtimeContracts?.registryPhase===registry.phase),'Skill Export contains non-Formal runtimeContracts');
console.log('COST_FORMAL_VALIDATION_GA_B486_44_OK');
