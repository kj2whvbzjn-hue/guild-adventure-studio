const assert=require('assert'),fs=require('fs'),vm=require('vm');
const formalCompiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const payload=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const rows=Array.isArray(payload)?payload:payload.data;
const currentCover=rows.find(x=>x.schemaVersion===1&&x.runtimeContracts?.effectContracts?.some(e=>e.type==='TARGET_CONTROL'&&e.mode==='COVER'));
assert.ok(currentCover,'current Formal COVER row missing');
assert.ok(!Array.isArray(currentCover.tags),'current Formal COVER row must not depend on legacy tag_v1');
const source={
 schemaVersion:1,id:'COVER-VALIDATION-MIXED-ATTACK',name:'COVER mixed positive validation',skillLevel:1,
 trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},
 effects:[{type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'PERSISTENT'},{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
 resource:{mpCost:0,cooldown:0,activationPriority:0}
};
const formal=formalCompiler.compileSkill(source,registry);
assert.strictEqual(formal.ok,true,JSON.stringify(formal.errors));
const row={...formal.compiledSkill,environment:'validation',expected_result:'accepted',description:'複合を許可'};
assert.strictEqual(row.schemaVersion,1,'accepted COVER validation row must be Formal Skill');
assert.ok(row.runtimeContracts,'accepted COVER validation row must carry runtimeContracts');
assert.ok(!Array.isArray(row.tags),'accepted COVER validation row must not depend on legacy tag_v1 at Production Runtime boundary');
assert.ok(row.runtimeContracts.effectContracts.some(x=>x.type==='TARGET_CONTROL'&&x.mode==='COVER'));
assert.ok(row.runtimeContracts.effectContracts.some(x=>x.type==='DAMAGE'));
const ctx={console,window:{GA_PROJECT_CONFIG:{skillExportUrl:'x'}},SKILLS:[]};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const compiled=ctx.compileSkillForRuntime(row);
assert.strictEqual(compiled.ok,true,compiled.errors.join(' / '));
assert.ok(compiled.definition.logicOrder.includes('COVER'));
assert.ok(compiled.definition.logicOrder.includes('ATTACK'));
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
assert.ok(bridge.includes("expected_result:record.expected_result||null"),'bridge must preserve expected_result');
assert.ok(bridge.includes("expected==='accepted'?row.compiled_ok"),'formal validation must support accepted positive cases');
console.log('PASS GKS-B552 COVER mixed positive validation via Formal compiler');
