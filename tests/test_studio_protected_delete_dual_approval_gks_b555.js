const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('studio/index.html','utf8');

assert.ok(html.includes('id="deployAllowDeleteButton"'),'normal delete approval button must exist');
assert.ok(html.includes('通常の削除許可: OFF'),'normal delete button must be separate and explicit');
assert.ok(html.includes('id="deployAllowProtectedDeleteButton"'),'protected delete approval button must exist');
assert.ok(html.includes('保護領域削除許可: OFF'),'protected delete button must be separate and explicit');
assert.ok(html.includes("toggleDeployDeleteApproval('normal')"),'normal approval must have its own toggle path');
assert.ok(html.includes("toggleDeployDeleteApproval('protected')"),'protected approval must have its own toggle path');
assert.ok(html.includes('if(!normal.checked||!hasProtected)protectedBox.checked=false;'),'protected approval must reset unless normal approval is active and protected targets exist');
assert.ok(html.includes('studioDeployDeleteManifestRules.some(rule=>isDeployProtectedDeletionPath(rule))'),'protected folder rules such as tests/ must enable protected approval without stripping the trailing slash');
assert.ok(html.includes("candidate.protectedDelete=isDeployProtectedDeletionPath(relative);"),'delete candidates must be classified by protected policy');
assert.ok(html.includes("candidate.status='DELETE_BLOCKED';"),'protected deletion must be blocked without second approval');
assert.ok(html.includes("if(candidate.protectedDelete&&!protectedDeleteEnabled)"),'protected candidate gate must require protected approval');
assert.ok(html.includes("if(protectedDeleteItems.length&&!(normalDeleteApproved&&protectedDeleteApproved))"),'deployment must require both approvals for protected deletes');
assert.ok(html.includes("setDeployExecuteEnabled(changes.length>0&&blockedCount===0);"),'deployment must stay disabled while a protected manifest deletion is blocked');
console.log('PASS GKS-B564 Studio dual human approval for protected deletion');
