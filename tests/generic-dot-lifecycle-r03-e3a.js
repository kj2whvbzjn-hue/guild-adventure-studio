const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}
const genericSkill={schemaVersion:1,id:'R03E3A-BURN',name:'R03E3A BURN',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:12,duration:300,interval:100,stackGain:2}]};
const legacySkill={id:'R03E3A-LEGACY-DOT',name:'Legacy DOT',tags:['DOT','敵','単体','DOT_POWER=12','DOT_DURATION=300','DOT_INTERVAL=100','STACK_GAIN=2']};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const battle={tick:10,units:[],log:[]},ctx={console,battle};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 ok(typeof ctx.resolveDotStackLifecyclePolicy==='function',`${path}: DOT lifecycle policy resolver missing`);
 ok(typeof ctx.applyDotStackLifecycle==='function',`${path}: DOT stack lifecycle helper missing`);
 const valid=ctx.resolveDotStackLifecyclePolicy({stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'SUM',consumeRule:'NONE',maxStacks:5});
 ok(valid.ok&&valid.maxStacks===5,`${path}: valid DOT lifecycle policy rejected`);
 const invalid=ctx.resolveDotStackLifecyclePolicy({stackRule:'UNIQUE',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'SUM',consumeRule:'NONE',maxStacks:5});
 ok(!invalid.ok&&invalid.field==='stackRule',`${path}: invalid DOT stackRule accepted`);
 const out=generic.compileGenericSkill(genericSkill,registry,ctx.compileTaggedSkill);ok(out.ok,`${path}: generic compile failed ${JSON.stringify(out.errors)}`);
 const compiled=ctx.compileTaggedSkill(out.legacySkill);ok(compiled.ok,`${path}: generic legacy compile failed ${JSON.stringify(compiled.errors)}`);
 const source={id:'SRC',name:'Source',alive:true},target={id:'TGT',name:'Target',alive:true,dotStacks:[]};
 const a=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');ok(a?.result?.ok&&a.result.added===2&&a.result.current===2,`${path}: generic DOT first stack add failed`);
 const b=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');ok(b?.result?.ok&&b.result.added===2&&b.result.current===4,`${path}: generic DOT second stack add failed`);
 const c=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');ok(c?.result?.ok&&c.result.added===1&&c.result.current===5,`${path}: generic DOT cap fill failed`);
 const d=ctx.applyTaggedApplyRuntime(source,target,compiled,'DOT');ok(d?.result?.ok===false&&d.result.reason==='MAX_STACK'&&d.result.current===5,`${path}: generic DOT max stack rejection failed`);
 ok(target.dotStacks.length===5,`${path}: generic DOT stack list count mismatch`);
 ok(new Set(target.dotStacks.map(x=>x.id)).size===5,`${path}: DOT instance IDs are not independent`);
 ok(target.dotStacks.every(x=>x.power===12&&x.expiresAt===310&&x.nextTick===110),`${path}: DOT snapshot/expiry changed`);
 // Legacy path remains unchanged and must produce the same stack counts under the same numeric inputs.
 const legacyCompiled=ctx.compileTaggedSkill(legacySkill);ok(legacyCompiled.ok,`${path}: legacy DOT compile failed`);
 const legacyTarget={id:'LEG',name:'Legacy Target',alive:true,dotStacks:[]};
 const la=ctx.applyTaggedDot(source,legacyTarget,legacyCompiled);const lb=ctx.applyTaggedDot(source,legacyTarget,legacyCompiled);const lc=ctx.applyTaggedDot(source,legacyTarget,legacyCompiled);const ld=ctx.applyTaggedDot(source,legacyTarget,legacyCompiled);
 ok(la.ok&&la.current===2&&lb.ok&&lb.current===4&&lc.ok&&lc.current===5,`${path}: legacy DOT stack parity failed`);
 ok(ld.ok===false&&ld.reason==='MAX_STACK'&&legacyTarget.dotStacks.length===5,`${path}: legacy DOT max stack parity failed`);
 const src=fs.readFileSync(path,'utf8');
 ok(src.includes("applyTaggedDot(source,target,compiled,lifecycleRef.generic?lifecycleRef.policy:null)"),`${path}: production DOT path does not delegate lifecycle policy`);
}
console.log('GENERIC_DOT_LIFECYCLE_R03_E3A_PASS');
