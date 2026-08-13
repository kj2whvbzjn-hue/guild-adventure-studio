const fs=require('fs');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
function ok(v,m){if(!v)throw new Error(m)}

ok(compiler.VERSION==='FORMAL-SKILL-1','Formal compiler version mismatch');
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
 {id:'SKL-9311',effect:{type:'APPLY',effectId:'BURN',power:15,duration:300},logic:'DOT',side:'ENEMY'},
 {id:'SKL-9312',effect:{type:'APPLY',effectId:'STUN',duration:300},logic:'STATUS',side:'ENEMY'},
 {id:'SKL-9313',effect:{type:'APPLY',effectId:'ATK_UP',power:20,duration:300},logic:'BUFF',side:'ALLY'},
 {id:'SKL-9314',effect:{type:'APPLY',effectId:'DEF_DOWN',power:20,duration:300},logic:'DEBUFF',side:'ENEMY'},
 {id:'SKL-9315',effect:{type:'APPLY',effectId:'BARRIER',power:100,duration:300},logic:'SHIELD',side:'ALLY'}
];
for(const c of cases){
 const skill={schemaVersion:1,id:c.id,name:`R03B ${c.logic}`,trigger:{type:'ON_USE',scope:'SELF'},target:{side:c.side,range:'SINGLE'},effects:[c.effect],resource:{mpCost:0,cooldown:0}};
 const r=compiler.compileSkill(skill,registry);ok(r.ok,`${c.logic}: ${JSON.stringify(r.errors)}`);
 const contract=r.compiledSkill.runtimeContracts.applyContracts[0];
 ok(contract?.logic===c.logic,`${c.logic}: formal apply contract missing`);
 ok(contract.lifecycle?.stackRule!=='LEGACY',`${c.logic}: lifecycle not formalized`);
 ok(!Object.prototype.hasOwnProperty.call(r.compiledSkill,'tags'),`${c.logic}: Legacy tags leaked into Formal Master`);
}
const broken=JSON.parse(JSON.stringify(registry));broken.effects.STUN.lifecycle.removeOnDeath='yes';
const bad=compiler.compileSkill({schemaVersion:1,id:'SKL-9316',name:'bad',trigger:{type:'ON_USE',scope:'SELF'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'STUN',duration:100}],resource:{mpCost:0,cooldown:0}},broken);
ok(!bad.ok,'invalid lifecycle boolean accepted');ok(bad.errors.some(x=>x.code==='EFFECT_LIFECYCLE_BOOLEAN_INVALID'),'invalid lifecycle boolean error missing');
console.log('FORMAL_APPLY_LIFECYCLE_R03_B_PASS');
