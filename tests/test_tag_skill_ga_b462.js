const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'game/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'game/sw.js'),'utf8');
const checks=[
 ['build',/GA-B462/.test(html)&&/guild-adventure-ga-b462/.test(sw)&&/appv=462/.test(sw)],
 ['skill view',/data-base-view="character-skills"/.test(html)&&/characterSkillList/.test(html)],
 ['owned skills',/SKL-TEST-POISON/.test(html)&&/equippedSkillId/.test(html)],
 ['save migration',/c\.equippedSkillId=c\.skills\.includes/.test(html)],
 ['equip action',/data-equip-skill/.test(html)&&/c\.equippedSkillId=id/.test(html)&&/persist\(\)/.test(html)],
 ['battle connection',/defaultSkillId:c\.equippedSkillId/.test(html)&&/findTagSkill\(actor\.defaultSkillId\)/.test(html)],
 ['placeholder removed',!html.includes('スキル装着画面は次の実験Buildで追加します。')],
 ['tag runtime retained',/function compileTaggedSkill/.test(html)&&/function executeTaggedSkill/.test(html)&&/function processDotStacks/.test(html)],
 ['test route retained',fs.existsSync(path.join(root,'game-tag-test/index.html'))]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}process.exitCode=fail?1:0;
