const fs=require('fs'),vm=require('vm'),assert=require('assert');
const registry=require('../assets/shared/config/skill-generic-registry.json');
const budgetRules=require('../assets/shared/config/skill-budget-rules.json');
const aiRules=require('../assets/shared/config/skill-ai-generation-rules.json');
const ctx={console,module:{exports:{}},globalThis:null};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/shared/js/generic-skill-budget-engine.js','utf8'),ctx);
ctx.module={exports:{}};vm.runInContext(fs.readFileSync('assets/shared/js/generic-skill-ai-batch-engine.js','utf8'),ctx);
ctx.module={exports:{}};vm.runInContext(fs.readFileSync('assets/shared/js/generic-skill-compiler.js','utf8'),ctx);
const batch=ctx.GKSGenericSkillAiBatchEngine,budget=ctx.GKSGenericSkillBudgetEngine,compiler=ctx.GKSGenericSkillCompiler;
assert.strictEqual(batch.VERSION,'G05');assert.strictEqual(aiRules.aiGenerationRuleVersion,'G05-AI-GENERATION-V1');
(async()=>{
 const envelope={schema:'GKS_GENERIC_SKILL_AI_BATCH_REQUEST',version:'1.0.0',requests:[
  {skillLevel:10,intent:'単体物理攻撃',effects:[{type:'DAMAGE',damageType:'PHYSICAL'}],target:'ENEMY',range:'SINGLE',desiredStrength:'MEDIUM',searchMetadata:{tags:['attack']}},
  {skillLevel:10,intent:'火傷付与',effects:[{type:'APPLY',effectId:'BURN'}],target:'ENEMY',range:'SINGLE',desiredStrength:0.6,searchMetadata:{}},
  {skillLevel:10,intent:'MP回復',effects:[{type:'RESOURCE_CHANGE',resource:'MP',direction:'GAIN'}],target:'ALLY',range:'SINGLE',desiredStrength:'LOW',searchMetadata:{}},
  {skillLevel:10,intent:'AIが数値を直接指定する不正例',effects:[{type:'DAMAGE',power:999}],target:'ENEMY',range:'SINGLE',desiredStrength:'HIGH',searchMetadata:{}},
  {skillLevel:10,intent:'未知Effect拒否',effects:[{type:'NO_SUCH'}],target:'ENEMY',range:'SINGLE',desiredStrength:'MEDIUM',searchMetadata:{}}
 ]};
 const compile=async skill=>compiler.compileGenericSkill(skill,registry);
 const out=await batch.generateBatch(envelope,{registry,budgetRules,rules:aiRules,budgetEngine:budget,compile,idPrefix:'G05-TEST'});
 assert.strictEqual(out.summary.total,5);assert.strictEqual(out.summary.accepted,3);assert.strictEqual(out.summary.rejected,2);assert.strictEqual(out.entries[0].status,'ACCEPT');assert.strictEqual(out.entries[1].status,'ACCEPT');assert.strictEqual(out.entries[2].status,'ACCEPT');
 assert.strictEqual(out.entries[3].status,'REJECT');assert.ok(out.entries[3].validation.issues.some(x=>x.code==='AI_FINAL_BATTLE_VALUE_FORBIDDEN'));
 assert.strictEqual(out.entries[4].status,'REJECT');assert.ok(out.entries[4].validation.issues.some(x=>x.code==='AI_EFFECT_UNKNOWN'));
 for(const e of out.entries.slice(0,3)){assert.strictEqual(e.validation.registry,true);assert.strictEqual(e.validation.budget,true);assert.strictEqual(e.validation.compiler,true);assert.strictEqual(e.validation.budgetResult.budgetRuleVersion,'G04-BUDGET-V1');assert.strictEqual(e.generation.aiGenerationRuleVersion,'G05-AI-GENERATION-V1');}
 assert.ok(out.entries[0].skill.effects[0].power>0);assert.ok(!Object.prototype.hasOwnProperty.call(envelope.requests[0].effects[0],'power'),'AI request must not own final power');
 assert.ok(out.entries[1].skill.effects[0].power>0);assert.ok(out.entries[1].skill.effects[0].duration>0);
 assert.ok(out.entries[2].skill.effects[0].amount>0);
 const same=await batch.generateBatch({requests:[envelope.requests[0]]},{registry,budgetRules,rules:aiRules,budgetEngine:budget,compile,idPrefix:'G05-TEST'});assert.deepStrictEqual(JSON.parse(JSON.stringify(same.entries[0].skill.effects)),JSON.parse(JSON.stringify(out.entries[0].skill.effects)),'Studio numeric generation must be deterministic');
 const badStrength=await batch.generateBatch({requests:[{...envelope.requests[0],desiredStrength:1.5}]},{registry,budgetRules,rules:aiRules,budgetEngine:budget,compile});assert.strictEqual(badStrength.entries[0].status,'REJECT');assert.ok(badStrength.entries[0].validation.issues.some(x=>x.code==='AI_DESIRED_STRENGTH_INVALID'));
 const sg=fs.readFileSync('studio/skill/skill-generator.js','utf8');for(const marker of ['loadAiGenerationRules','aiRequestTemplate','generateGenericAiBatch','skgAiBatchGenerate'])assert.ok(sg.includes(marker),`G05 marker missing: ${marker}`);
 const ai=fs.readFileSync('assets/shared/js/generic-skill-ai-batch-engine.js','utf8');assert.ok(ai.includes('AI_FINAL_BATTLE_VALUE_FORBIDDEN'));
 const html=fs.readFileSync('studio/index.html','utf8');assert.ok(html.includes('generic-skill-ai-batch-engine.js?v=1'));assert.ok(html.includes('skill-generator.js?v=10'));
 console.log('SKILL_GENERATOR_G05_AI_BATCH_GKS_B532_PASS');
})().catch(e=>{console.error(e);process.exit(1)});
