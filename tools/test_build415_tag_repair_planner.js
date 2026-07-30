const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','studio','index.html'),'utf8');
const required=[
 'gk.tag-repair-plan.v1','buildTagRepairPlan','generateTagRepairPlan','renderTagRepairPlanner',
 'applySelectedTagRepairs','rollbackLastTagRepair','before-build415-tag-repair',
 'replaceTagReferencesInData','delete-unused-tag','replace-references'
];
for(const token of required){if(!html.includes(token))throw new Error(`missing ${token}`)}
const script=html.match(/<script>([\s\S]*?)<\/script>/);
if(!script)throw new Error('inline script not found');
new Function(script[1]);
if(!/selected:false,safety:'destructive'/.test(html))throw new Error('destructive candidates must default to unselected');
if(!/createBackup\('before-build415-tag-repair'\)/.test(html))throw new Error('pre-apply backup missing');
console.log('BUILD415 tag repair planner: PASS');
