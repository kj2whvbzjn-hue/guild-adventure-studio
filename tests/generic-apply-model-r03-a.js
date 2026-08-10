const fs=require('fs'),vm=require('vm');
const registry=JSON.parse(fs.readFileSync('assets/shared/config/skill-generic-registry.json','utf8'));
const generic=require('../assets/shared/js/generic-skill-compiler.js');
function loadLegacy(path){const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);return ctx.compileTaggedSkill}
function ok(v,m){if(!v)throw new Error(m)}
for(const [id,def] of Object.entries(registry.effects||{})){ok(def.lifecycle,`${id}: lifecycle missing`);for(const k of registry.apply_model.required_lifecycle_fields)ok(def.lifecycle[k],`${id}: ${k} missing`)}
const skill={schemaVersion:1,id:'R03A-1',name:'共通APPLY',trigger:{type:'ON_USE'},target:{side:'ENEMY',range:'SINGLE'},effects:[{type:'APPLY',effectId:'BURN',power:15,duration:300}]};
for(const path of ['game/assets/js/tag-skill-runtime.js','game-tag-test/assets/js/tag-skill-runtime.js']){const r=generic.compileGenericSkill(skill,registry,loadLegacy(path));ok(r.ok,JSON.stringify(r.errors));const a=r.normalizedEffects.find(x=>x.type==='APPLY');ok(a&&a.effectId==='BURN','normalized APPLY missing');ok(a.lifecycle&&a.lifecycle.stackRule==='LEGACY','lifecycle normalization missing');ok(r.legacySkill.tags.includes('DOT'),'legacy DOT mapping missing')}
const broken=JSON.parse(JSON.stringify(registry));delete broken.effects.BURN.lifecycle;const bad=generic.compileGenericSkill(skill,broken,null);ok(!bad.ok,'missing lifecycle accepted');ok(bad.errors.some(x=>x.code==='EFFECT_LIFECYCLE_REQUIRED'),'missing lifecycle error absent');
console.log('GENERIC_APPLY_MODEL_R03_A_PASS');
