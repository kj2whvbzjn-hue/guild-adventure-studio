const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','game','index.html'),'utf8');
function check(cond,msg){if(!cond)throw new Error(msg)}
check(html.includes('GKS-G002_TAG_DRIVEN_RUNTIME_BEGIN'),'runtime marker missing');
check(html.includes('eligibleInteractionSkill'),'skill selection missing');
check(html.includes('rolledBack:true'),'rollback missing');
check(html.includes("a.side==='a'&&useTagDrivenSkill"),'battle integration missing');
const runtime={
 tagId(op){return String(op?.tagId||op?.tag_id||op?.tag?.id||'').trim()},subject(a,t,o){return o?.subject==='actor'?a:t},
 hasTag(u,id){return Array.isArray(u?.tags)&&u.tags.includes(id)},stack(u,id){return Number(u?.stacks?.[id]||0)},
 evaluate(a,t,o){const u=this.subject(a,t,o),id=this.tagId(o);if(o.type==='has_tag')return this.hasTag(u,id);if(o.type==='tag_missing')return !this.hasTag(u,id);if(o.type==='stack_at_least')return this.stack(u,o.stackId)>=Number(o.amount||0);throw Error('bad')},
 apply(a,t,o){const u=this.subject(a,t,o),id=this.tagId(o),n=Math.max(1,Number(o.amount||1));u.tags=u.tags||[];u.stacks=u.stacks||{};if(o.type==='add_tag'){if(!u.tags.includes(id))u.tags.push(id);return}if(o.type==='remove_tag'){u.tags=u.tags.filter(x=>x!==id);return}if(o.type==='consume_stack'){if(this.stack(u,o.stackId)<n)throw Error('STACK_NOT_ENOUGH');u.stacks[o.stackId]-=n;return}throw Error('UNSUPPORTED_OPERATION')},
 execute(a,t,s){const ex=s.execution,checks=ex.conditions.map(o=>this.evaluate(a,t,o));if(!checks.every(Boolean))return {ok:false};const snap=JSON.stringify([a,t]);try{ex.costs.forEach(o=>this.apply(a,t,o));ex.effects.forEach(o=>this.apply(a,t,o));return {ok:true}}catch(e){const [aa,tt]=JSON.parse(snap);Object.assign(a,aa);Object.assign(t,tt);return {ok:false,rolledBack:true}}}
};
let actor={tags:[],stacks:{}},target={tags:['FROZEN'],stacks:{CHILL:3}};
let skill={execution:{conditions:[{subject:'target',type:'has_tag',tagId:'FROZEN'},{subject:'target',type:'stack_at_least',stackId:'CHILL',amount:3}],costs:[{subject:'target',type:'remove_tag',tagId:'FROZEN'},{subject:'target',type:'consume_stack',stackId:'CHILL',amount:3}],effects:[{subject:'target',type:'add_tag',tagId:'BROKEN'}]}};
check(runtime.execute(actor,target,skill).ok,'valid interaction failed');
check(!target.tags.includes('FROZEN')&&target.tags.includes('BROKEN')&&target.stacks.CHILL===0,'interaction result incorrect');
target={tags:['FROZEN'],stacks:{CHILL:3}};skill.execution.effects=[{subject:'target',type:'unknown'}];const before=JSON.stringify(target),res=runtime.execute(actor,target,skill);check(res.rolledBack&&JSON.stringify(target)===before,'rollback failed');
console.log('GKS-G002 PASS');
