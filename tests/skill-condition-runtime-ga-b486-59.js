const fs=require('fs'),vm=require('vm');
const validation=fs.readFileSync('assets/shared/js/validation-tag-compiler.js','utf8');
const src=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(validation+'\n'+src,ctx);
ctx.battle={tick:10,units:[{id:'A',name:'A',side:'味方',alive:true,hp:40,maxHp:100,mp:25,maxMp:100},{id:'B',name:'B',side:'味方',alive:true,hp:100,maxHp:100,mp:100,maxMp:100},{id:'E1',name:'E1',side:'敵',alive:true,hp:100,maxHp:100},{id:'E2',name:'E2',side:'敵',alive:true,hp:100,maxHp:100}]};
const actor=ctx.battle.units[0];
function check(tags,expected,label){const compiled=ctx.GKSValidationTagCompiler.compile({id:'C',name:'C',tags:['ATTACK','敵','単体','DAMAGE=1',...tags]});if(!compiled.ok)throw new Error(label+' compile '+compiled.errors.join(','));ctx.compiled=compiled;ctx.actor=actor;const r=vm.runInContext('evaluateTaggedSkillConditions(actor,compiled)',ctx);if(r.ok!==expected)throw new Error(label+' expected '+expected+' got '+r.ok+' '+JSON.stringify(r.results));}
check(['CONDITION_SELF_HP_RATE<=0.5'],true,'hp-rate');
check(['CONDITION_SELF_MP>20','CONDITION_ENEMY_COUNT=2','CONDITION_ALLY_COUNT>=2','CONDITION_BATTLE_TICK>=10'],true,'and-pass');
check(['CONDITION_SELF_MP>30'],false,'mp-fail');
check(['CONDITION_ENEMY_COUNT!=2'],false,'not-equal-fail');
console.log('SKILL_CONDITION_RUNTIME_GA_B486_59_PASS');
