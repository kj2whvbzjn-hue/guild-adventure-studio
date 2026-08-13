const fs=require('fs'),vm=require('vm');
function load(path){const src=fs.readFileSync(path,'utf8'),ctx={console};vm.createContext(ctx);vm.runInContext(src,ctx);return ctx;}
for(const path of ['assets/shared/js/validation-tag-compiler.js','game-tag-test/assets/js/tag-skill-runtime.js']){
 const c=load(path),compile=path.includes('validation-tag-compiler')?c.GKSValidationTagCompiler.compile:c.compileTaggedSkill,base=['ATTACK','敵','単体','DAMAGE=120'];
 const valid=[
  [...base,'CONDITION_SELF_HP_RATE<=0.5'],
  [...base,'CONDITION_SELF_MP>=20'],
  [...base,'CONDITION_ENEMY_COUNT>=3'],
  [...base,'CONDITION_ALLY_COUNT!=1'],
  [...base,'CONDITION_BATTLE_TICK>5']
 ];
 for(const tags of valid){const r=compile({id:'C',name:'condition',tags});if(!r.ok)throw new Error(path+' valid failed '+r.errors.join(','));if(!r.definition.parameters.conditions?.length)throw new Error(path+' conditions missing');}
 for(const tags of [[...base,'CONDITION_SELF_HP_RATE<=1.1'],[...base,'CONDITION_ENEMY_COUNT>=1.5'],['ATTACK','敵','単体','DAMAGE>=120']]){const r=compile({id:'X',name:'bad',tags});if(r.ok)throw new Error(path+' invalid accepted '+tags.join('|'));}
}
console.log('SKILL_CONDITION_TAG_VALIDATION_GA_B486_59_PASS');
