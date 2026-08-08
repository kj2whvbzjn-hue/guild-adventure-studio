const fs=require('fs');
const ctl=fs.readFileSync('game/assets/js/battle-control.js','utf8');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const rt=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const spec=JSON.parse(fs.readFileSync('docs/design/P01-12_ACTIVATION_PRIORITY_VALIDATION_SPEC.json','utf8'));
const errors=[];
for(const x of ['function activationPriorityFeatureEnabled','function activationPriorityOf','function fixDueActionOrder','activation_order_fixed'])if(!ctl.includes(x))errors.push('control '+x);
for(const x of ['ACTIVATION-PRIORITY-FORMAL-SAME-TICK-HIGH-FIRST','ACTIVATION-PRIORITY-NEXT-TICK-REDECIDES','tagTestRunActivationPriorityRuntimeJson'])if(!app.includes(x))errors.push('app '+x);
if(!app.includes("if(!battle.validationMode&&battle.validationCaptureEvents!==true)return;"))errors.push('formal evidence capture gate');
if(!app.includes("formal_candidate:'P01-12-FORMAL-1'"))errors.push('formal candidate id');
if(!ctl.includes('function activationPriorityFeatureEnabled(){return true}'))errors.push('formal priority feature not enabled');
if(!app.includes('GA-B486.49-P01-12-FORMAL1-'))errors.push('device report filename must identify formal build');
if(!rt.includes('ACTIVATION_PRIORITYは有限整数が必要です'))errors.push('compiler validation');
if(spec.validation_patch!=='P01-12-FORMAL-1'||spec.runtime_application!==true||spec.status!=='FORMAL_CANDIDATE'||spec.validation_design.normal_runtime_enabled!==true)errors.push('formal spec state');
if(errors.length){errors.forEach(x=>console.error('FAIL',x));process.exit(1)}
console.log('ACTIVATION_PRIORITY_FORMAL_CANDIDATE_GA_B486_49_OK');
