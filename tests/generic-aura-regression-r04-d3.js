const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
const trigger=require('../assets/shared/js/trigger-engine.js');
assert.strictEqual(registry.phase,'R04-D3');
assert.strictEqual(trigger.VERSION,'R04-D3');

function genericAura(id,power,priority,{side='ALLY',excludeSelf=false,effectId='ATK_UP'}={}){
 const skill={schemaVersion:1,id,name:id,trigger:{type:'WHILE_SOURCE_ALIVE',scope:'SELF',priority},conditions:[],target:{side,range:'ALL',...(excludeSelf?{excludeSelf:true}:{})},effects:[{type:'APPLY',effectId,power}],resource:{mpCost:0,cooldown:0}};
 const out=generic.compileGenericSkill(skill,registry);assert.strictEqual(out.ok,true,`${id}: ${JSON.stringify(out.errors)}`);return out.legacySkill;
}
const g10p1=genericAura('G10P1',10,1),g30p0=genericAura('G30P0',30,0),g30p9=genericAura('G30P9',30,9),g30p9b=genericAura('G30P9B',30,9);
const gExclude=genericAura('GEX',15,2,{excludeSelf:true});
const gEnemy=genericAura('GENEMY',20,4,{side:'ENEMY',effectId:'DEF_DOWN'});
const legacy={id:'LEGACY30',name:'Legacy30',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=30','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=highest','AURA_PRIORITY=5','ATK']};

const signatures=[];
for(const runtimePath of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const a={id:'A',name:'A',side:'味方',alive:true,auraSkillIds:[g10p1.id,g30p0.id]};
 const b={id:'B',name:'B',side:'味方',alive:true,auraSkillIds:[g30p9.id]};
 const c={id:'C',name:'C',side:'味方',alive:true,auraSkillIds:[]};
 const e={id:'E',name:'E',side:'敵',alive:true,auraSkillIds:[]};
 const skills=[g10p1,g30p0,g30p9,g30p9b,gExclude,gEnemy,legacy];
 const ctx={console,battle:{tick:0,units:[a,b,c,e],log:[]},GKSTriggerEngine:trigger,TAG_SKILLS:skills};vm.createContext(ctx);vm.runInContext(fs.readFileSync(runtimePath,'utf8'),ctx);
 let entries=ctx.activeAuraEntries(c,'BUFF','ATK');let winner=ctx.resolveEffectiveAuraEntry(entries);
 assert.strictEqual(ctx.effectiveAuraPower(c,'BUFF','ATK'),30,`${runtimePath}: highest power`);assert.strictEqual(winner.skillId,g30p9.id,`${runtimePath}: equal power must use higher priority`);
 a.auraSkillIds=[legacy.id];b.auraSkillIds=[g30p9.id];entries=ctx.activeAuraEntries(c,'BUFF','ATK');winner=ctx.resolveEffectiveAuraEntry(entries);assert.strictEqual(winner.skillId,g30p9.id,`${runtimePath}: generic/legacy priority tie-break`);
 a.auraSkillIds=[g30p9b.id];b.auraSkillIds=[g30p9.id];entries=ctx.activeAuraEntries(c,'BUFF','ATK');winner=ctx.resolveEffectiveAuraEntry(entries);assert.strictEqual(winner.sourceId,'A',`${runtimePath}: same power/priority must preserve source order`);
 a.auraSkillIds=[gExclude.id];b.auraSkillIds=[];assert.strictEqual(ctx.effectiveAuraPower(a,'BUFF','ATK'),0,`${runtimePath}: exclude self`);assert.strictEqual(ctx.effectiveAuraPower(c,'BUFF','ATK'),15,`${runtimePath}: exclude self ally`);
 a.auraSkillIds=[gEnemy.id];assert.strictEqual(ctx.effectiveAuraPower(e,'DEBUFF','DEF'),20,`${runtimePath}: enemy aura`);assert.strictEqual(ctx.effectiveAuraPower(c,'DEBUFF','DEF'),0,`${runtimePath}: enemy aura side`);
 e.alive=false;assert.strictEqual(ctx.activeAuraEntries(e,'DEBUFF','DEF').length,0,`${runtimePath}: dead target inactive`);e.alive=true;a.alive=false;assert.strictEqual(ctx.effectiveAuraPower(e,'DEBUFF','DEF'),0,`${runtimePath}: dead source inactive`);
 a.alive=true;a.auraSkillIds=[g30p9.id];ctx.GKSTriggerEngine=null;assert.strictEqual(ctx.activeAuraEntries(c,'BUFF','ATK').length,0,`${runtimePath}: generic requires trigger engine`);a.auraSkillIds=[legacy.id];assert.strictEqual(ctx.effectiveAuraPower(c,'BUFF','ATK'),30,`${runtimePath}: legacy fallback`);
 signatures.push(JSON.stringify({winnerRule:['power_desc','priority_desc','source_order'],genericRequiresEngine:true,legacyFallback:true,excludeSelf:true,enemyTarget:true}));
}
assert.strictEqual(signatures[0],signatures[1],'Game/game-tag-test parity');
console.log('GENERIC_AURA_REGRESSION_R04_D3_PASS');
