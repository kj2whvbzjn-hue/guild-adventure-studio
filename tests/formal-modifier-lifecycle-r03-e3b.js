const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const skills=[
 {schemaVersion:1,id:'E3B-BUFF-LOW',name:'Buff Low',trigger:{type:'ON_USE'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'ATK_UP',power:10,duration:300,stackGain:2}],resource:{mpCost:0,cooldown:0}},
 {schemaVersion:1,id:'E3B-BUFF-HIGH',name:'Buff High',trigger:{type:'ON_USE'},conditions:[],target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'ATK_UP',power:25,duration:300,stackGain:1}],resource:{mpCost:0,cooldown:0}},
 {schemaVersion:1,id:'E3B-DEBUFF-LOW',name:'Debuff Low',trigger:{type:'ON_USE'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'DEF_DOWN',power:15,duration:300,stackGain:2}],resource:{mpCost:0,cooldown:0}},
 {schemaVersion:1,id:'E3B-DEBUFF-HIGH',name:'Debuff High',trigger:{type:'ON_USE'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'DEF_DOWN',power:30,duration:300,stackGain:1}],resource:{mpCost:0,cooldown:0}}
];
const battle={tick:10,units:[],log:[]},ctx={console,battle,recordValidationEvent:()=>{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
ok(typeof ctx.compileSkillForRuntime==='function','Formal runtime compiler missing');
ok(typeof ctx.resolveModifierStackLifecyclePolicy==='function','modifier policy resolver missing');
ok(typeof ctx.applyModifierStackLifecycle==='function','modifier stack helper missing');
ok(typeof ctx.resolveModifierEffectiveValue==='function','modifier effective resolver missing');
const good=ctx.resolveModifierStackLifecyclePolicy({stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'HIGHEST',consumeRule:'NONE'});ok(good.ok,'valid modifier policy rejected');
const bad=ctx.resolveModifierStackLifecyclePolicy({stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'SUM',consumeRule:'NONE'});ok(!bad.ok&&bad.field==='effectiveRule','invalid modifier effectiveRule accepted');
const compiled={};for(const skill of skills){const out=compiler.compileSkill(skill,registry);ok(out.ok,`${skill.id}: Formal compile failed ${JSON.stringify(out.errors)}`);const c=ctx.compileSkillForRuntime(out.compiledSkill);ok(c.ok,`${skill.id}: Formal runtime compile failed ${JSON.stringify(c.errors)}`);compiled[skill.id]=c;}
const src={id:'SRC',name:'Source',alive:true,side:'味方'},ally={id:'ALLY',name:'Ally',alive:true,side:'味方',attack:100,modifierStacks:[]},enemy={id:'ENEMY',name:'Enemy',alive:true,side:'敵',attack:100,modifierStacks:[]};battle.units=[src,ally,enemy];
const b1=ctx.applyTaggedApplyRuntime(src,ally,compiled['E3B-BUFF-LOW'],'BUFF');ok(b1?.result?.ok&&b1.result.added===2&&b1.result.effective===10,'Formal BUFF low apply failed');
const b2=ctx.applyTaggedApplyRuntime(src,ally,compiled['E3B-BUFF-HIGH'],'BUFF');ok(b2?.result?.ok&&b2.result.added===1&&b2.result.effective===25,'Formal BUFF HIGHEST failed');
ok(ally.modifierStacks.length===3,'BUFF stack count mismatch');ok(ctx.effectiveModifierPower(ally,'BUFF','ATK')===25,'BUFF effective power not HIGHEST');
const d1=ctx.applyTaggedApplyRuntime(src,enemy,compiled['E3B-DEBUFF-LOW'],'DEBUFF');ok(d1?.result?.ok&&d1.result.added===2&&d1.result.effective===15,'Formal DEBUFF low apply failed');
const d2=ctx.applyTaggedApplyRuntime(src,enemy,compiled['E3B-DEBUFF-HIGH'],'DEBUFF');ok(d2?.result?.ok&&d2.result.added===1&&d2.result.effective===30,'Formal DEBUFF HIGHEST failed');
ok(enemy.modifierStacks.length===3,'DEBUFF stack count mismatch');ok(ctx.effectiveModifierPower(enemy,'DEBUFF','DEF')===30,'DEBUFF effective power not HIGHEST');
ok(ctx.compileSkillForRuntime({id:'LEGACY-BUFF',name:'Legacy Buff',tags:['BUFF']}).ok===false,'Legacy tag-only modifier must be rejected');
console.log('FORMAL_MODIFIER_LIFECYCLE_R03_E3B_PASS');
