const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},dispatchEvent(){}};
const ctx={window:null,document,console,setTimeout,clearTimeout,AbortController,CustomEvent:function(){}};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.GKSSkillGenerator;

const stale=api.g07DryRunBlocker({
 summary:{stale_source:1},
 items:[
  {dataset:'skills',id:'G05-AI-001',status:'stale_source',detail:'Export後にこのレコードが正本側で変更されています。'},
  {dataset:'skills',id:'G05-AI-002',status:'add',detail:'新規追加候補'}
 ]
});
assert.strictEqual(stale.code,'G07_STALE_SOURCE');
assert.strictEqual(stale.count,1);
assert.strictEqual(stale.affected.length,1);
assert.strictEqual(stale.affected[0].id,'G05-AI-001');
const html=api.g07FormatBlocker(stale);
for(const text of ['G07 Dry Run REJECT [G07_STALE_SOURCE]','原因:','安全処理:','G05-AI-001','Export後にこのレコードが正本側で変更されています。','推奨対応:'])assert.ok(html.includes(text),`missing diagnostic ${text}`);

const broken=api.g07DryRunBlocker({summary:{broken_reference:1},items:[{dataset:'skills',id:'S1',status:'broken_reference',detail:'status_effects:STATUS-X'}]});
assert.strictEqual(broken.code,'G07_BROKEN_REFERENCE');
assert.ok(api.g07FormatBlocker(broken).includes('STATUS-X'));

const conflict=api.g07DryRunBlocker({summary:{conflict:1},items:[{dataset:'skills',id:'S2',status:'conflict',detail:'同一IDの現在値と内容が異なります。'}]});
assert.strictEqual(conflict.code,'G07_ID_CONFLICT');
assert.ok(api.g07FormatBlocker(conflict).includes('S2'));

for(const marker of ['g07Blocker:blocker','e.g07Blocker?g07FormatBlocker','read-only参照データの追加または変更が検出されました。'])assert.ok(src.includes(marker),`missing ${marker}`);
const page=fs.readFileSync('studio/index.html','utf8');assert.ok(page.includes('skill-generator.js?v=25'));
console.log('PASS GKS-B549 G07 human-readable reject diagnostics');
