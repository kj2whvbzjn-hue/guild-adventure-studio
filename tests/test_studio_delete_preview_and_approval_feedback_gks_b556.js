'use strict';
const fs=require('fs'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','studio','index.html'),'utf8');

assert(html.includes("削除予定 ${files}件"), 'manifest delete count preview missing');
assert(html.includes("未承認のためまだ削除は実行されません"), 'pre-approval safety notice missing');
assert(html.includes("normalButton.disabled=!publicPackage||!hasManifest"), 'normal approval button behavior must match prior version');
assert(html.includes("protectedButton.disabled=!publicPackage||!hasManifest||!hasProtected||!normal.checked"), 'protected approval button behavior must match prior version');
assert(!html.includes('id="deployReanalyzeButton"'), 'manual reanalyze button must not be required');
assert(!html.includes("DELETE_PLANNED_PROTECTED"), 'pre-approval file-by-file delete preview must be removed');

const toggle=html.match(/async function toggleDeployDeleteApproval\(kind\)\{[\s\S]*?\n\}/);
assert(toggle, 'toggleDeployDeleteApproval missing');
assert(toggle[0].includes("await handleDeployDeleteToggle()"), 'approval toggle must automatically refresh diff as before');

console.log('PASS test_studio_delete_count_preview_prior_behavior_gks_b556');
