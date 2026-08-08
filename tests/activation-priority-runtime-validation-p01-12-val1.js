const fs=require('fs');
const ctl=fs.readFileSync('game/assets/js/battle-control.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const rt=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const spec=JSON.parse(fs.readFileSync('docs/design/P01-12_ACTIVATION_PRIORITY_VALIDATION_SPEC.json','utf8'));
const errors=[];
for(const x of ['function activationPriorityFeatureEnabled','function activationPriorityOf','function fixDueActionOrder','activation_order_fixed'])if(!ctl.includes(x))errors.push('control '+x);
for(const x of ['ACTIVATION-PRIORITY-SAME-TICK-HIGH-FIRST','ACTIVATION-PRIORITY-GATE-OFF-PRESERVES-CURRENT','tagTestRunActivationPriorityRuntimeJson'])if(!app.includes(x))errors.push('app '+x);
if(!app.includes("if(!battle.validationMode&&battle.validationActivationPriority!==true)return;"))errors.push('priority validation event recording gate');
if(!app.includes("validation_patch:'P01-12-VAL-2'"))errors.push('runtime validation patch must be VAL-2');
if(!app.includes('P01-12-VAL2-'))errors.push('device report filename must identify VAL2');
if(!rt.includes('ACTIVATION_PRIORITYは有限整数が必要です'))errors.push('compiler validation');
if(spec.runtime_application!==false||spec.validation_design.normal_runtime_enabled!==false)errors.push('formal gate must be off');
if(spec.validation_patch!=='P01-12-VAL-2')errors.push('spec validation patch');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('ACTIVATION_PRIORITY_RUNTIME_VALIDATION_GA_B486_47_VAL2_OK');
