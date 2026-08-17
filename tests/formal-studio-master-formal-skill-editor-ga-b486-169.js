const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
function assert(cond,msg){if(!cond)throw new Error(msg)}
assert(html.includes("function isFormalSkillMasterRecord(category,m)"),'formal skill master detector missing');
assert(html.includes("function formalSkillEditorPayload(m)"),'formal skill editor payload missing');
assert(html.includes("Formal Skill本体（参照専用JSON）"),'formal skill readonly label missing');
assert(html.includes("masterParams.readOnly=!!enabled"),'formal payload must be readonly');
assert(html.includes("masterId.readOnly=!!enabled"),'formal master id must be readonly');
assert(html.includes("if(c==='skills'&&isFormalSkillMasterRecord('skills',existing))"),'formal skill preserving save branch missing');
assert(html.includes("delete rec.tags;delete rec.params"),'legacy generic fields must be removed on formal metadata save');
assert(html.includes("formal?formalSkillEditorPayload(m):(m.params||{})"),'formal editor must show formal top-level payload');
assert(html.includes("if(!isFormalSkillMasterRecord('skills',m)){m.tags=m.tags||[];m.params=m.params||{}}"),'normalizeData must not pollute formal skills with legacy fields');
console.log('FORMAL_STUDIO_MASTER_SKILL_EDITOR_OK build=GA-B486.194');
