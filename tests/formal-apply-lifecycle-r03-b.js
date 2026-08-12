const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/skill-compiler.js');
function loadLegacy(path){const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);return ctx.compileTaggedSkill}
function ok(v,m){if(!v)throw new Error(m)}
const expected={
 BURN:{stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',maxStacks:5,removable:false},
 POISON:{stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',maxStacks:5,removable:false},
 STUN:{stackRule:'UNIQUE',refreshRule:'REFRESH',snapshotPolicy:'SNAPSHOT',removable:true},
 ACCURACY_DOWN:{stackRule:'UNIQUE',refreshRule:'REFRESH',snapshotPolicy:'SNAPSHOT',removable:true},
 ATK_UP:{stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'HIGHEST'},
 DEF_DOWN:{stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',effectiveRule:'HIGHEST'},
 BARRIER:{stackRule:'STACK',refreshRule:'KEEP',snapshotPolicy:'SNAPSHOT',consumeRule:'FIFO'}
};
for(const [id,need] of Object.entries(expected)){
 const lc=registry.effects[id]?.lifecycle;ok(lc,`${id}: lifecycle missing`);
 for(const [k,v] of Object.entries(need))ok(lc[k]===v,`${id}: ${k} expected ${v}, got ${lc[k]}`);
 ok(lc.removeOnDeath===true,`${id}: removeOnDeath`);ok(lc.removeOnBattleEnd===true,`${id}: removeOnBattleEnd`);
}
const cases=[
 {effect:{type:'APPLY',effectId:'BURN',power:15,duration:300},tag:'DOT',side:'ENEMY'},
 {effect:{type:'APPLY',effectId:'STUN',duration:300},tag:'STATUS',side:'ENEMY'},
 {effect:{type:'APPLY',effectId:'ATK_UP',power:20,duration:300},tag:'BUFF',side:'ALLY'},
 {effect:{type:'APPLY',effectId:'DEF_DOWN',power:20,duration:300},tag:'DEBUFF',side:'ENEMY'},
 {effect:{type:'APPLY',effectId:'BARRIER',power:100,duration:300},tag:'SHIELD',side:'ALLY'}
];
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const legacy=loadLegacy(path);for(const c of cases){
  const skill={schemaVersion:1,id:'R03B-'+c.tag,name:'R03B',trigger:{type:'ON_USE'},target:{side:c.side,range:'SINGLE'},effects:[c.effect]};
  const r=generic.compileSkill(skill,registry,legacy);ok(r.ok,`${c.tag}: ${JSON.stringify(r.errors)}`);ok(r.compiledSkill.tags.includes(c.tag),`${c.tag}: legacy tag missing`);const n=r.normalizedEffects[0];ok(n&&n.lifecycle&&n.lifecycle.stackRule!=='LEGACY',`${c.tag}: lifecycle not formalized`);
 }}
const broken=JSON.parse(JSON.stringify(registry));broken.effects.STUN.lifecycle.removeOnDeath='yes';
const bad=generic.compileSkill({schemaVersion:1,id:'BAD',name:'bad',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}]},broken,null);
ok(!bad.ok,'invalid lifecycle boolean accepted');ok(bad.errors.some(x=>x.code==='EFFECT_LIFECYCLE_BOOLEAN_INVALID'),'invalid lifecycle boolean error missing');
console.log('GENERIC_APPLY_LIFECYCLE_R03_B_PASS');
