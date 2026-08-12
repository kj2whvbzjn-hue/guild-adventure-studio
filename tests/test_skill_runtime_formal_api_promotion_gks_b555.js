'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..');
function load(rel,ctx){vm.runInNewContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx,{filename:rel});}
const ctx={globalThis:null,module:{exports:{}},console};ctx.globalThis=ctx;
load('assets/shared/js/generic-skill-compiler.js',ctx);
assert(ctx.GKSSkillCompiler,'GKSSkillCompiler formal API missing');
assert.strictEqual(typeof ctx.GKSSkillCompiler.compileSkill,'function');
assert.strictEqual(ctx.GKSSkillCompiler,ctx.GKSGenericSkillCompiler,'compat compiler alias must share implementation');

ctx.module={exports:{}};
load('assets/shared/js/generic-skill-bridge.js',ctx);
assert(ctx.GKSSkillCompileService,'GKSSkillCompileService formal API missing');
assert.strictEqual(typeof ctx.GKSSkillCompileService.compileSkill,'function');
assert.strictEqual(ctx.GKSSkillCompileService,ctx.GKSGenericSkillBridge,'compat bridge alias must share implementation');

const validation=fs.readFileSync(path.join(root,'game-tag-test/assets/js/validation-runtime.js'),'utf8');
assert(!validation.includes('GKSGenericSkillBridge'),'validation runtime still depends on Generic bridge API');
const studio=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
assert(studio.includes('GKSSkillCompileService'),'Studio formal compile service missing');
assert(studio.includes('GKSGenericSkillBridge?.compileForLegacy'),'Studio temporary compatibility boundary missing');
const app=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
assert(app.includes('resolveSkillCompileService()'),'formal compatibility boundary missing');
assert(app.includes('GKSSkillCompileService'),'formal compile service missing');
assert(app.includes('GKSGenericSkillBridge?.compileForLegacy'),'temporary historical R04 compatibility boundary missing');
assert(studio.includes('GKSSkillAuthoringRegistry'));
assert(studio.includes('GKSSkillBudgetEngine'));
assert(studio.includes('GKSSkillAiBatchEngine'));
assert(studio.includes('GKSSkillCompileService'));
assert(studio.includes('compiled.compiledSkill||compiled.legacySkill'));
console.log('PASS test_skill_runtime_formal_api_promotion_gks_b555');
