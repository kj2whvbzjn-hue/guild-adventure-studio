'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..');

for(const rel of [
 'assets/shared/js/skill-authoring-registry.js',
 'assets/shared/js/skill-budget-engine.js',
 'assets/shared/js/skill-ai-batch-engine.js',
 'assets/shared/js/skill-compiler.js',
 'assets/shared/js/skill-compile-service.js'
]) assert(fs.existsSync(path.join(root,rel)),`formal module missing: ${rel}`);

for(const rel of ['studio/index.html','game/index.html','game-tag-test/index.html']){
 const text=fs.readFileSync(path.join(root,rel),'utf8');
 assert(text.includes('skill-compiler.js')||rel==='studio/index.html',`${rel} formal compiler path missing`);
 assert(!text.includes('src="../assets/shared/js/generic-skill-compiler.js"'),`${rel} still loads Generic compiler`);
}

const runtime=fs.readFileSync(path.join(root,'game/assets/js/tag-skill-runtime.js'),'utf8');
assert(runtime.includes('skill?.runtimeContracts??skill?.genericRuntime'),'runtimeContracts must be primary input');
assert(runtime.includes('runtimeContracts:genericRuntime,genericRuntime'),'compiled definition must expose formal runtimeContracts');

const dx=fs.readFileSync(path.join(root,'studio/data-exchange/data-exchange-core.js'),'utf8');
assert(dx.includes('row?.runtimeContracts||row?.genericRuntime'),'Data Exchange must prefer runtimeContracts');

const app=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
assert(app.includes('definition?.runtimeContracts||compiled.definition?.genericRuntime'),'Game device runtime must prefer runtimeContracts');

const ctx={globalThis:null,module:{exports:{}},console};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/shared/js/skill-compiler.js'),'utf8'),ctx);
assert(ctx.GKSSkillCompiler?.compileSkill,'formal compiler API missing from formal module');
console.log('PASS test_skill_runtime_formal_names_phase2_gks_b555');
