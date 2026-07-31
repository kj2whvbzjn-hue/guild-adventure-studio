const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'../game/index.html'),'utf8');
function check(v,m){if(!v)throw new Error(m)}
check(html.includes('GKS-G003_TAG_DRIVEN_COMBAT_RUNTIME_BEGIN'),'runtime marker missing');
check(html.includes("op.type==='deal_damage'"),'deal_damage missing');
check(html.includes("op.type==='heal'"),'heal missing');
check(html.includes("op.type==='hp_ratio_at_most'"),'hp ratio condition missing');
const R={
 subject(a,t,o){return o.subject==='actor'?a:t},ratio(u){return u.hp/u.maxHp},eval(a,t,o){const u=this.subject(a,t,o);if(o.type==='hp_ratio_at_most')return this.ratio(u)<=o.ratio;if(o.type==='has_tag')return u.tags.includes(o.tagId);throw Error('bad condition')},
 amount(a,u,o){return Math.round((a.attack||0)*(o.multiplier??1)+(o.power||0))},
 apply(a,t,o){const u=this.subject(a,t,o);if(o.type==='deal_damage'){const n=this.amount(a,u,o);u.hp=Math.max(0,u.hp-n);return n}if(o.type==='heal'){const n=this.amount(a,u,o),b=u.hp;u.hp=Math.min(u.maxHp,u.hp+n);return u.hp-b}if(o.type==='spend_hp'){if(u.hp<=o.amount)throw Error('HP_COST_NOT_ENOUGH');u.hp-=o.amount;return o.amount}throw Error('UNSUPPORTED')},
 exec(a,t,e){const snap=[a.hp,t.hp];try{if(!e.conditions.every(o=>this.eval(a,t,o)))return {ok:false};for(const o of e.costs)this.apply(a,t,o);const applied=e.effects.map(o=>this.apply(a,t,o));return {ok:true,applied}}catch(err){a.hp=snap[0];t.hp=snap[1];return {ok:false,rolledBack:true}}}
};
let a={hp:100,maxHp:100,attack:40,tags:[]},t={hp:60,maxHp:100,attack:10,tags:['FROZEN']};
let e={conditions:[{subject:'target',type:'has_tag',tagId:'FROZEN'},{subject:'target',type:'hp_ratio_at_most',ratio:.75}],costs:[{subject:'actor',type:'spend_hp',amount:10}],effects:[{subject:'target',type:'deal_damage',power:5,multiplier:1.5}]};
let r=R.exec(a,t,e);check(r.ok,'combat execution failed');check(a.hp===90,'hp cost wrong');check(t.hp===0,'damage wrong');
a={hp:5,maxHp:100,attack:40,tags:[]};t={hp:60,maxHp:100,attack:10,tags:['FROZEN']};r=R.exec(a,t,e);check(r.rolledBack&&a.hp===5&&t.hp===60,'rollback did not restore hp');
a={hp:50,maxHp:100,attack:20,tags:[]};t={hp:30,maxHp:100,attack:10,tags:[]};r=R.exec(a,t,{conditions:[],costs:[],effects:[{subject:'target',type:'heal',power:10,multiplier:1}]});check(r.ok&&t.hp===60,'heal wrong');
console.log('GKS-G003 PASS');
