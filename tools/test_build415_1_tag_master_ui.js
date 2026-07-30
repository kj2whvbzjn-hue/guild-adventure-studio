const fs=require('fs');
const html=fs.readFileSync('studio/index.html','utf8');
const required=[
 'option value="tags">タグ</option>',
 'id="tagMasterFields"',
 'function handleMasterCategoryChange()',
 "if(c==='tags')",
 "data.tags.push(rec)",
 "category==='tags'?tagDefinitions()",
 "canDeleteTag(id)",
 "BUILD415_1_TAG_MASTER_UI_INTEGRATION"
];
const missing=required.filter(x=>!html.includes(x));
if(missing.length){console.error('BUILD415.1 FAIL',missing);process.exit(1)}
console.log('BUILD415.1 tag master UI integration: PASS');
