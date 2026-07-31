const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
function check(v,m){if(!v)throw new Error(m)}
for(const x of ['GKS-G003_TAG_DRIVEN_COMBAT_EFFECTS_BEGIN','hp_ratio_at_most','hp_ratio_at_least','spend_hp','deal_damage','heal','target_max_hp'])check(html.includes(x),'missing '+x);
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/skill.schema.json'),'utf8'));
const types=schema.$defs.operation.properties.type.enum;
for(const x of ['spend_hp','deal_damage','heal'])check(types.includes(x),'schema missing '+x);
console.log('GKS-G003 STUDIO PASS');
