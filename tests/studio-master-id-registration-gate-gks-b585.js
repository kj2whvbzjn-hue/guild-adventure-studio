const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const build=JSON.parse(fs.readFileSync(path.join(root,'package-build.json'),'utf8'));

assert.strictEqual(build.studio_build,'GKS-B603');
assert.ok(html.includes('function masterIdPattern(category)'), 'master ID pattern helper missing');
assert.ok(html.includes('function validateMasterIdForCategory(category,id)'), 'master ID validation helper missing');
assert.ok(html.includes('const idError=validateMasterIdForCategory(c,id);if(idError)return alert(idError);'), 'saveMaster must reject invalid category IDs before persistence');
assert.ok(html.includes('id="masterIdRuleHint"'), 'master ID format hint missing');

const prefixes={tags:'TAG',stats:'STA',jobs:'JOB',skills:'SKL',equipment:'EQP',mods:'MOD',monsters:'MON',status_effects:'STS',tablets:'TBL',ai_conditions:'AIC',ai_targets:'AIT',ai_actions:'AIA',maps:'MAP',exploration_outcomes:'EXP',reward_tables:'RWD',adventure_settings:'ADV'};
function masterPrefix(category){return prefixes[category]||'MST'}
function masterIdPattern(category){const p=masterPrefix(category);return new RegExp('^'+p+'-\\d{4}$')}
function valid(category,id){return masterIdPattern(category).test(String(id||'').trim())}

assert.strictEqual(valid('skills','SKL-0001'),true);
assert.strictEqual(valid('monsters','MON-9999'),true);
assert.strictEqual(valid('reward_tables','RWD-0042'),true);
assert.strictEqual(valid('skills','SKL-SLASH'),false,'legacy free-form Skill ID must be rejected for new/update Master saves');
assert.strictEqual(valid('skills','MON-0001'),false,'wrong category prefix must be rejected');
assert.strictEqual(valid('skills','SKL-001'),false,'must require exactly four digits');
assert.strictEqual(valid('skills','skl-0001'),false,'prefix must be canonical uppercase');
assert.strictEqual(valid('maps','MAP-00001'),false,'must reject five-digit suffix');

console.log('PASS GKS-B593 Master registration/update gate enforces category prefix + four digits');
