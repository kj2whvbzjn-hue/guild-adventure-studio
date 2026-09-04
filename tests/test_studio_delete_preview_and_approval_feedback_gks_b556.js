'use strict';
const fs=require('fs'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','studio','index.html'),'utf8');
assert(html.includes("DELETE_PLANNED_PROTECTED"), 'protected delete preview status missing');
assert(html.includes("DELETE_MANIFEST削除予定（承認前プレビュー）"), 'pre-approval preview missing');
assert(html.includes("normalButton.disabled=false"), 'normal approval button must accept click for feedback');
assert(html.includes("protectedButton.disabled=false"), 'protected approval button must accept click for feedback');
assert(html.includes("更新ZIPが未選択です。先にZIPを読み込んでください。"), 'missing no-package feedback');
assert(html.includes("保護領域削除許可の前に、通常の削除許可をONにしてください。"), 'missing approval-order feedback');
assert(html.includes("差分を再解析"), 'explicit diff reanalysis control missing');
const toggle=html.match(/async function toggleDeployDeleteApproval\(kind\)\{[\s\S]*?\n\}/);
assert(toggle && !toggle[0].includes("prepareStudioDeployDiff"), 'approval toggle must not fetch GitHub diff');

assert(html.includes('id="deployAnalyzeButton"'), 'explicit diff/gate validation button missing');
assert(html.includes('差分・Gateを検証'), 'explicit diff/gate validation label missing');
assert(html.includes('GitHub差分・Gateは未実行です。'), 'local-only package inspection status missing');
const inspectFn=html.match(/async function inspectStudioPackage\(\)\{[\s\S]*?\n\}\nasync function verifyStudioPackageGate/);
assert(inspectFn && !inspectFn[0].includes('await prepareStudioDeployDiff();'), 'ZIP inspection must not automatically start GitHub diff/gate');
const gateFn=html.match(/async function verifyStudioPackageGate\(\)\{[\s\S]*?\n\}/);
assert(gateFn && gateFn[0].includes('await prepareStudioDeployDiff();'), 'GitHub diff/gate must start only from explicit validation action');
assert(html.includes("function recordStudioGateFailure(error,stage,autoDownload=false)"), 'Gate diagnostic download must be opt-in by default');
assert(html.includes("recordStudioGateFailure(e,'EXPLICIT_DIFF_AND_GATE_VALIDATION',false)"), 'explicit Gate failure must not force diagnostic download');
assert(html.includes('選択済みZIP・承認JSON・削除許可は保持しています。'), 'Gate failure must preserve user-selected inputs/approvals');
const approvalListener=html.match(/deployTestChangeApprovalFile\.addEventListener\('change',[\s\S]*?\n\}\);/);
assert(approvalListener && !approvalListener[0].includes('inspectStudioPackage()'), 'approval file selection must not auto-restart package/Gate inspection');

console.log('PASS test_studio_delete_preview_and_approval_feedback_gks_b557');
