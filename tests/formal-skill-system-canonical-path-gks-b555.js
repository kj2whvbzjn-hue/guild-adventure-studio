'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const compilerSrc=fs.readFileSync(path.join(__dirname,'../assets/shared/js/skill-compiler.js'),'utf8');
const serviceSrc=fs.readFileSync(path.join(__dirname,'../assets/shared/js/skill-compile-service.js'),'utf8');
const studio=fs.readFileSync(path.join(__dirname,'../studio/skill/skill-generator.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
for(const token of ['skill-native','GKSSkillNative','legacySkill','legacyCompile','compileForLegacy','compileTaggedSkill','genericRuntime'])
  assert(!compilerSrc.includes(token),`canonical compiler contains ${token}`);
for(const token of ['skill-native','GKSSkillNative','legacyCompile','compileForLegacy','compileTaggedSkill','genericRuntime'])
  assert(!serviceSrc.includes(token),`canonical service contains ${token}`);
assert(!html.includes('skill-native-compiler.js'),'Studio still loads native compiler path');
assert(!html.includes('skill-native-compile-service.js'),'Studio still loads native compile service path');
assert(!studio.includes('GKSSkillNativeCompileService'),'Studio still uses native compile service API');
assert(!studio.includes('legacySkill'),'Studio still uses legacySkill');
assert(!studio.includes('genericRuntime'),'Studio still stores genericRuntime');
const skill={schemaVersion:1,id:'FORMAL-CANONICAL-001',name:'Canonical Skill',skillLevel:5,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'DAMAGE',power:78,damageType:'PHYSICAL'},{type:'APPLY',effectId:'BURN',power:3,duration:20,interval:100,stackGain:1}],resource:{mpCost:0,cooldown:0,activationPriority:0}};
const out=compiler.compileSkill(skill,registry);
assert(out.ok,JSON.stringify(out.errors));
assert(out.compiledSkill?.runtimeContracts);
assert(!('tags' in out.compiledSkill));
assert(!('genericRuntime' in out.compiledSkill));
assert(!('legacySkill' in out));

const tagRuntime=fs.readFileSync(path.join(__dirname,'../game/assets/js/tag-skill-runtime.js'),'utf8');
const authoringRegistry=fs.readFileSync(path.join(__dirname,'../assets/shared/js/skill-authoring-registry.js'),'utf8');
assert(!tagRuntime.includes('legacy:true'));
assert(!tagRuntime.includes('legacy:false'));
assert(!authoringRegistry.includes('legacyTag'));
assert(!authoringRegistry.includes('legacy_tag'));
console.log('FORMAL_SKILL_SYSTEM_CANONICAL_PATH_PASS');
