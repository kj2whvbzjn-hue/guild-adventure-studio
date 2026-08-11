const assert=require('assert'),fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const migration=require('../assets/shared/js/legacy-skill-migration.js');
assert.strictEqual(migration.VERSION,'R06-A');
function loadLegacy(path){const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);return ctx.compileTaggedSkill}
const convertible=[
 {id:'R06A-DAMAGE',name:'Damage',tags:['ATTACK','敵','単体','物理','DAMAGE=100']},
 {id:'R06A-BUFF',name:'Buff',tags:['BUFF','味方','単体','ATK','POWER=20','DURATION=300','STACK_GAIN=1']},
 {id:'R06A-STATUS',name:'Status',tags:['STATUS','STATUS_ID=STATUS-ACCURACY-DOWN','敵','単体','DURATION=400']},
 {id:'R06A-COVER',name:'Cover',tags:['COVER','COVER_TARGET=single_ally','COVER_TRIGGER=direct_attack','COVER_PRIORITY=4','COVER_REMOVABLE=true','COVER_LIFETIME=uses','COVER_USES=2','味方','単体']},
 {id:'R06A-CLEANSE',name:'Cleanse',tags:['CLEANSE','CLEANSE_CATEGORY=status','CLEANSE_ORDER=oldest','CLEANSE_COUNT=1','味方','単体']},
 {id:'R06A-REVIVE',name:'Revive',tags:['REVIVE','REVIVE_HP_RATE=0.25','味方','単体']}
];
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const legacyCompile=loadLegacy(path),opts={registry,legacyCompile,genericCompile:generic.compileGenericSkill};
 for(const skill of convertible){const r=migration.dryRunLegacySkill(skill,opts);assert.strictEqual(r.ok,true,`${path} ${skill.id}: ${JSON.stringify(r.issues)}`);assert.strictEqual(r.mode,'DRY_RUN');assert.strictEqual(r.mutated,false);assert.ok(r.genericSkill);assert.strictEqual(r.roundtripValidation.ok,true)}
 const poison={id:'R06A-POISON',name:'Poison',tags:['DOT','敵','単体','DOT_POWER=20','DOT_DURATION=1000','DOT_INTERVAL=100','STACK_GAIN=1']};
 const blocked=migration.dryRunLegacySkill(poison,opts);assert.strictEqual(blocked.ok,false);assert.ok(blocked.issues.some(x=>x.code==='APPLY_EFFECT_AMBIGUOUS'));
 const invalid={id:'R06A-INVALID',name:'Invalid',tags:['ATTACK','敵','単体','物理']};
 const rejected=migration.dryRunLegacySkill(invalid,opts);assert.strictEqual(rejected.ok,false);assert.ok(rejected.issues.some(x=>x.code==='LEGACY_COMPILE_REJECTED'));
 const batch=migration.dryRunLegacySkills([...convertible,poison,invalid],opts);assert.deepStrictEqual(batch.summary,{total:8,convertible:6,blocked:2});assert.strictEqual(batch.mutated,false);
}
console.log('LEGACY_SKILL_MIGRATION_R06_A_PASS');
