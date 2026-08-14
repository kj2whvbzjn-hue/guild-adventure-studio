'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');

// Simulate the stale browser Skill Schema that caused the device screenshot rejection.
global.GKSSkillSchema={
 VERSION:'stale-cache',
 masterAllowed(){return ['id','name','target','status'];}
};
delete require.cache[require.resolve('../studio/data-exchange/data-exchange-core.js')];
const dx=require('../studio/data-exchange/data-exchange-core.js');

const required=['schemaVersion','id','name','skillLevel','trigger','conditions','target','effects','resource','runtimeContracts'];
for(const field of required)assert(dx.FORMAL_SKILL_MASTER_FIELDS.includes(field),`formal Master contract missing ${field}`);

const diagnostic=dx.skillMasterContractDiagnostic();
assert.strictEqual(diagnostic.shared_matches,false,'stale shared schema must be detected');
assert(diagnostic.missing.includes('runtimeContracts'));

const skill={
 schemaVersion:1,id:'G07-FORMAL-CACHE-001',name:'formal',skillLevel:5,
 trigger:{type:'ON_USE',scope:'SELF'},conditions:[],
 target:{side:'ENEMY',range:'SINGLE'},
 effects:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
 resource:{mpCost:0,cooldown:0,activationPriority:0},
 runtimeContracts:{
  schemaVersion:1,registryPhase:'FORMAL-SKILL-1',
  triggerContract:{type:'ON_USE',scope:'SELF',engineEvent:'use',dispatchMode:'RESOLVE_ONLY',priority:0},
  targetContract:{side:'ENEMY',range:'SINGLE',randomCount:null,excludeSelf:false},
  conditionContracts:[],effectContracts:[{type:'DAMAGE',power:100,damageType:'PHYSICAL'}],
  applyContracts:[],auraEffectContract:null,
  resourceContract:{mpCost:0,cooldown:0,activationPriority:0}
 }
};
assert.deepStrictEqual(dx.unknownIncomingFields('skills',null,skill),[],
 'formal Skill fields must not be rejected because a stale shared schema is cached');
const bad={...skill,notARealMasterField:true};
assert(dx.unknownIncomingFields('skills',null,bad).includes('notARealMasterField'),
 'unrelated unknown field must still be rejected');

const gen=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
assert(gen.includes('function g07AssertFormalMasterContract()'),'G07 formal contract assertion missing');
assert(gen.includes('g07BuildMasterEnvelopeFromSkillBatch'),'canonical G07 build API missing');
assert(gen.includes('g07SafeApplySkillBatch'),'canonical G07 apply API missing');
assert(!gen.includes('g07BuildMasterEnvelopeFromGenericBatch'),'retired G07 Generic build API remains');
assert(!gen.includes('g07SafeApplyGenericBatch'),'retired G07 Generic apply API remains');
assert(gen.includes('G07 正式Skill Master登録'),'G07 UI is not formalized');

const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
assert(html.includes('skill-schema.js?v=2b563'),'Skill Schema cache bust missing');
assert(html.includes('skill-generator.js?v=33'),'Skill Generator cache bust missing');
assert(html.includes('data-exchange-core.js?v=17'),'Data Exchange cache bust missing');

console.log('FORMAL_G07_MASTER_CONTRACT_CACHE_RESILIENCE_PASS');
