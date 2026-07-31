const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','studio','index.html'),'utf8');
const required=[
 'GKS-G001_TAG_DRIVEN_SKILL_DEFINITION_BEGIN',
 'id="skillExecutionFields"',
 'function validateSkillExecutionDefinition',
 'function buildSkillExecutionFromForm',
 "if(c==='skills')",
 "params.execution=checked.execution",
 "if(category==='skills')loadSkillExecutionForm(m)",
 "new Set(['has_tag','tag_exists','tag_missing','stack_at_least'])",
 "new Set(['remove_tag','consume_stack'])",
 "new Set(['add_tag','remove_tag','add_stack','remove_stack'])"
];
for(const token of required){if(!html.includes(token)){console.error('FAIL missing:',token);process.exit(1)}}
console.log('PASS GKS-G001 tag-driven skill definition integration');
