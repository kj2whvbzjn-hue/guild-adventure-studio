const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
const ctx={console,window:{},document:{}};vm.createContext(ctx);vm.runInContext(src,ctx);
const c=ctx.compileTaggedSkill;if(typeof c!=='function')throw new Error('compileTaggedSkill missing');
const base=['STATUS','STATUS_ID=STATUS-ACTION-DISABLED','ACTION_DISABLED=true','敵','単体','DURATION=400'];
const ok=c({id:'T',name:'T',tags:base});if(!ok.ok)throw new Error('formal action disabled rejected: '+ok.errors.join('|'));
if(ok.definition.parameters.statusPayload.action_disabled!==true)throw new Error('statusPayload.action_disabled missing');
const attached=c({id:'TA',name:'TA',tags:['ATTACK',...base,'物理','DAMAGE=100']});if(!attached.ok||attached.definition.parameters.statusPayload.action_disabled!==true)throw new Error('ATTACK+STATUS action disabled failed');
for(const [id,tags] of [
 ['false',base.map(x=>x==='ACTION_DISABLED=true'?'ACTION_DISABLED=false':x)],
 ['numeric',base.map(x=>x==='ACTION_DISABLED=true'?'ACTION_DISABLED=1':x)],
 ['nostatus',['ACTION_DISABLED=true','敵','単体']]
]){const r=c({id,name:id,tags});if(r.ok)throw new Error(id+' should reject');}
const data=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));if(data.data_version!=='GA-B486.49-p01-12-activation-priority-formal-v1')throw new Error('data_version mismatch');
const prod=data.data.find(x=>x.id==='SKL-STATUS-ACTION-DISABLED-400');if(!prod||prod.environment!=='production'||!c(prod).ok)throw new Error('production fixture invalid');
for(const id of ['ACTION-DISABLED-VALIDATION-FALSE','ACTION-DISABLED-VALIDATION-NUMERIC','ACTION-DISABLED-VALIDATION-NO-STATUS','ACTION-DISABLED-VALIDATION-NO-DURATION']){const x=data.data.find(v=>v.id===id);if(!x||x.environment!=='validation'||c(x).ok)throw new Error('validation fixture not rejected '+id)}
const html=fs.readFileSync('game-tag-test/index.html','utf8'),vr=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');if(!html.includes('tagTestRunActionDisabledJson')||!vr.includes('function tagTestRunActionDisabledJson()'))throw new Error('device JSON path missing');
console.log('ACTION_DISABLED_TAG_VALIDATION_GA_B486_38_OK');
