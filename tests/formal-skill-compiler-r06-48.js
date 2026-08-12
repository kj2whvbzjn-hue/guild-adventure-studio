'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=JSON.parse(fs.readFileSync(path.join(root,'assets/shared/config/skill-registry.json'),'utf8'));
const batch=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/g06-r06-48-skill-batch.json'),'utf8'));
assert.equal(batch.skills.length,48);
for(const row of batch.skills){
 const out=compiler.compileSkill(row.skill,registry);
 assert(out.ok,`${row.skill.id}: ${JSON.stringify(out.errors)}`);
 assert(out.compiledSkill?.runtimeContracts,`${row.skill.id}: runtimeContracts missing`);
 for(const forbidden of ['legacySkill','legacyValidation','genericRuntime'])assert(!(forbidden in out),`${row.skill.id}: forbidden output ${forbidden}`);
 assert(!('tags' in out.compiledSkill),`${row.skill.id}: tags must not be emitted by native compiler`);
}
const source=fs.readFileSync(path.join(root,'assets/shared/js/skill-compiler.js'),'utf8');
for(const token of ['legacySkill','legacyCompile','compileForLegacy','compileTaggedSkill','genericRuntime','GKSGeneric'])assert(!source.includes(token),`native compiler contains ${token}`);
console.log('FORMAL_NATIVE_SKILL_COMPILER_R06_48_PASS');
