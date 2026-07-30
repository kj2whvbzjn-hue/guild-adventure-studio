const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'studio', 'index.html'), 'utf8');
const required = [
  'id="tagManagementCenter"',
  'GKS-B001_TAG_MANAGEMENT_CENTER_BEGIN',
  'function renderTagManagementCenter()',
  'function runTagCenterValidation()',
  'function openTagRepairCenter()',
  'function openTagBaselineCenter()',
  'function addTagCategoryFromMaster()',
  "document.getElementById('tagManagementCenter')?.classList.toggle('hidden',!isTag)",
  'タグ管理センター',
  '参照を確認するタグ'
];
const missing = required.filter(x => !html.includes(x));
if (missing.length) {
  console.error('GKS-B001 FAIL:', missing);
  process.exit(1);
}
console.log('GKS-B001 PASS');
