const assert=require('assert'),fs=require('fs'),vm=require('vm');
const formalCompiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const payload=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
const rows=Array.isArray(payload)?payload:payload.data;
const row=rows.find(x=>x.id==='COVER-VALIDATION-MIXED-ATTACK');
assert.ok(row,'mixed COVER validation row missing');
assert.strictEqual(row.environment,'validation');
assert.strictEqual(row.expected_result,'accepted');
assert.ok(/複合を許可/.test(row.description||''));

const formalSkill={
 schemaVersion:1,id:'COVER-VALIDATION-MIXED-ATTACK-FORMAL',name:'かばう検証・ATTACK混在 Formal',skillLevel:20,
 trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ALLY',range:'SINGLE'},
 effects:[
  {type:'TARGET_CONTROL',mode:'COVER',trigger:'DIRECT_ATTACK',priority:0,removable:true,lifetime:'PERSISTENT'},
  {type:'DAMAGE',power:10,damageType:'PHYSICAL'}
 ],
 resource:{mpCost:0,cooldown:0,activationPriority:0}
};
const formal=formalCompiler.compileSkill(formalSkill,registry);
assert.strictEqual(formal.ok,true,JSON.stringify(formal.errors));
assert.ok(formal.compiledSkill.runtimeContracts,'Formal COVER runtimeContracts missing');
assert.ok(formal.compiledSkill.runtimeContracts.effectContracts.some(x=>x.type==='TARGET_CONTROL'&&x.mode==='COVER'));
assert.ok(formal.compiledSkill.runtimeContracts.effectContracts.some(x=>x.type==='DAMAGE'));

const ctx={console,window:{GA_PROJECT_CONFIG:{skillExportUrl:'x'}},SKILLS:[]};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
const compiled=ctx.compileSkillForRuntime(formal.compiledSkill);
assert.strictEqual(compiled.ok,true,compiled.errors.join(' / '));
assert.ok(compiled.definition.logicOrder.includes('COVER'));
assert.ok(compiled.definition.logicOrder.includes('ATTACK'));
const bridge=fs.readFileSync('game/assets/js/studio-skill-bridge.js','utf8');
assert.ok(bridge.includes("expected_result:record.expected_result||null"),'bridge must preserve expected_result');
assert.ok(bridge.includes("expected==='accepted'?row.compiled_ok"),'formal validation must support accepted positive cases');
console.log('PASS GKS-B552 COVER mixed positive validation via Formal compiler');
