'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const envelope=JSON.parse(fs.readFileSync(path.join(root,'Export/skill/skills.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'Export/manifest.json'),'utf8'));
assert.strictEqual(envelope.data_version,manifest.data_version,'Skill Export data_version must match Export manifest generation');
const production=(envelope.data||[]).filter(x=>(x.environment||'production')==='production');
assert(production.length>0,'formal production skill export is empty');
for(const skill of production){
 assert.strictEqual(skill.schemaVersion,1,`${skill.id}: schemaVersion`);
 assert(skill.runtimeContracts&&typeof skill.runtimeContracts==='object',`${skill.id}: runtimeContracts missing`);
 assert.strictEqual(skill.runtimeContracts.registryPhase,registry.phase,`${skill.id}: registryPhase`);
 assert(!('tags' in skill),`${skill.id}: production tags must be removed`);
 const c=compiler.compileSkill(skill,registry);
 assert(c.ok,`${skill.id}: ${JSON.stringify(c.errors)}`);
 assert.deepStrictEqual(c.compiledSkill.runtimeContracts,skill.runtimeContracts,`${skill.id}: runtimeContracts mismatch`);
}
const runtimeSrc=fs.readFileSync(path.join(root,'game/assets/js/tag-skill-runtime.js'),'utf8');
assert(runtimeSrc.includes("Skillは正式runtimeContractsが必要です"),'runtimeContracts-only fallback guard missing');
assert(!runtimeSrc.includes('GKSValidationTagCompiler'),'Production runtime must not delegate to legacy validation compiler');
const bridge=fs.readFileSync(path.join(root,'game/assets/js/studio-skill-bridge.js'),'utf8');
assert(bridge.includes('function normalizeStudioSkill(record){'),'formal Studio Skill normalizer missing');
assert(bridge.includes("if(environment==='production'||!tags.length)return null;"),'production Tag import must be rejected');
console.log(`FORMAL_PRODUCTION_SKILL_EXPORT_PASS count=${production.length}`);
