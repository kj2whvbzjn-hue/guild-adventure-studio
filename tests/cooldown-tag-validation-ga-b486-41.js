const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
const ctx={console,window:{},document:{}};vm.createContext(ctx);vm.runInContext(src,ctx);
const c=ctx.compileTaggedSkill;if(typeof c!=='function')throw new Error('compileTaggedSkill missing');
for(const [id,tags,expected] of [
 ['formal',['ATTACK','敵','単体','物理','DAMAGE=100','COOLDOWN=300'],300],
 ['zero',['ATTACK','敵','単体','物理','DAMAGE=100','COOLDOWN=0'],0],
 ['omitted',['ATTACK','敵','単体','物理','DAMAGE=100'],0],
 ['heal',['HEAL','味方','単体','HEAL=100','COOLDOWN=120'],120]
]){const r=c({id,name:id,tags});if(!r.ok)throw new Error(id+' rejected: '+r.errors.join('|'));if(r.definition.parameters.cooldown!==expected)throw new Error(id+' cooldown mismatch '+r.definition.parameters.cooldown)}
for(const [id,tags] of [
 ['negative',['ATTACK','敵','単体','物理','DAMAGE=100','COOLDOWN=-1']],
 ['decimal',['ATTACK','敵','単体','物理','DAMAGE=100','COOLDOWN=1.5']]
]){const r=c({id,name:id,tags});if(r.ok)throw new Error(id+' should reject')}
const data=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));if(data.data_version!=='GA-B486.44-p01-11-cost-tag-v1')throw new Error('data_version mismatch');
const prod=data.data.find(x=>x.id==='SKL-COOLDOWN-ATTACK-300');if(!prod||prod.environment!=='production'||!c(prod).ok)throw new Error('production fixture invalid');
for(const id of ['COOLDOWN-VALIDATION-NEGATIVE','COOLDOWN-VALIDATION-DECIMAL']){const x=data.data.find(v=>v.id===id);if(!x||x.environment!=='validation'||c(x).ok)throw new Error('validation fixture not rejected '+id)}
const html=fs.readFileSync('game-tag-test/index.html','utf8'),vr=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');if(!html.includes('tagTestRunCooldownJson')||!vr.includes('function tagTestRunCooldownJson()'))throw new Error('device JSON path missing');
console.log('COOLDOWN_TAG_VALIDATION_GA_B486_41_OK');
