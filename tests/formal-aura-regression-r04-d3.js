const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-registry.json','utf8'));
const compiler=require('../assets/shared/js/skill-compiler.js');
const trigger=require('../assets/shared/js/trigger-engine.js');
assert.ok(registry.phase==='FORMAL-SKILL-1'||/^R04-(?:D3|E\d+)$/.test(registry.phase)||/^R0[5-9]-/.test(registry.phase)||/^R[1-9][0-9]-/.test(registry.phase),`unexpected registry phase ${registry.phase}`);
assert.ok(/^R04-(?:D3|E\d+)$/.test(trigger.VERSION),`unexpected trigger engine version ${trigger.VERSION}`);

function formalAura(id,power,priority,{side='ALLY',excludeSelf=false,effectId='ATK_UP'}={}){
 const skill={schemaVersion:1,id,name:id,trigger:{type:'WHILE_SOURCE_ALIVE',scope:'SELF',priority},conditions:[],target:{side,range:'ALL',...(excludeSelf?{excludeSelf:true}:{})},effects:[{type:'APPLY',effectId,power}],resource:{mpCost:0,cooldown:0}};
 const out=compiler.compileSkill(skill,registry);assert.strictEqual(out.ok,true,`${id}: ${JSON.stringify(out.errors)}`);return out.compiledSkill;
}
const a10p1=formalAura('A10P1',10,1),a30p0=formalAura('A30P0',30,0),a30p9=formalAura('A30P9',30,9),a30p9b=formalAura('A30P9B',30,9);
const aExclude=formalAura('AEX',15,2,{excludeSelf:true});
const aEnemy=formalAura('AENEMY',20,4,{side:'ENEMY',effectId:'DEF_DOWN'});
const skills=[a10p1,a30p0,a30p9,a30p9b,aExclude,aEnemy];
const a={id:'A',name:'A',side:'味方',alive:true,auraSkillIds:[a10p1.id,a30p0.id]};
const b={id:'B',name:'B',side:'味方',alive:true,auraSkillIds:[a30p9.id]};
const c={id:'C',name:'C',side:'味方',alive:true,auraSkillIds:[]};
const e={id:'E',name:'E',side:'敵',alive:true,auraSkillIds:[]};
const ctx={console,battle:{tick:0,units:[a,b,c,e],log:[]},GKSTriggerEngine:trigger,SKILLS:skills};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8'),ctx);
for(const skill of skills){const compiled=ctx.compileSkillForRuntime(skill);assert.strictEqual(compiled.ok,true,`${skill.id}: ${JSON.stringify(compiled.errors)}`);assert.ok(compiled.definition.logicOrder.includes('AURA'));}
let entries=ctx.activeAuraEntries(c,'BUFF','ATK');let winner=ctx.resolveEffectiveAuraEntry(entries);
assert.strictEqual(ctx.effectiveAuraPower(c,'BUFF','ATK'),30,'highest power');assert.strictEqual(winner.skillId,a30p9.id,'equal power must use higher priority');
a.auraSkillIds=[a30p9b.id];b.auraSkillIds=[a30p9.id];entries=ctx.activeAuraEntries(c,'BUFF','ATK');winner=ctx.resolveEffectiveAuraEntry(entries);assert.strictEqual(winner.sourceId,'A','same power/priority must preserve source order');
a.auraSkillIds=[aExclude.id];b.auraSkillIds=[];assert.strictEqual(ctx.effectiveAuraPower(a,'BUFF','ATK'),0,'exclude self');assert.strictEqual(ctx.effectiveAuraPower(c,'BUFF','ATK'),15,'exclude self ally');
a.auraSkillIds=[aEnemy.id];assert.strictEqual(ctx.effectiveAuraPower(e,'DEBUFF','DEF'),20,'enemy aura');assert.strictEqual(ctx.effectiveAuraPower(c,'DEBUFF','DEF'),0,'enemy aura side');
e.alive=false;assert.strictEqual(ctx.activeAuraEntries(e,'DEBUFF','DEF').length,0,'dead target inactive');e.alive=true;a.alive=false;assert.strictEqual(ctx.effectiveAuraPower(e,'DEBUFF','DEF'),0,'dead source inactive');
a.alive=true;a.auraSkillIds=[a30p9.id];ctx.GKSTriggerEngine=null;assert.strictEqual(ctx.activeAuraEntries(c,'BUFF','ATK').length,0,'Formal aura requires trigger engine dispatch');
assert.strictEqual(ctx.compileSkillForRuntime({id:'LEGACY-AURA',name:'Legacy Aura',tags:['AURA']}).ok,false,'Legacy tag-only aura must be rejected');
console.log('FORMAL_AURA_REGRESSION_R04_D3_PASS');
