const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m)}
function stable(v){return JSON.parse(JSON.stringify(v))}
function referenceApply(list,{statusId,newEffect,refreshPatch}){
 const existing=list.find(x=>x.statusId===statusId);
 if(existing){Object.assign(existing,refreshPatch||{});return{ok:true,refreshed:true,effect:existing}}
 list.push(newEffect);return{ok:true,refreshed:false,effect:newEffect};
}
for(const path of ['game/assets/js/tag-skill-runtime.js']){
 const src=fs.readFileSync(path,'utf8');
 const a=src.indexOf('function resolveStatusUniqueRefreshLifecyclePolicy('),b=src.indexOf('function applyTaggedStatus(',a);
 ok(a>=0&&b>a,`${path}: lifecycle helper missing`);
 const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);
 const lifecycle={stackRule:'UNIQUE',refreshRule:'REFRESH'};
 const original={instanceId:'STATUS-I-1',sequence:1,statusId:'STATUS-STUN',sourceId:'A',targetId:'T',skillId:'OLD',appliedTick:10,baseDurationTick:100,effectiveDurationTick:75,expiresTick:85,targetResistance:25,stackPolicy:'refresh',payload:{action_disabled:true},removeOnDeath:true,removeOnBattleEnd:true};
 const incoming={
  statusId:'STATUS-STUN',
  refreshPatch:{sourceId:'B',skillId:'NEW',appliedTick:20,baseDurationTick:200,effectiveDurationTick:150,expiresTick:170,targetResistance:25,payload:{action_disabled:true}},
  newEffect:{instanceId:'STATUS-I-2',sequence:2,statusId:'STATUS-STUN',sourceId:'B',targetId:'T',skillId:'NEW',appliedTick:20,baseDurationTick:200,effectiveDurationTick:150,expiresTick:170,targetResistance:25,stackPolicy:'refresh',payload:{action_disabled:true},removeOnDeath:true,removeOnBattleEnd:true}
 };
 const oldList=[stable(original)],newList=[stable(original)];
 const oldR=referenceApply(oldList,stable(incoming)),newR=ctx.applyStatusUniqueRefreshLifecycle(newList,stable(incoming),lifecycle);
 ok(newR.ok&&newR.refreshed,`${path}: refresh failed`);
 ok(JSON.stringify(oldList)===JSON.stringify(newList),`${path}: refresh result differs from reference semantics`);
 const oldEmpty=[],newEmpty=[];const oldN=referenceApply(oldEmpty,stable(incoming)),newN=ctx.applyStatusUniqueRefreshLifecycle(newEmpty,stable(incoming),lifecycle);
 ok(newN.ok&&!newN.refreshed,`${path}: new apply failed`);
 ok(JSON.stringify(oldEmpty)===JSON.stringify(newEmpty),`${path}: new apply result differs from reference semantics`);
 const badStack=ctx.applyStatusUniqueRefreshLifecycle([],stable(incoming),{stackRule:'STACK',refreshRule:'REFRESH'});
 ok(!badStack.ok&&badStack.field==='stackRule',`${path}: bad stackRule not rejected`);
 const badRefresh=ctx.applyStatusUniqueRefreshLifecycle([],stable(incoming),{stackRule:'UNIQUE',refreshRule:'KEEP'});
 ok(!badRefresh.ok&&badRefresh.field==='refreshRule',`${path}: bad refreshRule not rejected`);
}
console.log('FORMAL_STATUS_LIFECYCLE_R03_E2A_PASS');
