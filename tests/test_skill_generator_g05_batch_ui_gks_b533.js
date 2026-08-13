const fs=require('fs'),assert=require('assert'),vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
assert.strictEqual(build.game_build,'GA-B486.122');
assert.strictEqual(build.studio_build,'GKS-B555');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const budgetRules=JSON.parse(fs.readFileSync('assets/shared/config/skill-budget-rules.json','utf8'));
const aiRules=JSON.parse(fs.readFileSync('assets/shared/config/skill-ai-generation-rules.json','utf8'));
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['assets/shared/js/skill-budget-engine.js','assets/shared/js/generic-skill-compiler.js','assets/shared/js/skill-ai-batch-engine.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
(async()=>{
 const out=await ctx.GKSGenericSkillAiBatchEngine.generateBatch({requests:[
  {skillLevel:8,intent:'表示確認用攻撃',effects:[{type:'DAMAGE',damageType:'PHYSICAL'}],target:'ENEMY',range:'SINGLE',desiredStrength:'MEDIUM',searchMetadata:{}},
  {skillLevel:8,intent:'表示確認用不正入力',effects:[{type:'DAMAGE',power:999}],target:'ENEMY',range:'SINGLE',desiredStrength:'HIGH',searchMetadata:{}}
 ]},{registry,budgetRules,rules:aiRules,budgetEngine:ctx.GKSGenericSkillBudgetEngine,compile:skill=>Promise.resolve(ctx.GKSGenericSkillCompiler.compileGenericSkill(skill,registry)),idPrefix:'G05-UI'});
 assert.deepStrictEqual(JSON.parse(JSON.stringify(out.summary)),{total:2,accepted:1,rejected:1,allAccepted:false});
 assert.strictEqual(out.entries[0].status,'ACCEPT');
 assert.strictEqual(out.entries[0].validation.registry,true);assert.strictEqual(out.entries[0].validation.budget,true);assert.strictEqual(out.entries[0].validation.compiler,true);
 assert.strictEqual(out.entries[1].status,'REJECT');assert.ok(out.entries[1].validation.issues.some(x=>x.code==='AI_FINAL_BATTLE_VALUE_FORBIDDEN'&&x.path==='effects[0].power'));
 const sg=fs.readFileSync('studio/skill/skill-generator.js','utf8');
 for(const marker of ['data-ai-batch-filter="ALL"','data-ai-batch-filter="ACCEPT"','data-ai-batch-filter="REJECT"','data-ai-batch-status','Registry','Budget','Compiler','Studio生成数値 / Budget trace','x.code||\'REJECT\'','x.path'])assert.ok(sg.includes(marker),`G05 stage2 UI marker missing: ${marker}`);
 const html=fs.readFileSync('studio/index.html','utf8');assert.ok(html.includes('skill-generator.js?v=29'));
 console.log('SKILL_GENERATOR_G05_BATCH_UI_GKS_B533_PASS');
})().catch(e=>{console.error(e);process.exit(1)});
