'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const callers=[
 'game/assets/js/app-runtime.js',
 'game/assets/js/battle-control.js',
 'game/assets/js/studio-skill-bridge.js',
 'game-tag-test/assets/js/validation-runtime.js',
 'game-tag-test/assets/js/battle-control.js'
];
for(const rel of callers){
 const src=fs.readFileSync(path.join(root,rel),'utf8');
 for(const token of ['executeTaggedSkill(','compileTaggedSkill(','findTagSkill(','TAG_SKILLS'])
  assert(!src.includes(token),`${rel} still calls transitional ${token}`);
}
const gameRuntime=fs.readFileSync(path.join(root,'game/assets/js/tag-skill-runtime.js'),'utf8');
assert(!gameRuntime.includes('function findTagSkill('),'Production runtime still exposes transitional findTagSkill alias');
assert(!gameRuntime.includes('function executeTaggedSkill('),'Production runtime still exposes transitional executeTaggedSkill alias');
assert(!gameRuntime.includes('function compileTaggedSkill('),'Production runtime still contains transitional Tag compiler');
assert(!gameRuntime.includes('function parseSkillTags('),'Production runtime still contains Tag parser');
assert(!gameRuntime.includes('GKSValidationTagCompiler'),'Production runtime still references isolated validation Tag compiler');
for(const rel of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const src=fs.readFileSync(path.join(root,rel),'utf8');
 assert(src.includes('function findSkill(skillId)'),'canonical findSkill missing');
 assert(src.includes('function compileSkillForRuntime(skill)'),'canonical runtime compile dispatcher missing');
 assert(src.includes('function executeSkillRuntime('),'canonical runtime executor missing');
}
assert(!fs.readFileSync(path.join(root,'game/index.html'),'utf8').includes('validation-tag-compiler.js'),'Production Game must not load validation Tag compiler');
console.log('FORMAL_SKILL_RUNTIME_CALLER_API_PASS');
