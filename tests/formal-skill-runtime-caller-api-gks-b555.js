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
for(const rel of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const src=fs.readFileSync(path.join(root,rel),'utf8');
 assert(src.includes('function findSkill(skillId)'),'canonical findSkill missing');
 assert(src.includes('function compileSkillForRuntime(skill)'),'canonical runtime compile dispatcher missing');
 assert(src.includes('function executeSkillRuntime('),'canonical runtime executor missing');
}
console.log('FORMAL_SKILL_RUNTIME_CALLER_API_PASS');
