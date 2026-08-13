'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..');
const compiler=require('../assets/shared/js/skill-compiler.js');
const registry=require('../assets/shared/config/skill-registry.json');
const runtimeSrc=fs.readFileSync(path.join(root,'game/assets/js/tag-skill-runtime.js'),'utf8');
const bridgeSrc=fs.readFileSync(path.join(root,'game/assets/js/studio-skill-bridge.js'),'utf8');
const battleSrc=fs.readFileSync(path.join(root,'game/assets/js/battle-control.js'),'utf8');
const deviceHarnessSrc=fs.readFileSync(path.join(root,'assets/shared/js/device-test-harness.js'),'utf8');

assert(runtimeSrc.includes('function compileSkillRuntime(skill){'),'formal runtime compiler is missing');
assert(runtimeSrc.includes('function executeSkillRuntime('),'formal runtime executor is missing');
assert(runtimeSrc.includes("production:'runtimeContracts_only'"),'production runtime mode must be formal only');
assert(!runtimeSrc.slice(runtimeSrc.indexOf('function runtimeSkillStore'),runtimeSrc.indexOf('function compileSkillForRuntime')).includes('TAG_SKILLS'),'Game runtime store must not fall back to TAG_SKILLS');
assert(!runtimeSrc.includes('function executeTaggedSkill('),'Production runtime must not expose transitional executeTaggedSkill alias');
assert(!runtimeSrc.includes('function findTagSkill('),'Production runtime must not expose transitional findTagSkill alias');
assert(!runtimeSrc.includes('function compileTaggedSkill('),'Production runtime must not contain the legacy Tag compiler');
assert(!runtimeSrc.includes('function parseSkillTags('),'Production runtime must not contain Tag parser helpers');
assert(runtimeSrc.includes('GKSValidationTagCompiler'),'non-production validation must delegate to isolated validation compiler');
assert(battleSrc.includes('function formalBattleSkill(skillId){'),'battle formal Skill guard missing');
assert(battleSrc.includes('NO_FORMAL_PRODUCTION_SKILL'),'battle must block without formal Production Skill');
assert(deviceHarnessSrc.includes("['compileSkillRuntime','executeSkillRuntime','GKSTriggerEngine','GKSSkillRuntimeMode','GKSSkillRuntimeDiagnostics']"),'device test must require formal Game APIs');
assert(runtimeSrc.includes('const compiled=compileSkillForRuntime(skillSource);'),
  'structured Skill execution does not use canonical runtime dispatcher');
const r06Start=bridgeSrc.indexOf('function runR06MasterStructuredRuntimeFinalRegression');
const r06End=bridgeSrc.indexOf('function buildFormalRuntimeRegressionReport',r06Start);
assert(r06Start>=0&&r06End>r06Start,'R06 final regression block missing');
const r06Block=bridgeSrc.slice(r06Start,r06End);
assert(r06Block.includes('compileStudioMasterSkillForRuntime(skill)'),'R06 Master must pass through formal compiler preparation');
assert(r06Block.includes('compileSkillRuntime(runtimeSkill)'),'R06 Master must compile prepared runtimeContracts directly');
assert(!r06Block.includes('compileTaggedSkill(skill)'),'R06 Master must not use Tag compiler');
assert(r06Block.includes('executeSkillRuntime('),'R06 Master must use formal runtime executor');
assert(!r06Block.includes('executeTaggedSkill('),'R06 Master must not use Tag executor');

const skill={schemaVersion:1,id:'FORMAL-RUNTIME-001',name:'Formal Runtime',skillLevel:5,
 trigger:{type:'ON_USE',scope:'SELF'},conditions:[],target:{side:'ENEMY',range:'SINGLE'},
 effects:[{type:'DAMAGE',power:78,damageType:'PHYSICAL'},{type:'APPLY',effectId:'BURN',power:3,duration:20,interval:100,stackGain:1}],
 resource:{mpCost:0,cooldown:0,activationPriority:0}};
const authored=compiler.compileSkill(skill,registry);
assert(authored.ok,JSON.stringify(authored.errors));
assert(authored.compiledSkill.runtimeContracts);
assert(!('tags' in authored.compiledSkill));

const ctx={console,globalThis:null};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(runtimeSrc,ctx);
const rejectedLegacyProduction=ctx.compileSkillForRuntime({id:'LEGACY-PROD',name:'Legacy Production',environment:'production',tags:['ATTACK','敵','単体','DAMAGE=1']});
assert.strictEqual(rejectedLegacyProduction.ok,false,'Production tag-only Skill must be rejected');
assert(rejectedLegacyProduction.errors.some(x=>x.includes('runtimeContracts')),'Production rejection must require runtimeContracts');
ctx.battle={tick:0,units:[],log:[]};
const compiled=ctx.compileSkillRuntime(authored.compiledSkill);
assert(compiled.ok,JSON.stringify(compiled.errors));
assert(compiled.definition.runtimeContracts);
assert.deepStrictEqual(JSON.parse(JSON.stringify(compiled.definition.target)),{side:'enemy',range:'single'});
assert(compiled.definition.logicOrder.includes('ATTACK'));
assert(compiled.definition.logicOrder.includes('DOT'));
assert(Array.isArray(compiled.definition.sourceTags)&&compiled.definition.sourceTags.length===0);

const disabledUnit={alive:true,statusEffects:[{instanceId:'S1',statusId:'STATUS-ACTION-DISABLED',payload:{actionDisabled:true}}]};
const disabledEligibility=ctx.actionExecutionEligibility(disabledUnit,{actionKind:'skill_action',skillId:'FORMAL-RUNTIME-001'});
assert.strictEqual(disabledEligibility.ok,false,'formal actionDisabled payload must block execution');
assert.strictEqual(disabledEligibility.reason,'ACTION_DISABLED');
const followSkill={schemaVersion:1,id:'FORMAL-FOLLOW-001',name:'Formal Follow',skillLevel:1,
 trigger:{type:'ON_ALLY_ATTACK',scope:'SELF'},conditions:[{scope:'TARGET',property:'TARGET_POISONED',operator:'=',value:true}],target:{side:'ENEMY',range:'SINGLE'},
 effects:[{type:'DAMAGE',power:50,damageType:'PHYSICAL'}],resource:{mpCost:0,cooldown:0,activationPriority:0}};
const followAuthored=compiler.compileSkill(followSkill,registry);assert(followAuthored.ok,JSON.stringify(followAuthored.errors));
const followCompiled=ctx.compileSkillRuntime(followAuthored.compiledSkill);assert(followCompiled.ok,JSON.stringify(followCompiled.errors));
const conditionActor={alive:true,hp:100,maxHp:100,mp:10,maxMp:10,side:'味方'},conditionTarget={alive:true,dotStacks:[{id:'D1'}]};
const conditionResult=ctx.evaluateTaggedSkillConditions(conditionActor,followCompiled,conditionTarget);
assert.strictEqual(conditionResult.ok,true,'formal TARGET_POISONED condition must evaluate against target');
console.log('FORMAL_SKILL_RUNTIME_DIRECT_CONTRACT_PASS');
