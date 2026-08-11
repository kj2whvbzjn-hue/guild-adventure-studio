const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const makeSkill=(id,power)=>({schemaVersion:1,id,name:id,trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BARRIER',power,duration:300}]});
const legacySkill=(id,power)=>({id,name:id,tags:['SHIELD','味方','単体',`SHIELD=${power}`,'DURATION=300']});
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const battle={tick:25,units:[],log:[],validationEvents:[]},ctx={console,battle,recordValidationEvent:(type,data)=>battle.validationEvents.push({type,...data})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.resolveShieldConsumeLifecyclePolicy==='function',`${path}: consume policy resolver missing`);
 ok(typeof ctx.resolveShieldConsumePolicyForTarget==='function',`${path}: target consume resolver missing`);
 ok(typeof ctx.consumeShieldLayersLifecycle==='function',`${path}: common shield consume helper missing`);
 const invalid=ctx.resolveShieldConsumeLifecyclePolicy({consumeRule:'LIFO'});ok(!invalid.ok&&invalid.field==='consumeRule',`${path}: unsupported LIFO accepted`);
 const out100=generic.compileGenericSkill(makeSkill('E4C-G100',100),registry,ctx.compileTaggedSkill),out40=generic.compileGenericSkill(makeSkill('E4C-G40',40),registry,ctx.compileTaggedSkill);
 ok(out100.ok&&out40.ok,`${path}: generic compile failed`);
 const c100=ctx.compileTaggedSkill(out100.legacySkill),c40=ctx.compileTaggedSkill(out40.legacySkill);ok(c100.ok&&c40.ok,`${path}: generic legacy compile failed`);
 const source={id:'SRC',name:'Source',alive:true},target={id:'TGT',name:'Target',alive:true,shieldEffects:[]};
 ok(ctx.applyTaggedApplyRuntime(source,target,c100,'SHIELD').result.ok,`${path}: first generic shield failed`);
 ok(ctx.applyTaggedApplyRuntime(source,target,c40,'SHIELD').result.ok,`${path}: second generic shield failed`);
 ok(target.shieldEffects.length===2&&target.shieldEffects.every(x=>x.lifecyclePolicy?.consumeRule==='FIFO'),`${path}: generic layers did not retain FIFO lifecycle contract`);
 const beforeIds=target.shieldEffects.map(x=>x.id);
 const r=ctx.consumeShieldDamage(target,120,{sourceId:'EN',skillId:'HIT120'});
 ok(r.absorbed===120&&r.hpDamage===0&&r.policy?.consumeRule==='FIFO',`${path}: generic FIFO absorb result mismatch`);
 ok(r.consumed.length===2&&r.consumed[0].shield_id===beforeIds[0]&&r.consumed[0].absorbed===100,`${path}: first generic layer not consumed first`);
 ok(r.consumed[1].shield_id===beforeIds[1]&&r.consumed[1].absorbed===20&&r.consumed[1].remaining===20,`${path}: second generic layer partial consume mismatch`);
 ok(target.shieldEffects.length===1&&target.shieldEffects[0].id===beforeIds[1]&&target.shieldEffects[0].remaining===20,`${path}: generic remaining layer mismatch`);
 const ev=battle.validationEvents.find(x=>x.type==='shield_absorbed');ok(ev&&ev.consume_rule==='FIFO'&&ev.policy_source==='registry_contract',`${path}: consume policy event missing`);
 // Unsupported policy must reject before mutation.
 const invalidTarget={id:'BAD',name:'Bad',alive:true,shieldEffects:[{id:'BAD-1',sequence:1,remaining:50,amount:50,appliedAt:1,expiresAt:99}]};
 const snapshot=JSON.stringify(invalidTarget.shieldEffects);
 const bad=ctx.consumeShieldLayersLifecycle(invalidTarget,20,{consumeRule:'LIFO'});
 ok(!bad.ok&&bad.reason==='SHIELD_CONSUME_POLICY_UNSUPPORTED',`${path}: common helper did not reject unsupported consume policy`);
 ok(JSON.stringify(invalidTarget.shieldEffects)===snapshot,`${path}: invalid consume policy mutated shield state`);
 // Legacy path remains FIFO by default and must match numeric result.
 const l100=ctx.compileTaggedSkill(legacySkill('E4C-L100',100)),l40=ctx.compileTaggedSkill(legacySkill('E4C-L40',40));ok(l100.ok&&l40.ok,`${path}: legacy compile failed`);
 const legacyTarget={id:'LEG',name:'Legacy',alive:true,shieldEffects:[]};
 ok(ctx.applyTaggedShield(source,legacyTarget,l100).ok&&ctx.applyTaggedShield(source,legacyTarget,l40).ok,`${path}: legacy shield apply failed`);
 const legacyIds=legacyTarget.shieldEffects.map(x=>x.id),lr=ctx.consumeShieldDamage(legacyTarget,120,{sourceId:'EN',skillId:'HIT120'});
 ok(lr.absorbed===120&&lr.hpDamage===0&&lr.policy?.consumeRule==='FIFO',`${path}: legacy FIFO result changed`);
 ok(lr.consumed[0].shield_id===legacyIds[0]&&lr.consumed[0].absorbed===100&&lr.consumed[1].shield_id===legacyIds[1]&&lr.consumed[1].absorbed===20,`${path}: legacy FIFO order changed`);
 ok(legacyTarget.shieldEffects.length===1&&legacyTarget.shieldEffects[0].remaining===20,`${path}: legacy remainder changed`);
}
console.log('GENERIC_SHIELD_CONSUME_R03_E4C_PASS');
