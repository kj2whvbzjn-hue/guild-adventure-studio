const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
for(const needle of [
 'id="questFormalWorkflow"',
 'function formalQuestWorkflowState()',
 'function openQuestFormalExport()',
 'function renderQuestFormalWorkflow()',
 'P7-B 正式Quest / Game Runtime',
 '1. Quest Box',
 '2. 正式Export契約',
 '3. P7-B Game Runtime',
 'Export検証へ',
 "showView('importexport')",
 'validatePhpExport()'
])assert(html.includes(needle),`formal quest workflow missing: ${needle}`);
assert(html.includes('questBoxes=questDraftBoxes'),'workflow must use Quest.boxes as the formal source');
assert(html.includes('renderQuestFormalWorkflow();'),'workflow must refresh with formal quest status');
console.log('adventure-formal-quest-studio-workflow-integration: PASS');
