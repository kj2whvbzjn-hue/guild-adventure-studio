const fs=require('fs');
const html=fs.readFileSync('game-tag-test/index.html','utf8');
const validation=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');
const runtime=fs.readFileSync('game-tag-test/assets/js/tag-skill-runtime.js','utf8');
for(const token of [
 'tagTestRunR06LegacyGenericRuntimeJson',
 'R06 Legacy/Generic比較JSON検証',
 '../assets/shared/js/legacy-skill-migration.js',
 '../assets/shared/js/legacy-generic-runtime-compare.js'
])if(!html.includes(token))throw new Error(`missing html token: ${token}`);
for(const token of [
 'R06-LEGACY-GENERIC-RUNTIME-DEVICE-001',
 'R06-B intentional mismatch rejection',
 'Current Studio Export freshness gate',
 'studio_export_acceptance_is_separate:true',
 'uses_legacy_demo_export:false',
 'acceptance_ready=versionOk&&studioOk',
 'RUNTIME_RESULT_MISMATCH was not rejected',
 'mismatch_rejection_passed_count',
 '[MISMATCH REJECTION]'
])if(!validation.includes(token))throw new Error(`missing validation token: ${token}`);
for(const token of ['function applyTaggedCover','||applyTaggedCover(actor,resolvedTarget,compiled)','coverApplyResult'])if(!runtime.includes(token))throw new Error(`missing COVER parity token: ${token}`);
const exp=JSON.parse(fs.readFileSync('Export/skill/skills.json','utf8'));
if(String(exp.data_version||'').startsWith('GA-B486.117')&&String(exp.generated_by||'').includes('GKS-B529'))throw new Error('fixture unexpectedly current; update test expectation and run Studio acceptance');
console.log('DEVICE_R06_LEGACY_GENERIC_RUNTIME_GA_B486_118_PASS');
