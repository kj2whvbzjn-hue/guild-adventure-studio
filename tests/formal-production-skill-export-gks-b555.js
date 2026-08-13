'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const envelope=JSON.parse(fs.readFileSync(path.join(root,'Export/skill/skills.json'),'utf8'));
const production=(envelope.data||[]).filter(x=>(x.environment||'production')==='production');
assert.strictEqual(production.length,45);
for(const skill of production){
 assert.strictEqual(skill.schemaVersion,1,`${skill.id}: schemaVersion`);
 assert(skill.runtimeContracts&&typeof skill.runtimeContracts==='object',`${skill.id}: runtimeContracts missing`);
 assert(!('tags' in skill),`${skill.id}: production tags must be removed`);
 const c=compiler.compileSkill(skill,registry);
 assert(c.ok,`${skill.id}: ${JSON.stringify(c.errors)}`);
 assert.deepStrictEqual(c.compiledSkill.runtimeContracts,skill.runtimeContracts,`${skill.id}: runtimeContracts mismatch`);
}
const runtimeSrc=fs.readFileSync(path.join(root,'game/assets/js/tag-skill-runtime.js'),'utf8');
assert(runtimeSrc.includes("Production SkillはruntimeContractsが必要です"),'production fallback guard missing');
const bridge=fs.readFileSync(path.join(root,'game/assets/js/studio-skill-bridge.js'),'utf8');
assert(bridge.includes('function normalizeStudioSkill(record){'),'formal Studio Skill normalizer missing');
assert(bridge.includes("if(environment==='production'||!tags.length)return null;"),'production Tag import must be rejected');
console.log('FORMAL_PRODUCTION_SKILL_EXPORT_PASS');
