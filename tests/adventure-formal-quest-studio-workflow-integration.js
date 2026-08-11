const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
for(const needle of [
 'id="questFormalWorkflow"',
 'function formalQuestWorkflowState()',
 'function openQuestFormalSection()',
 'function openQuestFormalExport()',
 'function renderQuestFormalWorkflow()',
 '正式Story Quest 作成手順',
 '1. Chapter',
 '2. Section',
 '3. Box',
 '4. Export',
 'Section / Boxを確認',
 'Export検証へ',
 "showView('storyeditor')",
 "showView('importexport')",
 'validatePhpExport()'
])assert(html.includes(needle),`formal quest workflow missing: ${needle}`);
assert(html.includes("renderQuestFormalWorkflow();"),'workflow must refresh with formal quest status');
console.log('adventure-formal-quest-studio-workflow-integration: PASS');
