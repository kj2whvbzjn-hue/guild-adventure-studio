'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
assert(src.includes("if(!skillRegistry)await loadSkillDefinition();"),
  'G06 revalidation must load Skill Registry before unknown-field validation');
assert(src.includes("G06_SKILL_REGISTRY_REQUIRED"),
  'G06 registry precondition error code missing');
assert(src.includes("effectTypeCount:Object.keys(skillRegistry?.authoring?.effect_types||{}).length"),
  'G06 revalidation report registry diagnostics missing');
console.log('PASS test_g06_revalidation_registry_precondition_gks_b555');
