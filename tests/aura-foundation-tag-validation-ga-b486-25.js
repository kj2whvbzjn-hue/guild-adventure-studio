const fs=require('fs');
const vm=require('vm');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
const spec=JSON.parse(fs.readFileSync('docs/design/P01-06_AURA_CURRENT_SPEC.json','utf8'));

function loadCompiler(path){
  const context={console,TAG_SKILLS:[],TAG_SKILL_BUILD:'TEST',TAG_SKILL_TEST_BUILD:'TEST'};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
  return skill=>vm.runInContext(`compileTaggedSkill(${JSON.stringify(skill)})`,context);
}
const compilers=[
  ['game',loadCompiler('game/assets/js/tag-skill-runtime.js')],
  ['game-tag-test',loadCompiler('game-tag-test/assets/js/tag-skill-runtime.js')]
];
const valid=[
  {id:'AURA-ALLY-ATK',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=highest','AURA_PRIORITY=0','ATK']},
  {id:'AURA-ALLY-DEF-EX',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=15','AURA_TARGET=ally','AURA_SCOPE=allies_excluding_self','DEF']},
  {id:'AURA-ENEMY-ATK-DOWN',tags:['AURA','AURA_EFFECT=DEBUFF','AURA_VALUE=20','AURA_TARGET=enemy','AURA_SCOPE=all','ATK']}
];
const invalid=[
  {id:'BAD-STATUS',tags:['AURA','AURA_EFFECT=STATUS','AURA_VALUE=10','AURA_TARGET=enemy','AURA_SCOPE=all','ATK']},
  {id:'BAD-NO-VALUE',tags:['AURA','AURA_EFFECT=BUFF','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','ATK']},
  {id:'BAD-ZERO',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=0','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','ATK']},
  {id:'BAD-TARGET',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=self','AURA_SCOPE=self_and_allies','ATK']},
  {id:'BAD-ENEMY-SCOPE',tags:['AURA','AURA_EFFECT=DEBUFF','AURA_VALUE=10','AURA_TARGET=enemy','AURA_SCOPE=allies_excluding_self','ATK']},
  {id:'BAD-STACK',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','AURA_STACK=additive','ATK']},
  {id:'BAD-NO-STAT',tags:['AURA','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies']},
  {id:'BAD-COMBINED',tags:['AURA','BUFF','AURA_EFFECT=BUFF','AURA_VALUE=10','AURA_TARGET=ally','AURA_SCOPE=self_and_allies','ATK','POWER=10','DURATION=100','STACK_GAIN=1']}
];
const errors=[];
if(build.game_build!=='GA-B486.27')errors.push(`build=${build.game_build}`);
if(!['tag_validation_ready','device_json_validation_ready','runtime_connection_v1'].includes(spec.status))errors.push(`spec_status=${spec.status}`);
for(const [name,compile] of compilers){
  for(const skill of valid){const r=compile(skill);if(!r.ok)errors.push(`${name}:${skill.id}: expected VALID: ${r.errors.join(' / ')}`);else{
    if(r.definition.logicOrder.join(',')!=='AURA')errors.push(`${name}:${skill.id}: logic=${r.definition.logicOrder}`);
    if(r.definition.target.side!=='self'||r.definition.target.range!=='single')errors.push(`${name}:${skill.id}: compiler target normalization failed`);
    if(r.definition.parameters.auraStack!=='highest')errors.push(`${name}:${skill.id}: auraStack=${r.definition.parameters.auraStack}`);
  }}
  for(const skill of invalid){const r=compile(skill);if(r.ok)errors.push(`${name}:${skill.id}: expected INVALID`);}
}
if(errors.length){for(const e of errors)console.error('FAIL',e);process.exit(1)}
console.log('AURA_FOUNDATION_TAG_VALIDATION_GA_B486_25_OK');
