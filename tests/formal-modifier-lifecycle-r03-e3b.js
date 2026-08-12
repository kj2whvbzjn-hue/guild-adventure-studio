const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
function compile(ctx,skill){const out=generic.compileSkill(skill,registry,ctx.compileTaggedSkill);ok(out.ok,`generic compile failed ${JSON.stringify(out.errors)}`);const c=ctx.compileTaggedSkill(out.compiledSkill);ok(c.ok,`legacy compile failed ${JSON.stringify(c.errors)}`);return c}
const lowBuff={schemaVersion:1,id:'E3B-BUFF-LOW',name:'Buff Low',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'ATK_UP',power:10,duration:300,stackGain:2}]};
const highBuff={schemaVersion:1,id:'E3B-BUFF-HIGH',name:'Buff High',trigger:{type:'ON_USE'},target:{side:'ALLY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'ATK_UP',power:25,duration:300,stackGain:1}]};
const lowDebuff={schemaVersion:1,id:'E3B-DEBUFF-LOW',name:'Debuff Low',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'DEF_DOWN',power:15,duration:300,stackGain:2}]};
const highDebuff={schemaVersion:1,id:'E3B-DEBUFF-HIGH',name:'Debuff High',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'DEF_DOWN',power:30,duration:300,stackGain:1}]};

for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const events=[],battle={tick:10,units:[],log:[]},ctx={console,battle,recordValidationEvent:(type,payload)=>events.push({type,payload})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.resolveModifierStackLifecyclePolicy==='function',`${path}: modifier policy resolver missing`);
 ok(typeof ctx.applyModifierStackLifecycle==='function',`${path}: modifier stack helper missing`);
 ok(typeof ctx.resolveModifierEffectiveValue==='function',`${path}: modifier effective resolver missing`);
 const good=ctx.resolveModifierStackLifecyclePolicy({stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'HIGHEST',consumeRule:'NONE'});
 ok(good.ok,`${path}: valid modifier policy rejected`);
 const bad=ctx.resolveModifierStackLifecyclePolicy({stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'SUM',consumeRule:'NONE'});
 ok(!bad.ok&&bad.field==='effectiveRule',`${path}: invalid modifier effectiveRule accepted`);

 const src={id:'SRC',name:'Source',alive:true,side:'味方'},ally={id:'ALLY',name:'Ally',alive:true,side:'味方',attack:100,modifierStacks:[]},enemy={id:'ENEMY',name:'Enemy',alive:true,side:'敵',attack:100,modifierStacks:[]};
 battle.units=[src,ally,enemy];

 const b1=ctx.applyTaggedApplyRuntime(src,ally,compile(ctx,lowBuff),'BUFF');ok(b1?.result?.ok&&b1.result.added===2&&b1.result.effective===10,`${path}: generic BUFF low apply failed`);
 const b2=ctx.applyTaggedApplyRuntime(src,ally,compile(ctx,highBuff),'BUFF');ok(b2?.result?.ok&&b2.result.added===1&&b2.result.effective===25,`${path}: generic BUFF HIGHEST failed`);
 ok(ally.modifierStacks.length===3,`${path}: BUFF stack count mismatch`);
 ok(ctx.effectiveModifierPower(ally,'BUFF','ATK')===25,`${path}: BUFF effective power not HIGHEST`);

 const d1=ctx.applyTaggedApplyRuntime(src,enemy,compile(ctx,lowDebuff),'DEBUFF');ok(d1?.result?.ok&&d1.result.added===2&&d1.result.effective===15,`${path}: generic DEBUFF low apply failed`);
 const d2=ctx.applyTaggedApplyRuntime(src,enemy,compile(ctx,highDebuff),'DEBUFF');ok(d2?.result?.ok&&d2.result.added===1&&d2.result.effective===30,`${path}: generic DEBUFF HIGHEST failed`);
 ok(enemy.modifierStacks.length===3,`${path}: DEBUFF stack count mismatch`);
 ok(ctx.effectiveModifierPower(enemy,'DEBUFF','DEF')===30,`${path}: DEBUFF effective power not HIGHEST`);

 // Legacy path parity: same stack counts/effective HIGHEST under identical inputs.
 const legacyLow=ctx.compileTaggedSkill({id:'LEG-B',name:'Legacy Buff',tags:['BUFF','味方','単体','ATK','POWER=10','DURATION=300','STACK_GAIN=2']});
 const legacyHigh=ctx.compileTaggedSkill({id:'LEG-B2',name:'Legacy Buff High',tags:['BUFF','味方','単体','ATK','POWER=25','DURATION=300','STACK_GAIN=1']});
 ok(legacyLow.ok&&legacyHigh.ok,`${path}: legacy BUFF compile failed`);
 const legacyTarget={id:'LEG',name:'Legacy',alive:true,side:'味方',attack:100,modifierStacks:[]};battle.units=[src,legacyTarget];
 const lb1=ctx.applyTaggedModifier(src,legacyTarget,legacyLow,'BUFF');const lb2=ctx.applyTaggedModifier(src,legacyTarget,legacyHigh,'BUFF');
 ok(lb1.ok&&lb2.ok&&legacyTarget.modifierStacks.length===3&&ctx.effectiveModifierPower(legacyTarget,'BUFF','ATK')===25,`${path}: legacy BUFF parity failed`);

 const srcText=fs.readFileSync(path,'utf8');
 ok(srcText.includes("applyTaggedModifier(source,target,runtimeCompiled,logic,lifecycleRef.generic?lifecycleRef.policy:null)"),`${path}: production modifier path does not delegate lifecycle policy`);
}
console.log('GENERIC_MODIFIER_LIFECYCLE_R03_E3B_PASS');
