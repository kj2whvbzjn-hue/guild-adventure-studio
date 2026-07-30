#!/usr/bin/env node
const fs=require('fs'),vm=require('vm');
const file=process.argv[2]||'studio/index.html';
const html=fs.readFileSync(file,'utf8');
const m=html.match(/\/\/ BUILD414_TAG_GOVERNANCE_BASELINE_DRIFT_BEGIN([\s\S]*?)\/\/ BUILD414_TAG_GOVERNANCE_BASELINE_DRIFT_END/);
if(!m)throw new Error('BUILD414 block not found');
const sandbox={console,now:()=> '2026-07-31T00:00:00Z',Map,JSON,Number,String,Array,Object,Boolean,Error};
vm.createContext(sandbox);vm.runInContext(m[1],sandbox);
const base={schema:'gk.tag-governance-report.v1',generated_at:'a',project_id:'p',app_version:'413',summary:{tag_count:2,category_count:1,reference_count:1},acceptance:{pass:true,blockers:[]},tags:[{id:'a',name:'A',usage_count:1,enabled:true},{id:'b',name:'B',usage_count:0,enabled:true}],categories:[{id:'c',name:'C',tag_count:2,enabled:true}]};
const current=JSON.parse(JSON.stringify(base));current.generated_at='b';current.app_version='414';current.summary.tag_count=3;current.summary.reference_count=2;current.acceptance={pass:false,blockers:['x']};current.tags[0].usage_count=2;current.tags.push({id:'d',name:'D',usage_count:0,enabled:true});current.categories[0].tag_count=3;
const d=sandbox.compareTagGovernanceReports(base,current);
function ok(v,msg){if(!v)throw new Error(msg)}
ok(d.schema==='gk.tag-governance-drift.v1','schema');
ok(d.has_drift===true,'drift');
ok(d.acceptance.regressed===true,'regression');
ok(d.tags.added.includes('d'),'added tag');
ok(d.tags.changed.some(x=>x.id==='a'&&x.fields.some(f=>f.field==='usage_count')),'changed usage');
ok(d.categories.changed.some(x=>x.id==='c'),'category change');
ok(d.summary_delta.tag_count.delta===1,'summary delta');
let rejected=false;try{sandbox.compareTagGovernanceReports({},current)}catch(e){rejected=true}ok(rejected,'invalid schema rejected');
console.log('BUILD414 tag governance drift: PASS');
