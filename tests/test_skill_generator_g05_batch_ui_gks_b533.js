const fs=require('fs'),assert=require('assert'),vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const runtimeConfig=fs.readFileSync('assets/shared/config/runtime-config.js','utf8');
const runtimeGameBuild=runtimeConfig.match(/gameBuild:\s*"([^"]+)"/)?.[1]||'';
const runtimeStudioBuild=runtimeConfig.match(/studioBuild:\s*"([^"]+)"/)?.[1]||'';
assert.strictEqual(build.game_build,runtimeGameBuild,'package-build game_build must match shared runtime-config');
assert.strictEqual(build.studio_build,runtimeStudioBuild,'package-build studio_build must match shared runtime-config');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const budgetRules=JSON.parse(fs.readFileSync('assets/shared/config/skill-budget-rules.json','utf8'));
const aiRules=JSON.parse(fs.readFileSync('assets/shared/config/skill-ai-generation-rules.json','utf8'));
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['assets/shared/js/skill-budget-engine.js','assets/shared/js/skill-compiler.js','assets/shared/js/skill-ai-batch-engine.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
(async()=>{
 const out=await ctx.GKSSkillAiBatchEngine.generateBatch({schema:'GKS_SKILL_AI_BATCH_REQUEST',version:'1.0.0',mode:'ACTIVE',requests:[
  {skillLevel:4,intent:'STR40物理',statThresholds:{STR:40},abilityKind:'PHYSICAL_DAMAGE',target:'ENEMY',range:'SINGLE',resource:{mpCost:999,cooldown:999,activationPriority:999,castTime:999},searchMetadata:{}},
  {skillLevel:8,intent:'AGI80三段',statThresholds:{AGI:80},abilityKind:'PHYSICAL_DAMAGE',target:'ENEMY',range:'SINGLE',resource:{mpCost:0,cooldown:0,activationPriority:0,castTime:0},searchMetadata:{}},
  {skillLevel:4,intent:'旧入力Reject',effects:[{type:'DAMAGE',damageType:'PHYSICAL'}],target:'ENEMY',range:'SINGLE',desiredStrength:'MEDIUM',resource:{mpCost:0,cooldown:0,activationPriority:0,castTime:0},searchMetadata:{}},
  {skillLevel:4,intent:'未Binding Heal',statThresholds:{MND:40},abilityKind:'HEAL',target:'ALLY',range:'SINGLE',resource:{mpCost:0,cooldown:0,activationPriority:0,castTime:0},searchMetadata:{}}
 ]},{registry,budgetRules,rules:aiRules,budgetEngine:ctx.GKSSkillBudgetEngine,compile:skill=>Promise.resolve(ctx.GKSSkillCompiler.compileSkill(skill,registry)),idPrefix:'G05-UI'});
 assert.deepStrictEqual(JSON.parse(JSON.stringify(out.summary)),{total:4,accepted:2,rejected:2,allAccepted:false});
 assert.strictEqual(out.entries[0].status,'ACCEPT');assert.deepStrictEqual(JSON.parse(JSON.stringify(out.entries[0].skill.abilityConditions)),[{stat:'STR',min:40}]);assert.strictEqual(out.entries[0].skill.effects[0].power,140);assert.strictEqual(out.entries[0].validation.budget,true);assert.strictEqual(out.entries[0].validation.compiler,true);
 assert.deepStrictEqual(JSON.parse(JSON.stringify(out.entries[0].skill.resource)),{mpCost:32,cooldown:0,activationPriority:0,castTime:0});assert.strictEqual(out.entries[0].generation.resourceSeedTrace.baseMpPerSkillLevel,8);
 assert.strictEqual(out.entries[1].status,'ACCEPT');assert.strictEqual(out.entries[1].skill.effects.length,3);assert.ok(out.entries[1].skill.effects.every(x=>x.power===60));
 assert.strictEqual(out.entries[2].status,'REJECT');assert.ok(out.entries[2].validation.issues.some(x=>x.code==='AI_STAT_THRESHOLDS_REQUIRED'));assert.ok(out.entries[2].validation.issues.some(x=>x.code==='AI_LEGACY_ACTIVE_EFFECTS_UNSUPPORTED'));
 assert.strictEqual(out.entries[3].status,'REJECT');assert.ok(out.entries[3].validation.issues.some(x=>x.code==='ACTIVE_BINDING_REQUIRED'));

 const variableRules=JSON.parse(JSON.stringify(aiRules));variableRules.current_active.resource_policy.base_mp.per_skill_level=11;variableRules.current_active.resource_policy.ranges.FRONT={mp_multiplier:1.5,cooldown_tick:9,cast_time_tick:6};variableRules.current_active.resource_policy.ranges.RANDOM={mp_multiplier:2.25,cooldown_tick:5,cast_time_tick:3,target_count:4};
 const variable=ctx.GKSSkillAiBatchEngine.generateSkill({skillLevel:4,intent:'可変Resource',statThresholds:{STR:40},abilityKind:'PHYSICAL_DAMAGE',target:'ENEMY',range:'FRONT',resource:{mpCost:1,cooldown:1,activationPriority:88,castTime:1}},0,{registry,budgetRules,rules:variableRules,idPrefix:'G05-VAR',mode:'ACTIVE'});assert.deepStrictEqual(JSON.parse(JSON.stringify(variable.skill.resource)),{mpCost:66,cooldown:9,activationPriority:0,castTime:6});
 const random=ctx.GKSSkillAiBatchEngine.generateSkill({skillLevel:4,intent:'可変Random',statThresholds:{STR:40},abilityKind:'PHYSICAL_DAMAGE',target:'ENEMY',range:'RANDOM',randomCount:99},0,{registry,budgetRules,rules:variableRules,idPrefix:'G05-VAR',mode:'ACTIVE'});assert.strictEqual(random.skill.target.randomCount,4);assert.deepStrictEqual(JSON.parse(JSON.stringify(random.skill.resource)),{mpCost:99,cooldown:5,activationPriority:0,castTime:3});
 const badRules=JSON.parse(JSON.stringify(aiRules));delete badRules.current_active.resource_policy.ranges.ALL;assert.throws(()=>ctx.GKSSkillAiBatchEngine.generateSkill({skillLevel:4,intent:'設定欠落',statThresholds:{STR:40},abilityKind:'PHYSICAL_DAMAGE',target:'ENEMY',range:'ALL'},0,{registry,budgetRules,rules:badRules,idPrefix:'G05-VAR',mode:'ACTIVE'}),e=>e?.code==='ACTIVE_RANGE_RESOURCE_CONFIG_REQUIRED');
 assert.throws(()=>ctx.GKSSkillAiBatchEngine.generateSkill({skillLevel:4,intent:'PIERCE deferred',statThresholds:{STR:40},abilityKind:'PHYSICAL_DAMAGE',target:'ENEMY',range:'PIERCE'},0,{registry,budgetRules,rules:aiRules,idPrefix:'G05-VAR',mode:'ACTIVE'}),e=>e?.code==='ACTIVE_RANGE_DEFERRED');
 assert.strictEqual(out.mode,'ACTIVE');assert.strictEqual(out.aiGenerationRuleVersion,'G05-AI-GENERATION-V4-SKL-VARIABLE');assert.strictEqual(out.budgetRuleVersion,'SKL-THRESHOLD-BUDGET-V1');
 assert.throws(()=>ctx.GKSSkillAiBatchEngine.assertEnvelopeMode({schema:'GKS_SKILL_AI_BATCH_REQUEST',version:'1.0.0',requests:[]}),e=>e?.code==='AI_MODE_REQUIRED');
 await assert.rejects(()=>ctx.GKSSkillAiBatchEngine.generateBatch({schema:'GKS_SKILL_AI_BATCH_REQUEST',version:'1.0.0',mode:'PASSIVE',requests:[]},{registry,budgetRules,rules:aiRules,budgetEngine:ctx.GKSSkillBudgetEngine,compile:skill=>Promise.resolve(ctx.GKSSkillCompiler.compileSkill(skill,registry)),idPrefix:'G05-UI'}),e=>e?.code==='AI_PASSIVE_BUILDER_NOT_CONNECTED');
 const sg=fs.readFileSync('studio/skill/skill-generator.js','utf8');
 for(const marker of ['data-ai-batch-filter="ALL"','data-ai-batch-filter="ACCEPT"','data-ai-batch-filter="REJECT"','data-ai-batch-status','Registry','Budget','Compiler','Studio生成数値 / Threshold trace','x.code||\'REJECT\'','x.path'])assert.ok(sg.includes(marker),`G05 stage2 UI marker missing: ${marker}`);
 const html=fs.readFileSync('studio/index.html','utf8');assert.ok(html.includes('skill-compiler.js?v=486180'));assert.ok(html.includes('skill-budget-engine.js?v=3'));assert.ok(html.includes('skill-ai-batch-engine.js?v=4'));assert.ok(html.includes('skill-generator.js?v=34'));assert.ok(!html.includes('generic-skill-compiler.js'));
 console.log('SKILL_GENERATOR_G05_BATCH_UI_GKS_B533_PASS');
})().catch(e=>{console.error(e);process.exit(1)});
