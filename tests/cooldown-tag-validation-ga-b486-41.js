
'use strict';
const fs=require('fs'),assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
function skill(id,cooldown,kind='DAMAGE',omit=false){
 const effects=kind==='HEAL'?[{type:'HEAL',power:100}]:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}];
 const resource=omit?{mpCost:0,activationPriority:0}:{mpCost:0,cooldown,activationPriority:0};
 return{schemaVersion:1,id:`SKL-${id}`,name:id,skillLevel:1,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:kind==='HEAL'?'ALLY':'ENEMY',range:'SINGLE'},effects,resource};
}
for(const [id,value,kind,omit,expected] of [['FORMAL',300,'DAMAGE',false,300],['ZERO',0,'DAMAGE',false,0],['OMITTED',0,'DAMAGE',true,0],['HEAL',120,'HEAL',false,120]]){
 const r=compiler.compileSkill(skill(id,value,kind,omit),registry);assert.strictEqual(r.ok,true,`${id}: ${JSON.stringify(r.errors)}`);assert.strictEqual(r.compiledSkill.runtimeContracts.resourceContract.cooldown,expected,`${id} cooldown`);
}
for(const [id,value] of [['NEGATIVE',-1],['DECIMAL',1.5]]){const r=compiler.compileSkill(skill(id,value),registry);assert.strictEqual(r.ok,false,`${id} accepted`);assert(r.errors.some(x=>x.code==='INVALID_COOLDOWN'),JSON.stringify(r.errors));}
const data=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));assert.strictEqual(data.data_version,'FORMAL-SKILL-1');
const prod=data.data.find(x=>x.id==='SKL-COOLDOWN-ATTACK-300');assert(prod&&prod.environment==='production','production fixture missing');assert.strictEqual(prod.runtimeContracts?.resourceContract?.cooldown,300,'production cooldown contract mismatch');
console.log('COOLDOWN_FORMAL_VALIDATION_GA_B486_41_OK');
